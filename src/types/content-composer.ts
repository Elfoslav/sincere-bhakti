export type ContentKind = "post" | "article" | "album";

export interface PostingChannel {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ComposerFormState {
  onDirtyChange?: (dirty: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export interface ComposerMediaItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl?: string;
  type: string;
  width?: number;
  height?: number;
}
