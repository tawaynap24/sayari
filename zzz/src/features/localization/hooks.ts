import { useEffect, useMemo, useState } from 'react';
import type { ResourceData } from '../nanoka/types';
import type { LocalizationManifest, Overlay } from './model';
import { applyOverlay } from './model';
import { loadLocalization, loadOverlay } from './client';

export function useLocalizedResource(data: ResourceData | null, runId: string, language: string) {
  const key = language === 'th' && data ? `${runId}:${data.source.url}:${data.source.sha256}` : '';
  const [state, setState] = useState<{ key: string; manifest: LocalizationManifest | null; overlay: Overlay | null; error: string }>({ key: '', manifest: null, overlay: null, error: '' });
  useEffect(() => {
    let active = true;
    if (!key || !data) return;
    loadLocalization(runId).then(async manifest => {
      const overlay = await loadOverlay(manifest, data.source);
      if (active) setState({ key, manifest, overlay, error: '' });
    }).catch(reason => { if (active) setState({ key, manifest: null, overlay: null, error: (reason as Error).message }); });
    return () => { active = false; };
  }, [data, key, runId]);
  const current = state.key === key ? state : { manifest: null, overlay: null, error: '' };
  const view = useMemo(() => {
    if (!data || !current.overlay || language !== 'th') return { value: data?.parsed, error: '' };
    try { return { value: applyOverlay(data.parsed, current.overlay), error: '' }; }
    catch (reason) { return { value: data.parsed, error: (reason as Error).message }; }
  }, [data, current.overlay, language]);
  return { value: view.value, manifest: current.manifest, overlay: view.error ? null : current.overlay, error: current.error || view.error, loading: Boolean(key && state.key !== key), language };
}
export type LocalizedResourceState = ReturnType<typeof useLocalizedResource>;
