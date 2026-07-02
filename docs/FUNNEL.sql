-- FUNNEL.sql — the queries that decide pricing and launch-readiness (LAUNCH_PLAN.md L1).
-- Run against the Railway Postgres. `at` is epoch milliseconds throughout.
-- These numbers gate L6: D7 ≥ ~15% and narration attach ≥ ~40% before acquisition spend.

-- ── Daily funnel: visits → births seen → signups ───────────────────────────────────
SELECT
  to_timestamp(at / 1000)::date AS day,
  count(*) FILTER (WHERE name = 'visit')            AS visits,
  count(DISTINCT anon_id) FILTER (WHERE name = 'visit') AS visitors,
  count(*) FILTER (WHERE name = 'birth_seen')       AS births_seen,
  count(*) FILTER (WHERE name = 'signup')           AS signups
FROM telemetry
GROUP BY 1 ORDER BY 1 DESC;

-- ── Signup conversion (visitor → account), last 30 days ────────────────────────────
SELECT
  count(DISTINCT anon_id) FILTER (WHERE name = 'visit')  AS visitors,
  count(*)               FILTER (WHERE name = 'signup')  AS signups,
  round(
    100.0 * count(*) FILTER (WHERE name = 'signup')
    / greatest(count(DISTINCT anon_id) FILTER (WHERE name = 'visit'), 1), 1) AS pct
FROM telemetry
WHERE at > (extract(epoch FROM now()) - 30 * 86400) * 1000;

-- ── D1 / D7 retention: of each signup cohort, who came back (any beat) ─────────────
WITH cohort AS (
  SELECT user_id, min(at) AS signed_up
  FROM telemetry WHERE name = 'signup' GROUP BY 1
)
SELECT
  to_timestamp(c.signed_up / 1000)::date AS cohort_day,
  count(*) AS signups,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM telemetry t WHERE t.user_id = c.user_id
      AND t.at BETWEEN c.signed_up + 1 * 86400000 AND c.signed_up + 2 * 86400000
  )) AS d1,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM telemetry t WHERE t.user_id = c.user_id
      AND t.at BETWEEN c.signed_up + 7 * 86400000 AND c.signed_up + 8 * 86400000
  )) AS d7
FROM cohort c
GROUP BY 1 ORDER BY 1 DESC;

-- ── Engagement: care actions and peeks per active user per day ─────────────────────
SELECT
  to_timestamp(at / 1000)::date AS day,
  count(DISTINCT user_id)                            AS active_users,
  count(*) FILTER (WHERE name = 'care_action')       AS care_actions,
  count(*) FILTER (WHERE name = 'peek')              AS peeks,
  count(*) FILTER (WHERE name = 'push_enabled')      AS push_optins
FROM telemetry
WHERE user_id IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

-- ── Narration attach + cost ledger (live from L3 on) ───────────────────────────────
-- Attach: share of active users whose peeks were model-narrated that day.
SELECT
  to_timestamp(at / 1000)::date AS day,
  count(DISTINCT user_id)                                   AS narrated_users,
  count(*)                                                  AS model_calls,
  sum((props->>'inputTokens')::bigint)                      AS input_tokens,
  sum((props->>'outputTokens')::bigint)                     AS output_tokens
FROM telemetry
WHERE name = 'narration'
GROUP BY 1 ORDER BY 1 DESC;

-- ── Client errors (should trend to zero; details live in Sentry) ───────────────────
SELECT to_timestamp(at / 1000)::date AS day, count(*) AS client_errors
FROM telemetry WHERE name = 'client_error'
GROUP BY 1 ORDER BY 1 DESC;
