import type { Status } from "@krakow-bez-barier/ui";
import { donutSegments } from "@/lib/map-clusters";
import { PIN_SHADOW } from "./place-pin";

const RING = 6;

/** Diameter in px: grows with the number of places so a dense area reads as dense from afar. */
export function clusterSize(count: number) {
  return count < 10 ? 38 : count < 50 ? 42 : count < 200 ? 46 : 50;
}

/**
 * Map cluster: a circle with the number of places. With a profile on, a donut ring shows the share of
 * each verdict (places without one stay a neutral track); the label on the marker element carries the
 * same breakdown as text. The selected ring shows when an ancestor has `data-selected="true"`.
 */
export function PlaceCluster({ count, breakdown }: { count: number; breakdown: [Status, number][] }) {
  const size = clusterSize(count);
  const r = size / 2;
  const ringR = r - RING / 2;
  const circumference = 2 * Math.PI * ringR;
  const withVerdicts = breakdown.length > 0;
  const segments = donutSegments(breakdown, count).map(({ status, start, length }) => ({
    status,
    start: start * circumference,
    length: length * circumference,
  }));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-r} ${-r} ${size} ${size}`}
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 overflow-visible"
      aria-hidden
    >
      <circle
        r={r + 5}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={3}
        className="hidden group-data-[selected=true]:block"
      />
      <g style={{ filter: PIN_SHADOW }} className="pointer-events-auto">
        <circle r={r} fill={withVerdicts ? "var(--card)" : "var(--primary)"} stroke="var(--card)" strokeWidth={2.5} />
      </g>
      {withVerdicts ? (
        <g transform="rotate(-90)">
          <circle r={ringR} fill="none" stroke="var(--muted)" strokeWidth={RING} />
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
        fill={withVerdicts ? "var(--foreground)" : "var(--primary-foreground)"}
        className="font-heading text-[13px] font-bold"
      >
        {count}
      </text>
    </svg>
  );
}
