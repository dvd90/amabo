/**
 * cron/notify.ts — the notification scheduler (M-C). The app is lazy (no always-on
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
import { decideNotification, type NotifyCandidate } from '../notify/decide.js';
import { DrizzleRepository } from '../repo/drizzle.js';
import type { PushSubscriptionRecord } from '../repo/types.js';
import { catchUp } from '../service/catchup.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? process.env.MAIL_FROM ?? 'mailto:amabo@example.com';
  if (!databaseUrl || !pub || !priv) {
    console.error('[amabo notify] missing DATABASE_URL or VAPID keys — nothing to do');
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);
  const repo = new DrizzleRepository(makeDb(databaseUrl));
  const now = Date.now();

  const byUser = new Map<string, PushSubscriptionRecord[]>();
  for (const s of await repo.listPushSubscriptions()) {
    (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s);
  }

  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    const recs = await repo.listCreaturesByOwner(userId);
    const cands: NotifyCandidate[] = [];
    for (const rec of recs) {
      const { record } = await catchUp(repo, rec, now);
      cands.push({ name: record.name, state: record.state, lastSeenAt: record.lastSeenAt });
    }
    for (const sub of userSubs) {
      const msg = decideNotification(cands, now, sub.lastNotifiedAt);
      if (!msg) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(msg),
        );
        await repo.touchPushNotified(sub.id, now);
        sent += 1;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await repo.deletePushSubscription(sub.endpoint);
        else console.error('[amabo notify] send failed:', (err as Error).message);
      }
    }
  }
  console.log(`[amabo notify] pinged ${sent} device(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
