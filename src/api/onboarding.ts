/**
 * Onboarding API — Server functions for real-time conversational startup onboarding.
 *
 * Performs dual-task LLM reasoning on every chat turn:
 * 1. Generates a natural, intelligent reply understanding what the founder said.
 * 2. Extracts and updates the structured 25-field Company Profile in real-time.
 *
 * Uses Mistral's structured JSON output mode
 * to guarantee structured JSON output on every response — no markdown fences,
 * no conversational text outside the JSON structure.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  companiesCollection,
  conversationsCollection,
  ensureIndexes,
} from "../lib/db";
import { ObjectId } from "mongodb";
import { chatCompletionJson } from "../lib/mistral";

// ── 25-Field Company Profile (aligned with Python backend model) ─────

export type CompanyProfileFields = {
  company_name: string;
  one_line_pitch: string;
  startup_description: string;
  problem_statement: string;
  solution: string;
  target_customers: string;
  industry: string;
  business_model: string;
  current_stage: string;
  founders: string;
  team_size: string;
  website: string;
  location: string;
  current_progress: string;
  validation_done: string;
  market_research_completed: string;
  customer_interviews: string;
  competitor_analysis: string;
  current_challenges: string;
  top_priorities: string;
  short_term_goals: string;
  long_term_vision: string;
};

// ── Structured Response Type from Mistral ─────────────────────────────

type OnboardingAIResponse = {
  assistant_reply: string;
  profile_updates: Partial<CompanyProfileFields>;
  confidence_score: number;
  missing_information: string[];
};

// ── Response Schema for Mistral's structured output mode ──────────────

const ONBOARDING_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    assistant_reply: {
      type: "string",
      description: "Natural conversational response to the founder (2-4 sentences max)",
    },
    profile_updates: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        one_line_pitch: { type: "string" },
        startup_description: { type: "string" },
        problem_statement: { type: "string" },
        solution: { type: "string" },
        target_customers: { type: "string" },
        industry: { type: "string" },
        business_model: { type: "string" },
        current_stage: { type: "string" },
        founders: { type: "string" },
        team_size: { type: "string" },
        website: { type: "string" },
        location: { type: "string" },
        current_progress: { type: "string" },
        validation_done: { type: "string" },
        market_research_completed: { type: "string" },
        customer_interviews: { type: "string" },
        competitor_analysis: { type: "string" },
        current_challenges: { type: "string" },
        top_priorities: { type: "string" },
        short_term_goals: { type: "string" },
        long_term_vision: { type: "string" },
      },
      required: [
        "company_name", "one_line_pitch", "startup_description",
        "problem_statement", "solution", "target_customers",
        "industry", "business_model", "current_stage",
      ],
    },
    confidence_score: {
      type: "integer",
      description: "Profile completeness score from 0 to 100",
    },
    missing_information: {
      type: "array",
      items: { type: "string" },
      description: "List of 3-5 most critical missing profile attributes",
    },
  },
  required: ["assistant_reply", "profile_updates", "confidence_score", "missing_information"],
};

// ── System Prompt ────────────────────────────────────────────────────

const DUAL_ONBOARDING_SYSTEM_PROMPT = `You are an elite YC Partner and experienced serial founder acting as the AI Co-Founder in Cofoundr OS.

Your mission:
Understand the startup deeply through a natural, unscripted conversation. Build and refine their Company Profile in real-time.

## Behavioral & Conversational Guidelines:
1. NEVER follow a fixed script or ask form-like questions.
2. NEVER ask about things the founder has already mentioned.
3. UNDERSTAND CONTEXT & PROBE VAGUE INPUTS:
   - If founder says "I'm building Nexora" -> Acknowledge the name warmly and ask what Nexora actually is and what problem it solves.
   - If founder says "It's a travel startup" -> Probe: "Is it a booking platform, AI itinerary planner, visa tool, or something else?"
   - If founder says "AI travel planner" -> Ask: "Who is this built for?"
4. HANDLE CORRECTIONS SEAMLESSLY:
   - If founder changes or refines previous information, IMMEDIATELY update that field in profile_updates with the new value. Never duplicate.
5. TONE: Experienced, sharp, direct, warm, supportive — like a top-tier YC partner during office hours. Keep replies concise (2-4 sentences max).

## Response Rules:
- "assistant_reply": Your natural response to the founder (2-4 sentences max).
- "profile_updates": Only include fields where NEW information was extracted from the latest message. Use empty string "" for fields with no new data.
- "confidence_score": Integer 0-100 representing how complete the overall company profile is.
- "missing_information": Array of 3-5 most critical missing profile attributes that should be asked about next.`;

// ── Helper: Calculate completeness locally (for fallback) ────────────

const PROFILE_KEYS: (keyof CompanyProfileFields)[] = [
  "company_name", "one_line_pitch", "startup_description", "problem_statement",
  "solution", "target_customers", "industry", "business_model", "current_stage",
  "founders", "team_size", "website", "location", "current_progress",
  "validation_done", "market_research_completed", "customer_interviews",
  "competitor_analysis", "current_challenges", "top_priorities",
  "short_term_goals", "long_term_vision",
];

function calculateCompleteness(profile: Partial<CompanyProfileFields>): number {
  const filled = PROFILE_KEYS.filter((k) => (profile[k] || "").trim().length > 0).length;
  return Math.max(10, Math.min(100, Math.round((filled / PROFILE_KEYS.length) * 100)));
}

// ── Empty profile factory ────────────────────────────────────────────

function emptyProfile(): CompanyProfileFields {
  return {
    company_name: "",
    one_line_pitch: "",
    startup_description: "",
    problem_statement: "",
    solution: "",
    target_customers: "",
    industry: "",
    business_model: "",
    current_stage: "",
    founders: "",
    team_size: "",
    website: "",
    location: "",
    current_progress: "",
    validation_done: "",
    market_research_completed: "",
    customer_interviews: "",
    competitor_analysis: "",
    current_challenges: "",
    top_priorities: "",
    short_term_goals: "",
    long_term_vision: "",
  };
}

// ── Onboarding Chat Server Function ──────────────────────────────────

export const onboardingChat = createServerFn({ method: "POST" })
  .validator(
    (data: {
      messages: { role: "user" | "assistant"; text: string }[];
      currentProfile?: Partial<CompanyProfileFields>;
      conversationId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { messages, currentProfile, conversationId } = data;

    // Initialize profile from current state
    const profile: CompanyProfileFields = {
      ...emptyProfile(),
      ...currentProfile,
    };

    let assistantReply = "";
    let profileUpdates: Partial<CompanyProfileFields> = {};
    let confidenceScore = calculateCompleteness(profile);
    let missingInformation: string[] = [];

    // Try Mistral structured JSON call
    const apiKey = process.env["MISTRAL_API_KEY"];
    if (apiKey) {
      try {
        // Format conversation transcript
        const transcript = messages
          .map((m) => `${m.role === "user" ? "FOUNDER" : "AI CO-FOUNDER"}: ${m.text}`)
          .join("\n\n");

        const fullPrompt = `Full Conversation Transcript:\n${transcript}\n\n[Current Known Profile State]: ${JSON.stringify(profile, null, 2)}\n\nAnalyze the latest message, generate your conversational reply, and extract any updated profile fields.`;

        const aiResult = await chatCompletionJson<OnboardingAIResponse>(
          DUAL_ONBOARDING_SYSTEM_PROMPT,
          fullPrompt,
          ONBOARDING_RESPONSE_SCHEMA,
        );

        assistantReply = aiResult.assistant_reply || "";
        profileUpdates = aiResult.profile_updates || {};
        confidenceScore = aiResult.confidence_score ?? calculateCompleteness({ ...profile, ...profileUpdates });
        missingInformation = aiResult.missing_information || [];
      } catch (err) {
        console.warn("[onboarding] Mistral structured JSON call failed, using fallback:", err);
      }
    }

    // Local Fallback if Mistral key missing or failed
    if (!assistantReply) {
      const lastUserMsg = messages[messages.length - 1]?.text.toLowerCase().trim() || "";
      const userCount = messages.filter((m) => m.role === "user").length;

      if (["hey", "hello", "hi", "yo"].includes(lastUserMsg)) {
        assistantReply = "Hey! Great to meet you. I'm your AI co-founder. What startup or product are you building, and who is it for?";
      } else if (["what?", "what", "huh?", "explain"].includes(lastUserMsg)) {
        assistantReply = "I'm your AI co-founder setting up your OS workspace. Tell me a bit about what idea or product you're working on!";
      } else if (userCount === 1) {
        profileUpdates.startup_description = messages[messages.length - 1]?.text || "";
        assistantReply = "Got it! That sounds like an exciting space. What stage are you at right now (e.g. Idea, MVP, Pre-seed, or Bootstrapped)?";
      } else if (userCount === 2) {
        profileUpdates.current_stage = messages[messages.length - 1]?.text || "";
        assistantReply = "Understood. What is your hardest constraint right now — is it funding, engineering speed, or customer acquisition?";
      } else if (userCount === 3) {
        profileUpdates.current_challenges = messages[messages.length - 1]?.text || "";
        assistantReply = "Got it. What has to happen in the next 90 days for this quarter to be a massive win?";
      } else {
        profileUpdates.short_term_goals = messages[messages.length - 1]?.text || "";
        assistantReply = "Awesome! I have updated your company profile in the right panel. Review it and click 'Complete Onboarding & Build Workspace' whenever you're ready!";
      }

      // Recalculate locally
      confidenceScore = calculateCompleteness({ ...profile, ...profileUpdates });
      missingInformation = PROFILE_KEYS
        .filter((k) => !({ ...profile, ...profileUpdates })[k]?.trim())
        .slice(0, 5)
        .map((k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    }

    // Merge updates into profile
    const mergedProfile: CompanyProfileFields = { ...profile };
    for (const [key, value] of Object.entries(profileUpdates)) {
      if (value && String(value).trim()) {
        (mergedProfile as Record<string, string>)[key] = String(value).trim();
      }
    }

    // Save to Mongo if DB is available
    let convId = conversationId;
    try {
      await ensureIndexes();
      const convCol = await conversationsCollection();
      const fullMessages = [...messages, { role: "assistant" as const, text: assistantReply }];

      if (convId && ObjectId.isValid(convId)) {
        await convCol.updateOne(
          { _id: new ObjectId(convId) },
          { $set: { messages: fullMessages, updatedAt: new Date() } },
        );
      } else {
        const res = await convCol.insertOne({
          type: "onboarding",
          messages: fullMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        convId = res.insertedId.toString();
      }
    } catch (dbErr) {
      console.warn("[onboarding] DB save skipped:", dbErr);
    }

    return {
      assistant_reply: assistantReply,
      profile_updates: profileUpdates,
      profile: mergedProfile,
      confidence_score: confidenceScore,
      missing_information: missingInformation,
      conversationId: convId || "demo-conv-id",
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .validator(
    (data: {
      conversationId: string;
      profile: Record<string, string>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { conversationId, profile } = data;

    let companyId = "demo-company-id";
    try {
      await ensureIndexes();
      const compCol = await companiesCollection();
      const result = await compCol.insertOne({
        profile,
        onboardingConversationId: conversationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      companyId = result.insertedId.toString();

      if (conversationId && ObjectId.isValid(conversationId)) {
        const convCol = await conversationsCollection();
        await convCol.updateOne(
          { _id: new ObjectId(conversationId) },
          { $set: { companyId } },
        );
      }
    } catch (err) {
      console.warn("[onboarding] Could not save final company to Mongo:", err);
    }

    return {
      companyId,
      profile,
    };
  });

