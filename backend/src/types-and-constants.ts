const enum MODEL_PROVIDER {
    DEEPSEEK = "deepseek",
    DEFAULT = "default"
}

const enum LLM_PROVIDER {
    CEREBRAS = "cerebras",
    GROQ = "groq",
    GOOGLE = "google",
    OPENAI = "openai",
    GROK = "grok",  // X.AI (Elon's company, NOT Groq)
    MULTI = "multi"
}

const enum AGENT_ROLE {
    MAITRED = "matried",
    RECOMMEND = "recommend"
}

// ============================================
// MODEL NAME CONSTANTS (no more magic strings)
// ============================================
// Model catalog last reviewed: June 17, 2026.
// Fast-model maintenance note:
// - OpenAI fast default updated from `gpt-4o-mini` to `gpt-5-mini`
// - OpenAI `gpt-5.4-mini` added and selected for stream and rerank canaries
// - Google `gemini-3.1-flash-lite` added to the registry for rerank evaluation
// - Google `gemini-2.5-flash-lite` retained in the registry for rollback/evaluation
// - xAI `grok-4.20-non-reasoning` added as the 2M-context replacement
// - Groq and Cerebras GPT-OSS 120B are the default fast public models.
// - Groq Llama constants were removed from the active registry after the Llama 4
//   Scout deprecation notice and the intent cutover away from Llama.
// - Cerebras public endpoints currently expose GPT-OSS 120B plus Z.ai GLM 4.7
//   preview; older public Llama/Qwen constants were removed from this registry.
// Periodically re-check official OpenAI, Google Gemini, xAI, Groq, and Cerebras model catalogs
// before changing these constants or the active provider/model mappings below.
const enum GROQ_MODEL_NAMES {
  OPENAI_GPT_OSS_120B = "openai/gpt-oss-120b",
  QWEN_3_32B = "qwen/qwen3-32b",
  QWEN_3_8B = "qwen/qwen3-8b",
}

const enum CEREBRAS_MODEL_NAMES {
  GPT_OSS_120B = "gpt-oss-120b",
  ZAI_GLM_4_7 = "zai-glm-4.7",
}

const enum GOOGLE_MODEL_NAMES {
  GEMINI_31_FLASH_LITE = "gemini-3.1-flash-lite",
  GEMINI_25_FLASH = "gemini-2.5-flash",
  GEMINI_25_FLASH_LITE = "gemini-2.5-flash-lite",
}

const enum OPENAI_MODEL_NAMES {
  GPT_54_MINI = "gpt-5.4-mini",
  GPT_5_MINI = "gpt-5-mini",
  GPT_4O = "gpt-4o",
}

const enum GROK_MODEL_NAMES {
  GROK_420_NON_REASONING = "grok-4.20-non-reasoning",
  GROK_3_MINI = "grok-3-mini",
}

// ============================================
// ROLE → MODEL MAPPINGS (using constants)
// ============================================
const GROQ_MODELS = {
  INTENT: GROQ_MODEL_NAMES.OPENAI_GPT_OSS_120B,
  STREAM: GROQ_MODEL_NAMES.OPENAI_GPT_OSS_120B,
  RECOMMEND: GROQ_MODEL_NAMES.QWEN_3_32B,
} as const;

const CEREBRAS_MODELS = {
  INTENT: CEREBRAS_MODEL_NAMES.GPT_OSS_120B,
  STREAM: CEREBRAS_MODEL_NAMES.GPT_OSS_120B,
  RECOMMEND: CEREBRAS_MODEL_NAMES.GPT_OSS_120B,
} as const;

const GOOGLE_MODELS = {
  INTENT: GOOGLE_MODEL_NAMES.GEMINI_25_FLASH,
  STREAM: GOOGLE_MODEL_NAMES.GEMINI_25_FLASH,
  RECOMMEND: GOOGLE_MODEL_NAMES.GEMINI_31_FLASH_LITE,
} as const;

const OPENAI_MODELS = {
  INTENT: OPENAI_MODEL_NAMES.GPT_4O,
  STREAM: OPENAI_MODEL_NAMES.GPT_54_MINI,
  RECOMMEND: OPENAI_MODEL_NAMES.GPT_54_MINI,
} as const;

