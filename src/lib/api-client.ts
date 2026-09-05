/**
 * API Client for FastAPI Backend (http://localhost:8000/api)
 */

// Base API URL: Defaults to "/api" (local Vite proxy), or uses VITE_API_URL if connecting to Render/remote deployment
const rawApiUrl = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL;
const API_BASE_URL = rawApiUrl
  ? (rawApiUrl.endsWith("/api") ? rawApiUrl.replace(/\/$/, "") : `${rawApiUrl.replace(/\/$/, "")}/api`)
  : "/api";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cofoundr_token");
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("cofoundr_token", token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cofoundr_token");
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "API Request failed";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  return response.json();
}

// ── Auth Endpoints ───────────────────────────────────────────────────

export async function loginApi(username_or_email: string, password: string): Promise<{ access_token: string; user: any }> {
  const res = await apiRequest<{ access_token: string; user: any }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username_or_email, password }),
  });
  if (res.access_token) {
    setAuthToken(res.access_token);
  }
  return res;
}

export async function signupApi(email: string, username: string, password: string): Promise<{ access_token: string; user: any }> {
  const res = await apiRequest<{ access_token: string; user: any }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
  if (res.access_token) {
    setAuthToken(res.access_token);
  }
  return res;
}

export async function getMeApi(): Promise<any> {
  return apiRequest("/auth/me");
}

// ── Onboarding Endpoints ─────────────────────────────────────────────

export async function getProfileApi(): Promise<any> {
  return apiRequest("/onboarding/profile");
}

export async function updateProfileApi(updates: Record<string, any>): Promise<any> {
  return apiRequest("/onboarding/profile", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function getHistoryApi(): Promise<{ messages: { role: string; content: string; timestamp?: string }[] }> {
  return apiRequest("/onboarding/history");
}

export async function sendOnboardingChatApi(message: string): Promise<{
  assistant_reply: string;
  profile_updates: Record<string, any>;
  profile: Record<string, any>;
  completeness_score: number;
  missing_information: string[];
  next_focus?: string;
}> {
  return apiRequest("/onboarding/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function uploadDocApi(file: File): Promise<{
  assistant_reply: string;
  profile_updates: Record<string, any>;
  profile: Record<string, any>;
  completeness_score: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/onboarding/upload-doc", {
    method: "POST",
    body: formData,
  });
}

// ── Document Library Endpoints ──────────────────────────────────────────

export async function listDocumentsApi(category?: string, search?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (search) params.append("search", search);
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/documents${queryStr}`);
}

export async function uploadDocumentApi(file: File, category?: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const queryStr = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiRequest(`/documents/upload${queryStr}`, {
    method: "POST",
    body: formData,
  });
}

export async function renameDocumentApi(docId: string, filename: string): Promise<any> {
  return apiRequest(`/documents/${docId}/rename`, {
    method: "PUT",
    body: JSON.stringify({ filename }),
  });
}

export async function reclassifyDocumentApi(docId: string, category: string): Promise<any> {
  return apiRequest(`/documents/${docId}/reclassify`, {
    method: "PUT",
    body: JSON.stringify({ category }),
  });
}

export async function replaceDocumentApi(docId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`/documents/${docId}/replace`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteDocumentApi(docId: string): Promise<{ success: boolean }> {
  return apiRequest(`/documents/${docId}`, {
    method: "DELETE",
  });
}

export async function getDocumentStatsApi(): Promise<{ totalDocuments: number; indexedDocuments: number; totalChunks: number }> {
  return apiRequest("/documents/stats");
}

// ── RAG Chat Endpoints ─────────────────────────────────────────────────

export interface ChatAttachment {
  filename: string;
  text: string;
  mimeType: string;
  fileSizeBytes: number;
  tempPath?: string;
  base64?: string;
  isSaved: boolean;
  savedDocId?: string;
}

export interface RagMessage {
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  sources?: string[];
  attachment?: ChatAttachment;
}

export async function sendChatMessageApi(messages: RagMessage[], conversationId?: string): Promise<{
  text: string;
  steps: string[];
  sources: string[];
  conversationId: string;
}> {
  return apiRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ messages, conversationId }),
  });
}

export async function getChatHistoryApi(conversationId?: string): Promise<{
  messages: RagMessage[];
  conversationId: string;
}> {
  const queryStr = conversationId ? `?conversationId=${conversationId}` : "";
  return apiRequest(`/chat/history${queryStr}`);
}

export async function resetChatApi(conversationId?: string): Promise<{ success: boolean }> {
  const queryStr = conversationId ? `?conversationId=${conversationId}` : "";
  return apiRequest(`/chat/reset${queryStr}`, {
    method: "POST",
  });
}

export async function listConversationsApi(): Promise<{ id: string; title: string; updatedAt: string }[]> {
  return apiRequest("/chat/conversations");
}

export async function deleteConversationApi(conversationId: string): Promise<{ success: boolean }> {
  return apiRequest(`/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export async function uploadChatAttachmentApi(file: File): Promise<ChatAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/chat/upload-attachment", {
    method: "POST",
    body: formData,
  });
}

export async function saveChatAttachmentApi(conversationId: string, messageIndex: number): Promise<{ success: boolean; attachment: ChatAttachment }> {
  return apiRequest(`/chat/conversations/${conversationId}/messages/${messageIndex}/save-attachment`, {
    method: "POST",
  });
}

// ── Startup Health Endpoints ──────────────────────────────────────────

export async function getHealthReportApi(): Promise<any> {
  return apiRequest("/health/report");
}

export async function recalculateHealthApi(): Promise<any> {
  return apiRequest("/health/recalculate", {
    method: "POST",
  });
}

// ── Competitor Intelligence Endpoints ─────────────────────────────────

export async function startCompetitorResearchApi(): Promise<{ success: boolean; research_id: string; status: string }> {
  return apiRequest("/competitors/research", {
    method: "POST",
  });
}

export async function getResearchStatusApi(): Promise<{ status: string; started_at?: string; completed_at?: string; error_message?: string }> {
  return apiRequest("/competitors/research/status");
}

export async function getCompetitorResultsApi(): Promise<{
  id: string;
  competitors: any[];
  comparison?: { dimensions: any[]; summary: string };
  gaps: any[];
  research_status: string;
}> {
  return apiRequest("/competitors/results");
}

export async function getCompetitorDetailApi(id: string): Promise<any> {
  return apiRequest(`/competitors/${id}`);
}

// ── Opportunities & Decision Intelligence Endpoints ───────────────────

export async function getOpportunitiesApi(): Promise<{
  opportunities?: any[];
  decisions: Record<string, any>;
  experiments: Record<string, string>;
  companyName?: string;
  targetCustomer?: string;
}> {
  return apiRequest("/opportunities");
}

export async function regenerateOpportunitiesApi(): Promise<{
  success: boolean;
  opportunities: any[];
  companyName?: string;
}> {
  return apiRequest("/opportunities/generate", {
    method: "POST",
  });
}

export async function decideOpportunityApi(
  opportunityId: string,
  data: { decision: string; reasoning: string; action_summary?: string }
): Promise<any> {
  return apiRequest(`/opportunities/${opportunityId}/decide`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateValidationApi(
  opportunityId: string,
  data: { experiment_id: string; status: string }
): Promise<any> {
  return apiRequest(`/opportunities/${opportunityId}/validate`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

