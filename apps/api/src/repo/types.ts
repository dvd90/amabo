/**
 * repo/types.ts — the persistence port (a small interface the handlers depend on, so
 * they never touch SQL directly). A DrizzleRepository backs production; an
 * InMemoryRepository backs the tests. Every read is OWNER-SCOPED: callers pass the
 * owner and a cross-owner read returns null → the route answers 404, never leaking
 * existence (CLAUDE.md, ARCHITECTURE.md §14). Owner is nullable for the single-user
 * v1 and made required when auth lands (M5.5).
 */

import type { CreatureState, SimEvent, Star } from '@amabo/engine';

export interface CreatureRecord {
  id: string;
  ownerId: string | null;
  name: string;
  state: CreatureState;
  graduatedAt: number | null;
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

export interface Repository {
  createCreature(input: NewCreature): Promise<CreatureRecord>;
  /** Owner-scoped: returns null if it doesn't exist OR isn't owned by `ownerId`. */
  getCreature(id: string, ownerId: string | null): Promise<CreatureRecord | null>;
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
  /** Confirm one side; when both sides have confirmed, ownership transfers atomically. */
  confirmRehome(id: string, userId: string, at: number): Promise<RehomeRecord | null>;
  addBlock(userId: string, blockedUserId: string, at: number): Promise<void>;
  addReport(reporterId: string, subject: string, reason: string | null, at: number): Promise<void>;
}
