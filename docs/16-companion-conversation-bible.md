# Companion Conversation Bible

**System:** finite two-person lantern talks

**Scope:** 15 unordered party pairings × 6 ordered talks = 90 conversations

**Completion policy:** once per save, with one explicit response recorded per conversation

**Shipped volume:** 3,644 main lines, 540 authored response lines, and 83,435 counted words

## Dramatic purpose

The lantern talks carry relationship change that would overcrowd the route scenes. They are not confession dispensers or hidden romance points. Each pairing begins with a concrete disagreement about evidence, custody, violence, care, faith, or responsibility and revisits that disagreement as the campaign changes what both people know.

Mateus's participation follows the story's central limit: useful testimony and changed conduct do not purchase pardon. Lise can recognize an action without becoming responsible for his redemption. Persecuted communities retain agency and are never reduced to scenery for a European character's moral crisis.

The talks introduce no historical official, real-person likeness, borrowed franchise terminology, traversal ability, collectible sacred object, or secret ending requirement.

## Pair ownership

| Production pack | Pairings |
| --- | --- |
| Early | Ren–Aya, Ren–Lise, Aya–Lise, Ren–Mateus, Aya–Mateus |
| Middle | Lise–Mateus, Ren–Genta, Aya–Genta, Lise–Genta, Mateus–Genta |
| Late | Ren–Kiku, Aya–Kiku, Lise–Kiku, Mateus–Kiku, Genta–Kiku |

Every pairing has six canonical slots. A later talk requires the prior talk for that pair, even if a late save has already passed all story unlock beats. This prevents character development from appearing out of order.

## Unlock cadence

Each pairing belongs to the join tier of its later participant. The six talks open at authored story beats distributed from that join point through the epilogue. They rotate among Roadside Lantern, Lantern Safehouse, and Hidden Infirmary so the conversation remains an intentional rest-point activity rather than an omnipresent menu.

A talk is available only when all four conditions hold:

1. its story beat is complete;
2. both participants are unlocked;
3. the party is at its authored camp;
4. the previous talk in that pairing is complete.

Only one talk may be active at a time. Leaving the page preserves the exact main-line, choice, and response frontier.

## Authored shape

Every conversation contains:

- a specific title and a concrete thematic statement;
- at least 40 main-dialogue lines;
- at least 15 main lines for each participant;
- one prompt with exactly two readable options;
- at least three response lines for each option;
- a unique consequence flag and visible summary for each option;
- at least 450 counted authored words across the complete record.

The catalogue validator rejects malformed keys, incorrect pair ownership or order, unknown speakers, wrong beat/camp placement, repeated consequence flags, exact repeated authored text, placeholder language, real-person/franchise references, and sacred objects framed as loot.

## Player-facing flow

The Camp page lists only conversations relevant to the selected rest point, plus any currently active conversation. Starting a talk records its finite slot. The player acknowledges exactly one authored line per input, sees both response labels after the main exchange, chooses explicitly, and then acknowledges the selected response one line at a time. Completion records the selected consequence flag and refuses replay mutation.

Completed entries remain recorded rather than becoming grindable dialogue rewards. The system grants no XP, currency, equipment, or tactical modifier, so a personal response cannot become an optimization tax.

## Save contract

The independent versioned save contains only:

- campaign ID, schema version, and clean-run ID;
- canonical ordered conversation records;
- status, main-line frontier, selected choice, and response frontier;
- monotonic revision.

The adapter binds the payload to the validated run-receipt ID and uses sequential compare-and-swap writes. A stale tab, conflicting same-revision payload, skipped transition, cleared namespace, or old-run payload fails closed instead of rolling back or resurrecting progress after New Game.

Validation fails closed on unknown or duplicate IDs, multiple active talks, premature choices, impossible response progress, non-canonical record order, or a completion state that has not acknowledged the selected response. New Game clears this save alongside all other campaign authorities.

## Duration accounting and proof boundary

The quantity audit counts only text a canonical first-choice playthrough can actually see: title, theme, prompt, both visible option labels, all main lines, the selected first response, and that option's consequence summary. The unseen response branch is reported in catalogue volume but excluded from the playable duration estimate.

The canonical visible path contains 3,914 acknowledged dialogue lines and 76,547 visible words. These quantities are derived from the exact shipped records; no authored activity-minute declaration is added.

The bounded completion witness starts from the zero-time canonical campaign result, completes all 90 talks through public runtime transitions, records the first response for each, refuses all 90 replay attempts, and keeps recorded playtime at zero. All 90 talks are also placed at exact unlock frontiers in the 215-activity intended route, with completed evidence required before credits may seal. Its prose-bound catalogue signature is `fnv1a32:3265b9bc`; the completion signature is `fnv1a32:e49705bb`. This proves deterministic reachability and line coverage. It does not prove how long a person reads, reflects, or chooses.

## Writing review checklist

- Does the talk begin from a concrete object, route decision, witnessed act, or care task?
- Do both characters pursue distinct needs rather than alternate exposition lines?
- Has the relationship moved since this pair's prior talk?
- Can either response be chosen without making faith, trauma, or forgiveness a morality meter?
- Does the consequence describe the party's understanding or working method, not rewrite public campaign facts?
- Are community custody and consent preserved when testimony is discussed?
- Is Mateus denied automatic absolution, even when he behaves usefully?
- Does every line sound speakable and carry information, pressure, evasion, humor, or change?
