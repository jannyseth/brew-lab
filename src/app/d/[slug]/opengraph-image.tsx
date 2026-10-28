import { ImageResponse } from "next/og";
import { getSignatureDrink } from "@/lib/signature";
import { tierLabels } from "@/lib/coin-rules";

export const alt = "A Brew Lab signature drink";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card Facebook and Messenger show when a drink link is shared. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const drink = await getSignatureDrink(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#faf6f0",
          color: "#2b1d14",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: "#b8622b", fontWeight: 700 }}>Brew Lab · Signature drink</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>{drink?.name ?? "Signature drink"}</div>
          {drink && (
            <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#7a6656" }}>
              {`${drink.baseName} · by @${drink.handle}${drink.tier === "creator" ? "" : ` · ${tierLabels[drink.tier]}`}`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#7a6656" }}>Order it ahead, pay at pickup.</div>
      </div>
    ),
    size,
  );
}
