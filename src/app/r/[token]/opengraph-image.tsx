import { ImageResponse } from "next/og";
import { loadSharedReceipt, weekLabel } from "@/lib/receipt-share";

export const alt = "A shared Brew Lab receipt";
export const size = { width: 1080, height: 1080 };
export const contentType = "image/png";

// The image renderer's built-in font may lack the peso sign, so spell it out.
const pesos = (cents: number) => `PHP ${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

/** The square card shown on Facebook and X, and saved for Instagram. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const data = await loadSharedReceipt((await params).token);
  const lines =
    data?.kind === "order"
      ? data.items.slice(0, 5).map((i) => `${i.quantity} × ${i.name}`)
      : data
        ? [`${data.drinks} drinks · ${data.orders} orders`, data.favorite ? `Favourite: ${data.favorite}` : ""].filter(Boolean)
        : [];
  const title = data?.kind === "order" ? data.branch : "My week of coffee";
  const subtitle = data?.kind === "order" ? data.date.toLocaleDateString("en-PH", { dateStyle: "medium" }) : data ? weekLabel(data.weekStart) : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#b8622b" }}>
        <div
          style={{
            width: 860,
            display: "flex",
            flexDirection: "column",
            padding: 64,
            background: "#faf6f0",
            color: "#2b1d14",
            borderRadius: 48,
            fontFamily: "serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 32, color: "#b8622b", fontWeight: 700, letterSpacing: 4 }}>BREW LAB</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: "#7a6656" }}>{subtitle}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, paddingTop: 28, borderTop: "4px dashed #e5d8c8", fontSize: 38, gap: 14 }}>
            {lines.map((l) => (
              <div key={l} style={{ display: "flex" }}>
                {l}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 28, borderTop: "4px dashed #e5d8c8", fontSize: 48, fontWeight: 700 }}>
            <span>Total</span>
            <span>{data ? pesos(data.totalCents) : ""}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
