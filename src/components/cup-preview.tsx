// A layered illustration of the drink being built. Purely decorative: the
// summary text next to it carries the same information for screen readers.

type Props = {
  size: "small" | "medium" | "large";
  iced: boolean;
  shots: number;
  milk: boolean;
  syrup: boolean;
  topping: "whip" | "foam" | null;
};

const cupHeights = { small: 150, medium: 185, large: 220 };

export function CupPreview({ size, iced, shots, milk, syrup, topping }: Props) {
  const height = cupHeights[size];
  // Espresso fills more of the cup per shot; without shots it's brewed coffee.
  const coffeeShare = shots === 0 ? (milk ? 0.55 : 0.8) : Math.min(0.65, 0.15 + shots * 0.1);
  const milkShare = milk ? 0.82 - coffeeShare : 0;
  const waterShare = !milk && shots > 0 ? 0.8 - coffeeShare : 0;

  return (
    <div aria-hidden className="flex flex-col items-center">
      <div style={{ height: 34 }} className="flex items-end">
        {topping === "whip" && <div className="h-8 w-28 rounded-t-full bg-[#fff8ef] shadow-sm" />}
      </div>
      <div
        className={`relative w-36 overflow-hidden rounded-b-3xl border-4 transition-all duration-300 ${
          iced ? "border-[#cfe3ea]/80 bg-[#eaf4f7]/40" : "border-[#d9c2a8] bg-[#f3e7d8]"
        }`}
        style={{ height, clipPath: "polygon(0 0, 100% 0, 90% 100%, 10% 100%)" }}
      >
        <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
          <Layer share={coffeeShare} height={height} color={shots === 0 ? "#4a2c1a" : "#3b2214"} />
          {waterShare > 0 && <Layer share={waterShare} height={height} color="#6b4a33" />}
          {syrup && <Layer share={0.05} height={height} color="#c98a3d" />}
          {milkShare > 0 && <Layer share={milkShare} height={height} color="#e9d6bd" />}
          {topping === "foam" && <Layer share={0.1} height={height} color="#fbf1e3" />}
        </div>
        {iced && (
          <div className="absolute inset-x-4 top-6 flex flex-wrap gap-2 opacity-70">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-6 w-6 rotate-12 rounded-md border border-white/70 bg-white/50" />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 h-2 w-40 rounded-full bg-foreground/10" />
    </div>
  );
}

function Layer({ share, height, color }: { share: number; height: number; color: string }) {
  return (
    <div
      className="transition-all duration-300"
      style={{ height: Math.max(0, share) * height, background: color }}
    />
  );
}
