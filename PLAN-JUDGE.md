# Plan: hidden test cases and a real judge

Status: **proposal** — not started. No code has been written.

Goal: LeetCode-style submission against hidden test cases, with verdicts the
learner can trust, integrated with the tutor's hint-gating pedagogy.

> **Revision note (Jul 2026).** The first draft overstated the available sample
> data by roughly 3×, which made the early phases look more valuable than they
> are and pointed the generation pipeline at the wrong corpus. Every count below
> is measured against the live Neon DB. The corrections changed the *sequencing*,
> not the methodology.

---

## 1. Where we actually are

**`Problem.samples` is dead.** The `Json?` column exists in
`prisma/schema.prisma:50` but **0 of 37,000** rows populate it, and nothing in
`src/` or `scripts/` reads or writes it.

**Samples were never ingested — they are flattened into prose.**
`scripts/ingest-codechef.ts` stores metadata and a link only. Statements are
fetched *lazily on first open* by `fetchCodechefStatement`, which runs
CodeChef's structured `sampleTestCases` through `ccSamples`
(`src/lib/codechef.ts:76`) into a markdown `### Sample Test Cases` section and
discards the structure.

**There is no judging today.** `/api/run` takes hand-pasted stdin, runs once,
returns raw stdout. Nothing compares output to an expected value. The
`"Accepted"` status in `src/lib/runner.ts:47` means only *exit code 0* — it does
not mean the answer is right, and the UI currently implies otherwise.

**The hard problem is sourcing correct expected outputs.** No judge publishes
hidden test data. Storage is trivial; trustworthy data is not.

### Problem inventory (measured)

| Source | Problems | Statements cached | With a parsed sample | With constraints | Usable for generation |
|---|---:|---:|---:|---:|---:|
| CodeChef | 21,364 | 21,360 | **7,432** | 7,043 | **6,309** |
| Codeforces | 11,263 | **4** | 0 | 0 | 0 |
| LeetCode | 3,973 | 3,199 | n/a | n/a | 0 (deferred) |
| CSES | 400 | 400 | **399** | 396 | **396** |

Four consequences that drive the phase order:

**Only 7,432 CodeChef problems carry a sample — 34.8%, not 21,364.** Just 859
have a *second* sample, so **88% have exactly one**. A one-test judge is barely
distinguishable from the Run button that already exists.

**Codeforces has 4 cached statements out of 11,263.** Parse-on-paste is the
right design and yields approximately nothing at launch. Not a v1 source.

**CSES is the strongest corpus.** 400 problems, 399 with an Example block, 396
with constraints, in a rigidly uniform format:

```
Input
The only input line has a string of length n consisting of characters a–z.

Constraints
- 1 \le n \le 10^6

Example
Input:
abcabca
Output:
3 6 7
```

Curated, classical, heavily single-valid-answer, and small enough to hand-audit
end to end — what an unproven generation pipeline needs on its first pass.

**The judgeable ceiling is ~6,705 problems** (6,309 CodeChef + 396 CSES), not
37,000. Phases 7a and 7b both gate on visible samples, so the ~14,000 CodeChef
problems without them can never become judgeable under this design. Deliberate,
not a defect.

**LeetCode is out of scope for v1.** It hands the learner a `class Solution`,
not a program. Judging it needs a per-problem C++ harness that deserializes JSON
arguments, invokes the method, and serializes the return value — a project in
its own right. The UI already acknowledges the mismatch
(`src/components/tutor/code-panel.tsx:148`).

---

## 2. Decisions still open

1. **On a failed hidden test, reveal the failing input?**
   *Recommendation:* **always hide `expectedOutput`; reveal the `input` on
   request for `origin: GENERATED` tests only.** Knowing the input does not tell
   the learner the answer, so the pedagogy survives — but it makes a bad
   generated test *falsifiable*, which the dispute button (Phase 8) otherwise
   cannot be.
2. **Migrations.** No `prisma/migrations/` exists; the workflow is `db:push`.
   With 37k problem rows and real user data on the shared Neon database, switch
   to `db:migrate` before altering the schema. This is Phase 1's first task.
3. **Where the runner lives long-term.** Wandbox through Phase 4; self-hosted
   from Phase 6 onward. Phase 7 cannot run on Wandbox at all.

---

## 3. The eight phases

Sizing is **relative**, not calendar. Dependencies are hard unless noted.

