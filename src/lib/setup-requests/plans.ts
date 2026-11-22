/** "Get this store" options. Zod-free: the storefront form imports it eagerly. */
export const SETUP_PLANS = [
  { value: "setup", title: "This design with my branding", description: "Your logo, colours, products and payment numbers on this store." },
  { value: "custom", title: "A custom design for my brand", description: "A design made for your brand: type, colours, layout and homepage." },
  { value: "unsure", title: "Not sure yet", description: "Tell me about your shop and I'll suggest what fits." },
] as const;
export type SetupPlan = (typeof SETUP_PLANS)[number]["value"];
export const setupPlanTitle = (value: string) => SETUP_PLANS.find((plan) => plan.value === value)?.title ?? value;
