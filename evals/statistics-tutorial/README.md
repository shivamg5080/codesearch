# Two-day statistics study guide

This module teaches statistical reasoning for repeated-seed tutor evaluations.

## Run it

From the repository root:

```powershell
npm run eval:statistics:generate
```

Then open `evals/statistics-tutorial/analysis.ipynb` and run all cells. The
notebook looks for `results.csv` both beside itself and relative to the
repository root.

Python packages used:

```text
numpy
pandas
scipy
```

## The experiment in one sentence

We compare four tutors with no tutor on the same 24 tasks, with eight stochastic
seeds per task and condition, and want to generalize the result to other tasks
from the same target population.

## The hierarchy

```text
evaluation
└── task (24 independently sampled problems)
    └── seed (8 repeated stochastic runs)
        └── condition (no tutor or one of four tutors)
```

The task is the independent unit because task difficulty and tutor usefulness
are shared by all sessions from that task. Re-running a task reduces uncertainty
about that task. It does not create a new problem or provide new evidence about
the diversity of the task population.

## The estimand

For tutor `j`, task `t`, and seed `s`, let the score be `Y[t,s,j]` and the
no-tutor score be `Y[t,s,0]`. The task-level paired effect is:

```text
D[t,j] = mean over seeds s of (Y[t,s,j] - Y[t,s,0])
```

The reported tutor effect is:

```text
Delta[j] = mean over the 24 tasks t of D[t,j]
```

This is a macro-average: every task receives the same weight. If tasks should
represent production frequency instead, pre-specify task weights and resample
in a way that preserves that target distribution.

## Why pairing matters

Tutor and control see the same tasks. A hard task lowers both scores; subtracting
within task cancels much of that nuisance variation. An unpaired comparison
throws this information away. Pairing must be preserved during resampling:
when task 7 is selected into a bootstrap sample, both its tutor and control
measurements travel together.

## Why the naive interval is too narrow

Treating 192 task-seed rows as independent claims eight times as many independent
pieces of task evidence as actually exist. The seed rows share task difficulty
and task-specific tutor effects, so they are correlated. This is
pseudo-replication. The notebook shows the result directly: the point estimate
is similar, but the naive bootstrap distribution is artificially concentrated.

A useful approximation is the cluster design effect:

```text
design effect = 1 + (m - 1) * ICC
effective n ≈ total rows / design effect
```

Here `m` is seeds per task and `ICC` is within-task correlation. This formula is
intuition, not a substitute for a correctly clustered analysis.

## Two-day schedule

### Day 1: experimental units, pairing, and uncertainty

1. Draw the hierarchy above and write the target population.
2. Write the estimand before opening the data.
3. Calculate seed-level paired differences.
4. Aggregate them to one effect per task.
5. Bootstrap tasks and compare the CI with the naive seed-row bootstrap.
6. Inspect the 24 task effects. Ask whether a mean hides strong heterogeneity.

Checkpoint: explain why 24 tasks × 8 seeds is `24 independent clusters`, not
`192 independent tasks`.

### Day 2: measurement quality and ranking

1. Hand-calculate a 2×2 confusion matrix and derive precision and recall.
2. Change the classifier threshold; observe the precision–recall tradeoff.
3. Calculate raw annotator agreement and Cohen's kappa.
4. Change label prevalence while keeping accuracy similar; observe the effect
   on kappa.
5. Rank tutors by human and simulator scores; calculate Spearman correlation.
6. Inspect floor and ceiling cells and explain which effects have become
   unidentifiable or compressed.

Checkpoint: explain why high Spearman correlation does not imply calibrated
simulator scores, and why high raw agreement does not imply high kappa.

## Common failure modes

- Selecting the analysis after seeing which version is significant.
- Reporting session count as the independent sample size.
- Breaking tutor/control pairs during bootstrap resampling.
- Allowing tasks with more successful runs to receive more weight accidentally.
- Ignoring missing seeds or silently dropping failed executions.
- Using precision without stating the positive class.
- Interpreting kappa without label prevalence or the confusion table.
- Treating correlation as agreement or calibration.
- Claiming no effect when the metric is pinned at a floor or ceiling.
- Ranking four tutors and treating the resulting p-value as strong evidence.

## Further exercises

1. Increase seeds from 8 to 64 while holding tasks at 24. Compare both interval
   widths. The naive interval will shrink much faster.
2. Increase tasks from 24 to 96 while holding seeds at 8. The clustered interval
   should now shrink substantially.
3. Make the tutor help hard tasks but hurt easy tasks. Compare the grand mean
   with a plot of effect versus difficulty.
4. Remove 20% of runs non-randomly from low-scoring conditions. Observe how
   complete-case analysis becomes biased.
5. Replace score with pass/fail and demonstrate how ceiling tasks erase visible
   improvements.
