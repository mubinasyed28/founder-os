/**
 * Mistral AI API wrapper for Cofoundr OS.
 *
 * Provides:
 * - chatCompletion: conversational AI (onboarding + RAG chat) using mistral-large-latest
 * - generateEmbedding: text → 1024-dim vector using mistral-embed
 * - describeImage: multimodal image → text description using pixtral-12b-latest
 */

let mistralApiKey: string | null = null;

function getApiKey(): string {
  if (mistralApiKey) return mistralApiKey;
  const key = process.env["MISTRAL_API_KEY"];
  if (!key) {
    throw new Error(
      "MISTRAL_API_KEY is not set. Get a key from https://console.mistral.ai/",
    );
  }
  mistralApiKey = key;
  return mistralApiKey;
}

export type ChatMessage = {
  role: "user" | "model";
  text: string;
};

async function postToMistral<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  const response = await fetch(`https://api.mistral.ai/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API Error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ── Chat Completion ──────────────────────────────────────────────────

type MistralChatResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

const CANDIDATE_MODELS = [
  "mistral-small-latest",
  "ministral-8b-latest",
  "open-mistral-7b",
  "ministral-3b-latest",
];

/**
 * Send a conversation to Mistral and get a text response.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  let lastErr: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await postToMistral<MistralChatResponse>("/chat/completions", {
        model,
        messages: formattedMessages,
      });

      const content = result.choices[0]?.message?.content;
      if (content) {
        return content;
      }
    } catch (err) {
      console.warn(`[mistral] Model ${model} failed in chatCompletion:`, err);
      lastErr = err;
    }
  }

  throw lastErr || new Error("All Mistral candidate models failed");
}

/**
 * Send a conversation to Mistral and get a structured JSON response.
 */
export async function chatCompletionJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  responseSchema?: Record<string, unknown>,
): Promise<T> {
  const schemaInstruction = responseSchema 
    ? `\n\nYou MUST return ONLY valid JSON matching this schema: ${JSON.stringify(responseSchema)}`
    : "";

  let lastErr: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await postToMistral<MistralChatResponse>("/chat/completions", {
        model,
        messages: [
          { role: "system", content: systemPrompt + schemaInstruction },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content?.trim();
      if (text) {
        try {
          return JSON.parse(text) as T;
        } catch {
          console.error(`[mistral] Failed to parse JSON from model ${model}:`, text);
        }
      }
    } catch (err) {
      console.warn(`[mistral] Model ${model} failed in chatCompletionJson:`, err);
      lastErr = err;
    }
  }

  throw lastErr || new Error("All Mistral candidate models failed for structured JSON");
}

// ── Embedding Generation ─────────────────────────────────────────────

type MistralEmbeddingResponse = {
  data: {
    embedding: number[];
  }[];
};

/**
 * Generate a 1024-dimensional embedding vector for a text string using mistral-embed.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await postToMistral<MistralEmbeddingResponse>("/embeddings", {
    model: "mistral-embed",
    input: [text],
  });

  const embedding = result.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate embedding from Mistral API");
  }
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
    await new Promise((r) => setTimeout(r, 100)); // Respect rate limits
  }
  return embeddings;
}

// ── Structured Extraction ────────────────────────────────────────────

/**
 * Extract a structured company profile from a conversational transcript.
 */
export async function extractCompanyProfile(
  conversationText: string,
): Promise<Record<string, string>> {
  const systemInstruction = `You are a data extraction agent. Given a conversation between a founder and an AI co-founder, extract a structured company profile.
Return ONLY a valid JSON object. Do not include markdown formatting or explanation.`;

  const schema = {
    companyName: "name of the startup",
    tagline: "one-line description",
    idea: "what they are building and for whom",
    stage: "current stage (idea/pre-seed/seed/series-a etc)",
    problem: "the problem being solved",
    solution: "their solution/approach",
    targetCustomer: "who the customer is",
    businessModel: "how they make/plan to make money",
    currentMetrics: "current traction (users, revenue, etc)",
    team: "team size and background",
    goal90Days: "what success looks like in 90 days",
    hardestConstraint: "biggest bottleneck (money/time/people/knowledge)",
    market: "target market and size if mentioned",
    competitors: "known competitors if mentioned",
    fundingStatus: "current funding status",
    location: "location if mentioned",
  };

  return chatCompletionJson<Record<string, string>>(
    systemInstruction,
    `Conversation:\n${conversationText}`,
    schema,
  );
}

// ── Image Description ─────────────────────────

/**
 * Describe an image using Mistral's pixtral-12b-latest model.
 */
export async function describeImage(
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const prompt = `You are a document analysis assistant for a startup. Describe this image in detail, extracting all visible text, data, charts, diagrams, and key information. 
If this is a pitch deck slide, financial chart, business plan page, or any business document, extract ALL the content including numbers, labels, and relationships.
If this is a screenshot of a product, describe the UI, features visible, and any text shown.
Be thorough — this description will be used as the document's content for search and retrieval.`;

  const result = await postToMistral<MistralChatResponse>("/chat/completions", {
    model: "pixtral-12b-latest",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Pixtral returned an empty response");
  }
  return content;
}

// ── Video Description ──────────────────────────

/**
 * Describe a video by returning a prompt explanation.
 * Video processing is not supported directly by Mistral API.
 */
export async function describeVideo(
  _videoBase64: string,
  _mimeType: string,
): Promise<string> {
  return "Video file uploaded. Video analysis is currently not supported natively by the Mistral AI API. Please upload documents in PDF, DOCX, XLSX, TXT, MD, or image formats (PNG/JPEG).";
}
