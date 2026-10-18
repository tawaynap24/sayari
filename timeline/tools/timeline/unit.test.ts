import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type {
  Kind,
  TimeSpec,
  Content,
  Choice,
} from "../../functions/src/domain/types";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { inspectFile } = require("../../functions/lib/media.js");
const { zipSync, strToU8 } = require("fflate");
const {
  requiredVotes,
  expiry,
  outcome,
  voteDelta,
  HOUR,
}: typeof import("../../functions/src/domain/policy") = require("../../functions/lib/domain/policy.js");
const {
  resolveTimes,
  distance,
  assertAcyclic,
  layout,
  cluster,
  orderedNodes,
}: typeof import("../../functions/src/domain/time") = require("../../functions/lib/domain/time.js");
const {
  contentSchema,
  safeUrl,
  embedUrl,
  MAX_BYTES,
}: typeof import("../../functions/src/domain/validation") = require("../../functions/lib/domain/validation.js");
const vectors = JSON.parse(
  fs.readFileSync(
    "tests/fixtures/vectors.v5.json",
    "utf8",
  ),
);
for (const v of vectors.thresholdVectors)
  test(`V5 threshold N=${v.interestCount}`, () => {
    for (const kind of ["CREATE", "EDIT", "HIDE"] as Kind[])
      assert.equal(requiredVotes(kind, v.interestCount), v[kind]);
  });
for (const v of vectors.deadlineVectors)
  test(`V5 expiry ${v.kind} last=${v.hoursAfterSubmitOfLastVote}`, () =>
    assert.equal(
      expiry(
        v.kind,
        Date.parse(v.submittedAt),
        Date.parse(v.lastVoteChangedAt),
      ),
      Date.parse(v.expectedExpiresAt),
    ));
for (const [i, v] of vectors.voteDeltaVectors.entries())
  test(`V5 vote delta ${i}`, () =>
    assert.deepEqual(
      voteDelta(
        ...(v.start as [number, number]),
        v.old as Choice | null,
        v.next,
      ),
      { yesCount: v.result[0], noCount: v.result[1], changed: v.changed },
    ));
for (const [i, v] of vectors.outcomeVectors.entries())
  test(`V5 outcome ${i}`, () =>
    assert.equal(outcome(v.yesCount, v.noCount, v.requiredVotes), v.expected));
test("invalid counters/times and cap 100000", () => {
  for (const n of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => requiredVotes("CREATE", n));
  assert.equal(requiredVotes("HIDE", 100000), 100);
  assert.throws(() => expiry("EDIT", 20, 10));
  assert.throws(() => voteDelta(0, 0, "yes", "no"));
  assert.throws(() => outcome(0, 0, 0));
});
test("continued real votes have unlimited cumulative age", () =>
  assert.equal(expiry("CREATE", 0, 10000 * HOUR), 10024 * HOUR));
const calendar = { id: "symbolic" };
const node = (id: string, time: TimeSpec, addedAt = 0) => ({
  id,
  time,
  addedAt,
  titleTh: id,
});
const year = (id: string, y: string) =>
  node(id, { type: "exact", at: { year: y, precision: "year" } });