| # | Phase | Depends on | Size | What ships |
|---|---|---|---|---|
| 1 | Data model | — | S | Schema for tests, submissions, judgeability, limits |
| 2 | CSES extraction | 1 | M | 396 hand-verified problems with real test data |
| 3 | Judge engine | 1 | M | Comparator + backend interface, unit-tested |
| 4 | Submit API + UI | 2, 3 | M | **First learner-visible feature** |
| 5 | CodeChef + Codeforces corpus | 2, 4 | M | ~7,400 more problems with sample data |
| 6 | Self-hosted sandboxed runner | 4 | L | Compile-once-run-many; unblocks Phase 7 |
| 7 | Generation + validation pipeline | 6 | XL | **Hidden tests** — the actual ask |
| 8 | Tutor integration + feedback loop | 7 | M | The differentiated product |

Phases 1–4 carry **no LLM-correctness risk anywhere in the path** — they judge
against judge-authored sample data only. Phase 7 is a separate bet and must not
block them.

**Honest framing:** phases 1–5 deliver plumbing on mostly-single-sample data.
The thing the learner actually asked for is Phase 7. Phases 1–5 are worth
building first because they prove the whole path end to end with nothing
generated in it — not because they are the feature.

---

## Phase 1 — Data model

**Goal:** one migration that makes everything downstream possible.

Switch to `db:migrate` first (decision 2), and apply to a Neon **branch**, not
the shared database.

```prisma
enum TestOrigin { SAMPLE GENERATED CURATED }
enum Verdict    { ACCEPTED WRONG_ANSWER TIME_LIMIT RUNTIME_ERROR COMPILE_ERROR PENDING }

model TestCase {
  id             String     @id @default(cuid())
  problemId      String
  index          Int        // display + "failed on test N" ordering
  input          String     @db.Text
  expectedOutput String     @db.Text
  isHidden       Boolean    @default(true)
  origin         TestOrigin
  quarantined    Boolean    @default(false) // see Phase 8
  problem        Problem    @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@unique([problemId, index])
  @@index([problemId, isHidden])
}

model Submission {
  id          String   @id @default(cuid())
  userId      String
  problemId   String
  code        String   @db.Text
  verdict     Verdict
  passedCount Int      @default(0)
  totalCount  Int      @default(0)
  failedIndex Int?     // index only — never the test data
  runtimeMs   Int?
  createdAt   DateTime @default(now())

  @@index([userId, problemId])
  @@index([problemId, verdict]) // powers quarantine statistics
}

// Judgeability metadata, set by the Phase 7 pipeline.
model ProblemJudge {
  problemId      String   @id
  judgeable      Boolean  @default(false) // false => run-only, no verdicts
  needsChecker   Boolean  @default(false) // multiple valid answers
  confidence     Float?   // 0..1
  mutantKillRate Float?
  validatorCode  String?  @db.Text
  checkerCode    String?  @db.Text
  referenceCode  String?  @db.Text // server-side only, never sent to client
  generatedAt    DateTime?
}
```

**Also add to `Problem`** — missing from the first draft and load-bearing:

```prisma
  timeLimitMs   Int?  // null => not judgeable on time
  memoryLimitMb Int?
```

Without a time limit, a `TIME_LIMIT` verdict is undefinable and an O(n²)
solution passes the large hidden tests — destroying the biggest pedagogical
payoff of the whole feature.

Plus `SubmissionUsage`, mirroring `ChatUsage` in `src/lib/usage.ts` — one
submission is many sandbox executions and needs its own daily cap, independent
of the tutor message cap.

Leave `Problem.samples` in place; drop it in a follow-up migration after Phase 5.

**Acceptance:** migration applies cleanly to a Neon branch; `npm run typecheck`
clean; rollback tested.

---

## Phase 2 — CSES extraction

**Goal:** 396 problems with real, hand-verified test data.

CSES leads because its format is uniform enough to parse with confidence and the
corpus is small enough to verify *every single problem* by hand against cses.fi.
That is the only point in this plan where ground truth is fully audited, and
everything downstream leans on it.

- Parser for `Input` / `Output` / `Constraints` / `Example` blocks from the 400
  cached statements.
- Curate `timeLimitMs` per problem in the same pass.
- `scripts/backfill-testcases.ts` — idempotent, resumable, `--source` and
  `--limit` flags. Stored `isHidden: false, origin: SAMPLE`.

**Acceptance:** all 396 problems with constraints yield ≥1 test case; **100%
hand-verified** against the live site; time limits recorded.

---

## Phase 3 — Judge engine (`src/lib/judge.ts`)

**Goal:** a comparator that does not emit false Wrong Answers, behind a backend
interface that survives the Phase 6 swap.

Comparison semantics — where naive judges get it wrong:

