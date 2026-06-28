/**
 * repo/types.ts — the persistence port (a small interface the handlers depend on, so
 * they never touch SQL directly). A DrizzleRepository backs production; an
 * InMemoryRepository backs the tests. Every read is OWNER-SCOPED: callers pass the
 * owner and a cross-owner read returns null → the route answers 404, never leaking
 * existence (CLAUDE.md, ARCHITECTURE.md §14). Owner is nullable for the single-user
 * v1 and made required when auth lands (M5.5).
 */

import type { CreatureState, GatherResult, SimEvent, Star } from '@amabo/engine';

export interface CreatureRecord {
  id: string;
  ownerId: string | null;
  name: string;
  state: CreatureState;
  graduatedAt: number | null;
  /** When the Light last explicitly looked in (peek); null until the first visit. */
  lastSeenAt: number | null;
  createdAt: number;
}

export interface StarRecord extends Star {
  id: string;
  creatureId: string;
  ownerId: string | null;
}

export interface JournalEntry {
  at: number;
  kind: string;
  tag: string | null;
  text: string | null;
  salience: number;
}

export interface NewCreature {
  ownerId: string | null;
  name: string;
  state: CreatureState;
}

// ── M5.5: accounts & auth ────────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  oauthProvider: string;
  oauthSubject: string;
  ageBand: string | null;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: number;
}

export interface OAuthUpsert {
  provider: string;
  subject: string;
  email: string;
  displayName: string;
  ageBand?: string | null;
}

// ── M9.5: sharing ────────────────────────────────────────────────────────────────
export type ShareKind = 'visit' | 'meet' | 'postcard';

export interface ShareLinkRecord {
  id: string;
  creatureId: string;
  ownerId: string | null;
  kind: ShareKind;
  token: string;
  expiresAt: number;
  revokedAt: number | null;
}

export interface RehomeRecord {
  id: string;
  creatureId: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'completed' | 'cancelled';
  fromConfirmedAt: number | null;
  toConfirmedAt: number | null;
  at: number;
}

/** A pending rehome shown in the recipient's inbox (with display fields joined in). */
export interface IncomingRehome {
  id: string;
  creatureId: string;
  creatureName: string;
  fromEmail: string;
  at: number;
}

// ── M-S: the Symposium (STORY.md §6½) ────────────────────────────────────────────
export interface TranscriptLine {
  /** The creature's name (the speaker), or '' for stage directions. */
  speaker: string;
  text: string;
}

export interface GatheringRecord {
  id: string;
  ownerId: string | null;
  at: number;
  participantIds: string[];
  outline: GatherResult;
  transcript: TranscriptLine[] | null;
}

export interface BondRecord {
  id: string;
  ownerId: string | null;
  creatureA: string;
  creatureB: string;
  strength: number;
  metCount: number;
  lastMetAt: number;
}

export interface LetterRecord {
  id: string;
  ownerId: string | null;
  fromCreature: string;
  toCreature: string;
  at: number;
  text: string;
}

// ── M-C: web-push notifications ──────────────────────────────────────────────────
export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** When this device was last pinged — used to honour a per-device cooldown. */
  lastNotifiedAt: number | null;
  createdAt: number;
}

export interface Repository {
  createCreature(input: NewCreature): Promise<CreatureRecord>;
  /** Owner-scoped: returns null if it doesn't exist OR isn't owned by `ownerId`. */
  getCreature(id: string, ownerId: string | null): Promise<CreatureRecord | null>;
  /** All of an owner's creatures (the dashboard), oldest first. */
  listCreaturesByOwner(ownerId: string | null): Promise<CreatureRecord[]>;
  /** Record that the Light looked in (peek) — drives "Xh ago" on the roster. */
  markSeen(id: string, at: number): Promise<void>;
  saveCreature(rec: CreatureRecord): Promise<void>;
  appendEvents(
    creatureId: string,
    events: SimEvent[],
    source: 'sim' | 'ai' | 'user',
  ): Promise<void>;
  listJournal(creatureId: string, limit: number, offset: number): Promise<JournalEntry[]>;
  recordInteraction(creatureId: string, action: string, at: number): Promise<void>;
  addStar(input: Omit<StarRecord, 'id'>): Promise<StarRecord>;
  listStars(ownerId: string | null): Promise<StarRecord[]>;

