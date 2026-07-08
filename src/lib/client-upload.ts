import { MAX_IMAGE_DIMENSION, IMAGE_JPEG_QUALITY, SKIP_CLIENT_RESIZE } from "@/lib/validation";
import type { MediaInput } from "@/lib/services/post";

export interface UploadItem {
  file: File;
  width?: number;
  height?: number;
}

export async function maybeResizeImage(
  file: File,
  width: number,
  height: number,
): Promise<{ file: File; width: number; height: number } | null> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
  if (Math.max(width, height) <= MAX_IMAGE_DIMENSION) return null;
  if (SKIP_CLIENT_RESIZE.includes(file.type)) return null;

  const img = await createImageBitmap(file);
  try {
    let newWidth: number, newHeight: number;
    if (width > height) {
      newWidth = MAX_IMAGE_DIMENSION;
      newHeight = Math.round((height / width) * MAX_IMAGE_DIMENSION);
    } else {
      newHeight = MAX_IMAGE_DIMENSION;
      newWidth = Math.round((width / height) * MAX_IMAGE_DIMENSION);
    }

    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", IMAGE_JPEG_QUALITY / 100),
    );
    if (!blob) return null;
    return { file: new File([blob], file.name, { type: "image/jpeg" }), width: newWidth, height: newHeight };
  } finally {
    img.close();
  }
}

export async function uploadMediaFiles(
  postId: string,
  items: UploadItem[],
): Promise<{ media: MediaInput[]; error: string | null }> {
  if (items.length === 0) return { media: [], error: null };

  const preprocessed = await Promise.all(
    items.map(async (item) => {
      const resized = await maybeResizeImage(item.file, item.width ?? 0, item.height ?? 0);
      return { item, file: item.file, uploadFile: resized?.file ?? item.file, resized };
    }),
  );

  const urlRes = await fetch("/api/upload-url/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId,
      files: preprocessed.map((p) => ({
        fileName: p.file.name,
        contentType: p.file.type,
        size: p.uploadFile.size,
      })),
    }),
  });

  if (!urlRes.ok) {
    const errBody = await urlRes.json().catch(() => ({}));
    if (errBody?.error === "too_many_requests") return { media: [], error: "rate_limited" };
    return { media: [], error: "upload_failed" };
  }

  const { urls } = await urlRes.json();

  const results = await Promise.allSettled(
    preprocessed.map(async ({ item, file, uploadFile, resized }, i) => {
      const { uploadUrl, publicUrl, key } = urls[i];

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("upload_failed");

      let mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
      let width: number | undefined;
      let height: number | undefined;

      if (resized) {
        width = resized.width;
        height = resized.height;
      } else if (file.type.startsWith("image/") && file.type !== "image/gif") {
        try {
          const compressRes = await fetch("/api/compress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          if (compressRes.ok) {
            const comp = await compressRes.json();
            mediaType = comp.mediaType;
            width = comp.width;
            height = comp.height;
          }
        } catch {
          // Compress failed — use raw dimensions if available
        }
      }

      if (width === undefined && item.width) width = item.width;
      if (height === undefined && item.height) height = item.height;

      return { url: publicUrl, type: mediaType, width, height } as MediaInput;
    }),
  );

  const uploaded: MediaInput[] = [];
  let hasError = false;
  for (const result of results) {
    if (result.status === "rejected") {
      hasError = true;
    } else {
      uploaded.push(result.value);
    }
  }

  if (hasError) return { media: uploaded, error: "upload_failed" };

  return { media: uploaded, error: null };
}

export async function cleanupUploadedMedia(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await fetch("/api/upload/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  }).catch(() => {});
}
