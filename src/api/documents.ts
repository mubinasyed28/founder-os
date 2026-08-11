/**
 * Documents API — Server functions for document upload, processing, and embedding.
 *
 * Pipeline: Upload → Extract text → Chunk → Embed → Store in MongoDB.
 */
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import {
  documentsCollection,
  chunksCollection,
  ensureIndexes,
} from "../lib/db";
import { generateEmbedding } from "../lib/mistral";
import { processDocument } from "../lib/chunker";

// ── Upload & Process Document ────────────────────────────────────────

export const uploadDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      filename: string;
      fileBase64: string;
      mimeType: string;
      companyId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await ensureIndexes();

    const { filename, fileBase64, mimeType, companyId } = data;

    // Convert base64 to buffer
    const buffer = Buffer.from(fileBase64, "base64");
    const fileSizeBytes = buffer.length;

    // Create document record first (status: processing)
    const docCol = await documentsCollection();
    const docResult = await docCol.insertOne({
      companyId,
      filename,
      mimeType,
      fileSizeBytes,
      chunkCount: 0,
      status: "processing",
      uploadedAt: new Date(),
    });
    const documentId = docResult.insertedId.toString();

    try {
      // Extract text and chunk
      const { text, chunks, fileType } = await processDocument(
        buffer,
        filename,
        mimeType,
      );

      // Generate embeddings and store chunks
      const chunkCol = await chunksCollection();
      let storedChunks = 0;

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);

        await chunkCol.insertOne({
          documentId,
          companyId,
          text: chunk.text,
          embedding,
          chunkIndex: chunk.index,
          metadata: {
            ...chunk.metadata,
            filename,
            fileType,
          },
          createdAt: new Date(),
        });

        storedChunks++;
      }

      // Update document status to indexed
      await docCol.updateOne(
        { _id: new ObjectId(documentId) },
        {
          $set: {
            status: "indexed",
            chunkCount: storedChunks,
            extractedTextLength: text.length,
            processedAt: new Date(),
          },
        },
      );

      return {
        documentId,
        filename,
        chunkCount: storedChunks,
        status: "indexed" as const,
      };
    } catch (error) {
      // Update document status to failed
      await docCol.updateOne(
        { _id: new ObjectId(documentId) },
        {
          $set: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      );

      throw error;
    }
  });

// ── List Documents ───────────────────────────────────────────────────

export const listDocuments = createServerFn({ method: "GET" })
  .validator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    await ensureIndexes();

    const docCol = await documentsCollection();
    const docs = await docCol
      .find({ companyId: data.companyId })
      .sort({ uploadedAt: -1 })
      .toArray();

    return docs.map((d) => ({
      id: d._id.toString(),
      filename: d["filename"] as string,
      mimeType: d["mimeType"] as string,
      fileSizeBytes: d["fileSizeBytes"] as number,
      chunkCount: d["chunkCount"] as number,
      status: d["status"] as string,
      uploadedAt: d["uploadedAt"] as Date,
    }));
  });

// ── Delete Document ──────────────────────────────────────────────────

export const deleteDocument = createServerFn({ method: "POST" })
  .validator((data: { documentId: string; companyId: string }) => data)
  .handler(async ({ data }) => {
    const docCol = await documentsCollection();
    const chunkCol = await chunksCollection();

    // Delete all chunks for this document
    await chunkCol.deleteMany({
      documentId: data.documentId,
      companyId: data.companyId,
    });

    // Delete the document record
    await docCol.deleteOne({ _id: new ObjectId(data.documentId) });

    return { success: true };
  });

// ── Get Document Stats ───────────────────────────────────────────────

export const getDocumentStats = createServerFn({ method: "GET" })
  .validator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    await ensureIndexes();

    const docCol = await documentsCollection();
    const chunkCol = await chunksCollection();

    const totalDocs = await docCol.countDocuments({
      companyId: data.companyId,
    });
    const indexedDocs = await docCol.countDocuments({
      companyId: data.companyId,
      status: "indexed",
    });
    const totalChunks = await chunkCol.countDocuments({
      companyId: data.companyId,
    });

    return {
      totalDocuments: totalDocs,
      indexedDocuments: indexedDocs,
      totalChunks,
    };
  });
