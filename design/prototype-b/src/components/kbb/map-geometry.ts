// Hand-drawn, schematic geometry of central Kraków in "world" units (≈ metres, north up).
// It is a stylised illustration, not survey data.

export type Pt = [number, number]

export function smoothPath(points: Pt[], closed = false, tension = 0.5): string {
  if (points.length < 2) return ""
  const pts = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]]
  let d = `M${pts[1][0]},${pts[1][1]}`
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]]
    const t = tension / 3
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return closed ? d + " Z" : d
}

export const PLANTY: Pt[] = [
  [560, 238], [690, 252], [778, 345], [800, 520], [785, 700], [725, 862], [622, 985],
  [520, 1058], [462, 1085], [385, 1035], [300, 895], [258, 720], [268, 520], [325, 352], [430, 262],
]

export const RING_ROAD: Pt[] = [
  [560, 190], [720, 205], [835, 290], [858, 520], [838, 760], [770, 935], [650, 1068],
  [520, 1140], [380, 1110], [262, 960], [212, 720], [222, 480], [292, 300], [420, 210],
]

export const RIVER: Pt[] = [
  [-500, 1230], [-150, 1262], [120, 1300], [290, 1350], [430, 1335], [560, 1292], [700, 1330],
  [860, 1418], [1100, 1450], [1500, 1420],
]

export interface Street {
  pts: Pt[]
  w: number
  major?: boolean
}

export const STREETS: Street[] = [
  // radial roads outside the ring
  { pts: [[835, 290], [1050, 300], [1500, 320]], w: 22, major: true },
  { pts: [[720, 205], [790, 120], [830, 0], [860, -400]], w: 22, major: true },
  { pts: [[560, 190], [545, 0], [530, -400]], w: 18 },
  { pts: [[292, 300], [180, 120], [60, -400]], w: 18 },
  { pts: [[212, 650], [0, 640], [-500, 630]], w: 24, major: true },
  { pts: [[858, 560], [1100, 570], [1500, 590]], w: 18 },
  { pts: [[820, 820], [1050, 940], [1500, 1080]], w: 18 },
  { pts: [[650, 1068], [900, 1120], [1500, 1150]], w: 16 },
  { pts: [[262, 960], [100, 1080], [-200, 1140]], w: 16 },
  { pts: [[380, 210], [360, 0], [330, -400]], w: 14 },
  { pts: [[222, 480], [0, 420], [-500, 380]], w: 14 },
  { pts: [[960, 300], [980, 700], [1000, 1200]], w: 12 },
  { pts: [[1150, -200], [1180, 600], [1200, 1300]], w: 12 },
  { pts: [[-120, -300], [-150, 600], [-140, 1200]], w: 12 },
  // old town grid
  { pts: [[602, 465], [596, 360], [588, 250]], w: 13 },
  { pts: [[490, 465], [480, 360], [470, 262]], w: 12 },
  { pts: [[430, 500], [380, 480], [312, 460]], w: 11 },
  { pts: [[430, 560], [360, 575], [272, 595]], w: 12 },
  { pts: [[430, 640], [360, 645], [268, 655]], w: 11 },
  { pts: [[450, 665], [468, 800], [458, 950], [455, 1060]], w: 13 },
  { pts: [[625, 600], [700, 605], [790, 615]], w: 11 },
  { pts: [[640, 512], [710, 495], [786, 470]], w: 11 },
  { pts: [[625, 465], [660, 380], [700, 280]], w: 11 },
  { pts: [[440, 665], [400, 760], [330, 860]], w: 11 },
  { pts: [[505, 665], [520, 780], [560, 900]], w: 10 },
  { pts: [[600, 665], [650, 790], [700, 860]], w: 10 },
  { pts: [[330, 860], [420, 860], [520, 840], [620, 800]], w: 10 },
  { pts: [[300, 390], [420, 380], [560, 380], [720, 400]], w: 9 },
]

export const RYNEK = { x: 430, y: 465, w: 195, h: 200 }

export interface MapLabel {
  text: string
  x: number
  y: number
  kind: "area" | "street" | "water" | "poi"
  rotate?: number
}

export const LABELS: MapLabel[] = [
  { text: "Rynek Główny", x: 470, y: 690, kind: "area" },
  { text: "Planty", x: 268, y: 800, kind: "street", rotate: -78 },
  { text: "Floriańska", x: 612, y: 400, kind: "street", rotate: -87 },
  { text: "Grodzka", x: 478, y: 870, kind: "street", rotate: 88 },
  { text: "Basztowa", x: 640, y: 182, kind: "street", rotate: 4 },
  { text: "Wawel", x: 410, y: 1195, kind: "area" },
  { text: "Wisła", x: 640, y: 1320, kind: "water", rotate: 10 },
  { text: "Dworzec Główny", x: 905, y: 262, kind: "poi" },
  { text: "Stare Miasto", x: 380, y: 420, kind: "area" },
]

function hash(i: number, j: number) {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return h - Math.floor(h)
}

export interface Block {
  x: number
  y: number
  w: number
  h: number
}

export function makeBlocks(x0: number, y0: number, x1: number, y1: number, step: number, gap: number, seed: number): Block[] {
  const out: Block[] = []
  let i = 0
  for (let x = x0; x < x1; x += step) {
    let j = 0
    for (let y = y0; y < y1; y += step) {
      const r = hash(i + seed, j - seed)
      if (r > 0.08) {
        const split = r > 0.6
        const w = step - gap
        if (split) {
          const k = 0.4 + r * 0.25
          out.push({ x, y, w: w * k - gap / 2, h: w })
          out.push({ x: x + w * k + gap / 2, y, w: w * (1 - k) - gap / 2, h: w })
        } else {
          out.push({ x, y, w, h: w })
        }
      }
      j++
    }
    i++
  }
  return out
}

export const INNER_BLOCKS = makeBlocks(236, 232, 806, 1090, 58, 12, 3).filter(
  (b) => !(b.x + b.w > RYNEK.x - 8 && b.x < RYNEK.x + RYNEK.w + 8 && b.y + b.h > RYNEK.y - 8 && b.y < RYNEK.y + RYNEK.h + 8),
)
export const OUTER_BLOCKS = makeBlocks(-420, -320, 1420, 1620, 74, 16, 11)
