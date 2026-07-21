# Lady Enma of Ash — recurring-antagonist contract

Lady Enma is an original Japanese vampire antagonist: Kurozane's **Cinder Fan**, a former court entertainer and audience keeper who made coercive bargains appear gracious. “Geisha-like” is a player-facing visual shorthand; the 1622 fiction calls her a court entertainer rather than claiming the later institutional profession unchanged. She is not a disguised innocent. She pursued witnesses, seized public evidence, delivered people to the Bell, and managed selective mercy for the regime.

Her dramatic function is the courtly recurring rival: composed, mobile, and personally interested in Mateus and Nikola. Her costume, face, weapons, history, and silhouette are original and do not reproduce a copyrighted character or actor likeness. The deterministic pixel-art source uses layered kosode and uchikake, uneven hairpins, a cinder folding fan, a broken paper-parasol wing, and a square blood-ward clasp.

## Three-fight escalation

| Fight | Encounter | Form and objective | Recovery punish | Exit |
|---|---|---|---|---|
| First mask | `c3-dock-patrol` at Rain Docks | Escort both witnesses while Enma and two retainers contest the boat route. | `Cinder Fan Draw` declares an orange five-space lane, then gives Recovery 3. Frost/Radiance pressure competes with moving witnesses. | At 55% HP after a witness boards, Enma's rain mask breaks and she retreats. She cannot die here. |
| Second mask | `c6-masked-clerks` at the Archive Roof | Preserve the courier and print blocks while Enma copies only the latest visible clerk writ. | Breaking the violet archive reflection cancels `Mirror Writ` and exposes Recovery 3. | At 30% HP, she burns the archive mask and retreats to Kurohana. She cannot die here. |
| Last mask | `c8-lady-enma` at the Black Gate | Release the Ashen garrison, convert paired Ember/Umbral lanes, and break the last mask. | `Cinder Parasol Wing` declares a full-activation arc before Recovery 3; Frost and Radiance remain her clearest weaknesses. | At zero HP she is subdued alive by the Severed Dragon boundary. Her fate is not decided by the battle result. |

All three fights preserve free movement outside animation lock. The boss's dangerous attacks use the same visible telegraph → resolve → recovery cadence as the rest of combat, and later fights combine rather than replace earlier reads.

## The Cinder Fan Storyworld spool

`spool_enma` contains the decision `sw-enma-three-terms` and three mutually exclusive consequence scenes. It is anchored after `c8-05-gate-opened`, related to `c8-lady-enma`, and required before Chapter 9 can proceed.

- **Killed — The Cinder Fan Ends:** Enma dies after a witnessed fatal stop. This removes an immediate threat but destroys access to living testimony and scatters court officials connected to her routes.
- **Captured — Custody Without a Trophy:** a Severed Dragon restraint is held by three rotating civilian custodians. Nikola supplies only the anti-vampire technique; Mateus may identify ciphers but may never question her alone.
- **Negotiated — A Defection Under Witness:** Enma releases attendants, surrenders ciphers, and provides independently checked intelligence under a revocable compact. She receives no pardon, office, party membership, or promise that harmed witnesses must meet her.

The exact result persists in the completed Storyworld record as `resolutionKey` (`revision`, `accord`, or `negotiated`) and is exposed by `getLadyEnmaResolution` as `killed`, `captured`, or `negotiated`. Bounded properties also retain the consequence's pressure on custody, testimony, and network consent; they do not replace the categorical record.

Existing saves migrate only through the first eight decision records. Any older history that crossed the newly inserted Enma hearing fails closed rather than inventing one of the three outcomes.

## Asset and cultural guardrails

- Pixel source: `assets/art/boss-combat-suite/build_boss_combat_suite.py`
- Inventory and original-design declaration: `assets/art/boss-combat-suite/boss-combat-suite.source.json`
- Generated atlas: `assets/art/boss-combat-suite/boss-combat-atlas.png`
- Generated review sheet: `assets/art/boss-combat-suite/boss-combat-contact-sheet.png`
- Sacred objects are not weapons, loot, or decorative proof of evil.
- Enma is one culpable individual, not a claim that court entertainers, women, Japanese tradition, or a profession are vampiric.
- Death, custody, and negotiation remain materially different outcomes; negotiation is neither romance nor instant redemption.