  // Memory distillation (M7)
  addMemories(
    creatureId: string,
    memories: { at: number; text: string; salience: number }[],
  ): Promise<void>;
  topMemories(creatureId: string, limit: number): Promise<{ text: string; salience: number }[]>;

  // Auth (M5.5)
  upsertUser(input: OAuthUpsert): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;
  /** Find a Light by email (case-insensitive) — used to rehome to someone by address. */
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createSession(userId: string, csrfToken: string, expiresAt: number): Promise<SessionRecord>;
  getSession(id: string): Promise<{ session: SessionRecord; user: UserRecord } | null>;
  deleteSession(id: string): Promise<void>;

  // Sharing (M9.5)
  createShareLink(input: Omit<ShareLinkRecord, 'id' | 'revokedAt'>): Promise<ShareLinkRecord>;
  getShareLink(token: string): Promise<ShareLinkRecord | null>;
  revokeShareLink(token: string, ownerId: string | null, at: number): Promise<boolean>;
  initiateRehome(
    input: Omit<RehomeRecord, 'id' | 'status' | 'toConfirmedAt'>,
  ): Promise<RehomeRecord>;
  getRehome(id: string): Promise<RehomeRecord | null>;
  /** Pending rehomes addressed to this user (the accept inbox). */
  listIncomingRehomes(userId: string): Promise<IncomingRehome[]>;
  /** Confirm one side; when both sides have confirmed, ownership transfers atomically. */
  confirmRehome(id: string, userId: string, at: number): Promise<RehomeRecord | null>;
  addBlock(userId: string, blockedUserId: string, at: number): Promise<void>;
  addReport(reporterId: string, subject: string, reason: string | null, at: number): Promise<void>;

  // The Symposium (M-S)
  createGathering(input: Omit<GatheringRecord, 'id'>): Promise<GatheringRecord>;
  /** Owner-scoped: null if it doesn't exist or isn't owned by `ownerId`. */
  getGathering(id: string, ownerId: string | null): Promise<GatheringRecord | null>;
  /** Set the narrated transcript once the AI (or local fallback) has voiced it. */
  setGatheringTranscript(id: string, transcript: TranscriptLine[]): Promise<void>;
  /** Upsert a bond per unordered pair: strengthen, count up, touch lastMetAt. */
  recordBonds(
    ownerId: string | null,
    pairs: { a: string; b: string; strength: number }[],
    at: number,
  ): Promise<void>;
  /** All of a creature's bonds (its friends), strongest first. */
  listBonds(ownerId: string | null, creatureId: string): Promise<BondRecord[]>;
  /** Every bond an owner has — the whole friendship sky, strongest first. */
  listAllBonds(ownerId: string | null, limit: number): Promise<BondRecord[]>;
  /** Leave a short note from one creature to a friend (the pen-pal thread). */
  createLetter(input: Omit<LetterRecord, 'id'>): Promise<LetterRecord>;
  /** All letters among an owner's creatures, most recent first. */
  listLetters(ownerId: string | null, limit: number): Promise<LetterRecord[]>;

  // Push notifications (M-C)
  /** Upsert a device subscription (keyed by endpoint). */
  addPushSubscription(
    input: Omit<PushSubscriptionRecord, 'id' | 'createdAt' | 'lastNotifiedAt'>,
  ): Promise<PushSubscriptionRecord>;
  /** All subscriptions — the cron groups these by user to decide who to ping. */
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
  deletePushSubscription(endpoint: string): Promise<void>;
  touchPushNotified(id: string, at: number): Promise<void>;
}
