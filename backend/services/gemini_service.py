import json
import logging
from typing import Dict, Any, List
from backend.config import settings

logger = logging.getLogger(__name__)

YC_PARTNER_SYSTEM_PROMPT = """You are an elite YC Partner and experienced serial co-founder acting as the AI Co-Founder in Cofoundr OS.

Your mission:
Understand the founder's startup deeply through a natural, unscripted conversation. Build and refine their structured Company Profile in real-time.

## CRITICAL PRIORITY FRAMEWORK FOR CONVERSATION
Never follow a fixed questionnaire or rigid script. Use this priority hierarchy to guide what you ask next based on what is currently missing in the Company Profile:

LEVEL 1 — BASIC UNDERSTANDING (HIGHEST PRIORITY - Must be satisfied first)
- company_name: Name of the company
- product: What the product actually is and does
- industry: Industry / domain
- problem_statement: Pain point being solved
- target_customer: Who the product is specifically for (ICP)
- solution: How the product solves the problem

LEVEL 2 — STARTUP CONTEXT (Ask after Level 1 is clear)
- current_stage: Idea / MVP / Beta / Revenue / Scaling
- validation_done & validation_details / survey_details / customer_interviews: User research, surveys, interviews done
- team_size & founders: Founders and team
- traction: Key metrics, users, revenue
- competitors: Direct or indirect competitors

LEVEL 3 — BUSINESS MODEL (Ask after Level 2 context is clear)
- business_model & revenue_model: Monetization model, pricing, distribution
- website & location: Company URL and headquarters location

LEVEL 4 — STRATEGIC CONTEXT (Ask only when startup is well understood)
- current_challenges: Hardest constraint / bottleneck right now
- short_term_goals: 90-day priorities / key quarterly goals
- long_term_vision: Big vision for the next 3-5 years

## STRICT BEHAVIORAL RULES:
1. ACKNOWLEDGE BEFORE ASKING: Always acknowledge what the founder said naturally in 1 warm, intelligent sentence before asking your follow-up.
   - Example: "Nice name — Nexora. What exactly are you building?"
   - Example: "Got it — an AI travel planner for college students. What problem are you solving for them that existing travel apps miss?"
2. DO NOT ASK LOW-VALUE / ADVANCED QUESTIONS TOO EARLY:
   - If you only know company_name="Nexora", DO NOT ask about funding, 90-day goals, revenue, or constraints! Ask what Nexora does!
   - If industry is known but product is vague (e.g. "travel startup"), probe to clarify the exact product (e.g. "Is it a booking tool, AI itinerary planner, or something else?").
3. HANDLE CORRECTIONS SEAMLESSLY:
   - If founder changes or refines previous info (e.g., "travel startup" -> "AI travel planner SaaS" or "targeting everyone" -> "international college students"), update that field in `profile_updates` with the new accurate value. Never create duplicate contradictory facts.
4. SPECIAL CASE - IF FOUNDER ASKS "WHAT DID YOU UNDERSTAND?":
   - If founder asks "What did you understand?", "Summarize what you know", "Tell me what you've understood so far", DO NOT ask another onboarding question!
   - Respond with a clear bulleted summary of all known profile attributes, note 2-3 key missing areas, and optionally ask ONE relevant follow-up question.
5. HANDLE MULTIPLE INFORMATION IN ONE TURN:
   - If founder gives multiple details (e.g., name, product, stage, survey count), extract ALL of them into `profile_updates` in this single turn. Do NOT ask about any detail already provided!
6. ANTI-HALLUCINATION:
   - NEVER invent or assume facts. Only extract information explicitly supported by the conversation. Keep unknown fields empty or null.
7. TONE: Sharp, direct, warm, experienced YC partner during office hours. Concise (2-4 sentences max).

## JSON RESPONSE SCHEMA REQUIREMENT:
You MUST return ONLY valid JSON matching this exact structure:
{
  "assistant_reply": "Your natural conversational reply to the founder",
  "profile_updates": {
    "company_name": "...",
    "one_line_pitch": "...",
    "description": "...",
    "industry": "...",
    "problem_statement": "...",
    "solution": "...",
    "product": "...",
    "target_customer": "...",
    "business_model": "...",
    "revenue_model": "...",
    "current_stage": "...",
    "team_size": "...",
    "founders": ["..."],
    "location": "...",
    "website": "...",
    "current_progress": "...",
    "validation_done": true,
    "validation_details": "...",
    "customer_interviews": "...",
    "survey_details": "...",
    "traction": "...",
    "competitors": ["..."],
    "current_challenges": ["..."],
    "short_term_goals": ["..."],
    "long_term_vision": "..."
  },
  "known_information": ["company_name"],
  "missing_information": ["product", "problem_statement"],
  "next_focus": "Understand what the product does",
  "confidence": 25
}
"""

