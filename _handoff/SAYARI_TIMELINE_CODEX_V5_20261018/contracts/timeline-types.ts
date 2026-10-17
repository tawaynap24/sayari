/** Domain-contract reference. Firestore Timestamp wrappers/ID formats may differ in production. */
export type Locale = 'th-TH' | 'en-US' | (string & {});
export type NamedEntityKind = 'character' | 'place' | 'organization' | 'faction' | 'other';
export type GameTimeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';
export type TimePrecision = GameTimeUnit | 'era' | 'unknown';
export type RelativeRelation = 'before' | 'after' | 'same_time' | 'during';
export type RefKind = 'in_game_quest' | 'dialogue' | 'item' | 'web' | 'video' | 'document' | 'other';
export type RequestKind = 'CREATE' | 'EDIT' | 'HIDE';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface DurationSpec {
  amount: number | string; // bigint string if universe spans exceed JS integer limits
  unit: GameTimeUnit;
  approximate?: boolean;
}
export interface TimeCoordinate {
  eraId?: string;
  eraLabelTh?: string;
  year?: number | string;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  precision: TimePrecision;
}
export type UniverseTimeSpec =
  | { type: 'exact'; at: TimeCoordinate; calendarId?: string }
  | { type: 'approximate'; around: TimeCoordinate; noteTh?: string; calendarId?: string }
  | { type: 'range'; from: TimeCoordinate; to: TimeCoordinate; calendarId?: string }
  | { type: 'relative'; anchorEventId: string; relation: RelativeRelation; offset?: DurationSpec; noteTh?: string }
  | { type: 'unknown'; noteTh?: string; eraId?: string };

export interface NamedEntity {
  id: string;
  topicId: string;
  kind: NamedEntityKind;
  names: Record<string, string>;
  aliases: Record<string, string[]>;
}
export interface StorySource {
  id: string;
  kind: RefKind;
  title: string;
  url?: string;
  chapter?: string;
  quest?: string;
  gameVersion?: string;
  timestampInVideo?: string;
  noteTh?: string;
}
export interface StoryMedia {
  id: string;
  kind: 'image' | 'video' | 'pdf' | 'docx';
  url?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  altTextTh?: string;
  sourceUrl?: string;
  cover?: boolean;
}
export interface StoryRevision {
  id: string;
  storyId: string;
  revisionNumber: number;
  titleTh: string;
  summaryTh?: string;
  bodyTh: string;
  time: UniverseTimeSpec;
  namedEntityIds: string[];
  sources: StorySource[];
  media: StoryMedia[];
  approvedAt?: unknown; // Firestore Timestamp in implementation
  createdByUid: string;
}
export interface TopicInfo {
  id: string;
  categoryId: string;
  slug: string;
  displayNames: Record<string, string>;
  interestCount: number;
  calendarDefinitionId?: string;
}
export interface TimelineRequest {
  id: string;
  topicId: string;
  storyId?: string;
  baseRevisionId?: string;
  proposalRevisionId?: string;
  kind: RequestKind;
  status: RequestStatus;
  submittedByUid: string;
  interestSnapshot: number;
  requiredVotes: number;
  yesCount: number;
  noCount: number;
  currentVoteRoundId: string;
  submittedAt: unknown;       // Server Timestamp in persistence
  lastVoteChangedAt: unknown; // Server Timestamp in persistence
  expiresAt: unknown;
  settledAt?: unknown;
}
