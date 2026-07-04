import { Hono } from "hono";
import { cors } from 'hono/cors';
import { generatePrompt } from "./prompt";
import {
  generateIntentWithCuePrompt,
  generateReRankPrompt
} from "./prompts";
import {
  LLM_PROVIDER,
  STREAM_PROVIDER,
  INTENT_PROVIDER,
  RERANK_PROVIDER,
  getModelForRole,
  getBaseUrl,
  getApiKey,
  getTokenLimitsForModel,
  type Tier
} from "./types-and-constants";
import {
  formatConversationHistory,
  validateVehicleFilters,
  parseRobustJSON,
  buildCompactRerankCandidates,
} from "./utils";
import { getVehicleSchemaForPrompt } from './vehicle-schema';
import {
  getCatalogFacets,
  lookupVehicleByName,
  searchVehiclesWithFallback
} from './vehicle-search';
import type { VehicleFilters, VehicleResult } from './vehicle-search';
import { getProfile } from './profiles';
import {
  isAnalyticsEnabled,
  recordAnalyticsEvent,
  recordIntentAnalysis,
  recordLeadCapture,
  recordProductLookupResult,
  recordRecommendationResults,
  recordStreamCompletion,
  recordAgeGateRendered,
  recordAgeConfirmed,
  recordAgeDeclined,
} from "./chat-analytics";
import type {
  D1Database,
  ExecutionContext,
} from "@cloudflare/workers-types";

interface Bindings {
  CEREBRAS_API_KEY_PROD: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GROK_API_KEY?: string;
  RESEND_API_KEY: string;
  VEHICLES_DB: D1Database;
  ANALYTICS_DB?: D1Database;
  PROFILE_TYPE?: string;
  ENVIRONMENT?: string;
}

const TIER: Tier = "FREE";
const RERANK_SKIP_CANDIDATE_MAX = 3;

function devLog(env: Bindings | undefined, ...args: any[]) {
  if (env?.ENVIRONMENT === 'development') {
    console.log(...args);
  }
}