const GROK_MODELS = {
  INTENT: GROK_MODEL_NAMES.GROK_420_NON_REASONING,
  STREAM: GROK_MODEL_NAMES.GROK_420_NON_REASONING,
  RECOMMEND: GROK_MODEL_NAMES.GROK_420_NON_REASONING,
} as const;

// Type for environment bindings (minimal interface for API keys)
interface EnvBindings {
  GROQ_API_KEY?: string;
  CEREBRAS_API_KEY_PROD: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GROK_API_KEY?: string;
  STORE_STATE?: string;
}

// Provider configuration
const PROVIDER_CONFIG = {
  [LLM_PROVIDER.GROQ]: {
    models: GROQ_MODELS,
    baseUrl: "https://api.groq.com/openai/v1",
    getApiKey: (env: EnvBindings) => env.GROQ_API_KEY,
  },
  [LLM_PROVIDER.CEREBRAS]: {
    models: CEREBRAS_MODELS,
    baseUrl: "https://api.cerebras.ai/v1",
    getApiKey: (env: EnvBindings) => env.CEREBRAS_API_KEY_PROD,
  },
  [LLM_PROVIDER.GOOGLE]: {
    models: GOOGLE_MODELS,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    getApiKey: (env: EnvBindings) => env.GEMINI_API_KEY,
  },
  [LLM_PROVIDER.OPENAI]: {
    models: OPENAI_MODELS,
    baseUrl: "https://api.openai.com/v1",
    getApiKey: (env: EnvBindings) => env.OPENAI_API_KEY,
  },
  [LLM_PROVIDER.GROK]: {
    models: GROK_MODELS,
    baseUrl: "https://api.x.ai/v1",
    getApiKey: (env: EnvBindings) => env.GROK_API_KEY,
  },
} as const;

// Helper function to get model for a role based on provider
function getModelForRole(provider: LLM_PROVIDER, role: keyof typeof GROQ_MODELS): string {
  return PROVIDER_CONFIG[provider].models[role];
}

// Helper function to get base URL for provider
function getBaseUrl(provider: LLM_PROVIDER): string {
  return PROVIDER_CONFIG[provider].baseUrl;
}

// Helper function to get API key for provider
function getApiKey(provider: LLM_PROVIDER, env: EnvBindings): string | undefined {
  return PROVIDER_CONFIG[provider].getApiKey(env);
}

// Feature flags
const USE_FIRE_AT_2_PROMPT = false;
const USE_DYNAMIC_STREAM_PROMPT = false;

// ============================================
// MULTI-PROVIDER CONFIGURATION
// ============================================
// Active mode: MULTI allows different providers per endpoint
const ACTIVE_PROVIDER = LLM_PROVIDER.MULTI;

// Per-endpoint provider assignments (used when ACTIVE_PROVIDER = MULTI)
const enum MULTI_ENDPOINT_PROVIDERS {
  STREAM = LLM_PROVIDER.GROQ,
  INTENT = LLM_PROVIDER.GROQ,
  RERANK = LLM_PROVIDER.OPENAI,
}

// Legacy constants for backward compatibility (reference MULTI_ENDPOINT_PROVIDERS)
const STREAM_PROVIDER = MULTI_ENDPOINT_PROVIDERS.STREAM as unknown as LLM_PROVIDER;
const INTENT_PROVIDER = MULTI_ENDPOINT_PROVIDERS.INTENT as unknown as LLM_PROVIDER;
const RERANK_PROVIDER = MULTI_ENDPOINT_PROVIDERS.RERANK as unknown as LLM_PROVIDER;

// ---------- MODEL IDS (NEW, ADDITIVE) ----------
const enum MODEL_ID {
  // GROQ
  GROQ_OPENAI_GPT_OSS_120B = "groq_openai_gpt_oss_120b",
  GROQ_QWEN_3_32B = "groq_qwen_3_32b",
  GROQ_QWEN_3_8B = "groq_qwen_3_8b",

  // CEREBRAS
  CEREBRAS_ZAI_GLM_4_7 = "cerebras_zai_glm_4_7",
  CEREBRAS_GPT_OSS_120B = "cerebras_gpt_oss_120b",

  // GOOGLE
  GOOGLE_GEMINI_31_FLASH_LITE = "google_gemini_31_flash_lite",
  GOOGLE_GEMINI_25_FLASH = "google_gemini_25_flash",
  GOOGLE_GEMINI_25_FLASH_LITE = "google_gemini_25_flash_lite",

  // OPENAI
  OPENAI_GPT_54_MINI = "openai_gpt_54_mini",
  OPENAI_GPT_5_MINI = "openai_gpt_5_mini",
  OPENAI_GPT_4O = "openai_gpt_4o",

  // GROK (X.AI)
  GROK_420_NON_REASONING = "grok_420_non_reasoning",
  GROK_3_MINI = "grok_3_mini"
}

