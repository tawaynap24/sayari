import { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { GameCover, PatchArtwork } from "./domain/types";

export const COVER_REFRESH_MS = 15 * 60_000;
export const COVER_SCHEMA_VERSION = 2;
const NEWS = "https://sg-public-api-static.hoyoverse.com/content_v2_user/app/";
export const HOYO_NEWS = [
  { id: "genshin-impact", app: "a1b1f9d3315447cc", channel: 395, imageKey: "banner", extra: "&iAppId=32" },
  { id: "honkai-star-rail", app: "113fe6d3b4514cdd", channel: 248, imageKey: "news-poster", extra: "" },
  { id: "zenless-zone-zero", app: "3e9196a4b9274bd7", channel: 288, imageKey: "news-banner", extra: "" },
];
export const KURO_NEWS = "https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en/";
export const ENDFIELD_NEWS = "https://web-news.gryphline.com/api/bulletin";
export const ENDFIELD_VERSION_API = "https://launcher.gryphline.com/api/proxy/batch_proxy";
export interface GameCoverCache {
  schemaVersion: number;
  covers: Record<string, GameCover>;
  checkedAt: number;
  nextCheckAt: number;
  failedProviders: string[];
}
type Discovered = PatchArtwork & { id: string };

export function imageUrl(value: string): string {
  const url = new URL(value);
  const allowed = ["hoyoverse.com", "aki-game.net", "kurogame.com", "hg-cdn.com", "gryphline.com"];
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
      !/\.(webp|png|jpe?g|avif)$/i.test(url.pathname)) throw Error("Unexpected cover image URL");
  return url.href;
}