test("negative and enormous years retain exact differences without JS Date", () => {
  const ns = [
    year("a", "-999999999999999999999999"),
    year("b", "-999999999999999999999989"),
  ];
  const p = resolveTimes(ns, calendar);
  assert.equal(distance(p.get("a")!, p.get("b")!, calendar), "10 ปี");
  assert.ok(layout(ns, calendar, "time").every((g) => Number.isFinite(g.x)));
});
test("no invented month/year conversion or era offsets", () => {
  const ns = [
    year("a", "150"),
    node("b", {
      type: "exact",
      at: { year: "150", month: 2, precision: "month" },
    }),
    node("era", { type: "exact", at: { eraId: "ancient", precision: "era" } }),
  ];
  const p = resolveTimes(ns, calendar);
  assert.equal(
    distance(p.get("a")!, p.get("b")!, calendar),
    "ไม่สามารถระบุระยะห่างที่แน่นอนได้",
  );
  assert.ok(p.get("era")!.unresolved);
});
test("same time joins, approximate retains uncertainty, ranges have end", () => {
  const ns = [
    year("a", "10"),
    year("b", "10"),
    node("c", {
      type: "approximate",
      around: { year: "20", precision: "year" },
    }),
    node("d", {
      type: "range",
      from: { year: "10", precision: "year" },
      to: { year: "30", precision: "year" },
    }),
  ];
  const p = resolveTimes(ns, calendar);
  assert.equal(p.get("a")!.key, p.get("b")!.key);
  assert.equal(distance(p.get("a")!, p.get("c")!, calendar), "ประมาณ 10 ปี");
  assert.equal(p.get("d")!.end, 30n);
  assert.equal(layout(ns, calendar, "equal")[0].nodes.length, 2);
});
test("relative resolves and recomputes after approved anchor change; hidden anchor stays unknown", () => {
  const a = year("a", "10"),
    b = node("b", {
      type: "relative",
      anchorEventId: "a",
      relation: "after",
      offset: { amount: "5", unit: "year" },
    });
  assert.equal(resolveTimes([a, b], calendar).get("b")!.value, 15n);
  assert.equal(
    resolveTimes([year("a", "30"), b], calendar).get("b")!.value,
    35n,
  );
  const hidden = resolveTimes([b], calendar).get("b")!;
  assert.equal(hidden.value, undefined);
  assert.ok(!hidden.label.includes("secret"));
});
test("unquantified relative order is topological, not a fabricated coordinate", () => {
  const ns = [
    node("b", { type: "relative", relation: "after", anchorEventId: "a" }),
    year("a", "10"),
  ];
  const p = resolveTimes(ns, calendar);
  assert.equal(p.get("b")!.value, undefined);
  assert.deepEqual(
    orderedNodes(ns, p).map((n) => n.id),
    ["a", "b"],
  );
});
test("self and deep cycles rejected", () => {
  assert.throws(() =>
    assertAcyclic([
      node("a", { type: "relative", anchorEventId: "a", relation: "after" }),
    ]),
  );
  assert.throws(() =>
    assertAcyclic(
      ["a", "b", "c"].map((id, i) =>
        node(id, {
          type: "relative",
          anchorEventId: ["b", "c", "a"][i],
          relation: "before",
        }),
      ),
    ),
  );
});
test("explicit calendar conversion supports offsets without assuming Earth", () => {
  const cal = {
    id: "fictional-test",
    units: { year: "1000", day: "10", hour: "2", minute: "1" },
    eras: { e: { nameTh: "Era", offsetTicks: "500" } },
  };
  const ns = [
    node("a", {
      type: "exact",
      at: { year: "2", eraId: "e", precision: "year" },
    }),
    node("b", {
      type: "relative",
      relation: "after",
      anchorEventId: "a",
      offset: { amount: "2", unit: "day" },
    }),
  ];
  const p = resolveTimes(ns, cal);
  assert.equal(p.get("a")!.value, 2500n);
  assert.equal(p.get("b")!.value, 2520n);
  assert.equal(distance(p.get("a")!, p.get("b")!, cal), "2 วัน");
});
test("10,000 points layout/clustering bounded and zoom reverses clusters", () => {
  const ns = Array.from({ length: 10000 }, (_, i) =>
    year(String(i), String(i)),
  );
  const start = performance.now();
  const gs = layout(ns, calendar, "time");
  assert.equal(gs.length, 10000);
  assert.equal(cluster(gs, 1).length, 10000);
  assert.ok(cluster(gs, 0.1).length < 10000);
  assert.ok(performance.now() - start < 4000);
});
test("pixels never affect distance; unknown always says unknown", () => {
  const ns = [year("a", "10"), year("b", "20"), node("c", { type: "unknown" })];
  const p = resolveTimes(ns, calendar);
  layout(ns, calendar, "equal");
  layout(ns, calendar, "time");
  assert.equal(distance(p.get("a")!, p.get("b")!, calendar), "10 ปี");
  assert.equal(
    distance(p.get("a")!, p.get("c")!, calendar),
    "ไม่สามารถระบุระยะห่างที่แน่นอนได้",
  );
});
const content: Content = {
  titleTh: "ทดสอบ",
  bodyTh: "ข้อมูลสังเคราะห์สำหรับทดสอบ",
  summaryTh: "",
  time: { type: "unknown" },
  namedEntityIds: [],
  sources: [],
  media: [],
  gameVersion: "",
  locale: "th-TH",
};
test("server content validation bounds, precision, range, URLs, duplicate/cover media", () => {
  assert.ok(contentSchema.safeParse(content).success);
  for (const patch of [
    { titleTh: "" },
    { bodyTh: "x".repeat(50001) },
    { time: { type: "exact", at: { year: "x", precision: "year" } } },
    {
      time: {
        type: "exact",
        at: { year: "10", minute: 1, precision: "minute" },
      },
    },
    {
      time: {
        type: "range",
        from: { year: "20", precision: "year" },
        to: { year: "10", precision: "year" },
      },
    },
    { media: [{ id: "m", kind: "image", url: "javascript:alert(1)" }] },
    { media: [{ id: "m", kind: "video", url: "https://evil.test/movie" }] },
  ])
    assert.ok(!contentSchema.safeParse({ ...content, ...patch }).success);
  assert.equal(safeUrl("https://user:password@host.test"), false);
  assert.equal(
    embedUrl("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
});
test("media magic bytes, decimal size boundary, spoof/SVG/PDF script rejected", () => {
  const image = Buffer.alloc(MAX_BYTES);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);
  assert.equal(inspectFile(image, "image/png").kind, "image");
  assert.throws(() => inspectFile(Buffer.alloc(MAX_BYTES + 1), "image/png"));
  assert.throws(() => inspectFile(Buffer.from("<html>hello"), "image/png"));
  assert.throws(() => inspectFile(Buffer.from("<svg/>"), "image/svg+xml"));
  assert.throws(() =>
    inspectFile(Buffer.from("%PDF-1.4\n/JavaScript bad"), "application/pdf"),
  );
});
test("DOCX safe text extraction and bounded ZIP reject arbitrary archives", () => {
  const bytes = Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8(
        "<w:document><w:p><w:t>&lt;script&gt;unsafe&lt;/script&gt;</w:t></w:p></w:document>",
      ),
    }),
  );
  const r = inspectFile(
    bytes,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(r.docText, "<script>unsafe</script>\n");
  assert.throws(() =>
    inspectFile(
      Buffer.from(zipSync({ "hello.txt": strToU8("x") })),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  );
});
