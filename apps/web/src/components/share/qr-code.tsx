"use client";

import { useMemo } from "react";
import { encode } from "uqr";

const QUIET_ZONE = 2;

/** A QR code drawn in the browser (no external service). Always black on white: scanners expect that, also in dark mode. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(value, { ecc: "M", border: 0 });
    const cells: string[] = [];
    data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) cells.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
      }),
    );
    return { size, path: cells.join("") };
  }, [value]);
  const box = size + QUIET_ZONE * 2;

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${box} ${box}`} shapeRendering="crispEdges" className={className}>
      <rect width={box} height={box} className="fill-white" />
      <path d={path} className="fill-black" />
    </svg>
  );
}