ONBOARDING_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "assistant_reply": {"type": "string", "description": "Natural conversational response to the founder"},
        "profile_updates": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "one_line_pitch": {"type": "string"},
                "description": {"type": "string"},
                "industry": {"type": "string"},
                "problem_statement": {"type": "string"},
                "solution": {"type": "string"},
                "product": {"type": "string"},
                "target_customer": {"type": "string"},
                "business_model": {"type": "string"},
                "revenue_model": {"type": "string"},
                "current_stage": {"type": "string"},
                "team_size": {"type": "string"},
                "founders": {"type": "array", "items": {"type": "string"}},
                "location": {"type": "string"},
                "website": {"type": "string"},
                "current_progress": {"type": "string"},
                "validation_done": {"type": "boolean"},
                "validation_details": {"type": "string"},
                "customer_interviews": {"type": "string"},
                "survey_details": {"type": "string"},
                "traction": {"type": "string"},
                "competitors": {"type": "array", "items": {"type": "string"}},
                "current_challenges": {"type": "array", "items": {"type": "string"}},
                "short_term_goals": {"type": "array", "items": {"type": "string"}},
                "long_term_vision": {"type": "string"},
            },
        },
        "known_information": {"type": "array", "items": {"type": "string"}},
        "missing_information": {"type": "array", "items": {"type": "string"}},
        "next_focus": {"type": "string"},
        "confidence": {"type": "integer"},
    },
    "required": ["assistant_reply", "profile_updates", "known_information", "missing_information", "next_focus", "confidence"],
}

def calculate_completeness(profile: Dict[str, Any]) -> int:
    """Calculates weighted completeness score (0-100%).
    Core Level 1 fields (7 fields): weight 8 each (total 56%)
    Secondary Level 2-4 fields (11 fields): weight 4 each (total 44%)
    """
    core_fields = [
        "company_name", "product", "problem_statement", "solution",
        "target_customer", "industry", "current_stage"
    ]
    secondary_fields = [
        "one_line_pitch", "description", "business_model", "revenue_model",
        "team_size", "location", "website", "validation_details",
        "customer_interviews", "survey_details", "traction", "long_term_vision"
    ]
    
    score = 0
    for cf in core_fields:
        val = profile.get(cf)
        if val and str(val).strip():
            score += 8
            
    for sf in secondary_fields:
        val = profile.get(sf)
        if val and str(val).strip():
            score += 4
            
    if profile.get("validation_done"):
        score += 4
    if profile.get("founders"):
        score += 4
    if profile.get("competitors"):
        score += 4

    return min(100, score)

import asyncio
import urllib.request
import urllib.error

