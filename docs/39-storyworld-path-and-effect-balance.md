# Storyworld path and effect balance

Audit date: 2026-07-26

This is the quantitative companion to the five-act master plan. It measures whether Salt, Ash, and Paper travel through comparably deep but materially different causal histories before Act V. It does not claim that uniform random choices model human play or that a Monte Carlo rehearsal replaces playtesting.

## Measurement model

The audit treats one ordinary Storyworld texture nudge, `0.05`, as one distance unit. Each completed decision and consequence changes a vector of bounded Storyworld properties.

- **Cumulative L1 travel** sums the absolute size of every effect. It measures total authored causal work, including effects that later counteract each other.
- **Cumulative L2 travel** sums the Euclidean length of each scene's effect vector. It measures route depth without letting a scene that touches many properties count once per property.
- **Prefinal displacement** measures Euclidean distance from the initial projection immediately before the Last Command. It isolates the history delivered into the climax.
- **Final displacement** adds the selected final tactic and ending reaction.
- **Displacement efficiency** is final displacement divided by cumulative L2 travel. A value near zero would mean churn without durable identity; a value near one would mean a nearly straight, unresponsive stat ramp.
- **Reaction branch distance** measures separation between alternate reactions to the same option.
- **Option centroid distance** measures separation between the average effect vectors of different options in the same cluster.
- **Route and ending centroid distance** measures the separation between mean resulting property vectors.
- **Inclination margin** is the winning reaction score minus the runner-up score. A close decision has a margin below `0.05`.

All distance calculations use the runtime's clamped projection. The only non-nudge effect remains the rare exact complement of Kurozane's pride during public confession.

## Locked rehearsal

Command:

```text
node game/storyworld-balance-audit.mjs --runs 5000 --seed 42
```

This executes 5,000 deterministic, uniformly option-sampled runs on each exact selected-route schedule, for 15,000 complete runs.

| Route | Cumulative L1 | Cumulative L2 | Prefinal displacement | Final displacement | Active properties before final | Efficiency |
|---|---:|---:|---:|---:|---:|---:|
| Salt | 112.08 | 45.65 | 25.05 | 25.33 | 26.30 | 0.555 |
| Ash | 111.01 | 45.19 | 23.90 | 24.51 | 28.39 | 0.542 |
| Paper | 116.16 | 46.73 | 24.87 | 25.85 | 28.34 | 0.554 |

The largest cumulative-L2 spread is 1.54 nudge units, or 3.4% of the shortest route. No route buys its ending leverage with substantially more Storyworld path length. The 0.542–0.555 efficiency band shows that histories retain a durable direction while still containing revision, resistance, and tradeoffs.

The mean prefinal route centroids are also distinct:

| Route pair | Centroid distance |
|---|---:|
| Salt ↔ Ash | 7.97 nudges |
| Salt ↔ Paper | 7.91 nudges |
| Ash ↔ Paper | 7.28 nudges |

Those distances are larger than the mean reaction-branch distance. Route identity therefore survives the local variation inside individual choices.

## Local choice geometry

Across Act III and IV:

- alternate reactions to one option are separated by **3.97 nudges** on average;
- option centroids are separated by **2.50 nudges** on average;
- entry formulas read **4.40 threads** on average;
- consequence formulas read exactly **4 threads**;
- 30 entry options select different reactions under different valid histories.

| Cluster | Options | Reactions per option | Entry terms | Branch distance | Option distance | Effect properties |
|---|---:|---:|---:|---:|---:|---:|
| War Table | 3 | 2.00 | 4.00 | 2.55 | 4.02 | 20 |
| Sodegaura manifests | 4 | 3.00 | 5.00 | 3.36 | 2.64 | 17 |
| Nagi testament | 3 | 2.00 | 4.00 | 4.30 | 2.20 | 14 |
| Kagura cipher | 3 | 2.00 | 4.00 | 3.71 | 2.45 | 17 |
| Kozui tribunal | 3 | 2.00 | 4.00 | 3.64 | 2.51 | 16 |
| Hushroad soldier | 4 | 2.25 | 4.33 | 4.36 | 1.83 | 18 |
| Black Gate boats | 4 | 2.25 | 4.33 | 3.95 | 1.98 | 16 |
| Lady Enma | 4 | 2.25 | 4.78 | 5.51 | 2.34 | 18 |

