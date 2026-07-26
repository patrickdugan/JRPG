# Five-Act Master Storyworld Plan

**Game:** *Bells of the Black Chrysanthemum*  
**Status:** master causal and production plan  
**Scope:** Acts I–V, with implementation detail for the Act III–IV conversion layer  
**Finale contract:** five player tactics, thirteen deterministic confrontation flows, and four political endings

## Authority and compatibility

This plan reconciles the project's newer act drafts with its shipped campaign and save contracts.

- [Act I — The Hidden Shore](34-act-i-the-hidden-shore.md) and [Act II — The Bishop Beneath the Bell](35-act-ii-the-bishop-beneath-the-bell.md) are the dramatic authority for the opening, Nikola's arrival, Ren's compact, Quiet Cross, and Mateus's defeat.
- The current sixty-beat campaign remains the runtime production ledger until those opening acts receive a dedicated beat migration.
- `sw1-clerks-second-copy` and `sw2-witness-not-family` retain their current `c1` and `c2` anchor IDs. Those are compatibility seams, not instructions to restore superseded characterization.
- [Act III–V route sequences](../game/content/act-route-sequences.mjs) are live production authority: eight major sequences in Act III, eight in Act IV, and five in Act V.
- Storyworld cluster, option, reaction, and outcome IDs remain opaque and save-stable. Visible prose and bounded effects may be improved without renaming a historical choice into a different decision.

No Act III–IV revision in this plan adds another state property. The world remains at thirty-five properties, below the projection-tower threshold. Existing properties are organized into causal strands instead of expanded into a flatter schema.

## Whole-game dramatic engine

Kurozane's claim is not merely that he is powerful. He claims that every road, granary, garrison, registry, and supernatural restraint will fail without his immortal body at the center. The heroes cannot answer that claim with a stronger body. Across five acts, they must turn personal disciplines into institutions that continue functioning when no hero owns them.

The campaign therefore advances through three kinds of victory:

1. **A person is kept alive or made answerable.**
2. **A method is made transferable without becoming somebody's private authority.**
3. **A public capacity survives the removal of the ruler who claimed to be indispensable.**

The physical boss progression remains Castlevania-paced: each act closes pressure through a dangerous space, a mechanically precise combat test, and a visible consequence. The Storyworld layer does not replace that velocity. It determines what the victory can safely mean.

## Five-act spine

| Act | Dramatic question | Physical escalation | Irreversible gain | Storyworld work |
|---|---|---|---|---|
| Act I — The Hidden Shore | Can Nikola protect people without appointing himself over them? | Covert landing → village pursuit → portable-bell search party | Nikola accepts a local compact; Ren joins by choice | Establish consent, evidence custody, witness safety, and the belief that party limits can be real |
| Act II — The Bishop Beneath the Bell | Can Mateus be defeated without victory becoming private judgment or absolution? | Attacked licensed village → crypt refuge/prison → three-phase vampire duel | Mateus becomes a bounded source; Black Sun Concord proves cooperation without restored office | Establish Mateus accountability, corroboration, survivor authority, and Kurozane's personal guilt |
| Act III — The Three-Road War | Can the coalition spend scarce time without turning a shared cause into one command? | War table → three chosen regional operations → counterstroke → Hushroad rescue | Ethical inclinations become evacuation, disruption, intelligence, defection, and succession capacity | Convert Acts I–II values into route infrastructure; preserve a real cost for the omitted fourth operation |
| Act IV — The Black Gate | Will those capacities hold when the coalition must breach the palace and judge a dangerous defector? | Route-specific homecoming → relay breach → Enma gate duel | Kurozane loses monopoly over movement, audience, and outer commands | Stress-test consent under siege; convert Enma's fate into bounded intelligence or an explicit information loss |
| Act V — The Living Castle | After Kurozane is physically beaten, can the country remove him without inheriting his theory of power? | Living archive → blood conservatory → Bell Spine → Yearless Bell → Kurozane | Seals return, transfer at dawn, survive prepared execution, or fracture into civil war | Pay every causal strand through five tactics and thirteen flows; permit one rare pride inversion |

## Causal strands

### 1. Evidence becomes public legitimacy

`proof_integrity`, `truth_completeness`, `aya_archive_openness`, and `public_reach` begin as questions about copies and testimony. Act III converts them into `bell_intelligence` and `succession_readiness`. Act IV tests whether those records can verify Enma's ciphers and inventory the palace offices. Act V uses them to catch concealed seals, support a mortal transfer, and distinguish confession from theater.

### 2. Consent becomes logistics

`network_consent`, `ren_noncoercion`, `p_party_respects_limits`, `care_capacity`, `kiku_capacity`, `witness_safety`, and `route_safety` begin as limits on access and recruitment. Act III converts them into `evacuation_capacity` and durable route commitments. Act IV asks the coalition to preserve those limits under siege. Act V uses the resulting routes to move prisoners, witnesses, food, and records before the political settlement.

