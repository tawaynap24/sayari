export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export interface Resource {
  dataset: string;
  kind: 'manifest' | 'index' | 'detail' | 'raw';
  version: string | null;
  language: string | null;
  id: string | null;
  url: string;
  referenceUrl: string;
  status: string;
  httpStatus: number | null;
  file: string | null;
  sha256?: string;
  bytes?: number;
  fetchedAt: string | null;
  checkedAt: string | null;
  cacheReadAt?: string | null;
  sourceUpdatedAt?: string | null;
  error?: string;
  jsonShape?: { nodes: number; leaves: number; unsafeNumberCount: number };
}
export interface Dataset {
  key: string;
  label: string;
  detailPath: string | null;
  localizedIndex: boolean;
  localizedDetail: boolean;
  recordsPointer: string;
  idField: string;
  referenceList: string;
}
export interface Catalog {
  schemaVersion: number;
  provider: string;
  runId: string;
  publishedAt?: string;
  generatedAt: string;
  manifest: Json;
  versions: { version: string; channels: string[] }[];
  languages: string[];
  definitions: Dataset[];
  resources: Resource[];
  inventory: { dataset: string; version: string; language: string | null; count: number; ids: string[] }[];
  coverage: {
    status: string;
    registeredScopeComplete: boolean;
    entireProviderApiComplete: boolean;
    successfulResources: number;
    failedResources: number;
    issues: Json[];
  };
}
export interface Snapshot {
  catalog: Catalog;
  catalogUrl: string;
  publishedAt: string;
  discovery: { runId: string; status: string; notes: string[]; categories: { key: string; status: string; note: string }[] } | null;
}
export interface ResourceData { raw: string; originalBytes: ArrayBuffer; parsed: Json; source: Resource }
export interface Entity {
  id: string;
  raw: Json;
  name: string;
  resolvedLanguage: string | null;
  icon: string | null;
  rank: string;
  group: string;
  description: string;
}