Sodegaura's new cluster closes the former route-depth gap. Its four operational plans distinguish distributed household ledgers, local stop signals, accountable deception, and destructive denial; three reactions per option let prior consent, evidence, safety, accountability, and route conditions alter how the same plan lands.

Hushroad, the boats, and Enma now have fourth options that add safe-conduct, two-wave cancellation, and verified-compact approaches. Their lower option-centroid distances are deliberate: these are fine strategic distinctions inside a converging crisis, while their reaction branches remain strongly separated by history.

## Ending geometry and frequencies

Every ending remains reachable on every route. Mean final centroids are separated as follows:

| Ending pair | Centroid distance |
|---|---:|
| Empty Throne ↔ Seals Returned | 4.99 nudges |
| Empty Throne ↔ Last Seal at Dawn | 6.75 nudges |
| Empty Throne ↔ Necessary Blade | 4.62 nudges |
| Seals Returned ↔ Last Seal at Dawn | 4.13 nudges |
| Seals Returned ↔ Necessary Blade | 3.32 nudges |
| Last Seal at Dawn ↔ Necessary Blade | 3.64 nudges |

| Route | Seals Returned | Last Seal at Dawn | Necessary Blade | Empty Throne |
|---|---:|---:|---:|---:|
| Salt | 29.38% | 4.90% | 8.82% | 56.90% |
| Ash | 25.58% | 8.98% | 20.56% | 44.88% |
| Paper | 43.92% | 26.22% | 20.20% | 9.66% |
| All routes | 32.96% | 13.37% | 16.53% | 37.15% |

The closest ending pair is living abdication and prepared execution at 3.32 nudges. They share a continuity objective but remain separated by consent, custody, military readiness, and the final use of force. The widest separation is civil war versus witnessed dawn seppuku at 6.75 nudges, which matches the intended dramatic and political contrast.

## Formula calibration

The Last Command was recalibrated after the original locked run because witnessed return and provisional binding made Seals Returned a 44.55% global default. Provisional binding now responds much more strongly to court pressure, witness safety, network consent, party cohesion, proof integrity, and Nikola's oath revision. Witnessed return also fails more often when earlier routes cannot independently verify the transfer. The new locked run holds every global ending below the 40% domination gate while preserving all route and ending geometry bounds.

Lady Enma's consequence reactions have only a 0.33% close-decision rate because custody, death, and compact are categorical consequences after the option and prior-history scoring have done their work. That low ambiguity is intentional. By contrast, **Tribunal Afterword** remains the most contestable consequence calculation, with a `0.0372` mean margin and 71.77% close-decision rate, fitting a scene whose evidence is politically disputable.

All thirteen final dramatic flows appear in the locked run. The public-confession pride reversal remains rare at 2.22% overall, and fear-without-repentance surrender remains a distinct 0.80% tail. No final flow is dead.

## Locked regression bounds

Automated tests now require:

- 40 Storyworld nodes in 12 clusters and 100 total authored scenes;
- exactly 11 decisions and 11 consequences on every selected route;
- cumulative L2 route travel between 40 and 52 nudges, with less than 4 nudges of spread;
- prefinal displacement between 20 and 30 nudges;
- at least 24 active prefinal properties and 0.45–0.65 displacement efficiency;
- mean reaction-branch distance above 3.5 nudges;
- mean option-centroid distance above 2.2 nudges;
- at least 4.3 entry formula terms on average and exactly 4 outcome terms;
- every Act III–IV cluster option-centroid distance above 1.7 nudges;
- every route-centroid pair above 6 nudges;
- every ending-centroid pair above 1.5 nudges.

These are drift guards, not claims of ideal fun. Human playtests still need to verify whether the distinctions are legible, emotionally persuasive, and worth replaying.
