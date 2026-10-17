/** Reference contract, not a drop-in model of every future Nanoka response.
 * Adapt to actual project conventions. Preserve raw bytes and unknown fields.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type FetchStatus = 'fetched' | 'cache' | 'failed' | 'invalid_json' | 'blocked_origin' | 'blocked_budget';
export interface JsonShape {
  nodes: number;
  leaves: number;
  types: Record<string, number>;
  unsafeNumberCount: number;
  topLevelKeys: string[] | null;
}
export interface SourceResource {
  dataset: string;
  kind: 'manifest' | 'index' | 'detail' | 'raw';
  version: string | null;
  language: string | null;
  id: string | null;
  url: string;
  referenceUrl: string;
  status: FetchStatus;
  httpStatus: number | null;
  file: string | null;
  sha256?: string;
  bytes?: number;
  fetchedAt: string | null;
  checkedAt: string | null;
  cacheReadAt?: string | null;
  sourceUpdatedAt?: string | null;
  headers?: Record<string, string>;
  error?: string;
  jsonShape?: JsonShape;
}
export interface DatasetDefinition {
  key: string;
  label: string;
  indexPath: string;
  detailPath: string | null;
  localizedIndex: boolean;
  localizedDetail: boolean;
  recordsPointer: string;
  idField: string;
  idPattern: string;
  referenceList: string;
  referenceDetail: string | null;
  evidence: { sourceUrl: string; kind: string; [key: string]: JsonValue };
}
export interface DataVersion { version: string; channels: Array<'live' | 'latest'> }
export interface ResourceView {
  source: SourceResource;
  rawText: string; // Exact fetched text. Do not regenerate from parsed numbers.
  parsed: JsonValue;
  requestedLanguage: string | null;
  resolvedLanguage: string | null;
  // Optional derived presentation must not overwrite parsed/rawText.
  projection?: Record<string, JsonValue>;
  warnings: string[];
}
export interface SnapshotPointer {
  schemaVersion: number;
  provider: string;
  runId: string;
  catalog: string; // Resolve relative to current.json URL using new URL().
  publishedAt: string;
  dataStatus: string;
  referenceUrl: string;
}
export interface SnapshotCatalog {
  schemaVersion: number;
  provider: string;
  referenceUrl: string;
  runId: string;
  generatedAt: string;
  publishedAt?: string;
  manifest: JsonValue;
  versions: DataVersion[];
  languages: string[];
  definitions: DatasetDefinition[];
  inventory: Array<{ dataset: string; version: string; language: string | null; url: string; count: number; ids: string[]; rejected: JsonValue[]; duplicatedIds: number }>;
  resources: SourceResource[];
  coverage: Record<string, JsonValue>;
  publicationWarnings?: string[];
}
