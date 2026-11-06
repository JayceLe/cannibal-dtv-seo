# SpySERP ranking sync

Project 256829 (KEY TỔNG), domain dienthoaivui.com.vn, Google G1 (17909).

The production Vercel GET /api/spyserp worker is triggered by Supabase pg_cron
`spyserp-monday-10am-vietnam` at `0 3 * * 1` (UTC), Monday 10:00 Asia/Ho_Chi_Minh.
Vercel Hobby's hourly cron delivery window is avoided. No local computer is required.
The encrypted vault entry `spyserp_cron_secret` must match Vercel CRON_SECRET.
Only its SHA-256 digest is stored in private.spyserp_sync. No secrets are committed.

SpySERP calls are confined to five approved read-only methods. POST is the upstream
API's transport for reading; the worker never requests scans, exports or mutations.
API key remains exclusively in Vercel's secret environment variable SPYSERP_API_KEY.

Only completed reports are imported. Dates use completion time in Vietnam, matching
the existing XLSX imports. No synthetic Monday snapshot is created if SpySERP has
no newer report. Every source keyword page is fetched with bounded concurrency and
checked for exact counts, unique IDs, normalized names and matching Top 100 total.
API position 0 maps to 101 (>100); -2 remains -2 (unavailable).

One database transaction merges the measured date into each keyword's existing
positions. Earlier dates survive, same-day values are replaced, unchanged values
are not rewritten. A failed or incomplete fetch never changes rankings. A receipt
skips repeat imports; a six-minute lease prevents overlapping invocations.
The worker is scoped to the configured project, existing workspace, domain and G1.

Verification on 2026-11-06: 28,948 unique keywords fetched across 97 source pages.
Latest completed report 20863287, measured date 2026-11-01: 28,195 Top 100,
452 outside Top 100, 301 unavailable. All agree with source report and website.

Operations (privileged SQL): inspect private.spyserp_sync.last_result and receipts;
inspect cron.job and cron.job_run_details; HTTP outcomes stay in net._http_response
for six hours. `select private.invoke_spyserp_sync();` triggers the actual scheduled
path for testing. Authenticated GET with `?mode=verify` checks latest data without
writing ranks. Unauthorized requests are rejected.
