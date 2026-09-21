/**
 * RAG Chat API — Server functions for the AI Co-Founder Chat.
 *
 * Pipeline:
 * User Question → Embed Question → Atlas Vector Search / Similarity Search on Chunks
 * → Build Context (Company Profile + Top Chunks) → Mistral Chat Completion
 * → Save Conversation to MongoDB → Return grounded answer with citations.
 */
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import {
  chunksCollection,
  companiesCollection,
  conversationsCollection,
  documentsCollection,
  ensureIndexes,
} from "../lib/db";
import { chatCompletion, generateEmbedding, type ChatMessage } from "../lib/mistral";

// ── Vector Search / Retrieval Helper ─────────────────────────────────

type RetrievedChunk = {
  text: string;
  filename: string;
  score?: number;
};

/**
 * Retrieve top relevant chunks for a user query from MongoDB chunks collection.
 * Uses Atlas Vector Search if available, with a fallback to in-memory cosine similarity
 * or text search for standard MongoDB instances.
 */
async function retrieveContextChunks(
  companyId: string,
  queryEmbedding: number[],
  topK: number = 6,
): Promise<RetrievedChunk[]> {
  const chunkCol = await chunksCollection();

  // 1. Try Atlas Vector Search ($vectorSearch pipeline stage)
  try {
    const vectorSearchResults = await chunkCol
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: topK * 10,
            limit: topK,
            filter: { companyId },
          },
        },
        {
          $project: {
            text: 1,
            "metadata.filename": 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    if (vectorSearchResults.length > 0) {
      return vectorSearchResults.map((doc) => ({
        text: doc["text"],
        filename: doc["metadata"]?.filename || "Uploaded document",
        score: doc["score"],
      }));
    }
  } catch (err) {
    // Atlas Vector Search index might not be created yet, fallback gracefully
    console.warn(
      "[rag] $vectorSearch not available or failed, falling back to manual similarity search:",
      err instanceof Error ? err.message : err,
    );
  }

  // 2. Fallback: retrieve all chunks for this company and calculate cosine similarity in memory
  // (Works cleanly for small-to-medium document stores during dev)
  try {
    const allChunks = await chunkCol
      .find({ companyId })
      .project({ text: 1, embedding: 1, "metadata.filename": 1 })
      .toArray();

    if (allChunks.length === 0) return [];

    // Cosine similarity
    const scored = allChunks
      .map((c) => {
        if (!c["embedding"] || !Array.isArray(c["embedding"])) return null;
        const score = cosineSimilarity(queryEmbedding, c["embedding"]);
        return {
          text: c["text"],
          filename: c["metadata"]?.filename || "Uploaded document",
          score,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  } catch (err) {
    console.error("[rag] Fallback chunk retrieval error:", err);
    return [];
  }
}

/**
 * Cosine similarity between two numerical vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── RAG Chat Endpoint ────────────────────────────────────────────────

export const ragChat = createServerFn({ method: "POST" })
  .validator(
    (data: {
      messages: { role: "user" | "assistant"; text: string }[];
      companyId?: string;
      conversationId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await ensureIndexes();

    const { messages, companyId, conversationId } = data;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUserMessage) {
      throw new Error("No user message provided");
    }

    const steps: string[] = ["Intent: founder consultation"];
    const sources: string[] = [];

    // 1. Fetch Company Profile if available
    let companyProfileText = "Company profile: No profile saved yet.";
    if (companyId) {
      try {
        const compCol = await companiesCollection();
        const companyDoc = await compCol.findOne({ _id: new ObjectId(companyId) });
        if (companyDoc && companyDoc["profile"]) {
          companyProfileText = `Company Profile:\n${JSON.stringify(companyDoc["profile"], null, 2)}`;
          steps.push("Loaded company profile");
        }
      } catch (err) {
        console.warn("[rag] Could not load company profile:", err);
      }
    }

    // 1.5. Fetch Uploaded Documents list if available
    let uploadedDocsText = "### Uploaded Documents in Library\nNo documents uploaded yet.";
    if (companyId) {
      try {
        const docCol = await documentsCollection();
        const docsList = await docCol.find({ companyId }).toArray();
        if (docsList.length > 0) {
          const docEntries = docsList.map(
            (d) => `- Name: ${d["filename"]}, Category: ${d["category"] || "other"}, Status: ${d["status"] || "unknown"}`
          );
          uploadedDocsText = `### Uploaded Documents in Library:\n${docEntries.join("\n")}`;
          steps.push("Loaded uploaded documents inventory list");
        }
      } catch (err) {
        console.warn("[rag] Could not load documents inventory:", err);
      }
    }

    // 2. RAG Retrieval via Query Embedding
    let retrievedChunksText = "";
    if (companyId) {
      try {
        steps.push("Generating query embedding");
        const queryEmbedding = await generateEmbedding(lastUserMessage.text);
        
        steps.push("Retrieving relevant company memory chunks");
        const chunks = await retrieveContextChunks(companyId, queryEmbedding, 6);

        if (chunks.length > 0) {
          steps.push(`Retrieved ${chunks.length} memory chunks`);
          const sourceFiles = new Set<string>();

          retrievedChunksText = chunks
            .map((c, i) => {
              sourceFiles.add(c.filename);
              return `[Source ${i + 1}: ${c.filename}]\n${c.text}`;
            })
            .join("\n\n---\n\n");

          sources.push(...Array.from(sourceFiles));
        } else {
          steps.push("No relevant document chunks found (answering with company profile & general expertise)");
        }
      } catch (err) {
        console.warn("[rag] RAG retrieval failed, falling back to profile-only:", err);
        steps.push("Retrieval fallback active");
      }
    }

    // 3. Construct System Prompt with Grounded Context
    const RAG_SYSTEM_PROMPT = `You are the AI Co-Founder in Cofoundr OS — an expert multi-agent decision engine for early-stage founders.

You have access to the founder's persistent company memory (uploaded pitch decks, financials, meeting notes, blueprints, customer transcripts) and their company profile.

## Grounded Knowledge & Context:

${companyProfileText}

${uploadedDocsText}

## Retrieved Document Chunks (RAG Memory):
${retrievedChunksText || "No document chunks retrieved for this query."}

## Instructions:
1. Ground your answers directly in the founder's company profile and retrieved document chunks whenever possible.
2. Be direct, strategic, practical, and founder-focused. Provide concrete next steps and actionable advice.
3. If citing data from the retrieved documents, refer to the document filenames naturally.
4. If the retrieved documents do not contain enough info to answer fully, answer using your expert startup knowledge and explicitly note what documents might be missing.
5. If the user asks to analyze, summarize, or reference the document they just uploaded (or similar general requests), you MUST analyze and summarize the retrieved documents in the context (such as TSLA-Q2-2026-Update.pdf), even if they seem unrelated to their company profile. Do not refuse, say you cannot access it, or ask the user to upload it again.
6. Keep your tone encouraging, sharp, and concise.`;

    // 4. Generate Response from Mistral
    steps.push("Generating response via Mistral AI");
    const mistralMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      text: m.text,
    }));

    const responseText = await chatCompletion(mistralMessages, RAG_SYSTEM_PROMPT);

    // 5. Save Conversation in MongoDB
    let convId = conversationId;
    try {
      const convCol = await conversationsCollection();
      const updatedMessages = [
        ...messages,
        { role: "assistant" as const, text: responseText, steps, sources },
      ];

      if (convId) {
        await convCol.updateOne(
          { _id: new ObjectId(convId) },
          {
            $set: {
              messages: updatedMessages,
              companyId,
              updatedAt: new Date(),
            },
          },
        );
      } else {
        const result = await convCol.insertOne({
          companyId,
          type: "chat",
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        convId = result.insertedId.toString();
      }
    } catch (err) {
      console.warn("[rag] Failed to persist chat conversation:", err);
    }

    return {
      text: responseText,
      steps,
      sources,
      conversationId: convId,
    };
  });