- Normalize `\r\n`, strip trailing whitespace per line, strip trailing blank lines
- Token-based comparison, not byte-exact
- Relative float tolerance (`1e-6`) when both sides parse as numeric
- **Multiple-valid-answer problems are excluded, not guessed at.** A large share
  of CP problems accept any valid answer; token comparison will emit false Wrong
  Answers. Detect via statement keywords ("if there are multiple answers", "any
  valid"), set `needsChecker`, leave run-only until a checker exists.

The backend interface is **compile-once-run-many from the start**, even though
Wandbox cannot do it — so Phase 6 changes no callers:

```ts
interface JudgeBackend {
  compile(code: string): Promise<CompiledArtifact | CompileError>;
  run(artifact: CompiledArtifact, stdin: string, limits: Limits): Promise<RunOutcome>;
}
```

`Limits` carries `timeLimitMs` / `memoryLimitMb` from `Problem`. A problem with
a null limit is judged on correctness only, and the UI must not show a runtime
figure implying a limit was enforced.

**Fail-fast has a cost — do not apply it universally.** Stopping at the first
wrong answer is right for learner latency, but it means test *k* is only reached
by submissions that passed 1..k−1, so per-test rejection rates are structurally
incomparable and Phase 8's quarantine statistic degenerates. Resolution: **fail
fast by default, run the full suite on ~5% of submissions**, and compute
quarantine statistics only over full-suite runs.

Wandbox backend for now: visible samples only (1–2 tests), concurrency 3,
verdicts cached by `hash(code + problemId)`.

**Acceptance:** unit tests covering trailing whitespace, `\r\n`, float
tolerance, token-count mismatch, and empty output.

---

## Phase 4 — Submit API and UI

**Goal:** the first thing a learner can see. End-to-end path proven with nothing
generated in it.

New route, separate from `/api/run` — "Run" against scratch stdin stays, it's
cheap and useful.

Submit route: auth-gate → check `SubmissionUsage` cap → load test cases
**server-side only** → judge → persist `Submission` → return
`{ verdict, passedCount, totalCount, failedIndex }`.

> Hidden `expectedOutput` must never cross the network boundary. That is the
> entire point of the feature. Per decision 1, a `GENERATED` test's `input` may
> be returned — but only on an explicit follow-up request for a test already
> failed, never in the submit response itself.

`maxDuration = 30` on the current run route will not cover a multi-test
submission. On Vercel this forces a job/poll model; on the EC2 target in
`DEPLOY-AWS.md` there is no function timeout and a synchronous request is fine.

UI (`code-panel.tsx`): Submit button beside Run, a result strip
(`✓✓✓✗···  3/8 passed · failed on test 4`), per-test detail rows for **visible
samples only**, and a "show me the input" affordance on failed generated tests
(inert until Phase 7).

**Acceptance:** a deliberately wrong solution reports the correct failing index;
network inspection confirms no `expectedOutput` reaches the client.

---

## Phase 5 — CodeChef and Codeforces corpus

**Goal:** scale the sample corpus, once the path from Phase 4 is proven.

Deliberately *after* Phase 4: this phase spends a 7,432-request scraping job
against a third-party service, and there is no reason to spend it before knowing
the judge works.

**CodeChef — re-fetch, do not re-parse.** Do not parse the markdown `ccSamples`
produced: `fetchCodechefStatement` runs `htmlToText` over the whole assembled
string whenever it detects HTML (`src/lib/codechef.ts:137`), which can mangle
the fenced blocks we would be reading back. Re-fetch structured
`sampleTestCases` JSON for the 7,432 problems known to have one — bounded,
resumable, rate-limited — and refactor `ccSamples()` to return
`{input, output}[]` alongside the markdown so future fetches persist both.

**Codeforces — parse on paste** in `/api/problems/[id]/statement`. Correct
design, near-zero yield today; do not budget for it.

Then drop `Problem.samples` in a follow-up migration.

**Acceptance:** ≥90% of the 7,432 yield ≥1 test case; 20 spot-checked by hand
against the live judge pages; rate limiting verified not to trip CodeChef.

---

## Phase 6 — Self-hosted sandboxed runner

**Goal:** compile-once-run-many, safely. Unblocks Phase 7 and takes learner-code
execution in-house.

**Correcting the first draft's arithmetic.** Phase 7's stress stage is ~1,000
inputs × 3 solutions × 2 builds ≈ 6,000 executions per problem — but with the
Phase 3 interface that is ~6 compiles plus 6,000 **sub-millisecond** runs at
`n ≤ 8`. Under a minute per problem; a few hundred problems is a few hours on a
`t4g.small`. The earlier "categorically impossible, budget a bigger instance"
framing was wrong about the cost.

What remains true: **Wandbox cannot do it**, because it recompiles on every
request and pointing a free public service at six thousand compiles per problem
would be abuse.

**The actual hard part is the sandbox, and the first draft did not mention it.**
Today Wandbox absorbs the risk of running arbitrary learner C++. The moment the
runner moves in-house that risk becomes yours: fork bombs, network egress,
filesystem escape, mining, resource exhaustion. Judge0 and Piston handle this,
but **default Docker configurations are not safe on a public box.**

**Acceptance criteria — non-negotiable, not footnotes:**

- no network namespace (zero egress from the sandbox)
- cgroup memory and PID caps
- seccomp filter and read-only root filesystem
- wall-clock kill independent of the reported time limit
- non-root execution, per-run ephemeral workdir
- a deliberate fork bomb and a deliberate egress attempt both contained, tested

---

## Phase 7 — Generation and validation pipeline

**Goal:** hidden tests the learner can trust. This is the actual ask, and the
only phase with LLM-correctness risk.

Runs **offline** as `scripts/generate-testcases.ts`, never on the request path.
Start on CSES, then the 6,309 CodeChef candidates.

### 7.0 The core difficulty

A test case is `(input, expected_output)` and each half fails independently:

1. **Input legality** — out-of-range `n`, a "tree" that isn't, an exceeded
   sum-over-testcases bound, or a format slip produces a garbage expected output
   that rejects correct solutions.
2. **Output correctness** — needs a trusted solution, but the solution came from
   the same model that may have misread the statement.

There is no way around the oracle problem. The pipeline does not "check that
tests are right" — it **earns transitive trust in a solution and derives tests
from it**. Every stage is a hard gate; failing one drops the problem.
*Declining to judge a problem is the correct outcome, not a failure.*

### 7a — Constraints → validator

LLM extracts constraints to structured JSON (bounds on `n`, value ranges,
sum-over-tests limits, structural properties, multi-test format), then writes a
**validator**: a program asserting every constraint plus exact formatting —
token counts, no trailing whitespace, no stray blank lines.

> **Gate:** the validator must accept *every visible sample input*. Those are
> judge-authored ground truth. A rejection means the constraint extraction is
> wrong, not the sample.

Cheapest high-value stage — a validator is a direct transcription of the
constraints section, far easier to get right than a solution. Mirrors real
problem-setting practice (Codeforces `testlib` has exactly this component).

### 7b — A solution *ensemble*, not a solution

Generate **≥3 deliberately diverse** solutions:

- **One brute force** — prompt explicitly for "simplest possible correct
  solution, ignore efficiency, exponential is fine." This is the real oracle: a
  direct transcription of the statement with no clever algorithm to get wrong.
- **Two optimized** — from *different models* (Sarvam and OpenAI are both wired
  up) or materially different prompted approaches.

Compile each twice: `-O2`, and `-O0 -fsanitize=address,undefined`.

> **Gates:** compiles; reproduces **all** visible samples byte-exact; no
> sanitizer diagnostics. Need ≥2 survivors, one of which is the brute force.

A solution with signed overflow or an out-of-bounds read is untrustworthy even
when it prints the right answer.

### 7c — Small-input stress: where trust is earned

Generate many **small** random inputs (`n ≤ 8`, tiny value ranges), biased to
degenerate cases: `n=1`, all-equal, already-sorted, maximum value at minimum
size. Validate each with 7a. Run every surviving solution.

> **Gate:** unanimous agreement across ~500–1000 small inputs.

At small `n` the brute force is trustworthy, so agreement means the optimized
solutions are near-certainly correct *as interpretations of the problem*.
**Disagreement is signal** — drop the problem rather than take a majority vote.

Output is not test cases. It is a **promoted oracle**: an optimized solution
that matched a brute force a thousand times.

### 7d — Only now, the large hidden tests

Generate inputs at full constraint scale, validate each, run the ≥2 *promoted*
solutions (brute force cannot scale here).

> **Gates:** promoted solutions agree with each other; output is deterministic
> across two runs; `-O0` and `-O2` builds agree; **the UBSan build is clean on
> every large input**.

That last gate was in the wrong place in the first draft. Sanitizers ran only in
7b against *sample* inputs — but signed overflow and out-of-bounds reads
manifest at **scale**, which is here. The instrumented build is 2–20× slower
and, at a few hundred problems, entirely affordable. It catches precisely the
class of bug that makes a reference solution silently wrong on big inputs.

Record the promoted reference's runtime on the largest test — that calibrates
`Problem.timeLimitMs` at **~3× reference**.

### 7e — Are the tests *useful*? (mutation testing)

A suite can be perfectly correct and worthless. Validate **power** separately
from correctness: inject a catalogue of classic bugs into the reference —
`long long`→`int`, off-by-one bound, flipped comparator, dropped `n==1` case,
wrong tie-break — and confirm the hidden suite rejects each mutant.

> **Gate:** kill ≥80% of mutants. Below that the tests are legal but toothless —
> regenerate with adversarial inputs (max sizes, overflow-triggering magnitudes,
> worst-case structures).

Include at least one **complexity mutant** — correct but asymptotically worse —
and require the suite to reject it *on time*. That is the check that the large
tests are actually large enough to teach anything.

### 7f — The case that breaks agreement-based validation

**Multiple valid answers.** Two correct solutions legitimately disagree and
every gate above misfires. These need a **checker** — verify the *certificate*
rather than compare strings: if the output claims a path of length `k`, confirm
the path exists and has length `k`. A checker is often much easier to write
correctly than a solution, and needs no oracle at all.

Route these to `needsChecker`, run-only in v1. **Interactive problems are out of
scope entirely.**

### Confidence gate

Judging is enabled only above this bar; everything else stays run-only with
today's scratch-stdin runner and no verdict.

| Signal | Requirement |
|---|---|
| Validator accepts all official samples | required |
| ≥3 solutions survived samples + sanitizers | required |
| Small-input unanimity across ~1000 cases | required |
| Promoted solutions agree at scale; deterministic; `-O0` ≡ `-O2`; UBSan clean at scale | required |
| Mutant-kill rate (incl. ≥1 complexity mutant) | ≥ 0.80 |
| Single valid answer (no checker needed) | required for v1 |
| `timeLimitMs` set | required for a `TIME_LIMIT` verdict |

**300 problems with trustworthy hidden tests beat 20,000 with occasionally wrong
ones.** A single false Wrong Answer against a learner who is actually right
destroys trust in the entire feature.

### Measurement (`npm run eval:testgen`)

Fits the existing `evals/` discipline — measured, not assumed:

- **False-rejection rate** — known-good solutions rejected by generated tests.
  Target 0; the trust-critical metric.
- **Mutant-kill rate** — injected bugs caught. Measures whether the suite is
  worth running at all.

Wire into `.github/workflows/prompt-evals.yml` alongside the hint-leakage eval,
triggered on changes to the generation prompts.

LLM cost is small: ~300 problems × (constraint extraction + validator + 3
solutions + mutants + retries) is low single-digit thousands of calls.

---

## Phase 8 — Tutor integration and the feedback loop

**Goal:** the part that makes this a tutor rather than a LeetCode clone.

- Feed the verdict to the tutor as a `useCopilotReadable` in
  `tutor-workspace.tsx`. "Fails on a large hidden case" is an ideal Socratic
  hook — *"what happens when n is 10⁹?"* — that teaches without revealing the
  counterexample. It fits the hint-gating philosophy exactly.
- A `TIME_LIMIT` verdict is the strongest hook of all, and only exists if
  Phase 1's `timeLimitMs` work was done.
- Auto-mark `SOLVED` on an accepted submission (currently manual via
  `problem-status-controls.tsx`), feeding spaced repetition
  (`src/lib/progress.ts`) and the dashboard automatically.
- **Dispute button** on a failed verdict — the code and an LLM are both already
  in the loop, so triage is cheap. Pairs with the input-reveal in decision 1: a
  learner who cannot see the input cannot substantiate a dispute.
- **Statistical quarantine** — a test rejecting a far higher share of
  submissions than its siblings gets auto-disabled (`quarantined`) and flagged.
  Computed **only over full-suite runs** (Phase 3), never over fail-fast runs,
  which bias every statistic toward test 1.

---

## 4. Residual risk

**Nothing in Phase 7 catches a systematically misread problem.** If every
generated solution misunderstands the statement the *same* way — plausible,
since the models share a training distribution and read identical text — all
gates pass and the tests are confidently wrong.

The visible samples are the only true ground truth in the entire pipeline. That
is why the 7b sample gate is non-negotiable, why cross-model diversity (Sarvam
*and* OpenAI) is a correctness measure rather than a nicety, why Phase 2's
hand-verification matters more than its size suggests, and why the one-sample
majority of the CodeChef corpus deserves a lower confidence ceiling than CSES —
a single sample is a single point of ground truth, and 6,573 CodeChef problems
have exactly that.

**Natural stopping points.** Phase 4 is shippable on its own (a real judge on
authentic sample data). Phase 6 is shippable on its own (faster, self-owned
execution). If Phase 7 proves unreliable in the eval, stopping after Phase 6
still leaves the product meaningfully better than today — and that is the reason
to sequence it this way rather than starting with generation.
