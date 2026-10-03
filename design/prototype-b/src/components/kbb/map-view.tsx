import { memo, useId } from "react"
import { Train } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Status } from "@/lib/data"
import {
  INNER_BLOCKS,
  LABELS,
  OUTER_BLOCKS,
  PLANTY,
  RING_ROAD,
  RIVER,
  RYNEK,
  STREETS,
  smoothPath,
  type Pt,
} from "./map-geometry"
import { PinShape } from "./status"

export const VIEW_W = 390
export const VIEW_H = 844

export interface Camera {
  /** world point to place on screen */
  wx: number
  wy: number
  /** screen point (viewBox px) */
  sx: number
  sy: number
  s: number
}

export interface MapPin {
  id: string
  x: number
  y: number
  status: Status | null
  selected?: boolean
  dimmed?: boolean
  label: string
}

export interface MapRouteSeg {
  id: number
  points: Pt[]
  status: Status
}

const EASE = "cubic-bezier(.2,.8,.2,1)"
const DUR = 520

const planty = smoothPath(PLANTY, true)
const ring = smoothPath(RING_ROAD, true)
const river = smoothPath(RIVER)

const BaseMap = memo(function BaseMap({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <clipPath id={`${uid}-in`}>
          <path d={planty} />
        </clipPath>
        <mask id={`${uid}-out`}>
          <rect x={-1000} y={-1000} width={4000} height={4000} fill="white" />
          <path d={planty} fill="black" stroke="black" strokeWidth={70} />
        </mask>
      </defs>
      <rect x={-1000} y={-1000} width={4000} height={4000} fill="var(--map-land)" />
      {/* Błonia / parks */}
      <path d="M-420,330 C-300,300 -120,320 -60,380 C-20,460 -40,700 -90,780 C-200,830 -380,820 -440,760 Z" fill="var(--map-green)" />
      <path d="M1000,980 C1100,960 1220,990 1240,1060 C1250,1130 1150,1170 1060,1150 C990,1120 960,1030 1000,980 Z" fill="var(--map-green)" />
      <g mask={`url(#${uid}-out)`}>
        {OUTER_BLOCKS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={5} fill="var(--map-block)" transform="rotate(7 500 600)" />
        ))}
      </g>
      <g clipPath={`url(#${uid}-in)`}>
        {INNER_BLOCKS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="var(--map-block)" />
        ))}
      </g>
      {/* railway */}
      <rect x={955} y={-420} width={130} height={900} rx={20} fill="var(--map-casing)" opacity={0.55} transform="rotate(4 1000 0)" />
      {[968, 990, 1012, 1034, 1056].map((x) => (
        <path key={x} d={`M${x},-420 C${x + 10},0 ${x + 30},300 ${x + 60},900 S${x + 90},1500 ${x + 100},1700`} fill="none" stroke="var(--map-label)" strokeOpacity={0.35} strokeWidth={2.5} strokeDasharray="10 6" />
      ))}
      {/* river with green banks */}
      <path d={river} fill="none" stroke="var(--map-green)" strokeWidth={150} strokeLinecap="round" opacity={0.85} />
      <path d={river} fill="none" stroke="var(--map-water)" strokeWidth={84} strokeLinecap="round" />
      {/* Wawel hill */}
      <path d="M330,1120 C380,1095 470,1100 505,1150 C530,1205 495,1262 430,1268 C365,1272 318,1236 312,1186 C308,1155 315,1132 330,1120 Z" fill="var(--map-green)" />
      <path d="M368,1150 L470,1146 L478,1222 L372,1230 Z" fill="var(--map-block)" stroke="var(--map-casing)" strokeWidth={3} />
      <rect x={398} y={1170} width={48} height={36} rx={3} fill="var(--map-land)" />
      {/* roads: casing then fill */}
      <path d={ring} fill="none" stroke="var(--map-casing)" strokeWidth={30} />
      {STREETS.map((s, i) => (
        <path key={`c${i}`} d={smoothPath(s.pts)} fill="none" stroke="var(--map-casing)" strokeWidth={s.w + 5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d={ring} fill="none" stroke="var(--map-street)" strokeWidth={24} />
      {STREETS.map((s, i) => (
        <path key={`f${i}`} d={smoothPath(s.pts)} fill="none" stroke="var(--map-street)" strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Planty green belt */}
      <path d={planty} fill="none" stroke="var(--map-green)" strokeWidth={44} strokeLinejoin="round" />
      <path d={planty} fill="none" stroke="var(--map-street)" strokeOpacity={0.75} strokeWidth={3} strokeDasharray="14 10" />
      {/* Rynek */}
      <rect x={RYNEK.x} y={RYNEK.y} width={RYNEK.w} height={RYNEK.h} rx={10} fill="var(--map-street)" stroke="var(--map-casing)" strokeWidth={4} />
      <rect x={508} y={500} width={34} height={128} rx={5} fill="var(--map-block)" stroke="var(--map-casing)" strokeWidth={2} />
      <rect x={458} y={598} width={20} height={20} rx={3} fill="var(--map-block)" />
      <path d="M628,478 L668,470 L676,504 L636,512 Z" fill="var(--map-block)" stroke="var(--map-casing)" strokeWidth={2} />
      {/* station + mall */}
      <rect x={846} y={186} width={118} height={50} rx={8} fill="var(--map-block)" stroke="var(--map-casing)" strokeWidth={3} />
      <rect x={800} y={64} width={120} height={96} rx={10} fill="var(--map-block)" stroke="var(--map-casing)" strokeWidth={3} />
    </>
  )
})

function project(cam: Camera, x: number, y: number): [number, number] {
  return [cam.sx + (x - cam.wx) * cam.s, cam.sy + (y - cam.wy) * cam.s]
}

export interface MapViewProps {
  camera: Camera
  pins?: MapPin[]
  route?: MapRouteSeg[]
  highlightSeg?: number | null
  routeStart?: Pt
  routeEnd?: Pt
  onPinClick?: (id: string) => void
  pinKey?: string
  showLabels?: boolean
  className?: string
  animate?: boolean
}

export function MapView({
  camera,
  pins = [],
  route,
  highlightSeg = null,
  routeStart,
  routeEnd,
  onPinClick,
  pinKey = "",
  showLabels = true,
  className,
  animate = true,
}: MapViewProps) {
  const uid = useId().replace(/:/g, "")
  const tx = camera.sx - camera.wx * camera.s
  const ty = camera.sy - camera.wy * camera.s
  const transition = animate ? `transform ${DUR}ms ${EASE}` : undefined
  const center = project(camera, camera.wx, camera.wy)

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMin slice"
      className={cn("absolute inset-0 size-full select-none", className)}
    >
      <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${camera.s})`, transformOrigin: "0 0", transition }}>
        <BaseMap uid={uid} />
        {route?.map((seg) => (
          <path
            key={`case${seg.id}`}
            d={smoothPath(seg.points, false, 0.3)}
            fill="none"
            stroke="var(--card)"
            strokeWidth={seg.id === highlightSeg ? 15 : 11}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {route?.map((seg) => {
          const unknown = seg.status === "unknown"
          const barrier = seg.status === "barrier"
          const dim = highlightSeg !== null && highlightSeg !== seg.id
          return (
            <path
              key={`seg${seg.id}`}
              d={smoothPath(seg.points, false, 0.3)}
              fill="none"
              stroke={unknown ? "var(--status-unknown)" : barrier ? "var(--status-barrier)" : "var(--primary)"}
              strokeWidth={seg.id === highlightSeg ? 9 : 6}
              strokeDasharray={unknown ? "2 9" : barrier ? "10 6" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={dim ? 0.35 : 1}
              style={{ transition: "opacity 250ms, stroke-width 250ms" }}
            />
          )
        })}
      </g>

      {showLabels &&
        LABELS.map((l) => {
          const [x, y] = project(camera, l.x, l.y)
          const size = l.kind === "area" ? 12 : l.kind === "poi" ? 11.5 : 10.5
          return (
            <g key={l.text} style={{ transform: `translate(${x}px, ${y}px)`, transition }}>
              <text
                transform={l.rotate ? `rotate(${l.rotate})` : undefined}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size}
                fontWeight={l.kind === "area" || l.kind === "poi" ? 700 : 600}
                letterSpacing={l.kind === "area" ? 0.6 : 0.2}
                fontStyle={l.kind === "water" ? "italic" : undefined}
                fill={l.kind === "water" ? "color-mix(in oklab, var(--map-water), var(--foreground) 45%)" : "var(--map-label)"}
                stroke="var(--map-land)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ fontFamily: "var(--font-display)", textTransform: l.kind === "area" ? "uppercase" : undefined }}
              >
                {l.text}
              </text>
            </g>
          )
        })}

      {routeStart && (() => {
        const [x, y] = project(camera, routeStart[0], routeStart[1])
        return (
          <g style={{ transform: `translate(${x}px, ${y}px)`, transition }}>
            <circle r={16} fill="var(--ink)" stroke="var(--card)" strokeWidth={3} />
            <g transform="translate(-9,-9)">
              <Train width={18} height={18} weight="bold" color="var(--ink-foreground)" />
            </g>
          </g>
        )
      })()}
      {routeEnd && (() => {
        const [x, y] = project(camera, routeEnd[0], routeEnd[1])
        return (
          <g style={{ transform: `translate(${x}px, ${y}px)`, transition }}>
            <circle r={18} fill="var(--primary)" opacity={0.18} />
            <circle r={9} fill="var(--primary)" stroke="var(--card)" strokeWidth={3} />
          </g>
        )
      })()}

      {pins.map((p, i) => {
        const [x, y] = project(camera, p.x, p.y)
        const dist = Math.hypot(x - center[0], y - center[1])
        return (
          <g
            key={p.id}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition,
              opacity: p.dimmed ? 0.28 : 1,
              cursor: onPinClick ? "pointer" : undefined,
            }}
            onClick={onPinClick ? () => onPinClick(p.id) : undefined}
          >
            <g
              key={pinKey}
              className="pin-pop"
              style={{ animationDelay: `${Math.min(400, Math.round(dist / 40) * 40 + i * 4)}ms` }}
            >
              <circle r={24} fill="transparent" />
              <PinShape status={p.status} size={p.selected ? 48 : 36} selected={p.selected} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