### 3. Accountability becomes force that can stop

`lise_oath_revision`—the save-stable key for Nikola's severed-command discipline—joins `genta_accountability`, `mateus_accountability`, `p_mateus_truthfulness`, and `party_cohesion`. Act III turns these personal restraints into `garrison_defection` and `oni_supply_disruption`. Act IV tests them against Enma's attempt to make custody, duel, or defection into another private sovereignty. Act V asks whether a fatal stroke, if chosen, ends a ruler after other commands are already functioning.

### 4. Regional commitments become political options

`salt_commitment`, `ash_commitment`, and `paper_commitment` are not morality scores.

- Salt improves evacuation, granary continuity, route safety, and separate witness custody.
- Ash improves Oni release, supply disruption, garrison refusal, and the survivability of a necessary execution.
- Paper improves distributed proof, bell verification, provisional offices, and public succession.

Every selected operation contributes something. Priority determines the strongest approach and counterstroke, not the only ethically valid path.

### 5. Kurozane's psychology follows material events

`kurozane_pride`, `kurozane_indispensability`, and `kurozane_guilt_pressure` do not move because the player chose a flattering dialogue line.

- Functioning routes and disobedient soldiers nudge indispensability downward.
- Enma's custody or defection lowers pride and indispensability; her death hardens pride and removes living pressure.
- Mateus's witnessed accountability and the public record increase guilt pressure.
- Ordinary changes remain bounded nudges of 0.05 or 0.10.
- Only the rare public confession in Act V performs an exact complement: `pride := 1 − pride`.

## Effect vocabulary

| Effect class | Magnitude | Use |
|---|---:|---|
| Texture nudge | ±0.05 | A boundary is accepted, an uncertainty is logged, a route loses time, or a public claim narrows |
| Decisive local movement | ±0.10 | A custody regime, route priority, public admission, death, or defection is established |
| Operational completion | +0.05 per stage | Completing a selected regional operation produces one guaranteed capacity at entry and another at consequence |
| Categorical state | 0.10 from a zero baseline | Enma is held, killed, or bound by compact; exactly one fate becomes active |
| Reversal | exact complement | Reserved for Kurozane's rare confession; never used as ordinary persuasion |

An effect may be negative only when the reaction text names the cost. Refusal is not automatically a loss: it often increases noncoercion or witness safety while reducing reach, speed, or route certainty. No option is a disguised global “good” button.

## Act III conversion plan

### III.1 — The Bellless House War Table

The route decision must always preserve the selected priority, regardless of whether the coalition accepts the party's first framing.

| Priority | Guaranteed outputs | History-sensitive texture |
|---|---|---|
| Salt | `act3_salt_priority`, `salt_commitment`, `evacuation_capacity` | Consent and route safety decide whether the coalition receives a unified schedule or a narrower supply promise |
| Ash | `act3_ash_priority`, `ash_commitment`, `oni_supply_disruption` | Court pressure, witness safety, and noncoercion decide whether rescue and sabotage share one accepted clock |
| Paper | `act3_paper_priority`, `paper_commitment`, `succession_readiness` | Proof, archive openness, and public reach decide whether the first transfer plan travels as a common inventory or a revised distributed argument |

The consequence scene adds one secondary legitimacy effect. It does not grant the full regional payoff before the operation is played.

### III.2 — Nagi and the Severed Dragon testament

Completing Nagi writes Salt infrastructure and bell knowledge:

- entry reactions add `salt_commitment` and `evacuation_capacity`;
- consequence reactions add `bell_intelligence` and `route_safety`;
- publication can improve public reach but risks centering inherited authority;
- full-context copying improves proof and truth but costs speed;
- survivor custody improves consent and safety while limiting immediate publication.

The scene's central conversion is: **inherited anti-vampire authority becomes publicly limited technique, and the wreck route becomes a verifiable palace signal.**

### III.3 — Kagura and the cipher handoff

Completing Kagura writes Ash infrastructure:

- entry reactions add `ash_commitment` and initial `oni_supply_disruption`;
- consequence reactions add further disruption and `garrison_defection`;
- Mateus's accountable explanation increases guilt pressure only when actions and offices are named;
- Aya's corroborated account increases bell intelligence and public usability;
- paired accounts increase consent and the credibility of later stand-down orders.

The conversion is: **a confession about machinery becomes an actionable release map that soldiers and bound Oni can refuse.**

### III.4 — Kozui and the tribunal afterword

Completing Kozui writes Paper infrastructure:

- entry reactions add `paper_commitment` and `public_reach`;
- consequence reactions add `succession_readiness`, `bell_intelligence`, and `kurozane_guilt_pressure`;
- corroboration strengthens proof without making Mateus the protagonist of the record;
- challenging omissions strengthens accountability while respecting living witness limits;
- moving listeners proves that care capacity is part of public legitimacy rather than a pause in politics.

The conversion is: **a public accusation becomes a distributed inventory of offices that can receive finite authority.**