async def process_conversational_turn(
    messages: List[Dict[str, str]],
    current_profile: Dict[str, Any]
) -> Dict[str, Any]:
    apiKey = settings.MISTRAL_API_KEY

    if apiKey:
        try:
            transcript = []
            for m in messages:
                role_label = "FOUNDER" if m["role"] == "user" else "AI CO-FOUNDER"
                transcript.append(f"{role_label}: {m['content']}")
            
            transcript_str = "\n\n".join(transcript)

            full_prompt = (
                f"Full Conversation Transcript:\n{transcript_str}\n\n"
                f"Current Known Profile State:\n{json.dumps(current_profile, indent=2)}\n\n"
                f"Analyze the latest message, generate your conversational reply, and extract any updated profile fields."
            )

            # Define the call to Mistral API
            def call_mistral():
                payload = {
                    "model": "mistral-large-latest",
                    "messages": [
                        {
                            "role": "system",
                            "content": YC_PARTNER_SYSTEM_PROMPT + f"\n\nYou MUST return ONLY valid JSON matching this schema:\n{json.dumps(ONBOARDING_RESPONSE_SCHEMA, indent=2)}"
                        },
                        {
                            "role": "user",
                            "content": full_prompt
                        }
                    ],
                    "response_format": {
                        "type": "json_object"
                    }
                }
                
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {apiKey}"
                }
                
                req = urllib.request.Request(
                    "https://api.mistral.ai/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                
                with urllib.request.urlopen(req, timeout=30) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    content = resp_json["choices"][0]["message"]["content"]
                    return json.loads(content.strip())

            # Execute the synchronous HTTP call in a thread pool to avoid blocking the event loop
            parsed = await asyncio.to_thread(call_mistral)
            return parsed
            
        except Exception as e:
            logger.warning(f"[mistral] Mistral API processing error: {e}. Using smart priority fallback engine.")

    # Smart Fallback Engine (when API key is missing or network fails)
    return _smart_fallback_engine(messages, current_profile)

def _smart_fallback_engine(messages: List[Dict[str, str]], current_profile: Dict[str, Any]) -> Dict[str, Any]:
    last_user_msg = messages[-1]["content"].strip() if messages else ""
    last_lower = last_user_msg.lower()
    
    profile_updates = {}
    
    # Check for summary request
    if any(q in last_lower for q in ["what did you understand", "summarize", "what do you know", "tell me what you've understood"]):
        known_summary = []
        if current_profile.get("company_name"): known_summary.append(f"• Company: {current_profile['company_name']}")
        if current_profile.get("industry"): known_summary.append(f"• Industry: {current_profile['industry']}")
        if current_profile.get("product"): known_summary.append(f"• Product: {current_profile['product']}")
        if current_profile.get("target_customer"): known_summary.append(f"• Target Users: {current_profile['target_customer']}")
        if current_profile.get("current_stage"): known_summary.append(f"• Stage: {current_profile['current_stage']}")
        if current_profile.get("validation_done"): known_summary.append(f"• Validation: Done ({current_profile.get('survey_details', 'User research')})")

        if not known_summary:
            reply = "I haven't captured details about your startup yet. What are you building?"
        else:
            summary_str = "\n".join(known_summary)
            reply = f"Here's what I've understood so far:\n\n{summary_str}\n\nI'm ready to learn more about your business model or current validation!"

        return {
            "assistant_reply": reply,
            "profile_updates": {},
            "known_information": [k for k, v in current_profile.items() if v],
            "missing_information": ["business_model", "validation_details", "revenue_model"],
            "next_focus": "Summarized current knowledge",
            "confidence": calculate_completeness(current_profile)
        }

    # Extract updates based on rules
    if not current_profile.get("company_name"):
        if "is an " in last_lower:
            parts = last_user_msg.split(" is an ")
            profile_updates["company_name"] = parts[0].strip().title()
        elif "is a " in last_lower:
            parts = last_user_msg.split(" is a ")
            profile_updates["company_name"] = parts[0].strip().title()
        elif "building" in last_lower or len(last_user_msg.split()) <= 4:
            profile_updates["company_name"] = last_user_msg.replace("I'm building", "").replace("It's", "").strip().title()
    
    if "travel" in last_lower and not current_profile.get("industry"):
        profile_updates["industry"] = "Travel Tech"
    
    if "ai travel planner" in last_lower or "travel planner" in last_lower:
        profile_updates["product"] = "AI Travel Planner"
        profile_updates["industry"] = "Travel Tech / SaaS"

    if "student" in last_lower or "college" in last_lower:
        if "international" in last_lower:
            profile_updates["target_customer"] = "International college students"
        else:
            profile_updates["target_customer"] = "College students on a budget"

    if "mvp" in last_lower:
        profile_updates["current_stage"] = "MVP"
    
    if "surveyed" in last_lower or "survey" in last_lower:
        profile_updates["validation_done"] = True
        profile_updates["survey_details"] = last_user_msg

    merged = {**current_profile, **profile_updates}
    
    # Priority-based reply selection
    if not merged.get("company_name"):
        reply = "What startup or product are you building, and who is it for?"
    elif not merged.get("product"):
        reply = f"Nice name — {merged['company_name']}. What exactly are you building?"
    elif not merged.get("target_customer"):
        reply = f"Got it — an {merged.get('product', 'product')}. Who are you building it for specifically?"
    elif not merged.get("problem_statement"):
        reply = f"Understood. What core problem are you solving for {merged.get('target_customer', 'your users')} that existing alternatives miss?"
    elif not merged.get("current_stage"):
        reply = "How far along are you right now — idea phase, building an MVP, or already testing with live users?"
    else:
        reply = "Got it! What is your primary monetization model or revenue strategy?"

    score = calculate_completeness(merged)
    missing = [k for k in ["product", "problem_statement", "target_customer", "current_stage", "business_model"] if not merged.get(k)]

    return {
        "assistant_reply": reply,
        "profile_updates": profile_updates,
        "known_information": [k for k, v in merged.items() if v],
        "missing_information": missing,
        "next_focus": f"Learn about {missing[0] if missing else 'strategy'}",
        "confidence": score
    }