function deriveVehicleFiltersFromText(text: string): VehicleFilters | null {
  const lower = ` ${text.toLowerCase().replace(/[$,]/g, '').replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  const filters: VehicleFilters = {};
  const useCases = new Set<string>();
  const priorities = new Set<string>();
  const hasAny = (terms: string[]) => terms.some((term) => lower.includes(` ${term} `));
  const hasPhrase = (terms: string[]) => terms.some((term) => lower.includes(term));

  const makeAliases: Array<[string, string[]]> = [
    ['Toyota', ['toyota', 'toyotas']],
    ['Honda', ['honda', 'hondas']],
    ['Ford', ['ford', 'fords']],
    ['Chevrolet', ['chevrolet', 'chevy']],
    ['Subaru', ['subaru']],
    ['Mazda', ['mazda']],
    ['Nissan', ['nissan']],
    ['Hyundai', ['hyundai']],
    ['Kia', ['kia']],
    ['BMW', ['bmw']],
    ['Mercedes-Benz', ['mercedes', 'mercedes-benz', 'benz']],
    ['Audi', ['audi']],
    ['Lexus', ['lexus']],
    ['Genesis', ['genesis']],
    ['Jeep', ['jeep']],
    ['Ram', ['ram']],
    ['GMC', ['gmc']],
    ['Volvo', ['volvo']],
    ['Volkswagen', ['volkswagen', 'vw']],
    ['Tesla', ['tesla']],
    ['Rivian', ['rivian']],
    ['Acura', ['acura']],
    ['Dodge', ['dodge']],
    ['Chrysler', ['chrysler']],
  ];

  for (const [make, aliases] of makeAliases) {
    if (hasAny(aliases)) {
      filters.make = make;
      break;
    }
  }

  if (hasAny(['used', 'pre-owned', 'preowned'])) filters.condition = 'used';
  if (hasAny(['certified', 'cpo'])) filters.condition = 'cpo';
  if (hasPhrase(['brand new']) || hasAny(['new'])) filters.condition = 'new';

  if (hasAny(['suv', 'crossover', 'crossovers'])) filters.body_type = 'suv';
  if (hasAny(['truck', 'pickup'])) filters.body_type = 'truck';
  if (hasAny(['sedan'])) filters.body_type = 'sedan';
  if (hasAny(['hatchback', 'hatch'])) filters.body_type = 'hatchback';
  if (hasAny(['wagon'])) filters.body_type = 'wagon';
  if (hasAny(['minivan'])) filters.body_type = 'minivan';
  if (hasPhrase(['work van', 'cargo van']) || hasAny(['van'])) filters.body_type = 'van';
  if (hasAny(['coupe'])) filters.body_type = 'coupe';
  if (hasAny(['convertible'])) filters.body_type = 'convertible';

  if (hasAny(['hybrid', 'hev'])) filters.fuel_type = 'hybrid';
  if (hasAny(['electric', 'ev'])) filters.fuel_type = 'electric';
  if (hasPhrase(['plug in hybrid', 'plug-in hybrid']) || hasAny(['phev'])) filters.fuel_type = 'plug-in-hybrid';
  if (hasAny(['diesel'])) filters.fuel_type = 'diesel';
  if (hasPhrase(['gas only', 'gasoline only', 'gas engine'])) filters.fuel_type = 'gasoline';

  if (hasAny(['awd']) || hasPhrase(['all wheel drive', 'all-wheel drive'])) filters.drive_type = 'awd';
  if (hasAny(['4wd', '4x4']) || hasPhrase(['four wheel drive', 'four-wheel drive'])) filters.drive_type = '4wd';
  if (hasAny(['fwd']) || hasPhrase(['front wheel drive', 'front-wheel drive'])) filters.drive_type = 'fwd';
  if (hasAny(['rwd']) || hasPhrase(['rear wheel drive', 'rear-wheel drive'])) filters.drive_type = 'rwd';

  if (hasAny(['family', 'kids', 'carpool'])) useCases.add('family');
  if (hasAny(['commute', 'commuter']) || hasPhrase(['daily driver'])) useCases.add('commuter');
  if (hasAny(['camping', 'outdoors', 'adventure']) || hasPhrase(['off road', 'off-road'])) useCases.add('adventure');
  if (hasAny(['commercial', 'jobsite']) || hasPhrase(['work truck'])) useCases.add('commercial');
  if (hasAny(['performance', 'sporty', 'fast'])) useCases.add('performance');
  if (hasPhrase(['fuel economy', 'gas budget', 'gas saver', 'save on gas']) || hasAny(['efficient', 'eco', 'mpg'])) {
    useCases.add('eco');
    priorities.add('fuel-economy');
  }

  if (hasAny(['safe', 'safety'])) priorities.add('safety');
  if (hasAny(['reliable', 'dependable'])) priorities.add('reliability');
  if (hasAny(['cargo', 'storage', 'space'])) priorities.add('cargo');
  if (hasAny(['tow', 'towing', 'trailer'])) priorities.add('towing');
  if (hasAny(['tech', 'carplay', 'infotainment'])) priorities.add('tech');
  if (hasAny(['luxury', 'premium', 'leather'])) priorities.add('luxury');
  if (hasAny(['value', 'deal', 'affordable', 'budget', 'cheap'])) priorities.add('value');
  if (hasAny(['comfort', 'comfortable', 'quiet', 'smooth'])) priorities.add('comfort');
  if (hasAny(['powerful', 'horsepower'])) priorities.add('performance');

  const priceMaxMatch = lower.match(/\b(?:under|below|less than|up to)\s+(\d+(?:\.\d+)?)\s*(k|thousand)?\b/);
  if (priceMaxMatch) {
    const raw = Number(priceMaxMatch[1]);
    if (Number.isFinite(raw)) {
      const isThousands = Boolean(priceMaxMatch[2]) || raw < 1000;
      filters.price_max = isThousands ? Math.round(raw * 1000) : Math.round(raw);
    }
  }

  const seatsMatch = lower.match(/\b(?:seats|seat)\s+(\d+)\b/) || lower.match(/\b(\d+)\s+(?:seats|seater|passenger)\b/);
  if (seatsMatch) {
    const seats = Number(seatsMatch[1]);
    if (Number.isFinite(seats) && seats > 0) filters.seats_min = seats;
  }

  if (useCases.size > 0) filters.use_case_tags = [...useCases];
  if (priorities.size > 0) filters.priority_tags = [...priorities];

  const normalized = validateVehicleFilters(filters as Record<string, any>);
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function buildTokenUsageResponse(
  modelName: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  tier: Tier = TIER
): {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  modelContextLimit: number;
} | null {
  if (!usage) return null;

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
  const tokenLimits = getTokenLimitsForModel(modelName, tier);

  return {
    tokenUsage: { promptTokens, completionTokens, totalTokens },
    model: modelName,
    modelContextLimit: tokenLimits.contextWindow,
  };
}

function shouldUseNoReasoning(modelName: string): boolean {
  return /^(gpt-5\.[1-9]|gpt-5\.[1-9][0-9]|gpt-5\.4|gpt-5\.5)/.test(modelName);
}

function buildChatCompletionPayload(
  provider: LLM_PROVIDER,
  model: string,
  messages: Array<Record<string, unknown>>,
  temperature: number,
  maxTokens: number,
  stream: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream,
  };

  if (provider === LLM_PROVIDER.OPENAI) {
    payload.max_completion_tokens = maxTokens;
    if (shouldUseNoReasoning(model)) {
      payload.reasoning_effort = "none";
    }
  } else {
    payload.max_tokens = maxTokens;
  }

  return payload;
}

function sanitizeMessagesForLLM(messages: any[]): Array<{ role: string; content: string }> {
  return messages
    .filter((msg) =>
      (msg?.role === "user" || msg?.role === "assistant" || msg?.role === "system") &&
      typeof msg?.content === "string" &&
      msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content.trim(),
    }));
}

function getLastUserMessage(messages: any[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && typeof message?.content === "string");
  return lastUserMessage?.content || "";
}

function getAnalyticsContext(body: any) {
  return {
    sessionId: typeof body?.analytics?.session_id === "string" ? body.analytics.session_id : null,
    messageId: typeof body?.analytics?.message_id === "string" ? body.analytics.message_id : null,
    sourcePage: typeof body?.analytics?.source_page === "string" ? body.analytics.source_page : null,
    storeId: typeof body?.analytics?.store_id === "string" ? body.analytics.store_id : null,
    browserToken: typeof body?.analytics?.browser_token === "string" ? body.analytics.browser_token : null,
    predecessorSessionId: typeof body?.analytics?.predecessor_session_id === "string" ? body.analytics.predecessor_session_id : null,
    ageGateRequired: body?.analytics?.age_gate_required === true || body?.analytics?.age_gate_required === 1,
    source: body?.analytics?.source === "guided_flow" ? "guided_flow" : "chat",
    guidedFlowFilters: body?.analytics?.guided_flow_filters ?? null,
  };
}

function trackAnalytics(
  c: { env: Bindings; executionCtx: ExecutionContext },
  fn: (db: D1Database) => Promise<void>
) {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) return;

  c.executionCtx.waitUntil(
    fn(c.env.ANALYTICS_DB!).catch((error) => {
      console.error("[Chat Analytics] Background write failed:", error);
    })
  );
}

const app = new Hono<{ Bindings: Bindings }>();

// ============================================
// FEEDBACK ROUTE
// ============================================

const FEEDBACK_FROM = "Dealer Feedback <noreply@xtscale.com>";
const FEEDBACK_TO = "info@xtscale.com";
const FEEDBACK_MAX_MESSAGE_LEN = 4000;
const FEEDBACK_MAX_FILE_SIZE = 5 * 1024 * 1024;
const FEEDBACK_RATE_WINDOW_MS = 10 * 60 * 1000;
const FEEDBACK_RATE_MAX = 5;
const ALLOWED_SCREENSHOT_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const TRANSCRIPT_FROM = "Vehicle Advisor <noreply@xtscale.com>";
const TRANSCRIPT_RATE_WINDOW_MS = 10 * 60 * 1000;
const TRANSCRIPT_RATE_MAX = 5;
const TRANSCRIPT_MAX_MESSAGES = 40;
const TRANSCRIPT_MAX_RECOMMENDATIONS_PER_MESSAGE = 6;
const TRANSCRIPT_MAX_CONTENT_LEN = 4000;

const feedbackRateLimitStore = new Map<string, number[]>();
const transcriptRateLimitStore = new Map<string, number[]>();

interface TranscriptRecommendation {
  name?: string;
  brand?: string;
  price?: number | null;
  shop_link?: string | null;
  body_type?: string | null;
  make?: string | null;
  model?: string | null;
  condition?: string | null;
}

interface TranscriptMessageEntry {
  role: "user" | "assistant" | "system";
  content: string;
  recommendations: TranscriptRecommendation[];
}

function cleanupRateLimitStore(now: number) {
  for (const [key, timestamps] of feedbackRateLimitStore.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < FEEDBACK_RATE_WINDOW_MS);
    if (fresh.length === 0) {
      feedbackRateLimitStore.delete(key);
      continue;
    }
    feedbackRateLimitStore.set(key, fresh);
  }
}

function isRateLimited(ip: string, now: number): boolean {
  cleanupRateLimitStore(now);
  const timestamps = feedbackRateLimitStore.get(ip) ?? [];
  const fresh = timestamps.filter((ts) => now - ts < FEEDBACK_RATE_WINDOW_MS);
  if (fresh.length >= FEEDBACK_RATE_MAX) {
    feedbackRateLimitStore.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  feedbackRateLimitStore.set(ip, fresh);
  return false;
}

function cleanupTranscriptRateLimitStore(now: number) {
  for (const [key, timestamps] of transcriptRateLimitStore.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < TRANSCRIPT_RATE_WINDOW_MS);
    if (fresh.length === 0) {
      transcriptRateLimitStore.delete(key);
      continue;
    }
    transcriptRateLimitStore.set(key, fresh);
  }
}

function isTranscriptRateLimited(ip: string, now: number): boolean {
  cleanupTranscriptRateLimitStore(now);
  const timestamps = transcriptRateLimitStore.get(ip) ?? [];
  const fresh = timestamps.filter((ts) => now - ts < TRANSCRIPT_RATE_WINDOW_MS);
  if (fresh.length >= TRANSCRIPT_RATE_MAX) {
    transcriptRateLimitStore.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  transcriptRateLimitStore.set(ip, fresh);
  return false;
}

function normalizeStore(rawStore: string): string {
  return rawStore
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function safeTranscriptText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, TRANSCRIPT_MAX_CONTENT_LEN);
}

function safeTranscriptScalar(value: unknown): string | null {
  const trimmed = safeTranscriptText(value);
  return trimmed || null;
}

function safeTranscriptPrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number(value);
}

function normalizeTranscriptMessages(rawMessages: unknown): TranscriptMessageEntry[] {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .slice(0, TRANSCRIPT_MAX_MESSAGES)
    .map((entry) => {
      const rawMessage = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      const role = rawMessage.role === "user" || rawMessage.role === "assistant" || rawMessage.role === "system"
        ? rawMessage.role
        : "assistant";
      const content = safeTranscriptText(rawMessage.content);
      const recommendations = Array.isArray(rawMessage.recommendations)
        ? rawMessage.recommendations
            .slice(0, TRANSCRIPT_MAX_RECOMMENDATIONS_PER_MESSAGE)
            .map((recommendation) => {
              const rawRecommendation = recommendation && typeof recommendation === "object"
                ? recommendation as Record<string, unknown>
                : {};

              return {
                name: safeTranscriptScalar(rawRecommendation.name) ?? undefined,
                brand: safeTranscriptScalar(rawRecommendation.brand) ?? undefined,
                price: safeTranscriptPrice(rawRecommendation.price),
                shop_link: safeTranscriptScalar(rawRecommendation.shop_link),
                body_type: safeTranscriptScalar(rawRecommendation.body_type),
                make: safeTranscriptScalar(rawRecommendation.make),
                model: safeTranscriptScalar(rawRecommendation.model),
                condition: safeTranscriptScalar(rawRecommendation.condition),
              };
            })
            .filter((recommendation) => recommendation.name || recommendation.shop_link || recommendation.price != null)
        : [];

      return { role, content, recommendations };
    })
    .filter((entry) => entry.content || entry.recommendations.length > 0);
}

function formatTranscriptPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Price unavailable";
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function buildTranscriptEmail(
  profileName: string,
  messages: TranscriptMessageEntry[],
  name: string | null,
  sourcePage: string | null,
  submittedAt: string
) {
  let recommendationCount = 0;

  const textSections = messages.map((message) => {
    const speaker = message.role === "user" ? "You" : message.role === "system" ? "System" : "Vehicle Advisor";
    const lines = [`${speaker}:`];

    if (message.content) {
      lines.push(message.content);
    }

    if (message.recommendations.length > 0) {
      recommendationCount += message.recommendations.length;
      lines.push("Recommendations:");

      for (const recommendation of message.recommendations) {
        const detailParts = [
          recommendation.make,
          recommendation.body_type,
          recommendation.model,
          recommendation.condition
        ].filter(Boolean);

        lines.push(`- ${recommendation.name ?? "Recommended vehicle"}${detailParts.length > 0 ? ` (${detailParts.join(" • ")})` : ""}`);
        lines.push(`  ${formatTranscriptPrice(recommendation.price)}`);
        if (recommendation.shop_link) {
          lines.push(`  ${recommendation.shop_link}`);
        }
      }
    }

    return lines.join("\n");
  });

  const htmlSections = messages.map((message) => {
    const speaker = message.role === "user" ? "You" : message.role === "system" ? "System" : "Vehicle Advisor";
    const productsHtml = message.recommendations.length > 0
      ? `<div style="margin-top:12px;"><div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Recommendations</div><ul style="margin:0;padding-left:18px;">${message.recommendations.map((recommendation) => {
          const detailParts = [
            recommendation.make,
            recommendation.body_type,
            recommendation.model,
            recommendation.condition
          ].filter(Boolean);

          return `<li style="margin-bottom:10px;"><div style="font-weight:600;color:#111827;">${escapeHtml(recommendation.name ?? "Recommended vehicle")}</div><div style="color:#6b7280;font-size:13px;">${escapeHtml(detailParts.join(" • ")) || "&nbsp;"}</div><div style="color:#111827;font-size:13px;">${escapeHtml(formatTranscriptPrice(recommendation.price))}</div>${recommendation.shop_link ? `<div style="font-size:13px;"><a href="${escapeHtml(recommendation.shop_link)}" style="color:#1d4ed8;">View vehicle</a></div>` : ""}</li>`;
        }).join("")}</ul></div>`
      : "";

    return `<section style="padding:16px 0;border-top:1px solid #e5e7eb;"><div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">${escapeHtml(speaker)}</div>${message.content ? `<div style="font-size:14px;line-height:1.6;color:#111827;">${escapeHtml(message.content).replace(/\n/g, "<br />")}</div>` : ""}${productsHtml}</section>`;
  });

  const salutation = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const sourceLine = sourcePage ? `<p style="margin:0 0 12px;color:#6b7280;font-size:13px;">Source page: ${escapeHtml(sourcePage)}</p>` : "";

  return {
    recommendationCount,
    textBody: [
      `${profileName} Chat Transcript`,
      `Generated (UTC): ${submittedAt}`,
      sourcePage ? `Source Page: ${sourcePage}` : null,
      "",
      ...textSections
    ].filter(Boolean).join("\n"),
    htmlBody: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#faf8f3;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;">
          <p style="margin:0 0 8px;color:#111827;font-size:14px;">${salutation}</p>
          <h1 style="margin:0 0 8px;color:#111827;font-size:24px;">Your ${escapeHtml(profileName)} chat transcript</h1>
          <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Generated ${escapeHtml(submittedAt)}.</p>
          ${sourceLine}
          ${htmlSections.join("")}
        </div>
      </div>
    `
  };
}

// ============================================
// MIDDLEWARE
// ============================================

app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid JSON format", message: err.message }, 400);
  }
  console.error(`Status: ${err.name}`, err.message);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.options('/chat', () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  });
});

app.get('/', (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  return c.text(`${profile.storeName} Vehicle Chat API`);
});

// ============================================
// PROFILE CONFIG (public-safe subset for frontend)
// ============================================

app.get('/chat/config', async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  let catalogFacets = null;

  try {
    const facetFilters = !profile.allowCrossBrand && profile.brandName
      ? { make: profile.brandName }
      : {};
    catalogFacets = await getCatalogFacets(c.env.VEHICLES_DB, facetFilters);
  } catch (error) {
    console.error('[Config] Failed to build catalog facets:', error);
  }

  return c.json({
    profileType: profile.profileType,
    storeName: profile.storeName,
    storeDescription: profile.storeDescription,
    brandName: profile.brandName ?? null,
    guidedFlowType: profile.guidedFlowType,
    welcomeMessage: profile.welcomeMessage,
    quickStartSuggestions: profile.quickStartSuggestions,
    features: profile.features,
    catalogFacets,
    brandContent: profile.brandContent ? {
      shippingPolicy: profile.brandContent.shippingPolicy,
      returnPolicy: profile.brandContent.returnPolicy,
      storeHours: profile.brandContent.storeHours,
      dealerLocatorUrl: profile.brandContent.dealerLocatorUrl,
      heritage: profile.brandContent.heritage,
    } : null,
  });
});

// ============================================
// LEAD CAPTURE
// ============================================

app.post("/chat/lead", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);

  try {
    const body = await c.req.json();
    const { email, name, intentSignal, sessionId, sourcePage, tastePreferences } = body;

    if (!email || typeof email !== 'string') {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
      devLog(c.env, '[Lead Capture] ANALYTICS_DB not configured, skipping DB write');
      return c.json({ ok: true, leadId: null, message: 'Lead capture not configured' });
    }

    const leadId = await recordLeadCapture(c.env.ANALYTICS_DB, {
      sessionId: sessionId || 'unknown',
      email,
      name: name || null,
      intentSignal: intentSignal || 'general',
      profileType: profile.profileType,
      tastePreferences: tastePreferences || null,
      sourcePage: sourcePage || null,
    });

    devLog(c.env, `[Lead Capture] Lead captured: ${leadId} (${email})`);

    return c.json({ ok: true, leadId });
  } catch (error: any) {
    console.error('[Lead Capture] Error:', error.message);
    return c.json({ error: 'Failed to capture lead' }, 500);
  }
});

app.post("/chat/transcript", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);

  try {
    const body = await c.req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const subscribe = Boolean(body?.subscribe);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "unknown";
    const sourcePage = typeof body?.sourcePage === "string" ? body.sourcePage.trim() : null;
    const transcriptMessages = normalizeTranscriptMessages(body?.messages);
    const ip = c.req.header("CF-Connecting-IP") || "unknown";

    if (!email) {
      return c.json({ ok: false, error: "validation_error", message: "Email is required." }, 400);
    }
    if (!isValidEmail(email)) {
      return c.json({ ok: false, error: "validation_error", message: "Email format is invalid." }, 400);
    }
    if (transcriptMessages.length === 0) {
      return c.json({ ok: false, error: "validation_error", message: "No transcript content is available to send." }, 400);
    }

    const now = Date.now();
    if (isTranscriptRateLimited(ip, now)) {
      return c.json({ ok: false, error: "rate_limited", message: "Too many transcript requests. Please try again later." }, 429);
    }

    const submittedAt = new Date(now).toISOString();
    const { textBody, htmlBody, recommendationCount } = buildTranscriptEmail(
      profile.storeName,
      transcriptMessages,
      name || null,
      sourcePage,
      submittedAt
    );

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: TRANSCRIPT_FROM,
        to: [email],
        subject: `Your ${profile.storeName} chat transcript`,
        text: textBody,
        html: htmlBody
      })
    });

    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok || !resendData?.id) {
      console.error("[Transcript] Resend error:", resendData);
      return c.json({ ok: false, error: "email_provider_error", message: "Transcript email could not be delivered." }, 502);
    }

    let leadId: string | null = null;
    if (subscribe && isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
      leadId = await recordLeadCapture(c.env.ANALYTICS_DB, {
        sessionId,
        email,
        name: name || null,
        intentSignal: "transcript_opt_in",
        profileType: profile.profileType,
        tastePreferences: {
          messageCount: transcriptMessages.length,
          recommendationCount
        },
        sourcePage
      });
    }

    return c.json({ ok: true, id: resendData.id, leadId });
  } catch (error) {
    console.error("[Transcript] Unexpected error:", error);
    return c.json({ ok: false, error: "internal_error", message: "Unexpected error while sending transcript." }, 500);
  }
});

// ============================================
// FEEDBACK
// ============================================

app.post("/feedback", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);

  try {
    const formData = await c.req.formData();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim().toLowerCase();
    const message = String(formData.get("message") ?? "").trim();
    const rawStore = String(formData.get("store") ?? "");
    const source = String(formData.get("source") ?? "widget").trim();
    const pageUrl = String(formData.get("pageUrl") ?? "").trim();
    const userAgent = String(formData.get("userAgent") ?? "").trim() || c.req.header("user-agent") || "";
    const screenshot = formData.get("screenshot");
    const ip = c.req.header("CF-Connecting-IP") || "unknown";

    const store = normalizeStore(rawStore);
    if (!store) {
      return c.json({ ok: false, error: "validation_error", message: "Store is required." }, 400);
    }
    if (!["bug", "quality", "safety", "other"].includes(type)) {
      return c.json({ ok: false, error: "validation_error", message: "Invalid feedback type." }, 400);
    }
    if (!message || message.length < 5 || message.length > FEEDBACK_MAX_MESSAGE_LEN) {
      return c.json({ ok: false, error: "validation_error", message: "Message must be between 5 and 4000 characters." }, 400);
    }
    if (email && !isValidEmail(email)) {
      return c.json({ ok: false, error: "validation_error", message: "Email format is invalid." }, 400);
    }

    const now = Date.now();
    if (isRateLimited(ip, now)) {
      return c.json({ ok: false, error: "rate_limited", message: "Too many submissions. Please try again later." }, 429);
    }

    let attachment: { filename: string; content: string; content_type: string } | undefined;
    if (screenshot && screenshot instanceof File && screenshot.size > 0) {
      if (screenshot.size > FEEDBACK_MAX_FILE_SIZE) {
        return c.json({ ok: false, error: "file_too_large", message: "Screenshot must be 5MB or smaller." }, 413);
      }
      if (!ALLOWED_SCREENSHOT_MIME.has(screenshot.type)) {
        return c.json({ ok: false, error: "unsupported_file_type", message: "Only PNG, JPEG, and WEBP screenshots are allowed." }, 415);
      }

      const bytes = new Uint8Array(await screenshot.arrayBuffer());
      attachment = {
        filename: screenshot.name || "feedback-screenshot",
        content: toBase64(bytes),
        content_type: screenshot.type
      };
    }

    const submittedAt = new Date(now).toISOString();
    const subject = `[${profile.storeName} Feedback][store:${store}][type:${type}]`;
    const textBody = [
      `Store (normalized): ${store}`,
      `Store (raw): ${rawStore || "N/A"}`,
      `Source: ${source || "N/A"}`,
      `Submitted At (UTC): ${submittedAt}`,
      `Name: ${name || "N/A"}`,
      `Email: ${email || "N/A"}`,
      `Type: ${type}`,
      `Page URL: ${pageUrl || "N/A"}`,
      `User Agent: ${userAgent || "N/A"}`,
      `IP: ${ip}`,
      `Screenshot: ${attachment ? "Attached" : "None"}`,
      "",
      "Message:",
      message
    ].join("\n");

    const htmlBody = `
      <h2>${escapeHtml(profile.storeName)} Feedback Submission</h2>
      <p><strong>Store (normalized):</strong> ${escapeHtml(store)}</p>
      <p><strong>Store (raw):</strong> ${escapeHtml(rawStore || "N/A")}</p>
      <p><strong>Source:</strong> ${escapeHtml(source || "N/A")}</p>
      <p><strong>Submitted At (UTC):</strong> ${escapeHtml(submittedAt)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name || "N/A")}</p>
      <p><strong>Email:</strong> ${escapeHtml(email || "N/A")}</p>
      <p><strong>Type:</strong> ${escapeHtml(type)}</p>
      <p><strong>Page URL:</strong> ${escapeHtml(pageUrl || "N/A")}</p>
      <p><strong>User Agent:</strong> ${escapeHtml(userAgent || "N/A")}</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      <p><strong>Screenshot:</strong> ${attachment ? "Attached" : "None"}</p>
      <hr />
      <p><strong>Message</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

    const resendPayload: Record<string, unknown> = {
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      subject,
      text: textBody,
      html: htmlBody
    };
    if (attachment) {
      resendPayload.attachments = [attachment];
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resendPayload)
    });

    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok || !resendData?.id) {
      console.error("[Feedback] Resend error:", resendData);
      return c.json({ ok: false, error: "email_provider_error", message: "Feedback could not be delivered." }, 502);
    }

    return c.json({ ok: true, id: resendData.id });
  } catch (err) {
    console.error("[Feedback] Unexpected error:", err);
    return c.json({ ok: false, error: "internal_error", message: "Unexpected error while sending feedback." }, 500);
  }
});

