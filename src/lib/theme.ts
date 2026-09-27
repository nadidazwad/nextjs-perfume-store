import type { StoreConfig } from "../../store.config";

/** Choose black or white text with WCAG AA contrast on any validated hex color. */
export function contrastForeground(hex: string): "#000000" | "#ffffff" {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}

export function themeVariables(theme: StoreConfig["theme"]): Record<`--store-${string}`, string> {
  const radius = { none: "0rem", sm: "0.375rem", md: "0.625rem", lg: "1rem" } as const;
  return {
    "--store-primary": theme.primary,
    "--store-primary-foreground": contrastForeground(theme.primary),
    "--store-deal": theme.deal,
    "--store-deal-foreground": contrastForeground(theme.deal),
    "--store-radius": radius[theme.radius],
  };
}
