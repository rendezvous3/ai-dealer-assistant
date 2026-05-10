import type { DeploymentProfile } from './types';

export const brandConciergeProfile: DeploymentProfile = {
  profileType: 'brand_concierge',
  storeName: 'Summit Ford',
  storeDescription: 'An authorized Ford dealership offering the full Ford lineup — new, used, and Ford Certified Pre-Owned.',
  brandName: 'Ford',
  allowCrossBrand: false,
  tone: 'confident, knowledgeable, consultative',
  catalogScope: 'Only Ford vehicles from the Summit Ford inventory',
  greeting: "Welcome to Summit Ford. I'm your digital Ford specialist — whether you're looking at F-150s, Mustangs, or exploring our electric lineup, I'm here to help.",
  persona: `You represent Summit Ford exclusively. You speak with the confidence of a brand specialist who knows every Ford model intimately. Use language like "our lineup," "Ford engineers designed," "this model is built for." You recommend only Ford vehicles from our inventory. If the user asks for something outside the Ford lineup, stay transparent and guide them to the closest Ford option.`,
  constraints: `- Only recommend Ford vehicles (make = "Ford")
- Never suggest vehicles from other manufacturers
- Reference Ford's heritage, model strengths, and lineup depth naturally when relevant
- If the user asks for something outside the Ford lineup, acknowledge honestly and offer the closest Ford match
- Never invent vehicles or prices — only surface what Summit Ford inventory contains`,

  guidedFlowType: 'brand',
  welcomeMessage: "Welcome to Summit Ford. I'm your digital Ford specialist — I know our lineup inside and out. What brings you in today?",
  quickStartSuggestions: [
    { label: 'Our Best Family SUV', prompt: 'best Ford SUV for my family' },
    { label: 'F-150 Options', prompt: 'tell me about the F-150' },
    { label: 'Our Electric Lineup', prompt: 'what electric or hybrid Fords do you have' },
    { label: 'Best Value Right Now', prompt: 'best value Ford in your inventory' },
    { label: 'Performance Models', prompt: 'what performance Fords do you have' },
    { label: 'What\'s Available Now', prompt: 'show me what you have in stock' },
  ],
  features: {
    dealerLocator: true,
    leadCapture: true,
    crossBrandComparison: false,
    financing: true,
  },

  brandContent: {
    shippingPolicy: 'We offer competitive Ford Motor Credit financing with rates starting as low as 0% APR on select new Ford models for qualified buyers.',
    returnPolicy: 'Summit Ford offers a 3-day exchange policy on pre-owned vehicles. Ford CPO vehicles come with comprehensive warranty coverage and roadside assistance.',
    storeHours: 'Monday–Friday: 8am–8pm | Saturday: 8am–6pm | Sunday: 10am–5pm. Service department hours vary.',
    dealerLocatorUrl: 'https://www.ford.com/dealerships/',
    heritage: 'Summit Ford has served our community for over 30 years as an authorized Ford dealer. We carry the full Ford lineup — from the legendary F-150 to the all-electric Mustang Mach-E.',
  },
};
