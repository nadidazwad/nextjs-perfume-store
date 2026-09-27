import { ImageResponse } from "next/og";
import { storeConfig } from "../../../store.config";
import { contrastForeground } from "@/lib/theme";

/** Store initials, e.g. "Attar Demo Store" → "AD". */
function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/**
 * Home-screen icon: the store's initials on its theme colour. Full-bleed and
 * with the letters inside the central safe zone, so it also works as a
 * maskable icon on Android. Replace with a real logo by serving your own PNGs.
 */
export function appIcon(size: number) {
  const { primary } = storeConfig.theme;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: primary,
          color: contrastForeground(primary),
          fontSize: size * 0.36,
          fontWeight: 600,
          letterSpacing: -size * 0.012,
        }}
      >
        {initials(storeConfig.store.name)}
      </div>
    ),
    { width: size, height: size },
  );
}
