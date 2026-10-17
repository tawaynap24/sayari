import { useEffect, useState } from 'react';
import { SnapshotClient } from './client';
import type { Resource, ResourceData } from './types';

export function useResource(client: SnapshotClient | null, resource: Resource | undefined) {
  const [state, setState] = useState<{ key: string; data: ResourceData | null; error: string | null }>({ key: '', data: null, error: null });
  const key = resource ? `${resource.url}:${resource.sha256}:${resource.status}` : '';
  useEffect(() => {
    let active = true;
    if (!client || !resource) return;
    client.resource(resource).then(data => { if (active) setState({ key, data, error: null }); })
      .catch(error => { if (active) setState({ key, data: null, error: error.message }); });
    // Shared fetches are deduplicated. Unsubscribing cancels the state update,
    // without aborting a request another StrictMode subscriber may still need.
    return () => { active = false; };
  }, [client, resource, key]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading: Boolean(resource && state.key !== key) };
}
