/**
 * cron/notify.ts — the world's heartbeat while nobody looks (M-C + M-M). The app is lazy (no always-on
 * worker), so a Railway cron runs this on an interval (~every 30 min): for each
 * subscribed Light it catches their creatures up to now, asks `decideNotification` what
 * (if anything) is worth a ping, and sends it via web-push. Dead endpoints (404/410)
 * are pruned; a per-device cooldown lives in the decision.
 *
 * Run: `node dist/cron/notify.js`. Needs DATABASE_URL + VAPID_PUBLIC_KEY/PRIVATE_KEY
 * (+ optional VAPID_SUBJECT). Generate keys once with `npx web-push generate-vapid-keys`.
 */

import webpush from 'web-push';
import { makeDb } from '../db/client.js';
import { buildLlmClient } from '../llm.js';
import { envLogger } from '../logger.js';
import {
  decideNotification,
  normalizeVapidSubject,
  type NotifyCandidate,
  type SocialCandidate,
} from '../notify/decide.js';
import { DrizzleRepository } from '../repo/drizzle.js';
import type { PushSubscriptionRecord } from '../repo/types.js';
import { catchUp } from '../service/catchup.js';
import { extendChronicle, makeChronicler } from '../service/chronicle.js';

const logger = envLogger();
const log = logger.child('notify');

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = normalizeVapidSubject(
    process.env.VAPID_SUBJECT ?? process.env.MAIL_FROM,
    'mailto:amabo@example.com',
  );
  if (!databaseUrl || !pub || !priv) {
    log.error('missing DATABASE_URL or VAPID keys — nothing to do');
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);
  const repo = new DrizzleRepository(makeDb(databaseUrl));
  const now = Date.now();
  const startedAt = now;
  // The same voice and the same fences as the server: breaker-shared, ledgered.
  const llm = buildLlmClient(logger);
  const chronicler = makeChronicler(
    llm,
    repo,
    logger,
    () => Date.now(),
    Number(process.env.NARRATION_DAILY_CAP ?? 2000),
  );

  const allSubs = await repo.listPushSubscriptions();
  const byUser = new Map<string, PushSubscriptionRecord[]>();
  for (const s of allSubs) {
    (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s);
  }
  log.info('run starting', {
    users: byUser.size,
    devices: allSubs.length,
    voice: llm?.provider ?? 'local',
  });
  if (byUser.size === 0) {
    log.info('no device has enabled notifications yet — nothing to do this tick');
  }

  let sent = 0;
  let pagesWritten = 0;
  for (const [userId, userSubs] of byUser) {
    const recs = await repo.listCreaturesByOwner(userId);
    const cands: NotifyCandidate[] = [];
    for (const rec of recs) {
      const { record } = await catchUp(repo, rec, now);
      cands.push({ name: record.name, state: record.state, lastSeenAt: record.lastSeenAt });
    }

    log.debug('shelf caught up', { userId, creatures: recs.length });

    // The shelf keeps writing while nobody looks (M-M) — then, if the freshest page
    // is still unread, it becomes the social candidate for the ping.
    let social: SocialCandidate | null = null;
    try {
      const pages = await extendChronicle(repo, chronicler, userId, now);
      pagesWritten += pages;
      if (pages > 0) log.info('chronicle extended while nobody looked', { userId, pages });
      const seenAt = (await repo.getUserById(userId))?.chronicleSeenAt ?? 0;
      const [latest] = await repo.listChronicle(userId, 1);
      if (latest && latest.at > seenAt && latest.text) {
        const nameOf = new Map(recs.map((r) => [r.id, r.name]));
        social = {
          aName: nameOf.get(latest.aId) ?? 'a passing light',
          bName: nameOf.get(latest.bId) ?? 'a passing light',
          valence: latest.valence,
          text: latest.text,
        };
      }
    } catch (err) {
      log.error('chronicle extension failed for a shelf — pings continue without it', { err });
    }

    for (const sub of userSubs) {
      const msg = decideNotification(cands, now, sub.lastNotifiedAt, undefined, social);
      if (!msg) {
        log.debug('nothing worth a ping for this device', {
          userId,
          cooldownActive:
            sub.lastNotifiedAt != null && now - sub.lastNotifiedAt < 6 * 60 * 60 * 1000,
        });
        continue;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(msg),
        );
        await repo.touchPushNotified(sub.id, now);
        sent += 1;
        log.info('pinged', { userId, title: msg.title });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          log.info('pruned a dead push endpoint', { code });
          await repo.deletePushSubscription(sub.endpoint);
        } else {
          log.error('push send failed', { code: code ?? null, err });
        }
      }
    }
  }
  log.info('run complete', {
    users: byUser.size,
    devices: allSubs.length,
    pinged: sent,
    pagesWritten,
    ms: Date.now() - startedAt,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    log.error('notify run crashed', { err: e });
    process.exit(1);
  });
