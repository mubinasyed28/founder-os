/**
 * Document chunker for Cofoundr OS.
 *
 * Handles text extraction from multiple file types:
 *   PDF, DOCX, XLSX, CSV, TXT, MD  → text extraction
 *   PNG, JPEG                       → Gemini vision description
 *   MP4, MOV                        → Gemini video description
 *
 * Then chunks the extracted text into overlapping segments
 * suitable for embedding and vector search.
 */
import { describeImage, describeVideo } from "./mistral";

// ── File type detection ──────────────────────────────────────────────

export type SupportedFileType =
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "txt"
  | "md"
  | "png"
  | "jpeg"
  | "jpg"
  | "mp4"
  | "mov";

const MIME_MAP: Record<string, SupportedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function detectFileType(
  filename: string,
  mimeType?: string,
): SupportedFileType | null {
  // Try MIME type first
  if (mimeType && MIME_MAP[mimeType]) {
    return MIME_MAP[mimeType]!;
  }
  // Fall back to extension
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && isSupported(ext)) {
    return ext as SupportedFileType;
  }
  return null;
}

function isSupported(ext: string): ext is SupportedFileType {
  return [
    "pdf",
    "docx",
    "xlsx",
    "csv",
    "txt",
    "md",
    "png",
    "jpeg",
    "jpg",
    "mp4",
    "mov",
  ].includes(ext);
}

// ── Text extraction by file type ─────────────────────────────────────

/**
 * Extract text content from a file buffer based on its type.
 */
export async function extractText(
  buffer: Buffer,
  fileType: SupportedFileType,
  mimeType?: string,
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
      return extractXlsx(buffer);
    case "csv":
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    case "png":
    case "jpeg":
    case "jpg":
      return extractImageText(buffer, mimeType || `image/${fileType}`);
    case "mp4":
    case "mov":
      return extractVideoText(
        buffer,
        mimeType || (fileType === "mp4" ? "video/mp4" : "video/quicktime"),
      );
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdfParseMod = await import("pdf-parse");
  // @ts-expect-error pdf-parse CJS/ESM interop
  const pdfParse = pdfParseMod.default || pdfParseMod;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const texts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    texts.push(`--- Sheet: ${sheetName} ---`);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    texts.push(csv);
  }
  return texts.join("\n\n");
}

async function extractImageText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const base64 = buffer.toString("base64");
  return describeImage(base64, mimeType);
}

async function extractVideoText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  // Check file size — Gemini free tier has limits (~20MB for inline data)
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > 20) {
    return `[Video file too large for processing: ${sizeMB.toFixed(1)}MB. Maximum supported size is 20MB on the free tier. Please upload a shorter or compressed version.]`;
  }
  const base64 = buffer.toString("base64");
  return describeVideo(base64, mimeType);
}

// ── Text chunking ────────────────────────────────────────────────────

export type TextChunk = {
  text: string;
  index: number;
  metadata: {
    startChar: number;
    endChar: number;
  };
};

/**
 * Split text into overlapping chunks suitable for embedding.
 *
 * @param text      - The full text to chunk.
 * @param maxChars  - Maximum characters per chunk (~512 tokens ≈ 2048 chars).
 * @param overlap   - Character overlap between consecutive chunks.
 * @returns Array of text chunks with metadata.
 */
export function chunkText(
  text: string,
  maxChars: number = 1500,
  overlap: number = 200,
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  // Clean up the text
  const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length <= maxChars) {
    return [
      {
        text: cleaned,
        index: 0,
        metadata: { startChar: 0, endChar: cleaned.length },
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);

    // Try to break at a paragraph or sentence boundary
    if (end < cleaned.length) {
      // Look for paragraph break
      const paraBreak = cleaned.lastIndexOf("\n\n", end);
      if (paraBreak > start + maxChars * 0.5) {
        end = paraBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = cleaned.lastIndexOf(". ", end);
        if (sentenceBreak > start + maxChars * 0.5) {
          end = sentenceBreak + 2;
        }
      }
    }

    chunks.push({
      text: cleaned.slice(start, end).trim(),
      index,
      metadata: { startChar: start, endChar: end },
    });

    // Move start forward, accounting for overlap
    start = end - overlap;
    if (start >= cleaned.length) break;
    index++;
  }

  return chunks;
}

/**
 * Full document processing pipeline:
 * File buffer → text extraction → chunking → ready for embedding.
 */
export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<{ text: string; chunks: TextChunk[]; fileType: SupportedFileType }> {
  const fileType = detectFileType(filename, mimeType);
  if (!fileType) {
    throw new Error(
      `Unsupported file type: ${filename}. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, PNG, JPEG, MP4, MOV`,
    );
  }

  const text = await extractText(buffer, fileType, mimeType);
  const chunks = chunkText(text);

  return { text, chunks, fileType };
}
