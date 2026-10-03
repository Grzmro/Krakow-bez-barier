import { deflateSync } from "node:zlib";

// A minimal OSM PBF writer for test fixtures, independent of the parser under test.
// Format: https://wiki.openstreetmap.org/wiki/PBF_Format

export type FixtureNode = { id: number; lat: number; lon: number; version?: number; tags?: Record<string, string> };
export type FixtureWay = { id: number; refs: number[]; version?: number; tags?: Record<string, string> };
export type FixtureRelation = {
  id: number;
  members: { type: "node" | "way" | "relation"; ref: number; role?: string }[];
  version?: number;
  tags?: Record<string, string>;
};

const varint = (n: number): number[] => {
  const out: number[] = [];
  let v = n;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
  return out;
};
const zigzag = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
const key = (field: number, wire: number) => varint(field * 8 + wire);

const varintField = (field: number, n: number) => [...key(field, 0), ...varint(n)];
const sintField = (field: number, n: number) => varintField(field, zigzag(n));
const bytesField = (field: number, bytes: Uint8Array | number[]) => [...key(field, 2), ...varint(bytes.length), ...bytes];
const stringField = (field: number, s: string) => bytesField(field, Buffer.from(s, "utf8"));
const packed = (field: number, values: number[]) => bytesField(field, values.flatMap(varint));
const deltas = (values: number[]) => values.map((v, i) => v - (i > 0 ? values[i - 1] : 0));

function block(type: "OSMHeader" | "OSMData", payload: number[]): Buffer {
  const raw = Buffer.from(payload);
  const blob = Buffer.from([...varintField(2, raw.length), ...bytesField(3, deflateSync(raw))]);
  const header = Buffer.from([...stringField(1, type), ...varintField(3, blob.length)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  return Buffer.concat([length, header, blob]);
}

/** One PBF file: a header block (with the replication timestamp) and one data block per element kind. */
export function writeOsmPbf(input: {
  replicationTimestamp?: number;
  nodes: FixtureNode[];
  ways: FixtureWay[];
  relations: FixtureRelation[];
}): Buffer {
  const header = [
    ...stringField(4, "OsmSchema-V0.6"),
    ...(input.replicationTimestamp ? varintField(32, input.replicationTimestamp) : []),
  ];

  const dataBlock = (encode: (str: (s: string) => number) => number[][]) => {
    const strings = [""];
    const str = (s: string) => {
      const i = strings.indexOf(s);
      return i >= 0 ? i : strings.push(s) - 1;
    };
    const group = encode(str).flat();
    const table = strings.flatMap((s) => stringField(1, s));
    return block("OSMData", [...bytesField(1, table), ...bytesField(2, group)]);
  };
  const tagFields = (tags: Record<string, string> | undefined, str: (s: string) => number) => {
    const entries = Object.entries(tags ?? {});
    return entries.length ? [...packed(2, entries.map(([k]) => str(k))), ...packed(3, entries.map(([, v]) => str(v)))] : [];
  };
  const info = (version: number | undefined) => (version ? bytesField(4, varintField(1, version)) : []);

  const nodes = dataBlock((str) =>
    input.nodes.map((n) =>
      bytesField(1, [
        ...sintField(1, n.id),
        ...tagFields(n.tags, str),
        ...info(n.version),
        ...sintField(8, Math.round(n.lat * 1e7)),
        ...sintField(9, Math.round(n.lon * 1e7)),
      ]),
    ),
  );
  const ways = dataBlock((str) =>
    input.ways.map((w) =>
      bytesField(3, [
        ...varintField(1, w.id),
        ...tagFields(w.tags, str),
        ...info(w.version),
        ...packed(8, deltas(w.refs).map(zigzag)),
      ]),
    ),
  );
  const memberType = { node: 0, way: 1, relation: 2 } as const;
  const relations = dataBlock((str) =>
    input.relations.map((r) =>
      bytesField(4, [
        ...varintField(1, r.id),
        ...tagFields(r.tags, str),
        ...info(r.version),
        ...packed(8, r.members.map((m) => str(m.role ?? ""))),
        ...packed(9, deltas(r.members.map((m) => m.ref)).map(zigzag)),
        ...packed(10, r.members.map((m) => memberType[m.type])),
      ]),
    ),
  );

  return Buffer.concat([block("OSMHeader", header), nodes, ways, relations]);
}
