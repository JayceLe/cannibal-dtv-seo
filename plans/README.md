# UI polish — motion plan

Baseline: `3a916f9`, branch `ui-polish`. Business/data code is out of scope.

## Direction before implementation

Corporate: precise, calm, trustworthy. Primary layer communicates scope/state; secondary layer confirms pointer actions; ambient layer is the existing, desktop-only Three header. No bounce, text zoom, scroll hijacking or repeated table count-ups.

| Token | Seconds | Easing | Purpose |
| --- | --- | --- | --- |
| press | .12 | power2.out | pointer acknowledgement |
| hover / menu | .18 | power2.out | small feedback |
| close | .18 | power2.out | dismissal |
| update | .24 | power2.out | scope/data refresh |
| open | .28 | power3.out | dialog focus change |
| reveal | .48 | power3.out | once per section |
| stagger | .07 | — | max .28s delay; entrance under 1.2s |

Choreography: header → primary scope → KPI → distributions → query workspace. Scroll reveals are once-only, never hide server content before observation. Chart series remain owned by ECharts. Keyboard navigation and table values are instant. Native dialog owns focus trapping and the top layer.

## Audit and execution order

| Priority | Before | After | Verification |
| --- | --- | --- | --- |
| P0 | FocusDialog exit unmounts immediately | Shared reversible dialog lifecycle, scroll lock until dismissal, focus restore | close during entry, Escape, reduced-motion, unmount |
| P0 | GSAP + CSS both animate ring stroke | Accurate static SVG arcs; reveal wrapper only | no stroke mutation; final values unchanged |
| P1 | Hover animates inherited gradient variables + reads layout per event | Cached card rect, actual spotlight element with transform/opacity | pointer interruption, cleanup, touch/reduced |
| P1 | Keyboard causes lift and press animation | Instant keyboard state, pointer-only movement | keyboard test |
| P1 | Menu keyframes restart; immediate exit | Interruptible GSAP presence from trigger origin | quick toggle, keyboard, portal removal |
| P1 | Report switches teleport | Shared tab/category indicator via Flip + brief scope entrance | rapid retarget, resize, reduced |
| P1 | Import progress jumps and completion is static | Presentation-only smooth scaleX progress + completion tick | unmount, phase change, final value |
| P1 | Inconsistent spacing/state presentation | Existing sections retain content, common hierarchy, skeleton/empty/error treatment | build, 320/390/768/1440 browser if available |
| P2 | Extra decorative loops | Deliberately omit | reading data stays stable |

Opportunities passed: dialog continuity (occasional), scope continuity (occasional), restrained pointer feedback (frequent), one-time grouped entrance (rare), import completion (rare). Rejected: count-up in table/filter counts, animated keyboard focus, infinite card pulses, per-row scroll effects.

Boundaries: no RPC/SQL/RLS/parser/CSV/engine/threshold edits, no dependencies, rankings outer frame only. Every new tween/observer/listener must be reverted; preference changes apply live. Mechanical checks: full `npm test`, `npm run typecheck`, `npm run build`. Visual feel checks must be reported separately from DOM simulations.


## Execution status

P0/P1 implementation complete. Core tests increased 64 → 71, covering pointer geometry cache, keyboard motion suppression, menu rapid reversal, dialog exit/focus/scroll lock, URL bars, scope interruptions, async indicator cleanup and import progress. All 71 tests pass; typecheck and production build pass. Business/parser/RPC/SQL/RLS/CSV sources are unchanged.

Review fixes: remove duplicate legacy tab underline; retain target cleanup through fast scope changes; remove React autofocus before native dialog focus capture. The static SVG percentage arcs deliberately do not animate their stroke or thickness.

Visual evidence: local Chrome signed in successfully; Overview and Comparison rendered with real read-only data, and no app runtime error appeared in the console. Device toolbar controls were unreliable through native automation, while the dedicated browser connection reports disabled. Exact 320/390/768/1440 visual verification and a measured 60fps trace remain unverified. Existing chart SVG tests cover these widths mechanically, not visual layout. No import was submitted, no data changed, no push/deployment performed.
