import { Check, ExclamationMark, Minus, Question, type Icon } from "@phosphor-icons/react";
import type { Status } from "@krakow-bez-barier/ui";

const SIZE = 36;
const R = SIZE / 2;
const VIEW = R + 9;
const GLYPH: Record<Status, Icon> = { met: Check, barrier: Minus, conflict: ExclamationMark, unknown: Question };
export const PIN_SHADOW = "drop-shadow(0 2px 3px rgb(22 20 31 / .18)) drop-shadow(0 6px 10px rgb(91 61 245 / .12))";
const OCTAGON = Array.from({ length: 8 }, (_, i) => {
  const a = (Math.PI / 8) * (2 * i + 1);
  return `${(Math.cos(a) * R).toFixed(2)},${(Math.sin(a) * R).toFixed(2)}`;
}).join(" ");

function Shape({ status }: { status: Status | null }) {
  const fill = status ? `var(--status-${status})` : "var(--primary)";
  if (status === "barrier") {
    return <polygon points={OCTAGON} fill={fill} stroke="var(--card)" strokeWidth={2.5} strokeLinejoin="round" />;
  }
  if (status === "conflict") {
    const d = R * 1.08 * 0.72;
    return (
      <rect x={-d} y={-d} width={d * 2} height={d * 2} rx={4} transform="rotate(45)" fill={fill} stroke="var(--card)" strokeWidth={2.5} />
    );
  }
  if (status === "unknown") {
    return (
      <>
        <circle r={R} fill="var(--card)" />
        <circle
          r={R - 1.5}
          fill="var(--status-unknown-bg)"
          stroke="var(--status-unknown)"
          strokeWidth={1.75}
          strokeDasharray="4 3"
        />
      </>
    );
  }
  return <circle r={R} fill={fill} stroke="var(--card)" strokeWidth={2.5} />;
}

/**
 * Map pin: circle (met or no profile), octagon (barrier), diamond (conflict), dashed circle (unknown),
 * each with its status glyph, so the verdict never rests on colour alone. The selected ring shows
 * when an ancestor has `data-selected="true"`.
 */
export function PlacePin({ status }: { status: Status | null }) {
  const I = status ? GLYPH[status] : null;
  const glyph = SIZE * 0.5;
  return (
    <svg
      width={VIEW * 2}
      height={VIEW * 2}
      viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 overflow-visible"
      aria-hidden
    >
      <circle
        r={R + 6}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={3}
        className="hidden group-data-[selected=true]:block"
      />
      <g style={{ filter: PIN_SHADOW }} className="pointer-events-auto">
        <Shape status={status} />
      </g>
      {I ? (
        <I
          x={-glyph / 2}
          y={-glyph / 2}
          width={glyph}
          height={glyph}
          weight="bold"
          color={status === "unknown" ? "var(--status-unknown)" : "var(--card)"}
        />
      ) : (
        <circle r={4} fill="var(--card)" />
      )}
    </svg>
  );
}
