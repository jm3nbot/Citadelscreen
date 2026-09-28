import { VertexAI } from "@google-cloud/vertexai";

// Vertex AI client. ADC discovery is automatic — the SDK reads from
// ~/.config/gcloud/application_default_credentials.json (Linux/macOS) or
// %APPDATA%/gcloud/application_default_credentials.json (Windows), set by
// `gcloud auth application-default login`. NOTHING here touches API keys.
//
// We lazy-init so the route can return a clean "ADC not configured" error
// instead of crashing the server at module import time when env is bad.

export class GeminiConfigError extends Error {
  constructor(
    public code:
      | "no_project"
      | "no_location"
      | "no_model"
      | "adc_missing"
      | "vertex_api_disabled"
      | "billing_disabled"
      | "permission_denied"
      | "unknown",
    message: string
  ) {
    super(message);
  }
}

export type GeminiUsage = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
};

function getConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const model = process.env.GEMINI_MODEL;
  if (!project) {
    throw new GeminiConfigError(
      "no_project",
      "GOOGLE_CLOUD_PROJECT not set in .env.local"
    );
  }
  if (!location) {
    throw new GeminiConfigError(
      "no_location",
      "GOOGLE_CLOUD_LOCATION not set in .env.local"
    );
  }
  if (!model) {
    throw new GeminiConfigError(
      "no_model",
      "GEMINI_MODEL not set in .env.local"
    );
  }
  return { project, location, model };
}

// Map opaque SDK errors to our typed config error so the UI can show a
// useful fix instruction. The SDK's error strings are stable enough for
// this matching to be reliable.
function classifyError(e: unknown): GeminiConfigError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Could not load the default credentials/i.test(msg)) {
    return new GeminiConfigError(
      "adc_missing",
      "Application Default Credentials not found. Run `gcloud auth application-default login` in a terminal, then restart the dev server."
    );
  }
  if (/SERVICE_DISABLED|aiplatform\.googleapis\.com/i.test(msg)) {
    return new GeminiConfigError(
      "vertex_api_disabled",
      "Vertex AI (aiplatform.googleapis.com) is not enabled on this project. Enable it in Google Cloud Console."
    );
  }
  if (/billing/i.test(msg)) {
    return new GeminiConfigError(
      "billing_disabled",
      "Billing is not enabled on this Google Cloud project. Vertex AI requires a billing account."
    );
  }
  if (/PERMISSION_DENIED|insufficient/i.test(msg)) {
    return new GeminiConfigError(
      "permission_denied",
      "Your gcloud principal doesn't have Vertex AI permissions. The 'roles/aiplatform.user' role is the minimum."
    );
  }
  return new GeminiConfigError("unknown", msg);
}

export type GeminiCallResult = {
  text: string;
  model: string;
  usage: GeminiUsage;
  // Vertex's finishReason. "MAX_TOKENS" means we hit our output cap and the
  // text is truncated — the UI can surface a "continue" affordance.
  finishReason?: string;
  truncated: boolean;
};

export async function generateWithGemini(
  systemInstruction: string,
  userMessage: string
): Promise<GeminiCallResult> {
  const { project, location, model } = getConfig();

  let vertex: VertexAI;
  try {
    vertex = new VertexAI({ project, location });
  } catch (e) {
    throw classifyError(e);
  }

  const generative = vertex.getGenerativeModel({
    model,
    systemInstruction: {
      role: "system",
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      // Reasonable defaults for a chat assistant; can be exposed in the
      // configure modal later if needed. 4096 covers full inbox-summary
      // replies without truncation — the previous 1024 was cutting off
      // multi-email summaries mid-sentence.
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 4096,
    },
  });

  try {
    const res = await generative.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
    });
    const candidate = res.response.candidates?.[0];
    const text =
      candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const usage: GeminiUsage = {
      promptTokens: res.response.usageMetadata?.promptTokenCount,
      candidatesTokens: res.response.usageMetadata?.candidatesTokenCount,
      totalTokens: res.response.usageMetadata?.totalTokenCount,
    };
    const finishReason = candidate?.finishReason;
    return {
      text,
      model,
      usage,
      finishReason,
      truncated: finishReason === "MAX_TOKENS",
    };
  } catch (e) {
    throw classifyError(e);
  }
}

// Lightweight env check for the /api/ai/status route. Returns the same shape
// as a "would this work" precheck — no actual SDK call, so it's free.
export function checkGeminiEnv(): {
  ok: boolean;
  project?: string;
  location?: string;
  model?: string;
  missing: string[];
} {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const model = process.env.GEMINI_MODEL;
  const missing: string[] = [];
  if (!project) missing.push("GOOGLE_CLOUD_PROJECT");
  if (!location) missing.push("GOOGLE_CLOUD_LOCATION");
  if (!model) missing.push("GEMINI_MODEL");
  return {
    ok: missing.length === 0,
    project,
    location,
    model,
    missing,
  };
}
