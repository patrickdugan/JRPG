# Cold-release prefetch for the two reviewed boss windups

The real Action Campaign test in merged PR #30 verified the source-pinned WebPs in authored `c9-yearless-bell` and `c8-lady-enma` encounters. It also captured a cold-load animation issue: the first Yearless Bell active-attack canvas draw sampled WebP cell **10** (0-based atlas frame index 9), skipping the opening nine cells of the 24-frame release strip.

The active attack is short. At hosted browser speed it was drawn only three times for Yearless Bell and once for Lady Enma. The player consequently sees a small fraction of the 24 decoded active cells.

During the `windup` of these two boss identities, and **only when** `?art=hd&motion=reviewed` is enabled, the renderer now requests the original `active` WebP in advance. The request uses the existing canonical manifest and does not replace the active file. The warmed active atlas should be available before the short release starts.

Image prefetch is restricted to the approved testing lane and only the two named bosses. Source identity checks, load failures, cache capacity, and canonical fallback all stay governed by the existing `createHdMotionRuntime` loader. Classic and default HD modes retain their old request schedules.

The live Chapter 8/9 Playwright test now records the first decoded active frame index and requires the reviewed trial to draw the active attack within WebP frames 1–6. The result is scored from **actual `drawImage` source rectangles** on the production Action Campaign canvas, not network availability. Source runtime and action model tests guard the state and timing boundaries.

No archive, WebP, attack duration, hitbox, save, or boss-wide art approval changes. The missing artist-authored windup-to-release keys remain tracked under JRPG Issue #27.