// ---------- MODEL → ID MAP (NEW) ----------
const MODEL_ID_MAP = {
  // Groq
  [GROQ_MODEL_NAMES.OPENAI_GPT_OSS_120B]: MODEL_ID.GROQ_OPENAI_GPT_OSS_120B,
  [GROQ_MODEL_NAMES.QWEN_3_32B]: MODEL_ID.GROQ_QWEN_3_32B,
  [GROQ_MODEL_NAMES.QWEN_3_8B]: MODEL_ID.GROQ_QWEN_3_8B,

  // Cerebras
  [CEREBRAS_MODEL_NAMES.GPT_OSS_120B]: MODEL_ID.CEREBRAS_GPT_OSS_120B,
  [CEREBRAS_MODEL_NAMES.ZAI_GLM_4_7]: MODEL_ID.CEREBRAS_ZAI_GLM_4_7,

  // Google
  [GOOGLE_MODEL_NAMES.GEMINI_31_FLASH_LITE]: MODEL_ID.GOOGLE_GEMINI_31_FLASH_LITE,
  [GOOGLE_MODEL_NAMES.GEMINI_25_FLASH]: MODEL_ID.GOOGLE_GEMINI_25_FLASH,
  [GOOGLE_MODEL_NAMES.GEMINI_25_FLASH_LITE]: MODEL_ID.GOOGLE_GEMINI_25_FLASH_LITE,

  // OpenAI
  [OPENAI_MODEL_NAMES.GPT_54_MINI]: MODEL_ID.OPENAI_GPT_54_MINI,
  [OPENAI_MODEL_NAMES.GPT_5_MINI]: MODEL_ID.OPENAI_GPT_5_MINI,
  [OPENAI_MODEL_NAMES.GPT_4O]: MODEL_ID.OPENAI_GPT_4O,

  // Grok (X.AI)
  [GROK_MODEL_NAMES.GROK_420_NON_REASONING]: MODEL_ID.GROK_420_NON_REASONING,
  [GROK_MODEL_NAMES.GROK_3_MINI]: MODEL_ID.GROK_3_MINI,
} as const;

// ---------- TOKEN LIMITS (NEW) ----------
type Tier = "FREE" | "PAID";

interface ModelTokenLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

const MODEL_TOKEN_LIMITS: Record<
  MODEL_ID,
  Record<Tier, ModelTokenLimits>
