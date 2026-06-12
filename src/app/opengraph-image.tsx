import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bio-Lien — Ta boutique en ligne africaine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 72,
          background:
            "linear-gradient(135deg, #FF6B35 0%, #FFD700 100%)",
          color: "#0F0F0F",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#0F0F0F",
              color: "#FFD700",
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
            <span>Bio</span>
            <span style={{ color: "#0F0F0F", opacity: 0.6 }}>-Lien</span>
            <span
              style={{
                marginLeft: 12,
                padding: "4px 12px",
                borderRadius: 8,
                background: "#0F0F0F",
                color: "#FFD700",
                fontSize: 20,
              }}
            >
              AF
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            Crée ta boutique. Partage ton lien.
          </div>
          <div style={{ fontSize: 36, fontWeight: 500, opacity: 0.85, maxWidth: 900 }}>
            La mini-boutique des créateurs TikTok, Instagram &amp; WhatsApp en Afrique.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <span>bio-lien.com</span>
          <span style={{ display: "flex", gap: 16 }}>
            <span>🇸🇳</span>
            <span>🇨🇮</span>
            <span>🇨🇲</span>
            <span>🇬🇭</span>
            <span>🇧🇫</span>
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