// ============================================
// VEHICLE COMPARISON
// ============================================

app.post("/chat/compare", async (c) => {
  try {
    const body = await c.req.json();
    const { vehicle1, vehicle2 } = body;

    if (!vehicle1 || !vehicle2) {
      return c.json({ error: 'Two vehicle names are required' }, 400);
    }

    const [results1, results2] = await Promise.all([
      lookupVehicleByName(c.env.VEHICLES_DB, vehicle1, 1),
      lookupVehicleByName(c.env.VEHICLES_DB, vehicle2, 1),
    ]);

    if (results1.length === 0 || results2.length === 0) {
      return c.json({
        error: 'comparison_incomplete',
        found: {
          vehicle1: results1.length > 0 ? results1[0] : null,
          vehicle2: results2.length > 0 ? results2[0] : null,
        },
        message: `Could not find ${results1.length === 0 ? vehicle1 : vehicle2} in our catalog.`,
      });
    }

    return c.json({
      comparison: {
        vehicle1: results1[0],
        vehicle2: results2[0],
      },
    });
  } catch (error: any) {
    console.error('[Compare] Error:', error.message);
    return c.json({ error: 'Failed to compare vehicles' }, 500);
  }
});

// ============================================
// INTENT
// ============================================

app.post("/chat/intent", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const intentStartedAt = Date.now();

  const lastMessage = messages[messages.length - 1]?.content || "";

  const lastAssistantMsg = messages.filter((m: any) => m.role === 'assistant').pop();
  const lastAssistantContent = lastAssistantMsg?.content || '';

  const assistantQuery = lastAssistantContent;

  // CODEX cue detection — preserved from original
  const RECOMMEND_CUES = [
    'Let me check what we have that matches your needs',
    'I\'m pulling up vehicles that fit your criteria',
    'Checking our inventory based on what you described'
  ];

  const PRODUCT_CUES = [
    'Let me look up',
    'I\'ll pull up the details on'
  ];

  const hasRecommendCue = RECOMMEND_CUES.some(cue => lastAssistantContent.includes(cue));
  const hasProductCue = PRODUCT_CUES.some(cue => lastAssistantContent.includes(cue));

  // No CODEX cue → return general immediately
  if (!hasRecommendCue && !hasProductCue) {
    let derivedFilters = deriveVehicleFiltersFromText(lastMessage);
    const profile = getProfile(c.env.PROFILE_TYPE);
    if (derivedFilters && !profile.allowCrossBrand && profile.brandName) {
      derivedFilters = { ...derivedFilters, make: profile.brandName };
    }

    if (derivedFilters) {
      trackAnalytics(c, (db) =>
        recordIntentAnalysis(db, {
          analytics,
          userTextRaw,
          predictedIntent: "recommendation",
          predictedFilters: derivedFilters,
          status: "completed",
          latencyMs: Date.now() - intentStartedAt,
        })
      );

      return c.json({
        intent: 'recommendation',
        filters: derivedFilters,
        product_query: null,
        assistantQuery: assistantQuery
      });
    }

    trackAnalytics(c, (db) =>
      recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedIntent: "general",
        status: "completed",
        latencyMs: Date.now() - intentStartedAt,
      })
    );

    return c.json({
      intent: 'general',
      filters: {},
      product_query: null,
      assistantQuery: assistantQuery
    });
  }

  // PRODUCT_LOOKUP cue — extract product name
  if (hasProductCue) {
    const lookupMatch = lastAssistantContent.match(/Let me look up (.+?) for you/i)
                     || lastAssistantContent.match(/I'll pull up the details on (.+)/i);
    const productName = lookupMatch ? lookupMatch[1].trim() : lastMessage;

    trackAnalytics(c, (db) =>
      recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        productQuery: productName,
        status: "completed",
        latencyMs: Date.now() - intentStartedAt,
      })
    );

    return c.json({
      intent: 'product-question',
      filters: {},
      product_query: productName,
      assistantQuery: assistantQuery
    });
  }

  // CODEX:RECOMMEND — call LLM for vehicle filter extraction
  const API_KEY = getApiKey(INTENT_PROVIDER, c.env);
  const MODEL = getModelForRole(INTENT_PROVIDER, "INTENT");
  const BASE_URL = getBaseUrl(INTENT_PROVIDER);

  const schemaInfo = getVehicleSchemaForPrompt();
  let tokenUsage: ReturnType<typeof buildTokenUsageResponse> = null;

  const prompt = generateIntentWithCuePrompt(lastAssistantContent, lastMessage, schemaInfo);

  let text: string;
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildChatCompletionPayload(
        INTENT_PROVIDER,
        MODEL,
        [{ role: "system", content: prompt }],
        0,
        4000,
        false
      ))
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Intent API error (${resp.status}):`, errorText);
      throw new Error(`Intent API returned ${resp.status}: ${errorText}`);
    }

    const data = await resp.json();
    text = data.choices?.[0]?.message?.content || "";
    tokenUsage = buildTokenUsageResponse(MODEL, data.usage, TIER);

    if (!text || text.trim().length === 0) {
      console.error("Intent API returned empty response:", JSON.stringify(data, null, 2));
      throw new Error("Intent API returned empty content");
    }

  } catch (err) {
    console.error(`/intent api error: ${err}`);

    trackAnalytics(c, (db) =>
      recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        status: "error",
        errorCode: "intent_api_error",
        latencyMs: Date.now() - intentStartedAt,
      })
    );

    return c.json({
      error: "Our AI understanding service is experiencing technical difficulties. Please try again.",
      service: "intent",
      intent: "general",
      filters: {},
      assistantQuery: assistantQuery,
      details: {
        message: err instanceof Error ? err.message : String(err),
        provider: INTENT_PROVIDER
      }
    }, 503);
  }

  // Parse response
  const parseResult = parseRobustJSON(text);

  if (!parseResult.success) {
    console.error("Failed to parse intent response:", {
      error: parseResult.error,
      rawResponse: text?.substring(0, 500)
    });

    trackAnalytics(c, (db) =>
      recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        status: "error",
        errorCode: "intent_json_parse_error",
        latencyMs: Date.now() - intentStartedAt,
      })
    );

    return c.json({
      error: "Filter extraction failed - JSON parsing error",
      intent: "recommendation",
      filters: {},
      product_query: null,
      assistantQuery: assistantQuery
    }, 400);
  }

  const parsed = parseResult.data;

  // Validate and normalize vehicle filters
  const normalizedFilters = validateVehicleFilters(parsed.filters || {});

  // Apply brand constraint for Brand Concierge profile
  const profile = getProfile(c.env.PROFILE_TYPE);
  if (!profile.allowCrossBrand && profile.brandName) {
    normalizedFilters.make = profile.brandName;
  }

  trackAnalytics(c, (db) =>
    recordIntentAnalysis(db, {
      analytics,
      userTextRaw,
      predictedCue: "RECOMMEND",
      predictedIntent: "recommendation",
      predictedFilters: normalizedFilters,
      status: "completed",
      latencyMs: Date.now() - intentStartedAt,
    })
  );

  return c.json({
    intent: "recommendation",
    filters: normalizedFilters,
    product_query: null,
    assistantQuery: assistantQuery,
    ...(tokenUsage ? { tokenUsage } : {})
  });
});

// ============================================
// PRODUCT LOOKUP (D1 name search)
// ============================================

app.post("/chat/product-lookup", async (c) => {
  const body = await c.req.json();
  const productQuery = body.product_query || "";
  const messages = body.messages || [];
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages) || productQuery;
  const lookupStartedAt = Date.now();

  if (!productQuery) {
    trackAnalytics(c, (db) =>
      recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        status: "error",
        fallbackReason: "missing_product_query",
        latencyMs: Date.now() - lookupStartedAt,
      })
    );

    return c.json({
      product: null,
      confidence: 0,
      needsClarification: false,
      message: "No vehicle query provided"
    });
  }

  try {
    // D1 name search — replaces Vectorize semantic search
    const results = await lookupVehicleByName(c.env.VEHICLES_DB, productQuery, 3);

    if (results.length === 0) {
      trackAnalytics(c, (db) =>
        recordProductLookupResult(db, {
          analytics,
          userTextRaw,
          productQuery,
          predictedCue: "PRODUCT_LOOKUP",
          predictedIntent: "product-question",
          status: "completed",
          fallbackReason: "no_match",
          latencyMs: Date.now() - lookupStartedAt,
        })
      );

      return c.json({
        product: null,
        confidence: 0,
        needsClarification: false,
        message: "I couldn't find that vehicle in our inventory. Would you like me to search for recommendations?"
      });
    }

    const vehicleLabel = (vehicle: VehicleResult) =>
      [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
    const lookupTokens = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    const hasDirectVehicleNameMatch = (query: string, vehicle: VehicleResult) => {
      const queryTokens = new Set(lookupTokens(query));
      const labelTokens = lookupTokens(vehicleLabel(vehicle));
      return labelTokens.length > 0 && labelTokens.every((token) => queryTokens.has(token));
    };

    const topScore = Number((results[0] as any)?.lookup_score ?? 0);
    const secondScore = Number((results[1] as any)?.lookup_score ?? 0);
    const hasDirectTopMatch = hasDirectVehicleNameMatch(productQuery, results[0]);
    const hasDirectSecondMatch = results[1] ? hasDirectVehicleNameMatch(productQuery, results[1]) : false;
    const hasConfidentTopMatch =
      results.length === 1 ||
      (hasDirectTopMatch && !hasDirectSecondMatch) ||
      (topScore >= 60 && topScore >= secondScore + 20);

    if (hasConfidentTopMatch) {
      const vehicle = results[0];

      trackAnalytics(c, (db) =>
        recordProductLookupResult(db, {
          analytics,
          userTextRaw,
          productQuery,
          predictedCue: "PRODUCT_LOOKUP",
          predictedIntent: "product-question",
          product: {
            id: vehicle.id,
            name: vehicleLabel(vehicle),
            brand: vehicle.make,
            category: vehicle.body_type,
            rankPosition: 1,
            sourceKind: "product_lookup",
          },
          status: "completed",
          latencyMs: Date.now() - lookupStartedAt,
        })
      );

      return c.json({
        product: vehicle,
        confidence: 1.0,
        needsClarification: false
      });
    }

    // Multiple matches — needs clarification
    const topNames = results.map(vehicleLabel).filter(Boolean);

    trackAnalytics(c, (db) =>
      recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        productQuery,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        needsClarification: true,
        status: "completed",
        fallbackReason: "clarification",
        latencyMs: Date.now() - lookupStartedAt,
      })
    );

    return c.json({
      product: null,
      confidence: 0.5,
      needsClarification: true,
      suggestedNames: topNames,
      message: topNames.length > 1
        ? `Did you mean ${topNames.slice(0, -1).join(', ')} or ${topNames[topNames.length - 1]}?`
        : `Did you mean ${topNames[0]}?`
    });

  } catch (err) {
    console.error("Vehicle lookup error:", err);
    trackAnalytics(c, (db) =>
      recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        productQuery,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        status: "error",
        fallbackReason: "lookup_error",
        latencyMs: Date.now() - lookupStartedAt,
      })
    );
    return c.json({
      product: null,
      confidence: 0,
      needsClarification: false,
      error: "Vehicle lookup service temporarily unavailable",
      message: "I'm having trouble searching for that vehicle. Would you like me to search for recommendations instead?"
    });
  }
});

// ============================================
// STREAM (SSE passthrough — preserved from original)
// ============================================

app.post("/chat/stream", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  const productContext = body.productContext || null;
  const clarificationContext = body.clarificationContext || null;
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const streamStartedAt = Date.now();

  // Clarification bypass — return text directly as SSE
  if (clarificationContext) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sseEvent = `data: ${JSON.stringify({
          choices: [{
            delta: { content: clarificationContext },
            finish_reason: null
          }]
        })}\n\n`;
        controller.enqueue(encoder.encode(sseEvent));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    trackAnalytics(c, (db) =>
      recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        assistantResponseText: clarificationContext,
        latencyMs: Date.now() - streamStartedAt,
        status: "completed",
      })
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const API_KEY = getApiKey(STREAM_PROVIDER, c.env);
  const MODEL = getModelForRole(STREAM_PROVIDER, "STREAM");
  const BASE_URL = getBaseUrl(STREAM_PROVIDER);

  const lastMessages = messages.slice(-10);
  const enrichedHistory = lastMessages.map((msg: any) => {
    if (msg.recommendations?.length > 0) {
      const names = msg.recommendations.map((p: any) => p.name).join(", ");
      return {
        role: "assistant",
        content: `${msg.content}\n\nI recommended: ${names}.`
      };
    }
    return { role: msg.role, content: msg.content };
  });

  const conversation_history = formatConversationHistory(enrichedHistory);
  const user_message = enrichedHistory[enrichedHistory.length - 1]?.content || "";

  const prompt = generatePrompt(
    "llama",
    user_message,
    conversation_history,
    productContext || "",
    clarificationContext || undefined,
    false,
    c.env.PROFILE_TYPE
  );

  const cleanMessages = sanitizeMessagesForLLM(lastMessages);

  const messagesForLLM = [
    { role: "system", content: "Hello." },
    { role: "system", content: prompt },
    ...cleanMessages
  ];

  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildChatCompletionPayload(
        STREAM_PROVIDER,
        MODEL,
        messagesForLLM,
        0.1,
        900,
        true
      ))
    });

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Network error";
      console.error(`Stream API error (${response?.status || 'network'}):`, errorText);
      trackAnalytics(c, (db) =>
        recordStreamCompletion(db, {
          analytics,
          userTextRaw,
          latencyMs: Date.now() - streamStartedAt,
          status: "error",
          errorCode: "stream_api_error",
        })
      );
      return c.json({
        error: "Our streaming service is experiencing technical difficulties. Please try again.",
        service: "stream",
        details: {
          status: response?.status || null,
          statusText: response?.statusText || "Network error",
          provider: STREAM_PROVIDER
        }
      }, 503);
    }

  } catch (err) {
    console.error(`Stream Error: ${err}`);
    trackAnalytics(c, (db) =>
      recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        latencyMs: Date.now() - streamStartedAt,
        status: "error",
        errorCode: "stream_network_error",
      })
    );
    return c.json({
      error: "Our streaming service is experiencing technical difficulties. Please try again.",
      service: "stream",
      details: {
        message: err instanceof Error ? err.message : String(err),
        provider: STREAM_PROVIDER
      }
    }, 503);
  }

  if (!response?.body) {
    trackAnalytics(c, (db) =>
      recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        latencyMs: Date.now() - streamStartedAt,
        status: "error",
        errorCode: "stream_missing_body",
      })
    );

    return c.json({
      error: "Our streaming service is experiencing technical difficulties. Please try again.",
      service: "stream",
      details: {
        status: response?.status || null,
        statusText: response?.statusText || "Missing response body",
        provider: STREAM_PROVIDER
      }
    }, 503);
  }

  // SSE passthrough with analytics mirroring — preserved from original
  const { readable, writable } = new TransformStream();
  const upstreamReader = response.body.getReader();
  const downstreamWriter = writable.getWriter();
  const decoder = new TextDecoder("utf-8");

  if (isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    c.executionCtx.waitUntil((async () => {
      let buffer = "";
      let assistantResponseText = "";

      const consumeSseBuffer = (rawBuffer: string, flush = false): string => {
        const parts = rawBuffer.split("\n\n");
        const completeParts = flush ? parts : parts.slice(0, -1);

        for (const part of completeParts) {
          const event = part.trim();
          if (!event) continue;

          const dataIndex = event.indexOf("data: ");
          if (dataIndex === -1) continue;

          const jsonStr = event.slice(dataIndex + 6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content ?? "";
            if (token) {
              assistantResponseText += token;
            }
          } catch (error) {
            console.error("[STREAM] Failed to parse SSE chunk for analytics:", error);
          }
        }

        return flush ? "" : parts[parts.length - 1];
      };

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          if (value) {
            await downstreamWriter.write(value);
            buffer += decoder.decode(value, { stream: true });
            buffer = consumeSseBuffer(buffer, false);
          }
        }

        buffer += decoder.decode();
        consumeSseBuffer(buffer, true);
      } catch (error) {
        console.error("[STREAM] Failed while mirroring upstream SSE:", error);
      } finally {
        try {
          await downstreamWriter.close();
        } catch {
          // Ignore close races if the client disconnects mid-stream.
        }
      }

      await recordStreamCompletion(c.env.ANALYTICS_DB!, {
        analytics,
        userTextRaw,
        assistantResponseText,
        latencyMs: Date.now() - streamStartedAt,
        status: "completed",
      });
    })().catch((error) => {
      console.error("[STREAM] Analytics mirror task failed:", error);
    }));
  } else {
    c.executionCtx.waitUntil((async () => {
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          if (value) {
            await downstreamWriter.write(value);
          }
        }
      } finally {
        try {
          await downstreamWriter.close();
        } catch {
          // Ignore close races if the client disconnects mid-stream.
        }
      }
    })());
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
});

// ============================================
// RECOMMENDATIONS (D1 SQL + optional LLM re-ranking)
// ============================================

app.post("/chat/recommendations", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  let filters: VehicleFilters = body.filters || {};
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const recommendationsStartedAt = Date.now();

  // Validate filters
  filters = validateVehicleFilters(filters);

  // Apply brand constraint for Brand Concierge profile
  const profile = getProfile(c.env.PROFILE_TYPE);
  if (!profile.allowCrossBrand && profile.brandName) {
    filters.make = profile.brandName;
  }

  const lastMessages = messages.slice(-5);
  const enrichedHistory = lastMessages.map((msg: any) => {
    if (msg.recommendations?.length > 0) {
      const names = msg.recommendations.map((p: any) => p.name).join(", ");
      return {
        role: "assistant",
        content: `${msg.content}\n\nI recommended: ${names}.`
      };
    }
    return { role: msg.role, content: msg.content };
  });

  const user_message = enrichedHistory[enrichedHistory.length - 1]?.content || "";
  const lastAssistantMessage = enrichedHistory.slice(-2).find((m: any) => m.role === 'assistant')?.content || "";

  // D1 SQL search — replaces Vectorize
  let results: VehicleResult[] = [];
  let searchFallbackReason = 'exact_match';
  let appliedSearchFilters = filters;
  try {
    const searchResult = await searchVehiclesWithFallback(c.env.VEHICLES_DB, filters, 8);
    results = searchResult.results;
    searchFallbackReason = searchResult.fallbackReason;
    appliedSearchFilters = searchResult.appliedFilters;
  } catch (err) {
    console.error("Vehicle search error:", err);
    trackAnalytics(c, (db) =>
      recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        predictedFilters: filters,
        recommendations: [],
        preRankedCount: 0,
        finalRankCount: 0,
        status: "error",
        errorCode: "vehicle_search_error",
        fallbackReason: `search:${searchFallbackReason}|vehicle_search_error`,
        latencyMs: Date.now() - recommendationsStartedAt,
      })
    );
    return c.json({ recommendations: [], error: "Vehicle search error" }, 200);
  }

  if (results.length === 0) {
    trackAnalytics(c, (db) =>
      recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        predictedFilters: filters,
        recommendations: [],
        preRankedCount: 0,
        finalRankCount: 0,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}`,
        latencyMs: Date.now() - recommendationsStartedAt,
      })
    );

    return c.json({
      recommendations: [],
      error: "No vehicles found matching your criteria",
      service: "recommendations",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason,
    }, 200);
  }

  // Create product map for re-ranking lookup
  const productMap = new Map(results.map((r) => [r.id, r]));

  // Skip re-ranking for small result sets
  if (results.length <= RERANK_SKIP_CANDIDATE_MAX) {
    trackAnalytics(c, (db) =>
      recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        predictedFilters: filters,
        recommendations: results.map((result, index) => ({
          id: typeof result.id === "string" ? result.id : null,
          name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
          brand: typeof result.make === "string" ? result.make : null,
          category: result.body_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation",
        })),
        preRankedCount: results.length,
        finalRankCount: results.length,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}|rerank_skipped_small_candidate_set`,
        latencyMs: Date.now() - recommendationsStartedAt,
      })
    );

    return c.json({
      recommendations: results,
      preRankedProducts: results,
      reasoning: "Skipped rerank because the candidate set was already narrow.",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason,
    }, 200);
  }

  // LLM re-ranking
  const API_KEY = getApiKey(RERANK_PROVIDER, c.env);
  const MODEL = getModelForRole(RERANK_PROVIDER, "RECOMMEND");
  const BASE_URL = getBaseUrl(RERANK_PROVIDER);

  let tokenUsage: ReturnType<typeof buildTokenUsageResponse> = null;

  const queryForReranking = lastAssistantMessage || user_message;
  const rerankCandidates = buildCompactRerankCandidates(results);
  const reRankPrompt = generateReRankPrompt(queryForReranking, filters, rerankCandidates);

  let text;
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildChatCompletionPayload(
        RERANK_PROVIDER,
        MODEL,
        [{ role: "system", content: reRankPrompt }],
        0.1,
        2500,
        false
      ))
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Re-ranking API error (${resp.status}):`, errorText);

      trackAnalytics(c, (db) =>
        recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
            brand: typeof result.make === "string" ? result.make : null,
            category: result.body_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation",
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_api_error",
          fallbackReason: `search:${searchFallbackReason}|rerank_api_error`,
          latencyMs: Date.now() - recommendationsStartedAt,
        })
      );

      return c.json({
        recommendations: results,
        error: "Showing results without AI ranking.",
        service: "recommendations",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
      }, 200);
    }

    const data = await resp.json();
    text = data.choices?.[0]?.message?.content || "";
    tokenUsage = buildTokenUsageResponse(MODEL, data.usage, TIER);

    if (!text || text.trim().length === 0) {
      console.error("Re-ranking API returned empty response");

      trackAnalytics(c, (db) =>
        recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
            brand: typeof result.make === "string" ? result.make : null,
            category: result.body_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation",
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_empty_response",
          fallbackReason: `search:${searchFallbackReason}|rerank_empty_response`,
          latencyMs: Date.now() - recommendationsStartedAt,
        })
      );

      return c.json({
        recommendations: results,
        error: "Showing results without AI ranking.",
        service: "recommendations",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...(tokenUsage ? { tokenUsage } : {})
      }, 200);
    }

    // Parse re-ranking response
    const parseResult = parseRobustJSON(text);

    if (!parseResult.success) {
      console.error("Failed to parse re-ranking response:", {
        error: parseResult.error,
        rawResponse: text?.substring(0, 500)
      });

      trackAnalytics(c, (db) =>
        recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
            brand: typeof result.make === "string" ? result.make : null,
            category: result.body_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation",
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_json_parse_error",
          fallbackReason: `search:${searchFallbackReason}|rerank_json_parse_error`,
          latencyMs: Date.now() - recommendationsStartedAt,
        })
      );

      return c.json({
        recommendations: results,
        error: "Re-ranking parse error - showing unranked results",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...(tokenUsage ? { tokenUsage } : {})
      }, 200);
    }

    const parsedRerank = parseResult.data;
    const rankedIds = parsedRerank.ranked_ids || [];
    const reasoning = parsedRerank.reasoning || "No reasoning provided";

    devLog(c.env, "Re-ranking reasoning:", reasoning);

    // Map ranked IDs back to full vehicle objects
    const rankedProducts = rankedIds
      .map((id: string) => productMap.get(id))
      .filter((product: any) => product !== undefined);

    if (rankedProducts.length === 0) {
      trackAnalytics(c, (db) =>
        recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
            brand: typeof result.make === "string" ? result.make : null,
            category: result.body_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation",
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          fallbackReason: `search:${searchFallbackReason}|no_ranked_ids`,
          latencyMs: Date.now() - recommendationsStartedAt,
        })
      );

      return c.json({
        recommendations: results,
        error: "No ranked IDs found - showing unranked results",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...(tokenUsage ? { tokenUsage } : {})
      }, 200);
    }

    trackAnalytics(c, (db) =>
      recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        predictedFilters: filters,
        recommendations: rankedProducts.map((product: any, index: number) => ({
          id: typeof product.id === "string" ? product.id : null,
          name: [product.year, product.make, product.model].filter(Boolean).join(' ') || null,
          brand: typeof product.make === "string" ? product.make : null,
          category: product.body_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation",
        })),
        preRankedCount: results.length,
        finalRankCount: rankedProducts.length,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}`,
        latencyMs: Date.now() - recommendationsStartedAt,
      })
    );

    return c.json({
      recommendations: rankedProducts,
      preRankedProducts: results,
      reasoning: reasoning,
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason,
      ...(tokenUsage ? { tokenUsage } : {})
    }, 200);

  } catch (err) {
    console.error("Recommendation service error:", err);
    trackAnalytics(c, (db) =>
      recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        predictedFilters: filters,
        recommendations: results.map((result, index) => ({
          id: typeof result.id === "string" ? result.id : null,
          name: [result.year, result.make, result.model].filter(Boolean).join(' ') || null,
          brand: typeof result.make === "string" ? result.make : null,
          category: result.body_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation",
        })),
        preRankedCount: results.length,
        finalRankCount: results.length,
        status: "completed",
        errorCode: "recommendation_service_error",
        fallbackReason: `search:${searchFallbackReason}|recommendation_service_error`,
        latencyMs: Date.now() - recommendationsStartedAt,
      })
    );

    return c.json({
      recommendations: results,
      error: "Showing results without AI ranking.",
      service: "recommendations",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason,
    }, 200);
  }
});

// ============================================
// ANALYTICS EVENT
// ============================================

app.post("/chat/analytics/event", async (c) => {
  const body = await c.req.json();

  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }

  try {
    await recordAnalyticsEvent(c.env.ANALYTICS_DB!, {
      eventId: typeof body?.event_id === "string" ? body.event_id : null,
      sessionId: typeof body?.session_id === "string" ? body.session_id : null,
      messageId: typeof body?.message_id === "string" ? body.message_id : null,
      eventType: typeof body?.event_type === "string" ? body.event_type : null,
      productId: typeof body?.product_id === "string" ? body.product_id : null,
      rankPosition: typeof body?.rank_position === "number" ? body.rank_position : null,
      payload: body?.payload,
      browserToken: typeof body?.browser_token === "string" ? body.browser_token : null,
      predecessorSessionId: typeof body?.predecessor_session_id === "string" ? body.predecessor_session_id : null,
      occurredAt: typeof body?.occurred_at === "string" ? body.occurred_at : null,
    });

    return c.json({ ok: true }, 202);
  } catch (error) {
    console.error("[Chat Analytics] Event write failed:", error);
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/chat/age-gate-rendered", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }

  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);

    trackAnalytics(c, (db) => recordAgeGateRendered(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post("/chat/age-confirmed", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }

  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);

    trackAnalytics(c, (db) => recordAgeConfirmed(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post("/chat/age-declined", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }

  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);

    trackAnalytics(c, (db) => recordAgeDeclined(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

export default app;