> = {
  // ---------- GROQ  ----------
  [MODEL_ID.GROQ_OPENAI_GPT_OSS_120B]: {
    FREE: { contextWindow: 131_072, maxOutputTokens: 65_536 },
    PAID: { contextWindow: 131_072, maxOutputTokens: 65_536 },
  },

  [MODEL_ID.GROQ_QWEN_3_32B]: {
    FREE: { contextWindow: 131_072, maxOutputTokens: 40_960 },
    PAID: { contextWindow: 131_072, maxOutputTokens: 40_960 },
  },

  [MODEL_ID.GROQ_QWEN_3_8B]: {
    FREE: { contextWindow: 32_768, maxOutputTokens: 32_768 },
    PAID: { contextWindow: 32_768, maxOutputTokens: 32_768 },
  },

  // ---------- CEREBRAS ----------
  [MODEL_ID.CEREBRAS_ZAI_GLM_4_7]: {
    FREE: { contextWindow: 32_000, maxOutputTokens: 8_192 },
    PAID: { contextWindow: 128_000, maxOutputTokens: 16_384 },
  },

  [MODEL_ID.CEREBRAS_GPT_OSS_120B]: {
    FREE: { contextWindow: 131_072, maxOutputTokens: 40_960 },
    PAID: { contextWindow: 131_072, maxOutputTokens: 40_960 },
  },

  // ---------- GOOGLE ----------
  [MODEL_ID.GOOGLE_GEMINI_31_FLASH_LITE]: {
    FREE: { contextWindow: 1_048_576, maxOutputTokens: 65_536 },
    PAID: { contextWindow: 1_048_576, maxOutputTokens: 65_536 },
  },

  [MODEL_ID.GOOGLE_GEMINI_25_FLASH]: {
    FREE: { contextWindow: 1_000_000, maxOutputTokens: 8_192 },
    PAID: { contextWindow: 1_000_000, maxOutputTokens: 8_192 },
  },

  [MODEL_ID.GOOGLE_GEMINI_25_FLASH_LITE]: {
    FREE: { contextWindow: 1_048_576, maxOutputTokens: 65_536 },
    PAID: { contextWindow: 1_048_576, maxOutputTokens: 65_536 },
  },

  // ---------- OPENAI ----------
  [MODEL_ID.OPENAI_GPT_54_MINI]: {
    FREE: { contextWindow: 400_000, maxOutputTokens: 128_000 },
    PAID: { contextWindow: 400_000, maxOutputTokens: 128_000 },
  },

  [MODEL_ID.OPENAI_GPT_5_MINI]: {
    FREE: { contextWindow: 400_000, maxOutputTokens: 128_000 },
    PAID: { contextWindow: 400_000, maxOutputTokens: 128_000 },
  },

  [MODEL_ID.OPENAI_GPT_4O]: {
    FREE: { contextWindow: 128_000, maxOutputTokens: 16_384 },
    PAID: { contextWindow: 128_000, maxOutputTokens: 16_384 },
  },

  // ---------- GROK (X.AI) ----------
  [MODEL_ID.GROK_420_NON_REASONING]: {
    FREE: { contextWindow: 2_000_000, maxOutputTokens: 32_768 },
    PAID: { contextWindow: 2_000_000, maxOutputTokens: 32_768 },
  },

  [MODEL_ID.GROK_3_MINI]: {
    FREE: { contextWindow: 131_072, maxOutputTokens: 16_384 },
    PAID: { contextWindow: 131_072, maxOutputTokens: 16_384 },
  },
};

// ---------- SAFE TOKEN CLAMP (NEW) ----------
function getTokenLimitsForModel(
  modelName: string,
  tier: Tier,
): ModelTokenLimits {
  const modelId = MODEL_ID_MAP[modelName as keyof typeof MODEL_ID_MAP];
  if (!modelId) {
    // Fallback to conservative defaults if model not found
    return { contextWindow: 32_000, maxOutputTokens: 4_096 };
  }
  return MODEL_TOKEN_LIMITS[modelId][tier];
}

function clampMaxTokens(
  modelName: string,
  tier: Tier,
  promptTokens: number,
  requestedOutputTokens: number,
): number {
  const { contextWindow, maxOutputTokens } =
    getTokenLimitsForModel(modelName, tier);

  const remaining = contextWindow - promptTokens;
  return Math.max(
    0,
    Math.min(requestedOutputTokens, remaining, maxOutputTokens),
  );
}

function getModelId(modelName: string): MODEL_ID | null {
  return MODEL_ID_MAP[modelName as keyof typeof MODEL_ID_MAP] || null;
}

export {
    MODEL_PROVIDER,
    LLM_PROVIDER,
    AGENT_ROLE,
    USE_FIRE_AT_2_PROMPT,
    USE_DYNAMIC_STREAM_PROMPT,
    // Multi-provider configuration
    ACTIVE_PROVIDER,
    MULTI_ENDPOINT_PROVIDERS,
    // Legacy endpoint providers (backward compatibility)
    STREAM_PROVIDER,
    INTENT_PROVIDER,
    RERANK_PROVIDER,
    // Model name constants
    GROQ_MODEL_NAMES,
    CEREBRAS_MODEL_NAMES,
    GOOGLE_MODEL_NAMES,
    OPENAI_MODEL_NAMES,
    GROK_MODEL_NAMES,
    // Model role mappings
    GROQ_MODELS,
    CEREBRAS_MODELS,
    GOOGLE_MODELS,
    OPENAI_MODELS,
    GROK_MODELS,
    // Provider configuration
    PROVIDER_CONFIG,
    getModelForRole,
    getBaseUrl,
    getApiKey,
    getTokenLimitsForModel,
}
export type { Tier }