async function json(request: typeof fetch, url: string, body?: unknown): Promise<unknown> {
  const response = await request(url, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(12_000), cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Timeline-Patch-Art/2.0", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error(`Patch provider HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw Error("Patch provider response too large");
  return JSON.parse(text);
}

export function patchVersion(title: string): string | null {
  return title.match(/\bVersion\s+(?:"([^"]+)"|(\d+\.\d+(?:\.\d+)?))/i)?.slice(1).find(Boolean) || null;
}
function plain(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
}
export function publisherDate(value: string): number {
  // These English CMS feeds publish local UTC+8 dates without an offset.
  const stamp = Date.parse(value.replace(" ", "T") + "+08:00");
  if (!Number.isFinite(stamp)) throw Error("Invalid publisher date");
  return stamp;
}
export function patchUpdateTime(html: string): number {
  const text = plain(html);
  // Anchor to the maintenance heading, not compensation cutoffs or event end dates.
  const section = text.match(/(?:Update Schedule|Update Time|Update Start Time|Maintenance Time|Update Maintenance Time)[\s\S]{0,350}/i)?.[0];
  if (!section) throw Error("Patch maintenance time not found");
  const numeric = section.match(/(20\d{2})[/-](\d{2})[/-](\d{2})\s+(\d{2}:\d{2})(?:\s*[-–]\s*(?:20\d{2}[/-]\d{2}[/-]\d{2}\s+)?\d{2}:\d{2})?\s*\(UTC\+8\)/i);
  if (numeric) return publisherDate(`${numeric[1]}-${numeric[2]}-${numeric[3]} ${numeric[4]}:00`);
  const english = section.match(/Asia Server:\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s*(20\d{2})\s+at\s+(\d{2}:\d{2})/i);
  if (english && section.includes("UTC+8")) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(english[1].slice(0, 3).toLowerCase()) + 1;
    if (month) return publisherDate(`${english[3]}-${String(month).padStart(2, "0")}-${english[2].padStart(2, "0")} ${english[4]}:00`);
  }
  throw Error("Patch maintenance time format changed");
}
const hoyoArticle = z.object({ sTitle: z.string(), sExt: z.string(), sContent: z.string(), dtStartTime: z.string() });
export async function hoyoPatch(config: typeof HOYO_NEWS[number], request: typeof fetch = fetch, now = Date.now()): Promise<Discovered> {
  for (let page = 1; page <= 3; page++) {
    const source = `${NEWS}${config.app}/getContentList?iPage=${page}&iPageSize=100&sLangKey=en-us&iChanId=${config.channel}${config.extra}`;
    const response = z.object({ retcode: z.literal(0), data: z.object({ list: z.array(hoyoArticle) }) }).parse(await json(request, source));
    const releases = response.data.list.filter(a => /\bUpdate (Details|Announcement)\s*$/i.test(a.sTitle.trim()) && patchVersion(a.sTitle))
      .sort((a, b) => publisherDate(b.dtStartTime) - publisherDate(a.dtStartTime));
    for (const article of releases) {
      // A scheduled announcement does not make an upcoming patch the live patch.
      if (publisherDate(article.dtStartTime) > now) continue;
      const patchUpdatedAt = patchUpdateTime(article.sContent);
      if (patchUpdatedAt > now) continue;
      const ext = z.record(z.unknown()).parse(JSON.parse(article.sExt));
      const images = z.array(z.object({ url: z.string() })).parse(ext[config.imageKey]);
      const url = images.map(i => { try { return imageUrl(i.url); } catch { return null; } }).find(Boolean);
      if (!url) throw Error("Patch announcement artwork missing");
      return { id: config.id, url, provider: "HoYoverse Official News", source, version: patchVersion(article.sTitle)!,
        title: article.sTitle.trim(), patchUpdatedAt, patchTimeKind: "maintenance-start" };
    }
    if (response.data.list.length < 100) break;
  }
  throw Error("No released HoYoverse patch announcement found");
}
export async function hoyoCovers(request: typeof fetch = fetch, now = Date.now()): Promise<Discovered[]> {
  return Promise.all(HOYO_NEWS.map(config => hoyoPatch(config, request, now)));
}
function firstArticleImage(html: string): string {
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const width = Number(match[0].match(/\bwidth=["'](\d+)/i)?.[1]);
    const height = Number(match[0].match(/\bheight=["'](\d+)/i)?.[1]);
    if (width && height && width / height < 1.2) continue; // Skip long infographics.
    try { return imageUrl(match[1].replace(/&amp;/g, "&")); } catch { /* Try the next publisher image. */ }
  }
  throw Error("Patch article artwork missing");
}
export async function kuroCovers(request: typeof fetch = fetch, now = Date.now()): Promise<Discovered[]> {
  const item = z.object({ articleId: z.number().int().positive(), articleTitle: z.string(), startTime: z.string() });
  const menu = z.object({ article: z.array(item) }).parse(await json(request, `${KURO_NEWS}MainMenu.json`));
  const unique = [...new Map(menu.article.filter(a => /^Patch Notes for /i.test(a.articleTitle) && patchVersion(a.articleTitle))
    .map(a => [a.articleId, a])).values()].sort((a, b) => publisherDate(b.startTime) - publisherDate(a.startTime));
  for (const article of unique.slice(0, 4)) {
    if (publisherDate(article.startTime) > now) continue;
    const source = `${KURO_NEWS}article/${article.articleId}.json`;
    const full = item.extend({ articleContent: z.string() }).parse(await json(request, source));
    if (full.articleId !== article.articleId || patchVersion(full.articleTitle) !== patchVersion(article.articleTitle)) throw Error("Kuro patch identity mismatch");
    const patchUpdatedAt = patchUpdateTime(full.articleContent);
    if (patchUpdatedAt > now) continue;
    return [{ id: "wuthering-waves", url: firstArticleImage(full.articleContent), provider: "Kuro Official News", source,
      version: patchVersion(full.articleTitle)!, title: full.articleTitle, patchUpdatedAt, patchTimeKind: "maintenance-start" }];
  }
  throw Error("No released Kuro patch notes found");
}
export async function endfieldCovers(request: typeof fetch = fetch, now = Date.now()): Promise<Discovered[]> {
  const params = "lang=en-us&code=arknights_endfield_official";
  const response = z.object({ code: z.literal(0), data: z.object({ list: z.array(z.object({ cid: z.string().regex(/^\d+$/), title: z.string(), displayTime: z.number() })) }) })
    .parse(await json(request, `${ENDFIELD_NEWS}?${params}&page=1&pageSize=50`));
  const articles = response.data.list.filter(a => /\bVersion Update Notes\s*$/i.test(a.title) && a.displayTime * 1000 <= now)
    .sort((a, b) => b.displayTime - a.displayTime);
  for (const article of articles.slice(0, 4)) {
    const source = `${ENDFIELD_NEWS}/${article.cid}?${params}`;
    const full = z.object({ code: z.literal(0), data: z.object({ cid: z.string(), title: z.string(), data: z.string(), cover: z.string() }) })
      .parse(await json(request, source)).data;
    if (full.cid !== article.cid || full.title !== article.title) throw Error("Endfield patch identity mismatch");
    const patchUpdatedAt = patchUpdateTime(full.data);
    if (patchUpdatedAt > now) continue;
    const game = z.object({ proxy_rsps: z.array(z.object({ get_latest_game_rsp: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }) })) })
      .parse(await json(request, ENDFIELD_VERSION_API, { proxy_reqs: [{ kind: "get_latest_game", get_latest_game_req: {
        appcode: "YDUTE5gscDZ229CW", channel: "6", sub_channel: "6", platform: "Windows", version: "",
      } }] }));
    return [{ id: "arknights-endfield", url: imageUrl(full.cover), provider: "GRYPHLINE Official News", source,
      version: game.proxy_rsps[0].get_latest_game_rsp.version.split(".").slice(0, 2).join("."), title: full.title,
      patchUpdatedAt, patchTimeKind: "maintenance-start" }];
  }
  throw Error("No released Endfield patch notes found");
}

export class GameCoverService {
  constructor(readonly db: Firestore, readonly clock: () => number = Date.now, readonly request: typeof fetch = fetch,
    readonly document = "siteStats/gameCovers") {}
  async current(): Promise<GameCoverCache> {
    const ref = this.db.doc(this.document), now = this.clock();
    const acquired = await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref), data = snapshot.data();
      const cache: GameCoverCache = {
        schemaVersion: data?.schemaVersion || 0, covers: data?.covers || {}, checkedAt: data?.checkedAt || 0,
        nextCheckAt: data?.nextCheckAt || 0, failedProviders: data?.failedProviders || [],
      };
      if ((cache.schemaVersion === COVER_SCHEMA_VERSION && cache.nextCheckAt > now) || data?.refreshingUntil > now) return { cache, refresh: false };
      tx.set(ref, { refreshingUntil: now + 60_000 }, { merge: true });
      return { cache, refresh: true };
    });
    if (!acquired.refresh) return acquired.cache;
    const providers = HOYO_NEWS.map(config => ({ name: config.id, run: () => hoyoPatch(config, this.request, now).then(c => [c]) }));
    providers.push({ name: "wuthering-waves", run: () => kuroCovers(this.request, now) },
      { name: "arknights-endfield", run: () => endfieldCovers(this.request, now) });
    const results = await Promise.allSettled(providers.map(p => p.run()));
    const covers = { ...acquired.cache.covers }, failedProviders: string[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") { failedProviders.push(providers[index].name); continue; }
      for (const { id, ...cover } of result.value) {
        const previous = covers[id];
        covers[id] = { ...cover, checkedAt: now, updatedAt: previous?.url === cover.url ? previous.updatedAt : now };
      }
    }
    const cache: GameCoverCache = { schemaVersion: COVER_SCHEMA_VERSION, covers, checkedAt: now,
      nextCheckAt: now + (failedProviders.length ? 60_000 : COVER_REFRESH_MS), failedProviders };
    await ref.set({ ...cache, refreshingUntil: 0 });
    return cache;
  }
}
