import { useEffect } from "react";
import { gameCoversEndpoint } from "./client";
import { useDoc } from "./hooks";
import type { GameCover } from "./types";

export function useGameCovers() {
  const cache = useDoc<{ covers: Record<string, GameCover> }>("siteStats/gameCovers");
  useEffect(() => {
    const controller = new AbortController();
    let lastCheck = 0;
    function refresh() {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      void fetch(gameCoversEndpoint, { signal: controller.signal }).catch(() => {});
    }
    refresh();
    const timer = setInterval(refresh, 15 * 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return cache.value?.covers || {};
}
