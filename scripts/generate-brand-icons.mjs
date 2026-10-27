import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// One master drawing supplies UI masks, browser icons, and home-screen icons.
const root = new URL("../", import.meta.url);
const lotus = await readFile(new URL("public/images/lotus.svg", root), "utf8");
const css = await readFile(new URL("src/app/globals.css", root), "utf8");
const primary = css.match(/--primary:\s*(#[\da-f]+)/i)?.[1];
if (!primary) throw new Error("Missing primary design token");

const mark = lotus.replace('stroke-width="2"', 'stroke-width="2.8"').replaceAll("currentColor", "#ffffff")
  .replace('width="48" height="48"', 'x="5" y="5" width="54" height="54"');
const browserIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${primary}"/>${mark}</svg>\n`;
await writeFile(new URL("src/app/icon.svg", root), browserIcon);

// Apple applies its own rounded mask; provide a fully opaque square.
const appleIcon = browserIcon.replace('rx="14"', 'rx="0"');
await sharp(Buffer.from(appleIcon)).resize(180, 180).png().toFile(fileURLToPath(new URL("src/app/apple-icon.png", root)));

// PNG-backed ICO frames remain crisp at each browser/desktop scale.
const sizes = [16, 32, 48, 64, 256];
const frames = await Promise.all(sizes.map((size) => sharp(Buffer.from(browserIcon)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] === 256 ? 0 : sizes[index];
  header[entry + 1] = header[entry];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(new URL("src/app/favicon.ico", root), Buffer.concat([header, ...frames]));
console.log("Generated SVG favicon, five ICO sizes, and 180px Apple icon from the shared lotus.");
