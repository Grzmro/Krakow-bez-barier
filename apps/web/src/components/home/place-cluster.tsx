import type { Status } from "@krakow-bez-barier/ui";
import { PIN_SHADOW } from "./place-pin";

const RING = 6;

/** Diameter in px: grows with the number of places so a dense area reads as dense from afar. */
export function clusterSize(count: number) {
  return count < 10 ? 38 : count < 50 ? 42 : count < 200 ? 46 : 50;
}

/**
 * Map cluster: a circle with the number of places. With a profile on, a donut ring shows the share of
 * each verdict; the label on the marker element carries the same breakdown as text.
 */
export function PlaceCluster({ count, breakdown }: { count: number; breakdown: [Status, number][] }) {
  const size = clusterSize(count);
  const r = size / 2;
  const ringR = r - RING / 2;
  const circumference = 2 * Math.PI * ringR;
  const total = breakdown.reduce((sum, [, n]) => sum + n, 0);
  const segments = breakdown.map(([status, n], i) => ({
    status,
    length: (n / total) * circumference,
    start: (breakdown.slice(0, i).reduce((sum, [, m]) => sum + m, 0) / total) * circumference,
  }));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-r} ${-r} ${size} ${size}`}
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 overflow-visible"
      aria-hidden
    >
      <g style={{ filter: PIN_SHADOW }} className="pointer-events-auto">
        <circle r={r} fill={total ? "var(--card)" : "var(--primary)"} stroke="var(--card)" strokeWidth={2.5} />
      </g>
      {total ? (
        <g transform="rotate(-90)">
          {segments.map(({ status, length, start }) => (
            <circle
              key={status}
              r={ringR}
              fill="none"
              stroke={`var(--status-${status})`}
              strokeWidth={RING}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-start}
            />
          ))}
        </g>
      ) : null}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={total ? "var(--foreground)" : "var(--primary-foreground)"}
        className="font-heading text-[13px] font-bold"
      >
        {count}
      </text>
    </svg>
  );
}
