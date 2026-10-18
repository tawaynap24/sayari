import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { formatTimelineDate } from "../../src/features/timeline/dateFormat";
const require = createRequire(import.meta.url);
const { imageUrl, hoyoCovers, kuroCovers, endfieldCovers, patchVersion, patchUpdateTime, publisherDate, COVER_REFRESH_MS }: typeof import("../../functions/src/gameCovers") = require("../../functions/lib/gameCovers.js");
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const now = Date.parse("2026-10-18T00:00:00Z");
const image = "https://fastcdn.hoyoverse.com/patch.webp";
const article = (version = "3.2", date = "2026-09-09", url = image) => ({
  sTitle: `Version ${version} Update Details`, dtStartTime: `${date} 07:00:00`,
  sContent: `[Update Start Time] ${date.replaceAll("-", "/")} 06:00 (UTC+8)`,
  sExt: JSON.stringify({ banner: [{ url }], "news-poster": [{ url }], "news-banner": [{ url }] }),
});
test("publisher images reject video, credentials and lookalike domains", () => {
  assert.equal(imageUrl(image), image);
  for (const value of ["http://fastcdn.hoyoverse.com/a.jpg", "https://fastcdn.hoyoverse.com.evil.test/a.png", "https://user@fastcdn.hoyoverse.com/a.png", "https://fastcdn.hoyoverse.com:8443/a.png", "https://fastcdn.hoyoverse.com/a.webm", "https://127.0.0.1/a.png"])
    assert.throws(() => imageUrl(value));
  assert.equal(COVER_REFRESH_MS, 900000);
});
test("version parser supports numbered and named releases without guessing a patch from image paths", () => {
  assert.equal(patchVersion('Version 7.1 "Title" Update Details'), "7.1");
  assert.equal(patchVersion('Version "Luna VIII" Update Details'), "Luna VIII");
  assert.equal(patchVersion("Happy anniversary"), null);
});
test("patch dates use the maintenance section, not a future end date or publication time", () => {
  assert.equal(patchUpdateTime('Version ends 2026/11/11 06:00 (UTC+8). <b>Update Time</b> Begins at 2026/09/28 06:00 (UTC+8).'), Date.parse("2026-09-27T22:00:00Z"));
  assert.equal(patchUpdateTime('Maintenance Time: 2026-09-30 04:00 - 11:00 (UTC+8)'), Date.parse("2026-09-29T20:00:00Z"));
  assert.equal(patchUpdateTime('Maintenance Time: 2026-09-30 04:00 - 2026-09-30 11:00 (UTC+8)'), Date.parse("2026-09-29T20:00:00Z"));
  assert.equal(patchUpdateTime('Update Maintenance Time Asia Server: Oct. 15, 2026 at 06:00 – Oct. 15, 2026 at 12:00 (UTC+8)'), Date.parse("2026-10-14T22:00:00Z"));
  assert.throws(() => patchUpdateTime("Compensation before 2026/09/28 06:00 (UTC+8)"));
  assert.equal(publisherDate("2026-09-28 07:00:00"), Date.parse("2026-09-27T23:00:00Z"));
});
test("Thai display uses exact DD/MM/YYYY HH:mm with Gregorian year and Bangkok time", () => {
  assert.equal(formatTimelineDate(Date.parse("2026-10-17T18:05:00Z")), "18/10/2026 01:05 น.");
  assert.equal(formatTimelineDate(Date.parse("2026-10-17T17:00:00Z")), "18/10/2026 00:00 น.");
});
test("HoYo uses the released patch announcement, ignoring newer events, previews and future releases", async () => {
  const request: typeof fetch = async () => response({ retcode: 0, data: { list: [
    { ...article("3.3", "2026-10-17"), sTitle: "Version 3.3 Special Program" },
    article("3.3", "2026-10-21", "https://fastcdn.hoyoverse.com/future.webp"),
    { ...article("3.2", "2026-10-18"), sTitle: "Version 3.2 Birthday Event" },
    article(), article("3.1", "2026-08-01"),
  ] } });
  const covers = await hoyoCovers(request, now);
  assert.equal(covers.length, 3);
  assert.ok(covers.every(c => c.version === "3.2" && c.url === image && c.patchUpdatedAt === Date.parse("2026-09-08T22:00:00Z")));
});
test("scheduled update announcement cannot replace live art before maintenance starts", async () => {
  const upcoming = { ...article("3.3", "2026-10-17"), sContent: "Update Time Begins at 2026/10/21 06:00 (UTC+8)" };
  const request: typeof fetch = async () => response({ retcode: 0, data: { list: [upcoming, article()] } });
  assert.ok((await hoyoCovers(request, now)).every(c => c.version === "3.2"));
});
test("unverifiable dates and malformed artwork fail instead of labelling an unrelated image as current", async () => {
  const request: typeof fetch = async () => response({ retcode: 0, data: { list: [{ ...article(), sContent: "No update schedule" }] } });
  await assert.rejects(() => hoyoCovers(request, now));
});
test("Kuro resolves the live patch notes by identity and skips tall infographics", async () => {
  const request: typeof fetch = async input => response(String(input).includes("MainMenu") ? { article: [
    { articleId: 2, articleTitle: "Patch Notes for Version 3.7: Current", startTime: "2026-09-30 10:00:00" },
    { articleId: 1, articleTitle: "Patch Notes for Version 3.6: Previous", startTime: "2026-08-20 10:00:00" },
  ] } : { articleId: 2, articleTitle: "Patch Notes for Version 3.7: Current", startTime: "2026-09-30 10:00:00",
    articleContent: 'Maintenance Time: 2026-09-30 04:00 - 11:00 (UTC+8) <img src="https://hw-media-cdn-mingchao.kurogame.com/tall.jpg" width="1080" height="9000"><img src="https://hw-media-cdn-mingchao.kurogame.com/current.jpg" width="1920" height="1080">' });
  const [cover] = await kuroCovers(request, now);
  assert.equal(cover.version, "3.7"); assert.ok(cover.url.endsWith("/current.jpg"));
});
test("Endfield obtains its patch number from the current client and artwork/date from official update notes", async () => {
  const request: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") return response({ proxy_rsps: [{ get_latest_game_rsp: { version: "1.6.4" } }] });
    if (url.includes("/bulletin/")) return response({ code: 0, data: { cid: "123", title: "[Ink] Version Update Notes", cover: "https://web-static.hg-cdn.com/current.jpg", data: "Update Maintenance Time Asia Server: Oct. 15, 2026 at 06:00 – Oct. 15, 2026 at 12:00 (UTC+8)" } });
    return response({ code: 0, data: { list: [{ cid: "123", title: "[Ink] Version Update Notes", displayTime: Date.parse("2026-10-15T00:00:00Z") / 1000 }] } });
  };
  const [cover] = await endfieldCovers(request, now);
  assert.equal(cover.version, "1.6"); assert.equal(cover.patchUpdatedAt, Date.parse("2026-10-14T22:00:00Z"));
});
