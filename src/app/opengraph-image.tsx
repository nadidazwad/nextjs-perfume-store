import { ImageResponse } from "next/og";
import { storeConfig } from "../../store.config";
export const alt = storeConfig.store.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#f5f5f5",
        color: "#171717",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        width: "100%",
        height: "100%",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 72, letterSpacing: -3 }}>
        {storeConfig.store.name}
      </div>
      <div style={{ marginTop: 28, fontSize: 30, color: "#555" }}>
        {storeConfig.store.tagline}
      </div>
      <div style={{ marginTop: 80, fontSize: 24 }}>
        Fragrances · Brands · Collections
      </div>
    </div>,
    size,
  );
}
