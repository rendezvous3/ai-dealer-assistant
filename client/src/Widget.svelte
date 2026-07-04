<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import ChatWidget from "../../Svelte-Component-Library/src/lib/custom/ChatWidget/ChatWidget.svelte";
  import ChatMessage from "../../Svelte-Component-Library/src/lib/custom/ChatMessage/ChatMessage.svelte";
  import ShimmerText from "../../Svelte-Component-Library/src/lib/custom/ShimmerText/ShimmerText.svelte";
  import WelcomeQuickStart from "../../Svelte-Component-Library/src/lib/custom/WelcomeQuickStart/WelcomeQuickStart.svelte";
  import TranscriptShareCard from "../../Svelte-Component-Library/src/lib/custom/TranscriptShareCard/TranscriptShareCard.svelte";
  import EducationPanel from "./components/EducationPanel.svelte";
  import type { QuickStartRequest } from "../../Svelte-Component-Library/src/lib/custom/QuickStartPanel/QuickStartPanel.svelte";
  import type { GuidedFlowConfig } from "../../Svelte-Component-Library/src/lib/custom/GuidedFlow/types.js";
  import type { WidgetPosition } from "./embed-config";
  import {
    WIDGET_CLOSE_EVENT,
    WIDGET_OPEN_EVENT,
    WIDGET_ROOT_ID,
    dispatchWidgetLifecycleEvent,
    subscribeToWidgetCommands
  } from "./embed-bridge";
  import { theme } from "./theme.svelte.js";
  import { CAR_EDUCATION_PANELS } from './car-education';

  const dealerHeaderIcon = `data:image/svg+xml,${encodeURIComponent(`
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 56L27 38C28.6 33.8 32.6 31.2 37.1 31.2H58.9C63.4 31.2 67.4 33.8 69 38L76 56" stroke="#38BDF8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 55H77V67.5C77 70.8 74.3 73.5 71 73.5H66.8C63.5 73.5 60.8 70.8 60.8 67.5V66.5H35.2V67.5C35.2 70.8 32.5 73.5 29.2 73.5H25C21.7 73.5 19 70.8 19 67.5V55Z" fill="#38BDF8"/>
      <circle cx="32" cy="63" r="5.8" fill="#0B1220"/>
      <circle cx="64" cy="63" r="5.8" fill="#0B1220"/>
      <path d="M36.5 40H59.5C61.8 40 63.8 41.4 64.7 43.5L67.1 49.4H28.9L31.3 43.5C32.2 41.4 34.2 40 36.5 40Z" fill="#0B1220"/>
      <path d="M39 23H57" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
      <path d="M25 29H32" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
      <path d="M64 29H71" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `)}`;

  const dealerSteeringWheelIcon = `data:image/svg+xml,${encodeURIComponent(`
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="48" cy="48" r="34" stroke="#0B1220" stroke-width="7"/>
      <circle cx="48" cy="48" r="9" fill="#0B1220"/>
      <path d="M20 48C27.5 43.6 37.8 41.2 48 41.2C58.2 41.2 68.5 43.6 76 48" stroke="#0B1220" stroke-width="7" stroke-linecap="round"/>
      <path d="M42.5 55.5L31.5 74.5" stroke="#0B1220" stroke-width="7" stroke-linecap="round"/>
      <path d="M53.5 55.5L64.5 74.5" stroke="#0B1220" stroke-width="7" stroke-linecap="round"/>
      <path d="M38 24H58" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
      <path d="M26 37H33" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
      <path d="M63 37H70" stroke="#E0F2FE" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `)}`;

  // Car SVG icons used where compact symbolic state is clearer than photos.
  const conditionUsedIcon = '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="7" y="18" width="34" height="15" rx="4" fill="#334155"/><path d="M12 18L16 10H32L36 18" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 23H32" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="33" r="4" fill="#0F172A"/><circle cx="32" cy="33" r="4" fill="#0F172A"/><path d="M11 14H15" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const conditionCpoIcon = '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="7" y="18" width="34" height="15" rx="4" fill="#0F766E"/><path d="M12 18L16 10H32L36 18" stroke="#2DD4BF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="33" r="4" fill="#134E4A"/><circle cx="32" cy="33" r="4" fill="#134E4A"/><circle cx="24" cy="23" r="7" fill="#ECFEFF"/><path d="M20.5 23L23 25.5L28 20.5" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const commuteIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M8 27H36L32 17C31.2 15 29.4 14 27.3 14H16.7C14.6 14 12.8 15 12 17L8 27Z" stroke="#38BDF8" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 27V31H31V27" stroke="#94A3B8" stroke-width="2.5"/><circle cx="15" cy="31" r="3" fill="#38BDF8"/><circle cx="29" cy="31" r="3" fill="#38BDF8"/><path d="M18 10H26" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const familyIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="8" y="15" width="28" height="17" rx="4" stroke="#38BDF8" stroke-width="2.5"/><path d="M13 15L16 10H28L31 15" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="32" r="3" fill="#38BDF8"/><circle cx="28" cy="32" r="3" fill="#38BDF8"/><path d="M16 23H28M22 19V27" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const adventureIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M8 30L17 17L24 26L29 20L37 30H8Z" stroke="#38BDF8" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 31H30" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/><path d="M26 12L29 9L32 12" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const commercialIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="7" y="17" width="19" height="14" rx="2.5" stroke="#38BDF8" stroke-width="2.5"/><path d="M26 22H33L37 27V31H26V22Z" stroke="#94A3B8" stroke-width="2.5" stroke-linejoin="round"/><circle cx="14" cy="32" r="3" fill="#38BDF8"/><circle cx="32" cy="32" r="3" fill="#38BDF8"/><path d="M12 13H23" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const performanceIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M9 28C10.5 19 15.2 14 22 14C28.8 14 33.5 19 35 28" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/><path d="M22 25L30 17" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/><path d="M13 29H31" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const ecoIcon = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M12 30C26 30 33 21 34 10C22 11 12 17 12 30Z" stroke="#2DD4BF" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 30C18 24 23 21 31 18" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/><path d="M8 32H20" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const safetyIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 6L31 10V18C31 25.5 26.4 31 20 34C13.6 31 9 25.5 9 18V10L20 6Z" stroke="#38BDF8" stroke-width="2.3" stroke-linejoin="round"/><path d="M16 20L19 23L25 16" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const fuelIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M12 32V8H24V32H12Z" stroke="#38BDF8" stroke-width="2.3" stroke-linejoin="round"/><path d="M24 14H28L31 18V30C31 31.1 30.1 32 29 32H27" stroke="#94A3B8" stroke-width="2.3" stroke-linecap="round"/><path d="M15 15H21" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const cargoIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="8" y="13" width="24" height="17" rx="3" stroke="#38BDF8" stroke-width="2.3"/><path d="M14 13V10H26V13M14 20H26" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const towingIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="7" y="17" width="18" height="11" rx="2" stroke="#38BDF8" stroke-width="2.3"/><path d="M25 22H31L34 25V28H25V22Z" stroke="#94A3B8" stroke-width="2.3" stroke-linejoin="round"/><circle cx="13" cy="29" r="2.5" fill="#F59E0B"/><circle cx="30" cy="29" r="2.5" fill="#F59E0B"/></svg>';
  const techIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="11" y="8" width="18" height="24" rx="3" stroke="#38BDF8" stroke-width="2.3"/><path d="M16 14H24M16 20H24M18 27H22" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const reliabilityIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M13 26L26 13" stroke="#38BDF8" stroke-width="2.3" stroke-linecap="round"/><path d="M24 8L32 16L27 21L19 13L24 8Z" stroke="#94A3B8" stroke-width="2.3" stroke-linejoin="round"/><path d="M12 27L9 31" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const powerIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 7L14 21H20L18 33L27 17H21L20 7Z" stroke="#F59E0B" stroke-width="2.3" stroke-linejoin="round"/><path d="M10 30H30" stroke="#38BDF8" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const luxuryIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 7L24 16L34 17L26.5 23.5L28.5 33L20 28L11.5 33L13.5 23.5L6 17L16 16L20 7Z" stroke="#38BDF8" stroke-width="2.3" stroke-linejoin="round"/><path d="M16 20H24" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const valueIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M9 17L20 8L31 17V31H9V17Z" stroke="#38BDF8" stroke-width="2.3" stroke-linejoin="round"/><path d="M16 23H24M20 19V27" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const comfortIcon = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M10 23C10 18 14 14 20 14C26 14 30 18 30 23V30H10V23Z" stroke="#38BDF8" stroke-width="2.3" stroke-linejoin="round"/><path d="M14 23H26" stroke="#F59E0B" stroke-width="2.3" stroke-linecap="round"/></svg>';
  const guideMenuIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7H14M6 10H14M6 13H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const carMenuIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="7" width="16" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 7L7 3H13L15 7" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="16" r="2" fill="currentColor"/><circle cx="14" cy="16" r="2" fill="currentColor"/></svg>';
  const dollarMenuIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 6V14M8 8.5C8 7.67 8.9 7 10 7C11.1 7 12 7.67 12 8.5C12 9.33 11.1 10 10 10C8.9 10 8 10.67 8 11.5C8 12.33 8.9 13 10 13C11.1 13 12 12.33 12 11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const evMenuIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M11 3L6 11H10L9 17L14 9H10L11 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const glossaryMenuIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 5H16M4 8H16M4 11H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="14" cy="13" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M16.5 15.5L18 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  interface WidgetProps {
    store?: string;
    apiBase?: string;
    assetBase?: string;
    position?: WidgetPosition;
    offsetX?: string;
    offsetY?: string;
    zIndex?: number;
    width?: string;
    height?: string;
    launcherIcon?: string;
    launcherLabel?: string;
    launcherBg?: string;
    hideLauncher?: boolean;
    ageGate?: boolean;
    debug?: boolean;
    onOpenStateChange?: (isOpen: boolean) => void;
  }

  const envStoreName = import.meta.env.VITE_STORE_NAME;
  const envApiBase = import.meta.env.VITE_API_URL;
  const envAssetBase = import.meta.env.VITE_ASSET_BASE;
  let {
    store = envStoreName ?? window.location.hostname ?? "demo-store",
    apiBase = envApiBase ?? "http://localhost:8787",
    assetBase = envAssetBase ?? '',
    position = 'bottom-right',
    offsetX = '20px',
    offsetY = '20px',
    zIndex = 2147483000,
    width = '426px',
    height = '702px',
    launcherIcon,
    launcherLabel = 'Open chat widget',
    launcherBg,
    hideLauncher = false,
    ageGate = false,
    debug = false,
    onOpenStateChange
  }: WidgetProps = $props();

  let isOpen = $state(false);
  let mode = $state<'chat' | 'guided-flow'>('chat');

  let BASE_URL = $derived(apiBase.replace(/\/chat\/?$/, "").replace(/\/$/, ""));
  let CHAT_BASE_URL = $derived(`${BASE_URL}/chat`);

  function assetUrl(path: string): string {
    const base = (assetBase ?? '').replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  function normalizeAssetImageUrl(url?: string): string {
    const trimmed = url?.trim();
    if (!trimmed) return '';
    if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    return assetUrl(trimmed);
  }

  function vehiclePhotoIcon(path: string, alt: string): string {
    return `<img src="${assetUrl(path)}" alt="${alt}" loading="lazy" decoding="async" />`;
  }

  let isInitialized = $state(false);

  const persistChat = false; // Set to true to re-enable localStorage persistence

  let STORAGE_KEY = $derived(`widget_chat_${store}`);
  let ANALYTICS_SESSION_KEY = $derived(`widget_chat_session_${store}`);
  let ANALYTICS_SESSION_LAST_ACTIVITY_KEY = $derived(`widget_chat_session_last_activity_${store}`);
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  let browserTokenFallback: string | null = null;

  function getOrCreateBrowserToken(): string {
    if (typeof window === 'undefined') return crypto.randomUUID();
    try {
      const storageKey = `cv_browser_token_v1_${store || 'demo-store'}`;
      const existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      const token = crypto.randomUUID();
      localStorage.setItem(storageKey, token);
      return token;
    } catch {
      browserTokenFallback ??= crypto.randomUUID();
      return browserTokenFallback;
    }
  }

  let browserToken = $state<string>(getOrCreateBrowserToken());
  interface ComparisonVehicle {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    condition?: string;
    body_type?: string;
    drive_type?: string;
    fuel_type?: string;
    price?: number;
    mileage?: number;
    description?: string;
    image_url?: string;
    source_url?: string;
  }

  interface Message {
    role: "user" | "assistant";
    content: string;
    recommendations?: Recommendation[];
    comparison?: { vehicle1: ComparisonVehicle; vehicle2: ComparisonVehicle };
    shimmer?: boolean;  // Add shimmer flag for loading messages
    id?: string;  // Unique identifier for Svelte keying
    analyticsMessageId?: string;
  }

  // Counter for generating unique message IDs
  let messageIdCounter = 0;

  interface Recommendation {
    id: string;
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    condition?: string;
    body_type?: string;
    drive_type?: string;
    fuel_type?: string;
    engine?: string;
    mileage?: number;
    price: number;
    msrp?: number;
    image?: string;
    image_url?: string;
    source_name?: string;
    source_url?: string;
    description?: string;
    key_features?: string[];
    use_case_tags?: string[];
    priority_tags?: string[];
    dealer_name?: string;
    rankPosition?: number;
  }

  interface CatalogFacets {
    makes: string[];
    bodyTypes: string[];
    conditions: string[];
  }

  // Profile config from backend
  interface ProfileConfig {
    profileType: 'brand_concierge' | 'merchant_advisor';
    storeName: string;
    storeDescription: string;
    brandName: string | null;
    guidedFlowType: 'brand' | 'merchant';
    welcomeMessage: string;
    quickStartSuggestions: Array<{ label: string; prompt: string }>;
    catalogFacets: CatalogFacets | null;
    features: {
      dealerLocator: boolean;
      leadCapture: boolean;
      crossBrandComparison: boolean;
    };
    brandContent: {
      shippingPolicy: string;
      returnPolicy: string;
      storeHours: string;
      dealerLocatorUrl: string;
      heritage: string;
    } | null;
  }

  let messages = $state<Message[]>([]);
  let input = $state("");
  let loading = $state(false);
  let analyticsSessionId = $state<string | null>(null);
  let profileConfig = $state<ProfileConfig | null>(null);
  let showTranscriptShare = $derived(
    profileConfig?.features.leadCapture &&
    messages.some((message) => (message.recommendations?.length ?? 0) > 0)
  );
  let comparisonData = $state<{ vehicle1: ComparisonVehicle; vehicle2: ComparisonVehicle } | null>(null);

  const COMPARE_PATTERN = /compare\s+(?:the\s+)?(.+?)\s+(?:and|with|vs\.?|versus)\s+(?:the\s+)?(.+?)(?:\s*[.?!]?\s*$)/i;

  function checkForGiftingIntent(_content: string) { }

  async function checkForComparison(text: string) {
    const match = text.match(COMPARE_PATTERN);
    if (!match) return;

    const vehicle1Name = match[1].trim();
    const vehicle2Name = match[2].trim();

    try {
      const res = await fetch(`${CHAT_BASE_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle1: vehicle1Name, vehicle2: vehicle2Name }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.comparison) {
        comparisonData = data.comparison;
        void sendAnalyticsEvent('comparison_requested', {
          payload: { vehicle1: vehicle1Name, vehicle2: vehicle2Name }
        });
      }
    } catch {
      // Comparison failed silently — the AI will still respond conversationally
    }
  }

  // Helper function to create messages with unique IDs
  function createMessage(role: "user" | "assistant", content: string, extras?: Partial<Message>): Message {
    return {
      id: `msg-${Date.now()}-${messageIdCounter++}`,
      role,
      content,
      ...extras
    };
  }

  function updateAnalyticsSessionActivity(timestamp = Date.now()) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(ANALYTICS_SESSION_LAST_ACTIVITY_KEY, String(timestamp));
  }

  function getOrCreateAnalyticsSessionId(forceNew = false): string {
    const now = Date.now();

    if (!forceNew && analyticsSessionId) {
      updateAnalyticsSessionActivity(now);
      return analyticsSessionId;
    }

    const lastActivityRaw = sessionStorage.getItem(ANALYTICS_SESSION_LAST_ACTIVITY_KEY);
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;
    const existingSessionId = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    const shouldRotate = forceNew || !existingSessionId || !lastActivity || (now - lastActivity) > SESSION_TIMEOUT_MS;
    const nextSessionId = shouldRotate ? crypto.randomUUID() : existingSessionId;

    if (shouldRotate && existingSessionId) {
      _predecessorSessionId = existingSessionId;
    }

    analyticsSessionId = nextSessionId;
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, nextSessionId);
    updateAnalyticsSessionActivity(now);
    return nextSessionId;
  }

  let _predecessorSessionId: string | null = null;

  function createAnalyticsContext(messageId = crypto.randomUUID()): AnalyticsContextPayload {
    return {
      session_id: getOrCreateAnalyticsSessionId(),
      message_id: messageId,
      source_page: window.location.pathname,
      store_id: store,
      browser_token: browserToken,
      predecessor_session_id: _predecessorSessionId,
      age_gate_required: ageGate,
    };
  }

  interface AnalyticsContextPayload {
    session_id: string;
    message_id: string;
    source_page: string;
    store_id: string;
    browser_token: string;
    predecessor_session_id: string | null;
    age_gate_required: boolean;
    source?: 'chat' | 'guided_flow';
    guided_flow_filters?: Record<string, unknown> | string | null;
  }

  async function sendAnalyticsEvent(
    eventType: string,
    options: {
      messageId?: string | null;
      productId?: string | null;
      rankPosition?: number | null;
      payload?: Record<string, unknown>;
      useBeacon?: boolean;
      sessionId?: string | null;
    } = {}
  ) {
    const sessionId = options.sessionId ?? analyticsSessionId;
    if (!sessionId) return;

    updateAnalyticsSessionActivity();

    const body = JSON.stringify({
      event_id: crypto.randomUUID(),
      session_id: sessionId,
      message_id: options.messageId ?? null,
      event_type: eventType,
      product_id: options.productId ?? null,
      rank_position: options.rankPosition ?? null,
      payload: options.payload ?? {},
      browser_token: browserToken,
      predecessor_session_id: _predecessorSessionId,
      occurred_at: new Date().toISOString()
    });

    const url = `${CHAT_BASE_URL}/analytics/event`;
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    };
    if (options.useBeacon) {
      fetchOptions.keepalive = true;
    }

    try {
      await fetch(url, fetchOptions);
    } catch (error) {
      if (debug) console.warn('[Analytics] Event send failed:', error);
    }
  }

  function resetAnalyticsSession() {
    if (analyticsSessionId) {
      _predecessorSessionId = analyticsSessionId;
    }
    analyticsSessionId = null;
    sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
    sessionStorage.removeItem(ANALYTICS_SESSION_LAST_ACTIVITY_KEY);
  }

  let productRecommendations = $state<Recommendation[]>([]);
  let suppressOpenUntil = $state(0);

  // Product registry to track ALL products shown to user (recommendations + lookups)
  // Removed productRegistry - stream has full conversation history and handles all intelligence

  // Prevent concurrent product lookups
  let productLookupInProgress = $state(false);

  // Abort controller for canceling previous lookups
  let currentLookupController: AbortController | null = null;

  // Store suggested product names from clarification for next query
  // Removed suggestedProductNames - stream handles all clarification intelligence

  // Track retry attempts for increasing search scope
  let retryAttempts = 0;

  // Removed FuzzyResult interface - no longer needed

  // CODEX Detection Constants
  const CODEX_PATTERNS = {
    RECOMMEND: [
      "Let me check what we have that matches your needs",
      "I'm pulling up vehicles that fit your criteria",
      "Checking our inventory based on what you described"
    ],
    PRODUCT_LOOKUP: [
      "Let me look up",
      "Let me check on",
      "Let me pull up",
      "I'll pull up the details",
      "Getting more details on"
    ]
  };

  // Detect CODEX cue in text
  function detectCodex(text: string): 'RECOMMEND' | 'PRODUCT_LOOKUP' | null {
    for (const pattern of CODEX_PATTERNS.RECOMMEND) {
      if (text.includes(pattern)) return 'RECOMMEND';
    }
    for (const pattern of CODEX_PATTERNS.PRODUCT_LOOKUP) {
      if (text.includes(pattern)) return 'PRODUCT_LOOKUP';
    }
    return null;
  }

  // Extract product name from PRODUCT_LOOKUP cue
  function extractProductName(text: string): string | null {
    if (debug) console.log('[Extract] Attempting to extract from:', text);

    // FOOLPROOF EXTRACTION: Product names are wrapped in double quotes
    // This handles ANY product name including periods, commas, special characters
    const quoteMatch = text.match(/"([^"]+)"/);
    if (quoteMatch && quoteMatch[1].trim()) {
      if (debug) console.log('[Extract] Extracted from quotes:', quoteMatch[1].trim());
      return quoteMatch[1].trim();
    }

    if (debug) console.log('[Extract] No quoted product name found - extraction failed!');
    return null;
  }

  // Removed fuzzyFindProduct - stream has conversation history and handles all product matching

  // Sidebar menu items for education, disclosure, and feedback
  const guideMenuPanels = {
    'guide-new-vs-used': CAR_EDUCATION_PANELS['new-vs-used'],
    'guide-body-type': CAR_EDUCATION_PANELS['body-type-guide'],
    'guide-financing': CAR_EDUCATION_PANELS['financing-basics'],
    'guide-ev-hybrid': CAR_EDUCATION_PANELS['ev-hybrid-guide'],
    'guide-glossary': CAR_EDUCATION_PANELS['glossary']
  } as const;

  type GuideMenuPanelId = keyof typeof guideMenuPanels;

  const menuItems = [
    { id: 'ai-disclosure', label: 'AI Disclosure', icon: 'about', iconType: 'svg' as const },
    { id: 'feedback', label: 'Send Feedback', icon: 'feedback', iconType: 'svg' as const },
    { id: 'menu-section-guides', label: 'Guides', type: 'section' as const },
    { id: 'guide-new-vs-used', label: 'New vs. Used vs. CPO', icon: guideMenuIcon, iconType: 'svg' as const },
    { id: 'guide-body-type', label: 'Body Type Guide', icon: carMenuIcon, iconType: 'svg' as const },
    { id: 'guide-financing', label: 'Financing Basics', icon: dollarMenuIcon, iconType: 'svg' as const },
    { id: 'guide-ev-hybrid', label: 'EV & Hybrid Guide', icon: evMenuIcon, iconType: 'svg' as const },
    { id: 'guide-glossary', label: 'Glossary', icon: glossaryMenuIcon, iconType: 'svg' as const }
  ];

  type PanelId =
    | GuideMenuPanelId
    | 'ai-disclosure'
    | 'feedback';
  type ExternalPanelId = 'ai-disclosure' | 'feedback';
  let activePanel = $state<PanelId | null>(null);
  let feedbackName = $state('');
  let feedbackEmail = $state('');
  let feedbackType = $state<'bug' | 'quality' | 'safety' | 'other'>('quality');
  let feedbackMessage = $state('');
  let feedbackNotice = $state('');
  let feedbackNoticeType = $state<'success' | 'error' | null>(null);
  let feedbackSending = $state(false);
  let feedbackScreenshotFile = $state<File | null>(null);
  let feedbackScreenshotPreview = $state('');
  let panelRef = $state<HTMLElement | null>(null);
  let panelBackButtonRef = $state<HTMLButtonElement | null>(null);
  let lastFocusedElement = $state<HTMLElement | null>(null);
  let a11yAnnouncement = $state('');
  const defaultQuickStarts: QuickStartRequest[] = [
    { label: 'Family SUV under $40k', prompt: 'I need a family SUV under $40,000' },
    { label: 'Reliable Daily Driver', prompt: 'looking for a reliable daily driver' },
    { label: 'Truck for Work or Adventure', prompt: 'need a truck for work and outdoor adventures' },
    { label: 'Best Fuel Economy', prompt: 'what has the best fuel economy' },
    { label: 'Something Fun to Drive', prompt: 'something fun and sporty to drive' },
  ];
  let popularRequests = $derived<QuickStartRequest[]>(
    profileConfig?.quickStartSuggestions ?? defaultQuickStarts
  );

  const menuRoutes: Record<ExternalPanelId, string> = {
    'ai-disclosure': '/disclosures/ai-disclosure.html',
    feedback: '/support/feedback.html',
  };

  function isGuidePanelId(panelId: string | null | undefined): panelId is GuideMenuPanelId {
    return !!panelId && panelId in guideMenuPanels;
  }

  function isPanelId(panelId: string): panelId is PanelId {
    return panelId === 'ai-disclosure' || panelId === 'feedback' || isGuidePanelId(panelId);
  }

  let activeGuidePanel = $derived.by(() => {
    if (!activePanel || !isGuidePanelId(activePanel)) return null;
    return guideMenuPanels[activePanel];
  });

  function getWidgetShadowRoot(): ShadowRoot | null {
    return document.getElementById(WIDGET_ROOT_ID)?.shadowRoot ?? null;
  }

  function dismissActivePanel({
    restoreFocus = true,
    announce = true
  }: {
    restoreFocus?: boolean;
    announce?: boolean;
  } = {}) {
    const closingPanel = activePanel;
    if (!closingPanel) return;

    activePanel = null;
    feedbackNotice = '';
    feedbackNoticeType = null;
    removeFeedbackScreenshot();

    if (announce) {
      a11yAnnouncement = `${menuItems.find((item) => item.id === closingPanel)?.label ?? 'Panel'} closed.`;
    }

    if (restoreFocus) {
      requestAnimationFrame(() => {
        lastFocusedElement?.focus();
        lastFocusedElement = null;
      });
    } else {
      lastFocusedElement = null;
    }
  }

  async function trackSessionClosed(reason: string, useBeacon = false) {
    await sendAnalyticsEvent('session_closed', {
      payload: { reason },
      useBeacon
    });
  }

  function openWidget(force = false) {
    if (isOpen) return;
    if (!force && Date.now() < suppressOpenUntil) return;
    isOpen = true;
  }

  function closeWidget(reason = 'widget_closed') {
    if (!isOpen) return;
    suppressOpenUntil = Date.now() + 250;
    void trackSessionClosed(reason, reason === 'visibility_hidden' || reason === 'pagehide' || reason === 'widget_destroyed');
    dismissActivePanel({ restoreFocus: false, announce: false });
    isOpen = false;
  }

  function toggleWidget() {
    if (isOpen) {
      closeWidget('widget_toggle_close');
      return;
    }
    openWidget();
  }


  function handleMenuItemClick(itemId: string) {
    if (itemId === 'menu-section-guides') return;
    if (!isPanelId(itemId)) return;

    if (document.activeElement instanceof HTMLElement) {
      lastFocusedElement = document.activeElement;
    }
    activePanel = itemId;
    a11yAnnouncement = `${menuItems.find((item) => item.id === itemId)?.label ?? 'Panel'} opened.`;
    requestAnimationFrame(() => {
      const shadowRoot = getWidgetShadowRoot();
      const container = shadowRoot?.querySelector('.chat-window__messages') as HTMLElement | null;
      if (container) container.scrollTop = 0;
      panelBackButtonRef?.focus();
    });
  }

  function openExternalPanelPage(panelId: ExternalPanelId) {
    const path = menuRoutes[panelId];
    if (!path) return;
    const url = new URL(path, window.location.origin);
    if (panelId === 'feedback') {
      url.searchParams.set('store', store);
      if (BASE_URL) {
        url.searchParams.set('api', BASE_URL);
      }
      url.searchParams.set('source', 'external-page');
    }
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  function closePanel() {
    dismissActivePanel();
  }

  function handleFeedbackScreenshotChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;

    if (feedbackScreenshotPreview) {
      URL.revokeObjectURL(feedbackScreenshotPreview);
      feedbackScreenshotPreview = '';
    }

    if (!file) {
      feedbackScreenshotFile = null;
      return;
    }

    feedbackScreenshotFile = file;
    feedbackScreenshotPreview = URL.createObjectURL(file);
  }

  function removeFeedbackScreenshot() {
    if (feedbackScreenshotPreview) {
      URL.revokeObjectURL(feedbackScreenshotPreview);
    }
    feedbackScreenshotFile = null;
    feedbackScreenshotPreview = '';
  }

  async function submitFeedback() {
    if (feedbackSending) return;
    if (!feedbackMessage.trim()) {
      feedbackNotice = 'Please add a message before sending feedback.';
      feedbackNoticeType = 'error';
      a11yAnnouncement = feedbackNotice;
      return;
    }

    feedbackSending = true;
    feedbackNotice = '';
    feedbackNoticeType = null;

    try {
      const submittedFeedbackType = feedbackType;
      const formData = new FormData();
      formData.set('name', feedbackName.trim());
      formData.set('email', feedbackEmail.trim());
      formData.set('type', feedbackType);
      formData.set('message', feedbackMessage.trim());
      formData.set('store', store);
      formData.set('source', 'widget');
      formData.set('pageUrl', window.location.href);
      formData.set('userAgent', navigator.userAgent);
      if (feedbackScreenshotFile) {
        formData.set('screenshot', feedbackScreenshotFile);
      }

      const resp = await fetch(`${BASE_URL}/feedback`, {
        method: 'POST',
        body: formData
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || 'Unable to send feedback right now.');
      }

      feedbackNotice = 'Thanks, your feedback has been sent successfully.';
      feedbackNoticeType = 'success';
      a11yAnnouncement = feedbackNotice;
      feedbackName = '';
      feedbackEmail = '';
      feedbackType = 'quality';
      feedbackMessage = '';
      removeFeedbackScreenshot();
      void sendAnalyticsEvent('feedback_submitted', {
        payload: {
          feedback_type: submittedFeedbackType,
          source: 'widget'
        }
      });
    } catch (err) {
      feedbackNotice = err instanceof Error ? err.message : 'Unable to send feedback right now.';
      feedbackNoticeType = 'error';
      a11yAnnouncement = feedbackNotice;
    } finally {
      feedbackSending = false;
    }
  }


  onMount(() => {
    const existingSessionId = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    const lastActivityRaw = sessionStorage.getItem(ANALYTICS_SESSION_LAST_ACTIVITY_KEY);
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;
    if (existingSessionId && lastActivity && (Date.now() - lastActivity) <= SESSION_TIMEOUT_MS) {
      analyticsSessionId = existingSessionId;
      updateAnalyticsSessionActivity();
    }

    if (persistChat) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          messages = JSON.parse(saved);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }

    // Apply theme
    theme.apply();

    // Fetch profile config from backend
    fetch(`${BASE_URL}/chat/config`)
      .then(res => res.json())
      .then((config: ProfileConfig) => { profileConfig = config; })
      .catch(err => console.warn('[Widget] Failed to fetch profile config:', err));

    isInitialized = true;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void trackSessionClosed('visibility_hidden', true);
      }
    };

    const handlePageHide = () => {
      void trackSessionClosed('pagehide', true);
    };

    const unsubscribeWidgetCommands = subscribeToWidgetCommands((command) => {
      if (command === 'open') {
        openWidget(true);
        return;
      }
      if (command === 'close') {
        closeWidget('api_close');
        return;
      }
      toggleWidget();
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      unsubscribeWidgetCommands();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  });

  let lastOpenState = $state<boolean | null>(null);

  $effect(() => {
    onOpenStateChange?.(isOpen);

    if (lastOpenState === null) {
      lastOpenState = isOpen;
      return;
    }

    if (lastOpenState === isOpen) return;

    dispatchWidgetLifecycleEvent(
      isOpen ? WIDGET_OPEN_EVENT : WIDGET_CLOSE_EVENT,
      { isOpen }
    );
    lastOpenState = isOpen;
  });

  $effect(() => {
    if (isInitialized && persistChat) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  });

  onDestroy(() => {
    if (feedbackScreenshotPreview) {
      URL.revokeObjectURL(feedbackScreenshotPreview);
    }
    void trackSessionClosed('widget_destroyed', true);
  });

  function getPanelFocusableElements(): HTMLElement[] {
    if (!panelRef) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(panelRef.querySelectorAll<HTMLElement>(selectors)).filter((el) => {
      return !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true';
    });
  }

  $effect(() => {
    if (!activePanel) return;
    const shadowRoot = getWidgetShadowRoot();
    if (!shadowRoot) return;

    function handlePanelKeydown(event: KeyboardEvent) {
      if (!activePanel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getPanelFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        panelBackButtonRef?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = shadowRoot.activeElement as HTMLElement | null;
      const isShift = event.shiftKey;
      const activeWithinPanel = activeElement ? panelRef?.contains(activeElement) : false;

      if (!activeWithinPanel) {
        event.preventDefault();
        (isShift ? last : first).focus();
        return;
      }

      if (!isShift && activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (isShift && (activeElement === first || !activeElement)) {
        event.preventDefault();
        last.focus();
      }
    }

    shadowRoot.addEventListener('keydown', handlePanelKeydown);
    return () => {
      shadowRoot.removeEventListener('keydown', handlePanelKeydown);
    };
  });

  // Body scroll lock for mobile fullscreen.
  // position:fixed on body prevents iOS Safari from scrolling the page behind the widget.
  // overflow:hidden alone is not enough — iOS Safari can bypass it for momentum scrolling.
  // We also set the html background to match the widget so the purple page never peeks through.
  $effect(() => {
    const isMobile = window.innerWidth <= 640;
    if (isOpen && isMobile) {
      const scrollY = window.scrollY;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevHtmlBg = document.documentElement.style.background;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyPosition = document.body.style.position;
      const prevBodyTop = document.body.style.top;
      const prevBodyLeft = document.body.style.left;
      const prevBodyRight = document.body.style.right;
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.background = '#1e1e1e';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      return () => {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.documentElement.style.background = prevHtmlBg;
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.left = prevBodyLeft;
        document.body.style.right = prevBodyRight;
        window.scrollTo(0, scrollY);
      };
    }
  });

  // Convert Recommendation to Product format for ChatMessage
  function convertToProducts(recommendations: Recommendation[]) {
    return recommendations.map((rec, index) => ({
      id: rec.id,
      image: normalizeAssetImageUrl(rec.image_url || rec.image),
      title: [rec.year, rec.make, rec.model, rec.trim].filter(Boolean).join(' '),
      price: rec.price != null && !isNaN(rec.price) ? rec.price : 0,
      originalPrice: rec.msrp,
      rating: undefined,
      discount: undefined,
      category: rec.body_type,
      shopLink: rec.source_url,
      brand: rec.dealer_name || rec.make,
      make: rec.make,
      model: rec.model,
      year: rec.year,
      trim: rec.trim,
      condition: rec.condition,
      body_type: rec.body_type,
      drive_type: rec.drive_type,
      fuel_type: rec.fuel_type,
      engine: rec.engine,
      mileage: rec.mileage,
      description: rec.description,
      key_features: rec.key_features,
      use_case_tags: rec.use_case_tags,
      priority_tags: rec.priority_tags,
      dealer_name: rec.dealer_name,
      vin: rec.vin,
      source_name: rec.source_name,
      rankPosition: index + 1
    }));
  }

  function handleRecommendationProductAction(
    messageId: string | undefined,
    product: {
      id?: string;
      title?: string;
      category?: string;
      subcategory?: string;
      rankPosition?: number;
    }
  ) {
    if (!messageId) return;
    void sendAnalyticsEvent('external_link_clicked', {
      messageId,
      productId: product.id ?? null,
      rankPosition: product.rankPosition ?? null,
      payload: {
        product_name: product.title ?? null,
        category: product.category ?? null
      }
    });
  }

  function handleRecommendationExpanded(
    messageId: string | undefined,
    details: { isExpanded: boolean; totalProducts: number; visibleProducts: number }
  ) {
    if (!messageId || !details.isExpanded) return;
    void sendAnalyticsEvent('results_expanded', {
      messageId,
      payload: {
        total_products: details.totalProducts,
        visible_products: details.visibleProducts
      }
    });
  }

  // Wrapper for ChatWidget's onSend
  function handleSend(message: string) {
    handleChat(message);
  }

  function handlePopularRequest(request: QuickStartRequest) {
    void handleChat(request.prompt);
  }

  // Clear chat function
  function handleClearChat() {
    void sendAnalyticsEvent('session_closed', {
      payload: { reason: 'clear_chat' },
      useBeacon: true
    });
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
    resetAnalyticsSession();
  }

  // ============================================
  // CAR GUIDED FLOW STEPS
  // ============================================

  const conditionStep = {
    id: 'condition',
    title: 'What are you shopping for?',
    type: 'single-select' as const,
    customStyles: {
      iconSize: '50px',
      minHeight: '78px'
    },
    options: [
      { id: 'used', label: 'Used / Pre-Owned', value: 'used', icon: conditionUsedIcon },
      { id: 'cpo', label: 'Certified Pre-Owned', value: 'cpo', icon: conditionCpoIcon }
    ]
  };

  const useCaseStep = {
    id: 'use_case',
    title: 'What do you primarily need it for?',
    type: 'single-select' as const,
    customStyles: {
      iconSize: '44px',
      minHeight: '124px',
      padding: '18px 10px',
      fontSize: '13px'
    },
    options: [
      { id: 'commuter', label: 'Daily Commuting', value: 'commuter', icon: commuteIcon },
      { id: 'family', label: 'Family Hauling', value: 'family', icon: familyIcon },
      { id: 'adventure', label: 'Weekend Adventures / Outdoors', value: 'adventure', icon: adventureIcon },
      { id: 'commercial', label: 'Work / Commercial Use', value: 'commercial', icon: commercialIcon },
      { id: 'performance', label: 'Performance Driving', value: 'performance', icon: performanceIcon },
      { id: 'eco', label: 'Best Fuel Economy / Eco', value: 'eco', icon: ecoIcon }
    ]
  };

  const bodyTypeStep = {
    id: 'body_type',
    title: 'What body style?',
    type: 'single-select' as const,
    customStyles: {
      iconSize: '76px',
      minHeight: '142px',
      padding: '14px 8px',
      fontSize: '13px'
    },
    options: [
      { id: 'suv', label: 'SUV / Crossover', value: 'suv', icon: vehiclePhotoIcon('/vehicles/kia-telluride-s.jpg', 'SUV') },
      { id: 'truck', label: 'Truck / Pickup', value: 'truck', icon: vehiclePhotoIcon('/vehicles/ford-f150-lariat.jpg', 'Truck') },
      { id: 'sedan', label: 'Sedan', value: 'sedan', icon: vehiclePhotoIcon('/vehicles/bmw-330i.jpg', 'Sedan') },
      { id: 'hatchback', label: 'Hatchback', value: 'hatchback', icon: vehiclePhotoIcon('/vehicles/toyota-prius-le.jpg', 'Hatchback') },
      { id: 'wagon', label: 'Wagon', value: 'wagon', icon: vehiclePhotoIcon('/vehicles/volvo-v60.jpg', 'Wagon') },
      { id: 'minivan', label: 'Minivan', value: 'minivan', icon: vehiclePhotoIcon('/vehicles/toyota-sienna-xle.jpg', 'Minivan') },
      { id: 'van', label: 'Work Van', value: 'van', icon: vehiclePhotoIcon('/vehicles/ford-transit-xlt.jpg', 'Work van') },
      { id: 'coupe', label: 'Coupe', value: 'coupe', icon: vehiclePhotoIcon('/vehicles/ford-mustang-gt.jpg', 'Coupe') },
      { id: 'convertible', label: 'Convertible', value: 'convertible', icon: vehiclePhotoIcon('/vehicles/mazda-miata-grand-touring.jpg', 'Convertible') }
    ]
  };

  const prioritiesStep = {
    id: 'priority_tags',
    title: 'What matters most to you?',
    type: 'multi-select' as const,
    maxSelections: 2,
    customStyles: {
      iconSize: '40px',
      minHeight: '118px',
      padding: '18px 10px',
      fontSize: '12px'
    },
    options: [
      { id: 'safety', label: 'Safety Ratings', value: 'safety', icon: safetyIcon },
      { id: 'fuel-economy', label: 'Fuel Economy / Range', value: 'fuel-economy', icon: fuelIcon },
      { id: 'cargo', label: 'Cargo / Passenger Space', value: 'cargo', icon: cargoIcon },
      { id: 'towing', label: 'Towing Capacity', value: 'towing', icon: towingIcon },
      { id: 'tech', label: 'Tech & Connectivity', value: 'tech', icon: techIcon },
      { id: 'reliability', label: 'Reliability / Low Maintenance', value: 'reliability', icon: reliabilityIcon },
      { id: 'performance', label: 'Performance / Power', value: 'performance', icon: powerIcon },
      { id: 'luxury', label: 'Luxury / Premium Feel', value: 'luxury', icon: luxuryIcon },
      { id: 'value', label: 'Best Value / Deal', value: 'value', icon: valueIcon },
      { id: 'comfort', label: 'Comfort / Quiet Ride', value: 'comfort', icon: comfortIcon }
    ]
  };

  const priceStep = {
    id: 'price',
    title: 'What\'s your budget?',
    type: 'price-selector' as const,
    options: [
      { id: 'under-15k', label: 'Under $15k', value: 15000, isMax: true },
      { id: '15k-25k', label: '$15k – $25k', value: 25000, isMax: true, minValue: 15000 },
      { id: '25k-40k', label: '$25k – $40k', value: 40000, isMax: true, minValue: 25000 },
      { id: '40k-60k', label: '$40k – $60k', value: 60000, isMax: true, minValue: 40000 },
      { id: '60k-plus', label: '$60k+', value: 60000, isMin: true },
      { id: 'flexible', label: 'Flexible / Show Me All', value: null }
    ]
  };

  const allGuidedFlowSteps = [conditionStep, useCaseStep, bodyTypeStep, prioritiesStep, priceStep];

  function handleModeToggle() {
    mode = mode === 'chat' ? 'guided-flow' : 'chat';
  }

  function buildTranscriptMessages() {
    return messages
      .filter((message) => !message.shimmer && (message.content.trim() || (message.recommendations?.length ?? 0) > 0))
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
        recommendations: (message.recommendations ?? []).slice(0, 6).map((recommendation) => ({
          make: recommendation.make,
          model: recommendation.model,
          year: recommendation.year,
          body_type: recommendation.body_type,
          condition: recommendation.condition,
          price: recommendation.price,
          source_url: recommendation.source_url
        }))
      }));
  }

  async function handleTranscriptSubmit(data: { email: string; name?: string; subscribe: boolean }): Promise<boolean> {
    const transcriptMessages = buildTranscriptMessages();
    if (transcriptMessages.length === 0) {
      return false;
    }

    try {
      const res = await fetch(`${CHAT_BASE_URL}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          subscribe: data.subscribe,
          messages: transcriptMessages,
          sessionId: analyticsSessionId,
          sourcePage: window.location.pathname,
        }),
      });

      if (res.ok) {
        void sendAnalyticsEvent('transcript_emailed', {
          payload: {
            subscribe: data.subscribe,
            message_count: transcriptMessages.length
          }
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async function handleFlowComplete(selections: Record<string, any>, metadata?: import('../../Svelte-Component-Library/src/lib/custom/GuidedFlow/utils.js').TransformedMetadata) {
    if (debug) console.log('Flow completed:', selections);
    if (!metadata || !metadata.guidedFlowQuery) {
      if (debug) console.error('No query available from GuidedFlow');
      mode = 'chat';
      return;
    }
    if (debug) {
      console.log('Transformed Metadata:', metadata.metadata);
      console.log('Query:', metadata.guidedFlowQuery);
      console.log('Filters:', metadata.filters);
    }

    mode = 'chat';

    const guidedFlowFilters = metadata.filters || {};
    const analyticsContext: AnalyticsContextPayload = {
      ...createAnalyticsContext(),
      source: 'guided_flow',
      guided_flow_filters: guidedFlowFilters
    };

    void sendAnalyticsEvent('guided_flow_submitted', {
      messageId: analyticsContext.message_id,
      payload: {
        source: 'guided_flow',
        filters: guidedFlowFilters,
        query: metadata.guidedFlowQuery || ''
      }
    });

    const queryMessage = createMessage("user", metadata.guidedFlowQuery, {
      analyticsMessageId: analyticsContext.message_id
    });
    messages = [...messages, queryMessage];
    loading = true;

    // Add shimmer loading message
    const shimmerIndex = messages.length;
    messages = [
      ...messages,
      createMessage("assistant", "Looking for best matches...", { shimmer: true, analyticsMessageId: analyticsContext.message_id })
    ];

    // Wait a tiny bit for shimmer to render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call recommendations API
    try {
      const resp = await fetch(
        `${CHAT_BASE_URL}/recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [queryMessage],
            filters: metadata.filters || {},
            semantic_search: metadata.guidedFlowQuery || "",
            analytics: analyticsContext
          }),
        }
      );

      if (!resp.ok) {
        try {
          const errorData = await resp.json();
          // Replace shimmer with error message
          messages = [
            ...messages.slice(0, shimmerIndex),
            {
              role: "assistant",
              content: errorData.error || "Our recommendation service is experiencing technical difficulties. Please try again."
            },
            ...messages.slice(shimmerIndex + 1)
          ];
        } catch (parseErr) {
          // Replace shimmer with error message
          messages = [
            ...messages.slice(0, shimmerIndex),
            {
              role: "assistant",
              content: "Our recommendation service is experiencing technical difficulties. Please try again."
            },
            ...messages.slice(shimmerIndex + 1)
          ];
        }
        return;
      }

      const data = await resp.json();

      // Check for error field
      if (data.error) {
        // Replace shimmer with error message
        messages = [
          ...messages.slice(0, shimmerIndex),
          {
            role: "assistant",
            content: data.error
          },
          ...messages.slice(shimmerIndex + 1)
        ];
      }

      productRecommendations = data.recommendations || [];
      if (productRecommendations.length > 0) {
        void sendAnalyticsEvent('guided_flow_completed', {
          messageId: analyticsContext.message_id,
          payload: {
            source: 'guided_flow',
            result_count: productRecommendations.length,
            filters: guidedFlowFilters,
            query: metadata.guidedFlowQuery || ''
          }
        });
      }

      // Replace shimmer with recommendations or friendly error message
      if (productRecommendations.length > 0) {
        // Removed productRegistry - stream has conversation history

        const botMessage: Message = {
          role: "assistant",
          content: "",
          recommendations: productRecommendations,
          analyticsMessageId: analyticsContext.message_id
        };
        messages = [
          ...messages.slice(0, shimmerIndex),
          botMessage,
          ...messages.slice(shimmerIndex + 1)
        ];
      } else {
        // No recommendations found - show friendly message
        messages = [
          ...messages.slice(0, shimmerIndex),
          {
            role: "assistant",
            content: "I couldn't find any vehicles matching those exact specifications. Try adjusting your preferences, or ask me about a specific vehicle.",
            analyticsMessageId: analyticsContext.message_id
          },
          ...messages.slice(shimmerIndex + 1)
        ];
      }
    } catch (err) {
      console.error("Recommendations API failed:", err);
      messages = [...messages, {
        role: "assistant",
        content: "Our recommendation service is experiencing technical difficulties. Please try again."
      }];
    } finally {
      loading = false;
    }
  }

  function handleFlowClose() {
    mode = 'chat';
  }

  function handleSelectionChange(_selections: Record<string, any>) {
    // Car guided flow is linear — no dynamic step branching needed
  }

  const guidedFlowConfig: GuidedFlowConfig = $derived({
    steps: allGuidedFlowSteps,
    onComplete: handleFlowComplete,
    onClose: handleFlowClose,
    onSelectionChange: handleSelectionChange
  });

  // ------------------------------------------------------
  // PRODUCT QUESTION HANDLER (SIMPLIFIED - STREAM HANDLES INTELLIGENCE)
  // ------------------------------------------------------
  async function handleProductQuestion(
    productQuery: string,
    payload: { messages: Message[] },
    analyticsContext: AnalyticsContextPayload
  ) {
    if (debug) console.log('[Product Lookup] Query:', productQuery);

    if (productLookupInProgress) {
      if (debug) console.log('[Product Lookup] Blocked: lookup already in progress');
      return;
    }

    if (currentLookupController) {
      if (debug) console.log('[Product Lookup] Aborting previous lookup');
      currentLookupController.abort();
    }
    currentLookupController = new AbortController();

    try {
      productLookupInProgress = true;

      // STEP 1: Call backend semantic search - WAIT FOR COMPLETION
      if (debug) console.log('[Product Lookup] Calling backend API with query:', productQuery);
      const lookupResp = await fetch(`${CHAT_BASE_URL}/product-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payload.messages,
          product_query: productQuery,
          retry_attempt: retryAttempts,
          analytics: analyticsContext
        }),
        signal: currentLookupController.signal
      });

      if (!lookupResp.ok) {
        const errorData = await lookupResp.json().catch(() => ({}));
        console.error('[Product Lookup] API error:', errorData);
        // Show error message directly
        messages = [...messages, createMessage("assistant", errorData.error || "I couldn't find that vehicle. Would you like me to search for recommendations?")];
        return;
      }

      const lookupResult = await lookupResp.json();
      if (debug) console.log('[Product Lookup] API result:', lookupResult);

      // STEP 2: Handle result based on backend decision - SEQUENTIAL, NO OVERLAP

      if (lookupResult.product) {
        // Backend found a confident match - stream with product context
        if (debug) console.log('[Product Lookup] Product found (confidence:', lookupResult.confidence, '), streaming with context');
        retryAttempts = 0; // Reset retry counter on success

        // Stream product details - WAIT FOR COMPLETION
        await streamWithProductContext(lookupResult.product, payload, analyticsContext);

      } else if (lookupResult.needsClarification) {
        // Low/medium confidence - show clarification question
        if (debug) console.log('[Product Lookup] Needs clarification, streaming clarification context');

        // Stream the clarification question - WAIT FOR COMPLETION
        await streamFollowUp(lookupResult.message, payload, analyticsContext);

      } else {
        // No match - offer to search for recommendations
        if (debug) console.log('[Product Lookup] No match found');
        messages = [...messages, createMessage("assistant", "I couldn't find that vehicle in our inventory. Would you like me to search for recommendations?")];
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (debug) console.log('[Product Lookup] Lookup aborted (new request started)');
        return;
      }
      console.error('[Product Lookup] Failed:', err);
      messages = [...messages, createMessage("assistant", "I'm having trouble finding that vehicle right now. Could you tell me more about what you're looking for?")];
    } finally {
      productLookupInProgress = false;
      currentLookupController = null;
    }
  }

  // Stream response with product context
  async function streamWithProductContext(
    product: Recommendation | Record<string, any> | null,
    payload: { messages: Message[] },
    analyticsContext: AnalyticsContextPayload
  ) {
    if (debug) console.log('[Product Context] Streaming with product:', [product?.year, product?.make, product?.model].filter(Boolean).join(' '));

    let buffer = "";
    let botMessageContent = "";
    let streamingMessageIndex: number | null = null;  // Always append NEW message

    try {
      // Validate product has required fields
      if (product && (!product.make && !product.model)) {
        console.error('[Product Context] Product missing make/model:', product);
        messages = [...messages, {
          role: 'assistant',
          content: 'I found a vehicle but the data seems incomplete. Please try again.'
        }];
        return;
      }

      const resp = await fetch(`${CHAT_BASE_URL}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          productContext: product ? JSON.stringify(product, null, 2) : null,
          analytics: analyticsContext
        }),
      });

      if (!resp.ok || !resp.body) {
        const errorText = !resp.ok ? await resp.text().catch(() => "") : "";
        console.error("[Product Context] Stream request failed", {
          url: `${CHAT_BASE_URL}/stream`,
          status: resp.status,
          statusText: resp.statusText,
          hasBody: !!resp.body,
          responseText: errorText
        });
        const productLabel = product ? [product.year, product.make, product.model].filter(Boolean).join(' ') || 'this vehicle' : null;
        const errorMessage = productLabel
          ? `I'm having trouble loading ${productLabel}. Please try again.`
          : "I'm having trouble getting that information. Please try again.";
        messages = [...messages, {
          role: "assistant",
          content: errorMessage
        }];
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split("\n\n");

        for (let i = 0; i < parts.length - 1; i++) {
          const event = parts[i].trim();
          if (!event) continue;

          const dataIndex = event.indexOf("data: ");
          if (dataIndex === -1) continue;

          const jsonStr = event.slice(dataIndex + 6);
          if (jsonStr === "[DONE]") continue;

          try {
            const json = JSON.parse(jsonStr);
            const token = json.choices?.[0]?.delta?.content ?? "";
            if (token) {
              botMessageContent += token;

              // Strip PRODUCT CONTEXT and debugging artifacts before displaying
              let cleanContent = botMessageContent;

              // Remove PRODUCT CONTEXT block and everything after it
              const productContextIndex = cleanContent.indexOf("**PRODUCT CONTEXT**");
              if (productContextIndex !== -1) {
                cleanContent = cleanContent.substring(0, productContextIndex).trim();
              }

              // Remove JSON code blocks (``` { ... } ```)
              cleanContent = cleanContent.replace(/```\s*\{[\s\S]*?\}\s*```/g, "").trim();

              // Remove any standalone ``` markers
              cleanContent = cleanContent.replace(/```/g, "").trim();

              if (streamingMessageIndex === null) {
                streamingMessageIndex = messages.length;
                messages = [...messages, createMessage("assistant", cleanContent, { analyticsMessageId: analyticsContext.message_id })];
              } else {
                messages = [
                  ...messages.slice(0, streamingMessageIndex),
                  createMessage("assistant", cleanContent, {
                    id: messages[streamingMessageIndex]?.id,
                    analyticsMessageId: analyticsContext.message_id
                  }),
                  ...messages.slice(streamingMessageIndex + 1)
                ];
              }
            }
          } catch (err) {
            console.error("[Product Context] Stream parse error:", err);
          }
        }

        buffer = parts[parts.length - 1];
      }

      // Stream has completed - now insert product card
      if (debug) console.log('[Product Context] Streaming completed');
      if (debug) console.log('[Product Context] Final streaming index:', streamingMessageIndex);

      // After streaming completes, add the product card as a recommendation
      if (product && streamingMessageIndex !== null) {
        if (debug) console.log('[Product Card] Building product recommendation from:', product);

        const productRecommendation: Recommendation = {
          id: product.id || '',
          year: product.year,
          make: product.make || (product as any).brand || '',
          model: product.model || '',
          trim: product.trim,
          condition: product.condition,
          body_type: product.body_type || (product as any).category,
          drive_type: product.drive_type,
          fuel_type: product.fuel_type,
          engine: product.engine,
          mileage: product.mileage,
          price: product.price || 0,
          msrp: product.msrp,
          image: normalizeAssetImageUrl(product.image_url || (product as any).image),
          image_url: normalizeAssetImageUrl(product.image_url || (product as any).image),
          vin: product.vin,
          source_name: product.source_name,
          source_url: (product as any).shop_link || product.source_url || '',
          description: product.description || '',
          key_features: product.key_features,
          use_case_tags: product.use_case_tags,
          priority_tags: product.priority_tags,
          dealer_name: product.dealer_name,
          rankPosition: 1
        };

        // Insert product card immediately after the streaming message
        messages = [
          ...messages.slice(0, streamingMessageIndex + 1),
          createMessage("assistant", "", {
            recommendations: [productRecommendation],
            analyticsMessageId: analyticsContext.message_id
          }),
          ...messages.slice(streamingMessageIndex + 1)
        ];

        if (debug) console.log('[Product Card] Card inserted at index:', streamingMessageIndex + 1);
      } else {
        console.warn('[Product Card] Skipped - product:', product, 'streamingMessageIndex:', streamingMessageIndex);
      }
    } catch (err) {
      console.error("[Product Context] Stream failed:", err);
      const productLabel2 = product ? [product.year, product.make, product.model].filter(Boolean).join(' ') || 'this vehicle' : null;
      const errorMessage = productLabel2 && err instanceof Error
        ? `I had trouble loading ${productLabel2}. ${err.message}`
        : "I'm having trouble getting that information. Please try again.";
      messages = [...messages, {
        role: "assistant",
        content: errorMessage
      }];
    }
  }

  // Stream follow-up question for clarification
  async function streamFollowUp(
    clarificationMessage: string,
    payload: { messages: Message[] },
    analyticsContext: AnalyticsContextPayload
  ) {
    if (debug) {
      console.log('[Follow-up] Clarification message:', clarificationMessage);
      console.log('[Follow-up] Payload messages count:', payload.messages.length);
      console.log('[Follow-up] Sending clarificationContext:', clarificationMessage);
    }

    let buffer = "";
    let botMessageContent = "";
    let streamingMessageIndex: number | null = null;  // Always append NEW message

    try {
      const requestBody = {
        ...payload,
        clarificationContext: clarificationMessage,
        analytics: analyticsContext
      };
      if (debug) console.log('[Follow-up] Request body keys:', Object.keys(requestBody));
      if (debug) console.log('[Follow-up] clarificationContext in body:', requestBody.clarificationContext);

      const resp = await fetch(`${CHAT_BASE_URL}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (debug) console.log('[Follow-up] Stream response status:', resp.status, resp.ok);

      if (!resp.ok || !resp.body) {
        const errorText = !resp.ok ? await resp.text().catch(() => "") : "";
        console.error("[Follow-up] Stream request failed", {
          url: `${CHAT_BASE_URL}/stream`,
          status: resp.status,
          statusText: resp.statusText,
          hasBody: !!resp.body,
          responseText: errorText
        });
        console.error('[Follow-up] Stream response not ok or no body, using fallback');
        messages = [...messages, {
          role: "assistant",
          content: clarificationMessage  // Fallback to showing the clarification directly
        }];
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");

      if (debug) console.log('[Follow-up] Starting to read stream...');
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (debug) console.log('[Follow-up] Stream done, total tokens:', tokenCount);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split("\n\n");

        for (let i = 0; i < parts.length - 1; i++) {
          const event = parts[i].trim();
          if (!event) continue;

          const dataIndex = event.indexOf("data: ");
          if (dataIndex === -1) continue;

          const jsonStr = event.slice(dataIndex + 6);
          if (jsonStr === "[DONE]") continue;

          try {
            const json = JSON.parse(jsonStr);
            const token = json.choices?.[0]?.delta?.content ?? "";
            if (token) {
              tokenCount++;
              botMessageContent += token;

              // Strip PRODUCT CONTEXT and debugging artifacts before displaying
              let cleanContent = botMessageContent;

              // Remove PRODUCT CONTEXT block and everything after it
              const productContextIndex = cleanContent.indexOf("**PRODUCT CONTEXT**");
              if (productContextIndex !== -1) {
                cleanContent = cleanContent.substring(0, productContextIndex).trim();
              }

              // Remove JSON code blocks (``` { ... } ```)
              cleanContent = cleanContent.replace(/```\s*\{[\s\S]*?\}\s*```/g, "").trim();

              // Remove any standalone ``` markers
              cleanContent = cleanContent.replace(/```/g, "").trim();

              if (streamingMessageIndex === null) {
                streamingMessageIndex = messages.length;
                messages = [...messages, createMessage("assistant", cleanContent, { analyticsMessageId: analyticsContext.message_id })];
                if (debug) console.log('[Follow-up] Created new message at index:', streamingMessageIndex);
              } else {
                messages = [
                  ...messages.slice(0, streamingMessageIndex),
                  createMessage("assistant", cleanContent, {
                    id: messages[streamingMessageIndex]?.id,
                    analyticsMessageId: analyticsContext.message_id
                  }),
                  ...messages.slice(streamingMessageIndex + 1)
                ];
              }
            }
          } catch (err) {
            console.error("[Follow-up] Stream parse error:", err);
          }
        }

        buffer = parts[parts.length - 1];
      }

      // If stream completed but no content, fallback to showing clarification directly
      if (botMessageContent.trim() === '') {
        console.warn('[Follow-up] Stream completed but no content, using fallback');
        messages = [...messages, {
          role: "assistant",
          content: clarificationMessage
        }];
      }

      if (debug) console.log('[Follow-up] Completed successfully');
    } catch (err) {
      console.error("[Follow-up] Stream failed:", err);
      messages = [...messages, {
        role: "assistant",
        content: clarificationMessage  // Fallback to showing the clarification directly
      }];
    }
  }

  // ------------------------------------------------------
  // MAIN HANDLER (Decision + Stream + Recommendation Tool)
  // ------------------------------------------------------
  async function handleChat(message?: string) {
    const userMsg = message || input.trim();
    if (!userMsg || loading) return;

    // Check for gifting intent and comparison requests
    checkForGiftingIntent(userMsg);
    checkForComparison(userMsg);

    const analyticsContext = createAnalyticsContext();
    messages = [...messages, createMessage("user", userMsg, { analyticsMessageId: analyticsContext.message_id })];
    if (!message) {
      input = "";
    }
    loading = true;

    const payload = { messages };

    // STREAM-FIRST ARCHITECTURE - Let stream handle ALL intelligence
    // Stream detects confirmations, clarifications, rejections, and emits appropriate CODEX cues
    // STEP 1: Stream immediately (instant feedback)
    let fullStreamText = "";
    let streamingMessageIndex: number | null = null;
    let buffer = "";
    let codexDetectedMidStream = false;  // Flag to stop streaming when CODEX detected

    try {
      const resp = await fetch(`${CHAT_BASE_URL}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          analytics: analyticsContext
        }),
      });

      // Check for error response before trying to read as stream
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        console.error("[Chat] Stream request failed", {
          url: `${CHAT_BASE_URL}/stream`,
          status: resp.status,
          statusText: resp.statusText,
          responseText: errorText
        });
        try {
          const errorData = errorText ? JSON.parse(errorText) : {};
          console.error("Stream error:", errorData);
          const errorMessage = errorData.error || "Our streaming service is experiencing technical difficulties. Please try again.";
          messages = [...messages, {
            role: "assistant",
            content: errorMessage
          }];
        } catch (parseErr) {
          console.error("Failed to parse error:", parseErr);
          messages = [...messages, {
            role: "assistant",
            content: "Our streaming service is experiencing technical difficulties. Please try again."
          }];
        }
        loading = false;
        return;
      }

      if (!resp.body) {
        console.error("No response body from stream");
        messages = [...messages, {
          role: "assistant",
          content: "Our streaming service is experiencing technical difficulties. Please try again."
        }];
        loading = false;
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines (SSE event boundary)
        let parts = buffer.split("\n\n");

        // Process all complete events
        for (let i = 0; i < parts.length - 1; i++) {
          const event = parts[i].trim();
          if (!event) continue;

          const dataIndex = event.indexOf("data: ");
          if (dataIndex === -1) continue;

          const jsonStr = event.slice(dataIndex + 6);
          if (jsonStr === "[DONE]") continue;

          try {
            const json = JSON.parse(jsonStr);
            const token = json.choices?.[0]?.delta?.content ?? "";
            if (token) {
              fullStreamText += token;

              // REAL-TIME CODEX DETECTION - Stop stream when we have COMPLETE cue
              // A complete cue has: pattern + quoted product name + ending phrase
              const codex = detectCodex(fullStreamText);
              if (codex) {
                // Check if we have a COMPLETE cue (has quotes and proper ending)
                const hasQuotedProduct = /"[^"]+"/i.test(fullStreamText);
                const hasProperEnding = fullStreamText.trim().endsWith('for you.') ||
                                       fullStreamText.trim().endsWith('Just a moment please.');

                if (hasQuotedProduct && hasProperEnding) {
                  if (debug) console.log('[STREAM] COMPLETE CODEX cue detected:', codex);
                  if (debug) console.log('[STREAM] Stopping stream to prevent hallucination');

                  // Update UI with final token BEFORE breaking
                  if (streamingMessageIndex !== null) {
                    messages[streamingMessageIndex].content = fullStreamText;
                    messages = [...messages];
                  }

                  codexDetectedMidStream = true;
                  break;
                } else {
                  if (debug) console.log('[STREAM] Partial CODEX detected, waiting for completion...');
                }
              }

              // Strip PRODUCT CONTEXT and debugging artifacts before displaying
              let cleanContent = fullStreamText;

              // Remove PRODUCT CONTEXT block and everything after it
              const productContextIndex = cleanContent.indexOf("**PRODUCT CONTEXT**");
              if (productContextIndex !== -1) {
                cleanContent = cleanContent.substring(0, productContextIndex).trim();
              }

              // Remove JSON code blocks (``` { ... } ```)
              cleanContent = cleanContent.replace(/```\s*\{[\s\S]*?\}\s*```/g, "").trim();

              // Remove any standalone ``` markers
              cleanContent = cleanContent.replace(/```/g, "").trim();

              // Create message only when we have the first token (avoid empty bubble)
              if (streamingMessageIndex === null) {
                streamingMessageIndex = messages.length;
                messages = [...messages, createMessage("assistant", cleanContent, { analyticsMessageId: analyticsContext.message_id })];
              } else {
                // Update the existing streaming message
                messages = [
                  ...messages.slice(0, streamingMessageIndex),
                  createMessage("assistant", cleanContent, {
                    id: messages[streamingMessageIndex]?.id,
                    analyticsMessageId: analyticsContext.message_id
                  }),
                  ...messages.slice(streamingMessageIndex + 1)
                ];
              }
            }
          } catch (err) {
            console.error("Stream parse error:", err);
          }
        }

        // Keep the incomplete part for next read
        buffer = parts[parts.length - 1];

        // If CODEX detected, stop reading stream immediately
        if (codexDetectedMidStream) {
          if (debug) console.log('[STREAM] Breaking out of stream read loop');
          break;
        }
      }
    } catch (err) {
      console.error("Stream failed:", err);
      messages = [...messages, {
        role: "assistant",
        content: "Our streaming service is experiencing technical difficulties. Please try again."
      }];
      loading = false;
      return;
    }

    // STEP 2: Detect CODEX cue in stream text
    const codex = detectCodex(fullStreamText);

    // STEP 3: Handle based on CODEX
    if (codex === 'RECOMMEND') {
      // Add shimmer loading message
      const finalStreamingIndex = streamingMessageIndex !== null ? streamingMessageIndex : messages.length - 1;
      const shimmerIndex = finalStreamingIndex + 1;
      messages = [
        ...messages.slice(0, shimmerIndex),
        createMessage("assistant", "Looking for best matches...", { shimmer: true, analyticsMessageId: analyticsContext.message_id }),
        ...messages.slice(shimmerIndex)
      ];

      // Wait a tiny bit for shimmer to render
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        // Call intent API (simplified - just extracts filters)
        // IMPORTANT: Create fresh payload with updated messages (includes stream response)

        // IMPORTANT: Filter out shimmer messages (UI-only, not for API)
        const messagesForApi = messages.filter(m => !m.shimmer);
        const intentPayload = { messages: messagesForApi };
        const analyticsPayload = {
          ...intentPayload,
          analytics: analyticsContext
        };

        const intentResp = await fetch(`${CHAT_BASE_URL}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(analyticsPayload),
        });

        if (!intentResp.ok) {
          const errorData = await intentResp.json().catch(() => ({}));
          messages = [
            ...messages.slice(0, shimmerIndex),
            { role: "assistant", content: errorData.error || "Our AI understanding service is experiencing technical difficulties. Please try again." },
            ...messages.slice(shimmerIndex + 1)
          ];
          loading = false;
          return;
        }

        const intentData = await intentResp.json();
        const intentFilters = intentData.filters || {};
        const semanticSearch = intentData.semantic_search || "";

        // Call recommendations API
        // IMPORTANT: Filter out shimmer messages (UI-only, not for API)
        const recResp = await fetch(`${CHAT_BASE_URL}/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForApi,
            filters: intentFilters,
            semantic_search: semanticSearch,
            analytics: analyticsContext
          }),
        });

        if (!recResp.ok) {
          const errorData = await recResp.json().catch(() => ({}));
          messages = [
            ...messages.slice(0, shimmerIndex),
            { role: "assistant", content: errorData.error || "Our recommendation service is experiencing technical difficulties. Please try again." },
            ...messages.slice(shimmerIndex + 1)
          ];
          loading = false;
          return;
        }

        const recData = await recResp.json();
        productRecommendations = recData.recommendations || [];

        // Replace shimmer with recommendations or friendly error message
        if (productRecommendations.length > 0) {
          // Removed productRegistry - stream has conversation history
          const botMessage: Message = {
            role: "assistant",
            content: "",
            recommendations: productRecommendations,
            analyticsMessageId: analyticsContext.message_id
          };
          messages = [
            ...messages.slice(0, shimmerIndex),
            botMessage,
            ...messages.slice(shimmerIndex + 1)
          ];
        } else {
          // No recommendations found - show friendly message
          messages = [
            ...messages.slice(0, shimmerIndex),
            {
            role: "assistant",
            content: "I couldn't find any vehicles matching those exact specifications. Try adjusting your preferences, or ask me about a specific vehicle.",
            analyticsMessageId: analyticsContext.message_id
          },
            ...messages.slice(shimmerIndex + 1)
          ];
        }
      } catch (err) {
        console.error("Recommendation flow failed:", err);
        messages = [
          ...messages.slice(0, shimmerIndex),
          { role: "assistant", content: "Our recommendation service is experiencing technical difficulties. Please try again." },
          ...messages.slice(shimmerIndex + 1)
        ];
      }
    } else if (codex === 'PRODUCT_LOOKUP') {
      // Extract product name from stream text
      const productName = extractProductName(fullStreamText);
      if (debug) console.log('[CODEX] PRODUCT_LOOKUP detected, product name:', productName);
      if (debug) console.log('[CODEX] Current messages length:', messages.length);

      if (productName) {
        if (debug) console.log('[CODEX] Starting product lookup flow (will append new messages, preserving cue)');

        try {
          // Call product-lookup flow - it will append new messages
          await handleProductQuestion(productName, { messages }, analyticsContext);
        } finally {
          // Ensure loading state is cleared even if handleProductQuestion fails
          loading = false;
        }
        return; // Exit early, loading already cleared
      }
    }
    // No CODEX fallback - cards are ONLY inserted via explicit CODEX cues from stream

    loading = false;
  }
</script>

<ChatWidget
  isOpen={isOpen}
  onToggle={toggleWidget}
  onClose={() => closeWidget('widget_closed')}
  onSend={handleSend}
  {position}
  expandIcon="dots"
  headerStyle="minimal"
  menuItems={menuItems}
  menuPosition="left"
  menuMode="sidebar"
  onMenuItemClick={handleMenuItemClick}
  title="Car Assistant"
  themeBackgroundColor="#38BDF8"
  iconSrc={dealerHeaderIcon}
  launcherIconSrc={launcherIcon ?? dealerSteeringWheelIcon}
  launcherButtonSize="78px"
  launcherIconSize="44px"
  launcherPulse={true}
  launcherCalloutText="Find your next car"
  launcherCalloutAutoShow={true}
  launcherCalloutDelayMs={900}
  launcherCalloutAnimationMs={850}
  launcherAriaLabel={launcherLabel}
  launcherButtonBackgroundColor={launcherBg ?? 'radial-gradient(circle at 50% 38%, #7DD3FC 0%, #38BDF8 58%, #0284C7 100%)'}
  hideLauncher={hideLauncher}
  {offsetX}
  {offsetY}
  zIndex={zIndex}
  windowWidth={width}
  windowHeight={height}
  showBadge={false}
  onClearChat={handleClearChat}
  hasMessages={activePanel === null && messages.length > 0}
  clearButtonIcon="erase"
  mode={mode}
  onModeToggle={activePanel === null ? handleModeToggle : undefined}
  modeTogglePosition="lower-left"
  guidedFlowConfig={mode === 'guided-flow' ? guidedFlowConfig : undefined}
  messagesCount={messages.length}
  darkMode={true}
  noAssistantBubble={true}
  showInput={activePanel === null}
  showScrollButton={activePanel === null}
  panelOpen={activePanel !== null}
  ariaMessageLogLabel="Car assistant chat messages"
  announceStreamingMode="final-only"
  announcementText={a11yAnnouncement}
>
  {#snippet children()}
    {#if activePanel === null}
      {#if messages.length === 0}
        <WelcomeQuickStart
          requests={popularRequests}
          {loading}
          welcomeMessage={profileConfig?.welcomeMessage}
          onRequestSelect={handlePopularRequest}
        />
      {/if}

      {#each messages as msg (msg.id || `fallback-${messages.indexOf(msg)}`)}
        {#if msg.shimmer === true}
          <!-- Render shimmer text for loading messages -->
          <div class="shimmer-message">
            <ShimmerText
              text={msg.content}
              speed={2.5}
              baseColor="#8b8b8b"
              highlightColor="#e0e0e0"
              fontSize="0.875rem"
            />
          </div>
        {:else}
          <ChatMessage
            variant={msg.role}
            messageText={msg.content}
            products={msg.recommendations ? convertToProducts(msg.recommendations) : undefined}
            recommendationTitle={msg.role === 'assistant' && msg.recommendations && msg.recommendations.length > 0 ? "Vehicle recommendations" : undefined}
            recommendationLayout="compact-list"
            productsInBubble={true}
            showHoverActions={false}
            actionType="link"
            onProductAction={(product) => handleRecommendationProductAction(msg.analyticsMessageId, product)}
            onResultsExpanded={(details) => handleRecommendationExpanded(msg.analyticsMessageId, details)}
          />
        {/if}
      {/each}

      {#if comparisonData}
        <div style="padding: 0 12px;">
          <div class="vehicle-comparison">
            {#each [comparisonData.vehicle1, comparisonData.vehicle2] as v}
              <div class="vehicle-comparison__card">
                {#if v.image_url}
                  <img src={normalizeAssetImageUrl(v.image_url)} alt="{v.year} {v.make} {v.model}" class="vehicle-comparison__image" />
                {/if}
                <div class="vehicle-comparison__info">
                  <div class="vehicle-comparison__title">{[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}</div>
                  <div class="vehicle-comparison__price">${v.price?.toLocaleString()}</div>
                  <div class="vehicle-comparison__badges">
                    {#if v.condition}<span class="vehicle-comparison__badge">{v.condition}</span>{/if}
                    {#if v.body_type}<span class="vehicle-comparison__badge">{v.body_type}</span>{/if}
                    {#if v.drive_type}<span class="vehicle-comparison__badge">{v.drive_type.toUpperCase()}</span>{/if}
                  </div>
                  {#if v.mileage}<div class="vehicle-comparison__meta">{v.mileage.toLocaleString()} mi</div>{/if}
                  {#if v.source_url}
                    <a href={v.source_url} target="_blank" rel="noopener noreferrer" class="vehicle-comparison__link">View Details</a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if showTranscriptShare}
        <div style="padding: 0 12px;">
          <TranscriptShareCard
            profileType={profileConfig?.profileType}
            storeName={profileConfig?.storeName}
            onSubmit={handleTranscriptSubmit}
          />
        </div>
      {/if}
    {:else}
      <div
        class="widget-panel"
        class:widget-panel--feedback={activePanel === 'feedback'}
        class:widget-panel--scrollable={activePanel !== 'feedback'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={activePanel ? `widget-panel-title-${activePanel}` : undefined}
        tabindex="-1"
        bind:this={panelRef}
      >
        <div class="widget-panel__top">
          <button type="button" class="widget-panel__back" onclick={closePanel} aria-label="Back to chat" bind:this={panelBackButtonRef}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        {#if activeGuidePanel}
          <div class="widget-panel__title-row">
            <h3 id={`widget-panel-title-${activePanel}`}>{activeGuidePanel.title}</h3>
          </div>
          <EducationPanel panel={activeGuidePanel} />
        {:else if activePanel === 'ai-disclosure'}
          <div class="widget-panel__title-row">
            <h3 id="widget-panel-title-ai-disclosure">AI Disclosure</h3>
            <button type="button" class="widget-panel__external-link" onclick={() => openExternalPanelPage('ai-disclosure')}>Full Page</button>
          </div>
          <p>This assistant helps guide vehicle discovery and purchasing decisions using inventory data and business context available in this experience.</p>
          <ul>
            <li>Recommendations are based on available inventory data and configured business context.</li>
            <li>Responses are informational and should not be treated as professional financial or legal advice.</li>
            <li>Inventory, pricing, and availability may change — verify with the dealership.</li>
          </ul>
          <p class="widget-panel__note">Please verify time-sensitive details before purchase.</p>
        {:else if activePanel === 'feedback'}
          <div class="widget-panel__title-row">
            <h3 id="widget-panel-title-feedback">Send Feedback</h3>
            <button type="button" class="widget-panel__external-link" onclick={() => openExternalPanelPage('feedback')}>Full Page</button>
          </div>
          <p>Share bugs, safety concerns, or recommendation quality issues.</p>

          <form class="feedback-form" onsubmit={(event) => { event.preventDefault(); submitFeedback(); }}>
            <div class="feedback-form__row">
              <label>
                Name (optional)
                <input type="text" bind:value={feedbackName} disabled={feedbackSending} />
              </label>
              <label>
                Email (optional)
                <input type="email" bind:value={feedbackEmail} disabled={feedbackSending} />
              </label>
            </div>
            <label>
              Feedback type
              <select bind:value={feedbackType} disabled={feedbackSending}>
                <option value="bug">Bug report</option>
                <option value="quality">Recommendation quality</option>
                <option value="safety">Safety/medical concern</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Message
              <textarea bind:value={feedbackMessage} placeholder="Tell us what happened and what should improve." required disabled={feedbackSending}></textarea>
            </label>
            <label>
              Screenshot (optional)
              <input type="file" accept="image/*" onchange={handleFeedbackScreenshotChange} disabled={feedbackSending} />
            </label>
            {#if feedbackScreenshotPreview}
              <div class="feedback-screenshot">
                <img src={feedbackScreenshotPreview} alt="Feedback screenshot preview" />
                <button type="button" class="feedback-screenshot__remove" onclick={removeFeedbackScreenshot} disabled={feedbackSending}>Remove screenshot</button>
              </div>
            {/if}
            <button type="submit" class="feedback-form__submit" disabled={feedbackSending}>
              {feedbackSending ? 'Sending...' : 'Send Feedback'}
            </button>
          </form>

          {#if feedbackNotice}
            <p
              class="widget-panel__note"
              class:widget-panel__note--error={feedbackNoticeType === 'error'}
              role={feedbackNoticeType === 'error' ? 'alert' : 'status'}
              aria-live={feedbackNoticeType === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {feedbackNotice}
            </p>
          {/if}
        {/if}
      </div>
    {/if}
  {/snippet}
</ChatWidget>

<style>
  :global(*) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .shimmer-message {
    padding-left: 12px;
    padding-right: 12px;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 20px;
    margin-bottom: 0;
    opacity: 0.8;
  }

  .widget-panel {
    min-height: auto;
    height: auto;
    flex: 0 0 auto;
    padding: 14px 12px 20px;
    color: #ebebeb;
    display: block;
    overflow: visible;
  }

  .widget-panel h3 {
    margin: 8px 0 4px;
    font-size: 1rem;
    color: #f5f5f5;
  }

  .widget-panel p,
  .widget-panel li {
    color: #d2d2d2;
    font-size: 0.85rem;
    line-height: 1.35;
  }

  .widget-panel ul {
    margin: 8px 0 0;
    padding-left: 18px;
  }

  .widget-panel__top {
    display: flex;
    justify-content: flex-start;
    gap: 6px;
    margin-top: 6px;
    margin-bottom: 8px;
    padding-right: 0;
  }

  .widget-panel__title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 2px;
  }

  .widget-panel__title-row h3 {
    margin: 0;
  }

  .widget-panel__back,
  .feedback-form__submit {
    border: 1px solid #4f4f4f;
    border-radius: 8px;
    background: #2d2d2d;
    color: #f1f1f1;
    padding: 6px 9px;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .widget-panel__back {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: rgba(45, 45, 48, 0.95);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .widget-panel__back:hover {
    filter: brightness(1.1);
  }

  .widget-panel__back:focus-visible,
  .widget-panel__external-link:focus-visible,
  .feedback-form__submit:focus-visible,
  .feedback-screenshot__remove:focus-visible,
  .feedback-form input:focus-visible,
  .feedback-form select:focus-visible,
  .feedback-form textarea:focus-visible {
    outline: 2px solid #71d0c2;
    outline-offset: 2px;
  }

  .widget-panel__external-link {
    border: none;
    background: transparent;
    color: #71d0c2;
    font-size: 0.8rem;
    line-height: 1;
    padding: 4px 2px;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    white-space: nowrap;
  }

  .widget-panel__external-link:hover {
    color: #8fe0d3;
  }

  .feedback-form {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }

  .feedback-form label {
    display: grid;
    gap: 3px;
    font-size: 0.78rem;
    color: #d8d8d8;
  }

  .feedback-form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .feedback-form input,
  .feedback-form select,
  .feedback-form textarea {
    border: 1px solid #4f4f4f;
    border-radius: 8px;
    background: #212121;
    color: #f1f1f1;
    font: inherit;
    padding: 7px 9px;
  }

  .feedback-form textarea {
    min-height: 68px;
    max-height: 96px;
    resize: vertical;
  }

  .feedback-form input[type="file"] {
    font-size: 0.76rem;
    padding: 6px 8px;
  }

  .feedback-form input[type="file"]::file-selector-button {
    margin-right: 8px;
    border: 1px solid #2e6d64;
    border-radius: 7px;
    background: #1f433e;
    color: #e9f8f4;
    padding: 6px 10px;
    font-size: 0.74rem;
    cursor: pointer;
  }

  .feedback-form input[type="file"]::file-selector-button:hover {
    filter: brightness(1.08);
  }

  .feedback-screenshot {
    display: grid;
    gap: 8px;
  }

  .feedback-screenshot img {
    max-width: 100%;
    max-height: 88px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid #4f4f4f;
    background: #171717;
  }

  .feedback-screenshot__remove {
    justify-self: start;
    border: 1px solid #4f4f4f;
    border-radius: 8px;
    background: #2d2d2d;
    color: #f1f1f1;
    padding: 5px 9px;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .widget-panel__note {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #3b5f58;
    background: #1c312d;
    color: #bde3da;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .widget-panel__note--error {
    border-color: #6a4343;
    background: #351f1f;
    color: #f0c4c4;
  }

  .feedback-form__submit:disabled,
  .feedback-screenshot__remove:disabled,
  .feedback-form input:disabled,
  .feedback-form select:disabled,
  .feedback-form textarea:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  @media (max-width: 430px) {
    .feedback-form__row {
      grid-template-columns: 1fr;
    }
  }

  .widget-panel--feedback h3 {
    margin-top: 0;
    margin-bottom: 8px;
  }

  .widget-panel--feedback > p {
    margin-top: 0;
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .widget-panel--feedback {
    padding-bottom: 24px;
  }

  .widget-panel--scrollable {
    padding-bottom: 28px;
  }

  /* Mobile: move shimmer closer to left edge to match assistant messages */
  @media (max-width: 640px) {
    .shimmer-message {
      padding-left: 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .widget-panel,
    .widget-panel * {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }

  .vehicle-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 8px;
  }
  .vehicle-comparison__card {
    background: rgba(255, 255, 255, 0.6);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .vehicle-comparison__image {
    width: 100%;
    height: 90px;
    object-fit: cover;
    background: #f3f4f6;
  }
  .vehicle-comparison__info {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .vehicle-comparison__title {
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    line-height: 1.3;
  }
  .vehicle-comparison__price {
    font-size: 15px;
    font-weight: 700;
    color: var(--widget-theme-color, #3b82f6);
  }
  .vehicle-comparison__badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .vehicle-comparison__badge {
    font-size: 9px;
    font-weight: 500;
    color: #374151;
    background: #f3f4f6;
    border-radius: 3px;
    padding: 2px 5px;
    text-transform: capitalize;
  }
  .vehicle-comparison__meta {
    font-size: 11px;
    color: #6b7280;
  }
  .vehicle-comparison__link {
    font-size: 11px;
    font-weight: 500;
    color: var(--widget-theme-color, #3b82f6);
    text-decoration: none;
    margin-top: 2px;
  }
  .vehicle-comparison__link:hover {
    text-decoration: underline;
  }
</style>
