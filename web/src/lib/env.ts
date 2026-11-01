// Server-only settings. Everything has a default so the app runs with no keys (fake mode).
export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  textModel: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
  liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live",
  // The @google/genai SDK only supports ephemeral tokens on v1alpha.
  liveApiVersion: process.env.GEMINI_LIVE_API_VERSION || "v1alpha",
  grokApiKey: process.env.GROK_API_KEY || process.env.XAI_API_KEY || "",
  grokTextModel: process.env.GROK_TEXT_MODEL || "grok-4.20-0309-non-reasoning",
  grokVoiceModel: process.env.GROK_VOICE_MODEL || "grok-voice-latest",
  // Empty means the manager's own Grok voice (manager.ts).
  grokVoice: process.env.GROK_VOICE || "",
  // Which provider answers text (chat, email, SMS) and voice (browser call, phone) by default.
  // Each reference can override this from the reference desk. See lib/models.ts.
  textProvider: process.env.TEXT_PROVIDER || "gemini",
  voiceProvider: process.env.VOICE_PROVIDER || "grok",
  agentboxdApiKey: process.env.AGENTBOXD_API_KEY || "",
  agentboxdBaseUrl: process.env.AGENTBOXD_BASE_URL || "https://api.agentboxd.com",
  agentboxdWebhookSecret: process.env.AGENTBOXD_WEBHOOK_SECRET || "",
  dataDir: process.env.DATA_DIR || ".data",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  // The public https origin Twilio calls (ngrok or Render). Used to check signatures and build the stream URL.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  // Which reference answers the shared number. Empty means the newest one.
  phoneReferenceId: process.env.PHONE_REFERENCE_ID || "",
};

export const hasGemini = () => env.geminiApiKey.length > 0;
export const hasGrok = () => env.grokApiKey.length > 0;
export const hasAgentboxd = () => env.agentboxdApiKey.length > 0;
