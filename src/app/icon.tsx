import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon used by Android and the web manifest. */
export default function Icon() {
  return new ImageResponse(<AppMark size={512} />, size);
}

export function AppMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#b8622b",
        color: "#faf6f0",
        fontSize: size * 0.5,
        fontWeight: 700,
        fontFamily: "serif",
      }}
    >
      B
    </div>
  );
}
