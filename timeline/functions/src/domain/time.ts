import type { Calendar, Coordinate, TimeSpec, Unit } from "./types";
const units: Unit[] = ["year", "month", "day", "hour", "minute"];
const th: Record<Unit, string> = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "ชั่วโมง",
  minute: "นาที",
};
export interface TimeNode {
  id: string;
  time: TimeSpec;
  addedAt: number;
  titleTh: string;
}
export interface Position {
  key: string;
  scale?: string;
  value?: bigint;
  end?: bigint;
  unit?: Unit;
  approximate: boolean;
  label: string;
  coordinate?: Coordinate;
  unresolved?: string;
}
function coordinate(c: Coordinate, calendar: Calendar): Position {
  const label =
    [
      c.eraId ? (calendar.eras?.[c.eraId]?.nameTh ?? c.eraId) : "",
      ...units.filter((u) => c[u] !== undefined).map((u) => `${th[u]} ${c[u]}`),
    ]
      .filter(Boolean)
      .join(" ") || "ไม่ทราบเวลา";
  const key = JSON.stringify(c);
  const p: Position = { key, label, coordinate: c, approximate: false };
  if (c.year === undefined)
    return { ...p, unresolved: "ยุคหรือเวลาที่ไม่มีปีอ้างอิง" };
  const present = units.filter((u) => c[u] !== undefined);
  const factors = calendar.units;
  const eraOffset = c.eraId ? calendar.eras?.[c.eraId]?.offsetTicks : "0";
  if (factors && eraOffset !== undefined && present.every((u) => factors[u])) {
    let v = BigInt(eraOffset);
    for (const u of present)
      v +=
        (BigInt(c[u]!) - (u === "month" || u === "day" ? 1n : 0n)) *
        BigInt(factors[u]!);
    return {
      ...p,
      scale: `${calendar.id}:ticks:${c.precision}`,
      value: v,
      unit: c.precision as Unit,
    };
  }
  // Symbolic coordinates can have a distance only within the same known unit/parent.
  const last = present.at(-1)!;
  const parent = present
    .slice(0, -1)
    .map((u) => `${u}=${c[u]}`)
    .join(":");
  return {
    ...p,
    scale: `${calendar.id}:${c.eraId ?? ""}:${parent}:${last}`,
    value: BigInt(c[last]!),
    unit: last,
  };
}
export function resolveTimes(
  nodes: TimeNode[],
  calendar: Calendar,
): Map<string, Position> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, Position>();
  function visit(id: string, visiting: Set<string>): Position {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id);
    if (!node || visiting.has(id))
      return {
        key: id,
        approximate: true,
        label: "ไม่สามารถระบุเวลาได้",
        unresolved: node
          ? "อ้างอิงเป็นวงจร"
          : "เหตุการณ์อ้างอิงไม่เปิดเผยหรือยังไม่ได้โหลด",
      };
    const trail = new Set(visiting).add(id);
    const t = node.time;
    let p: Position;
    if (t.type === "unknown")
      p = {
        key: `unknown:${id}`,
        approximate: true,
        label: t.noteTh || "ไม่ทราบเวลา",
        unresolved: "ไม่ทราบเวลา",
      };
    else if (t.type === "exact" || t.type === "approximate")
      p = {
        ...coordinate(t.type === "exact" ? t.at : t.around, calendar),
        approximate: t.type === "approximate",
      };
    else if (t.type === "range") {
      const a = coordinate(t.from, calendar),
        b = coordinate(t.to, calendar);
      p = {
        ...a,
        key: `range:${a.key}:${b.key}`,
        end: a.scale === b.scale ? b.value : undefined,
        label: `${a.label} ถึง ${b.label}`,
        approximate: true,
      };
    } else {
      const a = visit(t.anchorEventId, trail);
      const relation = {
        before: "ก่อน",
        after: "หลัง",
        same_time: "พร้อมกับ",
        during: "ระหว่าง",
      }[t.relation];
      const title =
        byId.get(t.anchorEventId)?.titleTh ?? "เหตุการณ์อ้างอิงไม่เปิดเผย";
      const label = `${relation} ${title}${t.offset ? ` ${t.offset.amount} ${th[t.offset.unit]}` : ""}`;
      if (t.relation === "same_time" && !a.unresolved) p = { ...a, label };
      else if (t.relation === "during" && a.end !== undefined)
        p = { ...a, key: `during:${id}`, label, approximate: true };
      else if (
        t.offset &&
        a.value !== undefined &&
        !a.unresolved &&
        (t.relation === "before" || t.relation === "after")
      ) {
        const factor = a.scale?.includes(":ticks:")
          ? calendar.units?.[t.offset.unit]
          : a.unit === t.offset.unit
            ? "1"
            : undefined;
        if (factor) {
          const value =
            a.value +
            BigInt(t.offset.amount) *
              BigInt(factor) *
              (t.relation === "before" ? -1n : 1n);
          p = {
            ...a,
            coordinate: undefined,
            key: `${a.scale}:${value}`,
            value,
            end: undefined,
            label,
            approximate: a.approximate || !!t.offset.approximate,
          };
        } else
          p = {
            key: `relative:${id}`,
            label,
            approximate: true,
            unresolved: "ปฏิทินยังไม่มีการแปลงหน่วยนี้",
          };
      } else
        p = {
          key: `relative:${id}`,
          label,
          approximate: true,
          unresolved: a.unresolved || "ทราบเฉพาะลำดับ ไม่ทราบระยะห่าง",
        };
    }
    if (p.approximate && t.type === "approximate")
      p.label = `ประมาณ ${p.label}`;
    // Exact same coordinate, including resolved relative times, shares one semantic marker.
    if (p.value !== undefined && p.end === undefined && !p.approximate)
      p.key = `${p.scale}:${p.value}`;
    memo.set(id, p);
    return p;
  }
  for (const n of nodes) visit(n.id, new Set());
  return memo;
}
export function assertAcyclic(nodes: Pick<TimeNode, "id" | "time">[]): void {
  const refs = new Map(
    nodes.map((n) => [
      n.id,
      n.time.type === "relative" ? n.time.anchorEventId : null,
    ]),
  );
  const done = new Set<string>();
  for (const id of refs.keys()) {
    const path = new Set<string>();
    let cursor: string | null | undefined = id;
    while (cursor && !done.has(cursor)) {
      if (path.has(cursor))
        throw new Error("เวลาอ้างอิงเป็นวงจร กรุณาเลือกเหตุการณ์อื่น");
      path.add(cursor);
      cursor = refs.get(cursor);
    }
    path.forEach((x) => done.add(x));
  }
}
export function comparePositions(a: Position, b: Position): number {
  if (
    a.scale &&
    a.scale === b.scale &&
    a.value !== undefined &&
    b.value !== undefined
  )
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  if (
    a.coordinate &&
    b.coordinate &&
    a.coordinate.eraId === b.coordinate.eraId
  ) {
    for (const u of units) {
      if (a.coordinate[u] === undefined || b.coordinate[u] === undefined)
        return 0;
      const av = BigInt(a.coordinate[u]!),
        bv = BigInt(b.coordinate[u]!);
      if (av !== bv) return av < bv ? -1 : 1;
    }
  }
  return 0;
}
export function orderedNodes<T extends TimeNode>(
  nodes: T[],
  positions: Map<string, Position>,
): T[] {
  const sorted = [...nodes].sort(
    (a, b) =>
      comparePositions(positions.get(a.id)!, positions.get(b.id)!) ||
      a.id.localeCompare(b.id),
  );
  const edges = new Map<string, string[]>();
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  for (const n of nodes)
    if (n.time.type === "relative" && indegree.has(n.time.anchorEventId)) {
      const from = n.time.relation === "before" ? n.id : n.time.anchorEventId;
      const to = n.time.relation === "before" ? n.time.anchorEventId : n.id;
      edges.set(from, [...(edges.get(from) || []), to]);
      indegree.set(to, indegree.get(to)! + 1);
    }
  const result: T[] = [];
  const queue = sorted.filter((n) => !indegree.get(n.id));
  while (queue.length) {
    const n = queue.shift()!;
    result.push(n);
    for (const next of edges.get(n.id) || []) {
      indegree.set(next, indegree.get(next)! - 1);
      if (!indegree.get(next)) queue.push(sorted.find((x) => x.id === next)!);
    }
  }
  return result.length === nodes.length ? result : sorted;
}
export function distance(a: Position, b: Position, calendar: Calendar): string {
  if (
    !a.scale ||
    a.scale !== b.scale ||
    a.value === undefined ||
    b.value === undefined ||
    a.end !== undefined ||
    b.end !== undefined
  )
    return "ไม่สามารถระบุระยะห่างที่แน่นอนได้";
  let delta = b.value - a.value;
  if (delta < 0n) delta = -delta;
  let label = `${delta} ${th[a.unit || "year"]}`;
  if (a.scale.includes(":ticks:")) {
    const chosen = units.find(
      (u) => calendar.units?.[u] && delta % BigInt(calendar.units[u]!) === 0n,
    );
    if (!chosen) return "ไม่สามารถระบุระยะห่างที่แน่นอนได้";
    label = `${delta / BigInt(calendar.units![chosen]!)} ${th[chosen]}`;
  }
  return `${a.approximate || b.approximate ? "ประมาณ " : ""}${label}`;
}
export interface LayoutGroup<T> {
  key: string;
  nodes: T[];
  x: number;
  endX?: number;
  position: Position;
}
export function layout<T extends TimeNode>(
  nodes: T[],
  calendar: Calendar,
  mode: "equal" | "time",
): LayoutGroup<T>[] {
  const positions = resolveTimes(nodes, calendar);
  const order = orderedNodes(nodes, positions);
  const groups: LayoutGroup<T>[] = [];
  const seen = new Map<string, LayoutGroup<T>>();
  for (const n of order) {
    const p = positions.get(n.id)!;
    const existing = seen.get(p.key);
    if (existing) existing.nodes.push(n);
    else {
      const g = { key: p.key, nodes: [n], x: 0, position: p };
      groups.push(g);
      seen.set(p.key, g);
    }
  }
  // Normalize BigInt differences before converting to floating pixels, never absolute epochs.
  const numerical = groups.filter((g) => g.position.value !== undefined);
  const scales = new Set(numerical.map((g) => g.position.scale));
  const values = numerical.map((g) => g.position.value!);
  const min = values.reduce((a, b) => (a < b ? a : b), values[0] ?? 0n);
  const max = values.reduce((a, b) => (a > b ? a : b), values[0] ?? 0n);
  const span = max - min || 1n;
  let x = 60;
  for (const g of groups) {
    const proportional =
      mode === "time" && scales.size === 1 && g.position.value !== undefined;
    const raw = proportional
      ? 60 +
        (Number(((g.position.value! - min) * 1_000_000n) / span) / 1_000_000) *
          Math.max(600, groups.length * 150)
      : x;
    g.x = Math.max(x, raw);
    x = g.x + 120;
    if (
      g.position.end !== undefined &&
      g.position.value !== undefined &&
      proportional
    )
      g.endX =
        g.x +
        Math.max(
          32,
          (Number(((g.position.end - g.position.value) * 1_000_000n) / span) /
            1_000_000) *
            Math.max(600, groups.length * 150),
        );
  }
  return groups;
}
export function cluster<T>(
  groups: LayoutGroup<T>[],
  zoom: number,
  threshold = 48,
): LayoutGroup<T>[][] {
  const result: LayoutGroup<T>[][] = [];
  for (const g of groups) {
    const last = result.at(-1);
    if (
      last &&
      (g.x - last.at(-1)!.x) * zoom < threshold &&
      !g.position.unresolved &&
      !last[0].position.unresolved
    )
      last.push(g);
    else result.push([g]);
  }
  return result;
}
