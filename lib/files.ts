/** File-type helpers shared by the browser (upload page) and the server (generation). */

export type MaterialKind = "pdf" | "image" | "docx" | "pptx";

const EXTENSION_KINDS: Record<string, MaterialKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  heic: "image",
  heif: "image",
  docx: "docx",
  pptx: "pptx",
};

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export const ACCEPTED_FILE_TYPES = Object.keys(EXTENSION_KINDS)
  .map((ext) => `.${ext}`)
  .join(",");

export function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Returns the material kind for a filename, or null if Recallzy can't read it. */
export function kindOf(name: string): MaterialKind | null {
  return EXTENSION_KINDS[extensionOf(name)] ?? null;
}

/** MIME type Gemini expects for files sent directly (PDF and images). */
export function geminiMimeOf(name: string): string | null {
  const ext = extensionOf(name);
  if (ext === "pdf") return "application/pdf";
  return IMAGE_MIME[ext] ?? null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
