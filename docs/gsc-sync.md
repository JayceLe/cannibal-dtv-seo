# Weekly cannibal data from Search Console

The reference Looker Studio report is
`https://datastudio.google.com/reporting/77bb2b4e-cca3-4eaf-ae8d-f239a89c2b53/page/p_pk3fypthjd/edit`.
Inspection on 2026-11-17 confirmed the URL property `https://dienthoaivui.com.vn/`,
Landing Page + Query dimensions, `web` search, and the metric filter Url Clicks >= 1.
The selected source range was 2026-10-16 through 2026-11-13 inclusive.

## Calendar

`private.invoke_gsc_sync()` is scheduled by Supabase pg_cron at 03:00 UTC every
Monday (10:00 Asia/Ho_Chi_Minh), with retry slots at 10:15 and 10:30. An already
published period with the same keyword mapping is skipped without re-reading GSC.
No running desktop app is required after configuration.

- App date: the Monday of the current Vietnam week.
- Source end: the preceding Friday, Monday minus 3 days.
- Source start: that Friday minus 28 days, also a Friday.
- Both source endpoints are inclusive: 29 calendar dates, matching the reference.
- 2026-11-16 is labeled on the app and uses 2026-10-16–2026-11-13.
- 2026-11-23 uses 2026-10-23–2026-11-20.

Google Search Console interprets source date strings in Pacific time. The code
passes the selected dates unchanged; Vietnam time determines the report label
and scheduler only. All dates must be available as finalized GSC data. A missing
Friday never causes a shorter window or a different label to be published.

## One-time connection

Open Import dữ liệu → Tự động cập nhật GSC on the production website.

1. In the desired Google Cloud project enable Search Console API.
2. Create a service account (no project IAM role is needed for reading GSC).
3. In the GSC URL property add the service-account email with Restricted access.
4. The account owner creates/downloads the JSON key and uploads it in the app.

The authenticated configuration endpoint verifies the fixed workspace owner,
validates the RSA JSON key, requests only `webmasters.readonly`, and tests the
actual property before saving the key in Supabase Vault. The private key is never
returned to the frontend, stored in localStorage, or committed to the repository.
The scheduler becomes active only after a complete first import succeeds.
Until then `private.gsc_sync.active=false`; scheduled invocations perform no HTTP
request. A configured connection that failed its initial full import can be
retried using Đồng bộ kỳ này in the app.

## Data and publication

- Query + page, `aggregationType=byPage`, `type=web`, `dataState=final`.
- Disjoint regex partitions cover the existing mapped keyword list, with NFC/NFD
  forms and case/whitespace normalization. No sample keyword is a production rule.
- Each partition is paginated. A response reaching the GSC row cap is discarded
  and retried as smaller query sets; a still-capped individual query aborts.
- Up to four source requests run concurrently. Failed batches prevent publication.
- Click >= 1 applies to each original Query–URL over the entire period, as in
  Looker; it is not applied to individual days. Fragment URLs are removed using
  the same rule as the existing CSV importer. Clicks remain a filter, not a new
  ranking tiebreaker. Positions use impression weights when normalized queries merge.
- Staging batches are private to the fixed owner, lease and import. Counts,
  duplicate pairs, source impression totals and unchanged base mapping are
  verified before calling the existing `seo_finalize_import`. Existing cannibal
  formulas and triggers remain unchanged.
- Only a fully ready import atomically replaces the same Monday. Other dates
  survive. A failed fetch cannot replace a published snapshot with partial data.

Search Console itself can omit anonymized queries and internally limited rows;
this pipeline does not invent those rows or claim access to data Google withholds.
Reconcile a first real import with the reference export before treating source
equivalence as verified. Local fixtures verify normalization against the current
CSV importer, date boundaries, pagination, caps, malformed/duplicate rows and scope.

## Operations

Production route: `GET /api/gsc`, authenticated with the existing CRON_SECRET.
Owner connection/status: `GET/POST /api/gsc/connection` with a valid Supabase user
token; the fixed owner is checked server-side. The database worker checks the
server secret hash, uses a seven-minute lease and rejects other report periods.
Status metadata contains source range, import ID, mapped query count and errors.
Inspect `private.gsc_sync`, `cron.job_run_details` and `net._http_response` for
schedule results. The scheduler uses the encrypted existing cron secret from Vault.
