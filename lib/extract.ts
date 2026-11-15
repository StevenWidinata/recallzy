import "server-only";
import mammoth from "mammoth";
import JSZip from "jszip";

/** Pulls the plain text out of a Word (.docx) file. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

/** Pulls the text out of each slide of a PowerPoint (.pptx) file, in slide order. */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .map((path) => ({ path, num: Number(path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter((s) => Number.isFinite(s.num))
    .sort((a, b) => a.num - b.num);

  const parts: string[] = [];
  for (const slide of slides) {
    const xml = await zip.files[slide.path].async("string");
    // Each paragraph is <a:p>…</a:p>; text runs inside are <a:t>…</a:t>.
    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length) parts.push(`Slide ${slide.num}:\n${paragraphs.join("\n")}`);
  }
  return parts.join("\n\n");
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}
