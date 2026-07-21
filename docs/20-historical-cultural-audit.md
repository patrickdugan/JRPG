# Historical and cultural audit note

Status: **provisional internal correction pass; external consultant review remains pending.** This note records deliberate divergences and production constraints. It is not a substitute for review by a Japanese cultural historian, a scholar of early-modern Japanese Christianity, and sensitivity readers familiar with Japanese religious practice.

## Locked historical frame

- The story takes place in alternate **Genna 8 (1622)**. That year deliberately coincides with the historical Great Genna Martyrdom, in which 55 missionaries and Japanese *dōjuku* acolytes were put to death. The game must not reenact that event or reuse its victims, locations, or methods. See the [Japan Tourism Agency overview](https://www.mlit.go.jp/tagengo-db/en/R1-00781.html) and [Agency for Cultural Affairs chronology](https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/pdf/suisensho_02.pdf).
- The 1614 nationwide ban predates the story. Active missionaries must therefore be clandestine holdovers or returnees, and Japanese Kirishitan communities must retain their own agency rather than appearing as an open foreign mission. The same [Agency for Cultural Affairs chronology](https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/pdf/suisensho_02.pdf) records the ban, later efumi practice, and later temple-certification developments.
- Takamine’s bell registry is Kurozane’s fictional local experiment. It is an alternate-history precursor, not the later nationwide temple-certification system.
- Nikola Dražanić is a fictional minor Croatian noble from the Habsburg–Ottoman frontier, not a historical person. He inflates a courtesy claim into “Count”; scripts should let informed characters challenge the style rather than authenticate it. His eastward route uses Adriatic commercial connections followed by Portuguese-linked movement through Goa, Macao, and Japanese ports. That is a production plausibility frame, not proof of one documented individual journey. Portugal’s expulsion from Japan occurs later than the story. See the [National Diet Library chronology of Japan–Netherlands exchange and foreign-port restrictions](https://www.ndl.go.jp/nichiran/e/chronology.html).
- Migration note: **Elisabet “Lise” Varga** is the retired display identity. Current player-visible text uses **Nikola Dražanić** and masculine pronouns. Lowercase save/runtime IDs such as `lise`, `varga-mark`, and `sw4-margin-varga-journal` remain frozen compatibility keys; historical receipts are not rewritten.

## Locked cultural constraints

- Kurozane’s black chrysanthemum is a deliberate theft and defacement of imperial symbolism. It is not an authentic shogunal crest, and his “Court” is an illegitimate fictional bakufu apparatus rather than the Imperial Court in Kyoto. The [Imperial Household Agency palace guide](https://www.kunaicho.go.jp/wp-content/uploads/2026/03/illustrationmap-e.pdf) distinguishes Imperial chrysanthemum and Tokugawa hollyhock imagery.
- “Ashen Oni” is a contested in-world label for a deliberate fictional synthesis. Art and dialogue must not claim one canonical oni appearance or moral meaning, or copy a sacred figure, ceremonial mask, or identifiable local tradition. The [Kyoto National Museum’s oni exhibition material](https://www.kyohaku.go.jp/eng/exhibitions/collection/2023/08/) supplies religious and visual context.
- Sacred or devotional objects must not become ordinary loot, combat consumables, or neutral gothic decoration. Aya uses fictional archive and record seals, not devotional talismans. The [Association of Shinto Shrines guide](https://jinjahoncho.or.jp/en/assets/pdf/pamphlet/jinja_EN.pdf) describes shrine talismans and their devotional setting.
- Catholic confession uses the terms *penitent*, *penance*, and *sacramental seal*. See the [Vatican Catechism on the acts of the penitent](https://www.vatican.va/content/catechism/en/part_two/section_two/chapter_two/article_4/vii_the_acts_of_the_penitent.html) and [Code of Canon Law on the sacramental seal](https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib4-cann959-997_en.html).

## Implemented terminology policy

- Save-stable identifiers remain unchanged when display language is corrected.
- `temple-charm` / `temple-charm-chest` display as **Defaced Registry Token**; the legacy item-name alias remains solely for compatibility.
- `reliquary-lock` identifies the existing interaction internally but displays **Dražanić Strongbox**.
- The schema-v1 field-interaction presentation catalogue now covers all 113 exact level/interactable pairs. Campaign buttons, native choice prompts, completions, blocked states, and replay text consume that authored copy; unknown pairs use neutral language and never expose legacy IDs or infer wording from rewards, actions, or flags.
- Takamine is described as an **experimental local bell registry**, never as a normal nationwide “temple system” in 1622.
- The Integrated 20-frame scene-panorama suite uses only original deterministic integer-coordinate primitives. Its source forbids actors, readable records, sacred/devotional objects, authentic heraldry, ceremonial masks, clean radial floral emblems, historical victims/methods, real-person likenesses, imported concept pixels, and borrowed film/game compositions. Kurozane's authority uses asymmetrical broken ledger-tab geometry; Takamine uses invented registry machinery without temple-bell ornament. Visual QA corrected one cross-like lantern read and one calm-band violation before integration. These internal constraints reduce risk but do not satisfy the external-review gate.
- The 16-role NPC suite maps only explicit structured person metadata. Twelve community roles use secular work silhouettes and an empty-hand conversation pose; no role is inferred from a Japanese name, Christian identity, ethnicity, prose, or objective action. The generated twelve-person roster is reference-only, while runtime pixels remain editable deterministic primitives.

## Source-to-content boundaries

| Source evidence | What production may use | What production must not infer |
| --- | --- | --- |
| The official Hidden Christian Sites history records the 1614 nationwide ban and the 1622 deaths of 55 Catholics, including Japanese people who sheltered clergy. | Genna 8 is a credible point for clandestine pressure, fractured routes, and danger shared by Japanese organizers and foreign clergy. | Do not reenact those deaths, reuse victims, or reduce Japanese participants to anonymous shelter for Europeans. |
| UNESCO describes Hidden Christianity as a tradition sustained by communities across more than two centuries of prohibition. | Japanese lay networks may own routes, records, concealment rules, refusal, and continuity independent of a priest protagonist. | Do not make foreign clergy the sole source of belief, organization, rescue, or historical memory. |
| Japan's Cultural Heritage Online records 2,218 later Hidden Christian devotional and ritual objects and notes coexistence with Buddhist and Shinto practice. | Material culture is diverse, locally transformed, and embedded in lived communities. | The collection spans later developments; do not back-project its objects wholesale into 1622, turn them into loot, or use them as generic gothic set dressing. |
| Kyoto National Museum material documents both kami–Buddha combinatory practice and varied oni imagery within religious and narrative contexts. | Shrine and temple life need not follow a modern exclusive binary; an invented Ashen Oni label may be contested in-world. | Do not present one canonical oni body, copy a ceremonial mask or sacred figure, or define Japanese religious identity as demonic. |

The production-facing questions, asset inventory, reject conditions, and disposition fields are frozen in the [external cultural review packet](24-external-cultural-review-packet.md). Source checking and automated guardrails can prepare that packet but cannot approve it.

## Review still required

Before dialogue, costume, religious practice, regional detail, scene panoramas, or marketing copy is locked, external reviewers must assess Japanese Kirishitan agency, shrine–temple relationships, titles and names, the Ashen Oni synthesis, the Black Chrysanthemum usurpation, and the material design of Christian prayer spaces. Findings must be logged here with reviewer scope, date, requested changes, and disposition.

Official source links and the chronology claims above were spot-checked on 2026-07-20; that check does not satisfy the external-consultant requirement.