### III.5 — Hushroad and the soldier who will not follow

Hushroad is common to every route because rescue before the palace is the coalition's shared constitutional act.

- entry reactions add `ash_commitment` and `evacuation_capacity`;
- consequence reactions add `garrison_defection`, `oni_supply_disruption`, and lower Kurozane's indispensability claim;
- bounded assistance can improve route safety;
- a complete refusal preserves noncoercion but may leave route knowledge uncertain;
- Genta's repair is measured by whether soldiers may refuse both the shogun and him.

The conversion is: **rescue and refusal become a garrison stand-down that belongs to neither commander.**

## Act IV stress-test plan

### IV.1 — Boats With Conditions

The boats are a siege instrument only because they remain civilian routes.

- entry reactions add evacuation capacity and route safety;
- consequence reactions add Salt commitment, network consent, and lower Kurozane's indispensability;
- evacuation-only produces maximum passenger safety;
- one sealed bundle trades a bounded inspection risk for proof reach;
- a locally assigned reserve improves care responsiveness without giving the party silent requisition authority.

This scene must never punish crews for refusing evidence cargo. The trade is between capacities, not courage and cowardice.

### IV.2 — Three Terms for the Cinder Fan

Enma's fate is the Act IV capstone and the last categorical branch before the palace converges.

| Fate | Capacity payoff | Cost retained |
|---|---|---|
| Rotating custody | Verified testimony, bell intelligence, proof, and a bounded reduction in Kurozane's indispensability | Dangerous living defendant; custody labor and witness distance remain necessary |
| Revocable compact | Strongest cipher and garrison payoff; pride and indispensability fall when a core servant publicly defects | No pardon, no office, and cooperation may be halted |
| Death | Immediate threat ends and court pressure can fall | Bell intelligence, stand-down reach, and living testimony are lost; Kurozane's pride hardens |

The formulas must read proof, consent, witness safety, Nikola's revised discipline, court pressure, and Enma testimony. The outcome must not be selected from a single mercy stat.

## Act V payoff matrix

| Tactic | Strongest prior support | Possible flows |
|---|---|---|
| Witnessed return | consent, proof, succession, garrison refusal, bell intelligence | complete surrender or concealed-office fatal stop |
| Provisional binding | proof, Nikola's discipline, consent, safety, cohesion | living finite custody or failed line requiring witnessed execution |
| Execution demand | Ash continuity or Paper succession, plus verified commands | fearful surrender, unprepared civil war, Ash-prepared execution, or Paper-prepared execution |
| Dawn seppuku demand | succession, bell intelligence, proof, public reach | orderly compelled abdication and dawn sentence, or collapse into civil war |
| Name the crime | Mateus accountability, guilt pressure, truth, succession, and low indispensability | incomplete living concession, defensive rage, or rare confession-and-pride reversal |

The four endings remain political consequences, not moral grades:

- **The Seals Returned:** living abdication and rotating custody.
- **The Last Seal at Dawn:** compelled public transfer followed by witnessed seppuku.
- **The Necessary Blade:** execution after independent commands are already functioning.
- **The Empty Throne Mobilizes:** unprepared execution or failed transfer exposes the civil war embedded in immortal rule.

## Production topology

The authored catalog remains ninety-seven scenes: sixty campaign beats plus eleven Storyworld decisions and twenty-six mutually exclusive consequences. This pass changes effects and formulas, not scene arithmetic.

Act III keeps eight major sequences:

1. Bellless House war table.
2. First regional operation.
3. Kurozane's counterstroke in that theater.
4. Second regional operation.
5. Live-families consequence report.
6. Third regional operation.
7. Hushroad emergency.
8. Coalition commitment.

Act IV keeps eight major sequences:

1. Three homecomings.
2. Route-specific approach.
3. Black Gate bargain.
4. Boats With Conditions.
5. Lantern breach.
6. Lady Enma.
7. Three Terms for the Cinder Fan.
8. Outer Archive threshold.

Act V keeps five convergent sequences and changes room parameters rather than deleting rooms by route.

## Acceptance and calibration

The implementation is ready only when all of the following hold:

- generated Storyworld artifacts are deterministic and validator-clean;
- every Act III–IV decision reaction uses a multi-thread inclination formula, except the route outcome itself remains categorically fixed by the selected priority;
- every completed regional operation writes at least one route capacity and one cross-route legitimacy or safety property;
- all thirty-five properties remain bounded and every nudge is at most 0.10;
- the only inversion effect remains Kurozane's Act V pride reversal;
- all three Enma fates remain reachable;
- all thirteen final confrontation flows remain reachable;
- all four endings remain globally live, no ending exceeds 60%, and no ending falls below 2% in the locked seeded audit;
- Paper retains the strongest access to orderly dawn transfer, Ash retains a distinct prepared-execution path, and Salt retains the strongest evacuation identity without becoming a dead political route;
- old source-version-six histories migrate without inventing a different selected option, reaction, or ending;
- the full game test suite passes before commit.
