// Server-only settings. Everything has a default so the app runs with no keys (fake mode).
export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  textModel: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
  liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live",
  // The @google/genai SDK only supports ephemeral tokens on v1alpha.
  liveApiVersion: process.env.GEMINI_LIVE_API_VERSION || "v1alpha",
  agentboxdApiKey: process.env.AGENTBOXD_API_KEY || "",
  agentboxdBaseUrl: process.env.AGENTBOXD_BASE_URL || "https://api.agentboxd.com",
  agentboxdWebhookSecret: process.env.AGENTBOXD_WEBHOOK_SECRET || "",
  dataDir: process.env.DATA_DIR || ".data",
};

export const hasGemini = () => env.geminiApiKey.length > 0;
export const hasAgentboxd = () => env.agentboxdApiKey.length > 0;
