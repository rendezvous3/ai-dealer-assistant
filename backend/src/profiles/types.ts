export type ProfileType = 'brand_concierge' | 'merchant_advisor';

export interface QuickStartSuggestion {
  label: string;
  prompt: string;
}

export interface ProfileFeatures {
  dealerLocator: boolean;
  leadCapture: boolean;
  crossBrandComparison: boolean;
  financing: boolean;
}

export interface BrandContent {
  shippingPolicy: string;
  returnPolicy: string;
  storeHours: string;
  dealerLocatorUrl: string;
  heritage: string;
}

export interface DeploymentProfile {
  profileType: ProfileType;
  storeName: string;
  storeDescription: string;
  brandName?: string;
  allowCrossBrand: boolean;
  tone: string;
  catalogScope: string;
  greeting: string;
  persona: string;
  constraints: string;
  guidedFlowType: 'brand' | 'merchant';
  welcomeMessage: string;
  quickStartSuggestions: QuickStartSuggestion[];
  features: ProfileFeatures;
  brandContent?: BrandContent;
}
