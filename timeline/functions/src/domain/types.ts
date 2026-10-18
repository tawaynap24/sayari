export type Kind = "CREATE" | "EDIT" | "HIDE";
export type Status =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
export type Choice = "yes" | "no";
export type Unit = "year" | "month" | "day" | "hour" | "minute";
export interface Coordinate {
  year?: string;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  eraId?: string;
  precision: Unit | "era" | "unknown";
}
export type TimeSpec =
  | { type: "exact"; at: Coordinate }
  | { type: "approximate"; around: Coordinate; noteTh?: string }
  | { type: "range"; from: Coordinate; to: Coordinate }
  | {
      type: "relative";
      anchorEventId: string;
      relation: "before" | "after" | "same_time" | "during";
      offset?: { amount: string; unit: Unit; approximate?: boolean };
      noteTh?: string;
    }
  | { type: "unknown"; noteTh?: string; eraId?: string };
export interface Calendar {
  id: string;
  units?: Partial<Record<Unit, string>>;
  eras?: Record<string, { nameTh: string; offsetTicks?: string }>;
}
export interface Source {
  id: string;
  kind:
    | "main_story"
    | "character_story"
    | "side_quest"
    | "video"
    | "other"
    // Legacy categories remain readable in existing revisions.
    | "in_game_quest"
    | "dialogue"
    | "item"
    | "web"
    | "document";
  title: string;
  originTh?: string;
  url?: string;
  chapter?: string;
  quest?: string;
  gameVersion?: string;
  timestampInVideo?: string;
  noteTh?: string;
}
export interface Media {
  id: string;
  kind: "image" | "video" | "pdf" | "docx";
  url?: string;
  altTextTh?: string;
  sourceUrl?: string;
  cover?: boolean;
}
export interface Entity {
  id: string;
  topicId: string;
  kind: "character" | "place" | "organization" | "faction" | "other";
  names: Record<string, string>;
  aliases: Record<string, string[]>;
}
export interface Content {
  titleTh: string;
  summaryTh: string;
  bodyTh: string;
  time: TimeSpec;
  namedEntityIds: string[];
  sources: Source[];
  media: Media[];
  gameVersion: string;
  locale: string;
}
export interface Topic {
  id: string;
  slug: string;
  categoryId: string;
  displayNames: Record<string, string>;
  descriptionTh: string;
  calendar: Calendar;
  publishedCount: number;
  /** Public aggregate mirrored atomically from topicStats; no follower identities. */
  interestCount?: number;
  /** Last successful publication, approved edit or hide; pending requests never change this. */
  timelineUpdatedAt?: number;
  coverPosition?: string;
  order?: number;
  listed?: boolean;
}
export interface PatchArtwork {
  url: string;
  provider: string;
  source: string;
  version: string;
  title: string;
  patchUpdatedAt: number;
  patchTimeKind: "maintenance-start";
}
export interface GameCover extends PatchArtwork {
  checkedAt: number;
  updatedAt: number;
}
export interface Revision extends Content {
  id: string;
  storyId: string;
  topicId: string;
  revisionNumber: number;
  authorLabel: string;
  editorLabel: string;
  addedAt: number;
  approvedAt: number;
  decision: string;
}
export interface Story {
  id: string;
  topicId: string;
  submittedByUid: string;
  authorLabel: string;
  addedAt: number;
  status: "pending" | "published" | "hidden" | "archived";
  activeRevisionId: string | null;
  revisionNumber: number;
  activeEditRequestId: string | null;
  activeHideRequestId: string | null;
}
export interface Request {
  restricted: boolean;
  id: string;
  kind: Kind;
  topicId: string;
  storyId: string;
  baseRevisionId: string | null;
  submittedByUid: string;
  authorLabel: string;
  status: Status;
  proposal: Content | null;
  reason: string;
  interestSnapshot: number;
  requiredVotes: number;
  yesCount: number;
  noCount: number;
  currentVoteRoundId: string;
  submittedAt: number;
  lastVoteChangedAt: number;
  expiresAt: number;
  settledAt: number | null;
  version: number;
}
export interface Actor {
  uid: string;
  label: string;
  privileged: boolean;
}
