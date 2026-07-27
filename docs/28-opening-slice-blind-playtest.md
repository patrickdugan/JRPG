# Opening-through-Mateus blind playtest

This is the release gate for the first 30–45-minute playable slice. Automated route attempts, passing tests, dialogue word counts, and author familiarity do not prove that a new player understands or enjoys it.

## Test conditions

- Use one tester who has not read the design documents and has not watched development.
- On Windows, the observer may double-click `PLAYTEST_OPENING.cmd`; it serves the current local build on an ephemeral localhost port, records the exact commit plus a dirty-worktree suffix when applicable, and opens a clean New Game without showing this protocol to the tester.
- Serve `game/`, open `campaign.html?new=1`, and give the tester no explanation beyond: **“Play until the game tells you the opening is complete.”**
- Do not answer rules, story, navigation, or control questions during the run. Record each question instead.
- Record active time from the opening panel, real elapsed time, wipes, restarts, and any point where the tester stops making purposeful progress for 30 seconds.
- Stop when the opening panel reports that the cells are open and Mateus has yielded. In launcher mode, **Next scene** remains locked and the endpoint feedback form appears above the game.
- Let the tester complete and download that form before any post-run discussion. Preserve the `bells-opening-playtest-*.json` receipt. Do not include Chapter 3.

## Build identity

| Field | Result |
| --- | --- |
| Tester |  |
| Date / timezone |  |
| Git commit |  |
| Browser, OS, and display scale |  |
| Input device |  |
| Active time at completion |  |
| Real elapsed time |  |
| Wipes / encounter restarts |  |

## Observation log

| Time | Page / scene / encounter | What the tester tried | Friction, surprise, or delight | Needed outside help? |
| ---: | --- | --- | --- | --- |
|  |  |  |  |  |

## Unprompted comprehension check

The launcher’s endpoint form asks these only after Mateus yields and preserves the tester’s words in the downloaded receipt. Do not discuss or correct an answer before submission. If the receipt cannot be downloaded, ask and record them manually:

1. Who are Ren, Aya, Nikola, and Mateus?
2. What is happening to the hidden Christians, and who benefits from it?
3. Why did the party enter Takamine?
4. Why did Mateus fight them, and why did he stop?
5. What were the two ways to win the Mateus duel?
6. What do attack commitment and the separate recovery timer ask you to do in combat?
7. What do you expect the party to do next?

## Experience check

The endpoint form records these ratings from 1 (strongly disagree) to 5 (strongly agree), followed by the open-ended prompts. Use this table only as a manual fallback.

| Statement | Score | Example |
| --- | ---: | --- |
| I always understood my immediate goal. |  |  |
| Movement and attacks responded as I expected. |  |  |
| Enemy telegraphs and elemental advice affected my decisions. |  |  |
| Tagging between the two active fighters was useful and readable. |  |  |
| Aya’s reserve healing was understandable. |  |  |
| Nikola, Ren, Aya, and Mateus sounded distinct. |  |  |
| The story made me want to see what happens after the cells open. |  |  |
| The slice felt paced rather than padded or rushed. |  |  |

Also ask:

- What was the best moment?
- What was the most confusing or tedious moment?
- Which line, mechanic, or image do you remember most?
- Would you voluntarily play another hour?

## Pass boundary

The slice is ready to call polished only when the clean blind run:

- completes in 30–45 minutes of visible active time;
- requires no outside explanation;
- has no progression blocker, crash, save corruption, or unrecoverable input state;
- produces correct answers to at least five of the seven comprehension questions, including questions 3–5;
- earns at least 4/5 for immediate-goal clarity, controls, character distinction, and desire to continue;
- contains no single confusion or stall that the tester identifies as run-defining.

The JSON receipt automatically reports the candidate build, clean-run ID, active and real elapsed time, opening encounter wins, restart count, self-reported prior exposure and help, all answers, ratings, and the mechanical pass signals. It deliberately retains `verdict: "human-review-required"`: another person must still score the seven free-text answers and review the observer’s stalls and questions.

A miss is evidence, not a reason to coach the tester or reinterpret the target. Preserve the receipt and notes, fix the observed cause, and run a new clean blind test on the new commit.
