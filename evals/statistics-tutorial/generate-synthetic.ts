import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Condition = "no_tutor" | "socratic" | "worked_example" | "hint_ladder" | "reflective";

type Row = {
  task_id: string;
  difficulty: number;
  seed: number;
  condition: Condition;
  score: number;
  passed: number;
  simulator_score: number;
  human_score: number;
  predicted_failure: number;
  annotator_a_failure: number;
  annotator_b_failure: number;
};

// Mulberry32: a tiny deterministic PRNG, sufficient for manufactured teaching data.
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, low = 0, high = 100): number {
  return Math.min(high, Math.max(low, value));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const conditions: Condition[] = [
  "no_tutor",
  "socratic",
  "worked_example",
  "hint_ladder",
  "reflective",
];

// Average improvements over no tutor. Effects vary by task below.
const averageEffect: Record<Condition, number> = {
  no_tutor: 0,
  socratic: 7,
  worked_example: 5,
  hint_ladder: 9,
  reflective: 4,
};

const random = rng(20260725);
const rows: Row[] = [];
const tasks = 24;
const seeds = 8;

for (let task = 0; task < tasks; task += 1) {
  // One draw per task creates strong within-task dependence across seeds.
  const difficulty = clamp(50 + 22 * normal(random), 8, 92);
  const taskBaseline = 100 - difficulty + 7 * normal(random);

  // Each tutor has genuine task-to-task effect heterogeneity.
  const taskEffect = Object.fromEntries(
    conditions.map((condition) => [
      condition,
      averageEffect[condition] +
        (condition === "no_tutor" ? 0 : 5 * normal(random)),
    ]),
  ) as Record<Condition, number>;

  for (let seed = 0; seed < seeds; seed += 1) {
    // Shared run noise makes same-task/same-seed comparisons more efficient.
    const sharedRunNoise = 3 * normal(random);

    for (const condition of conditions) {
      const conditionNoise = 4 * normal(random);
      const score = clamp(
        taskBaseline + taskEffect[condition] + sharedRunNoise + conditionNoise,
      );
      const passed = Number(score >= 60);

      // The simulator is related to human judgment but imperfect and noisier.
      const humanScore = clamp(score + 4 * normal(random));
      const simulatorScore = clamp(
        0.78 * humanScore + 0.22 * (100 - difficulty) + 9 * normal(random),
      );
      const trueFailure = Number(humanScore < 60);
      const predictedFailure = Number(simulatorScore < 58);

      // Two annotators share the same latent case but make occasional errors.
      const annotatorA = random() < 0.1 ? 1 - trueFailure : trueFailure;
      const annotatorB = random() < 0.14 ? 1 - trueFailure : trueFailure;

      rows.push({
        task_id: `task_${String(task + 1).padStart(2, "0")}`,
        difficulty: Number(difficulty.toFixed(3)),
        seed,
        condition,
        score: Number(score.toFixed(3)),
        passed,
        simulator_score: Number(simulatorScore.toFixed(3)),
        human_score: Number(humanScore.toFixed(3)),
        predicted_failure: predictedFailure,
        annotator_a_failure: annotatorA,
        annotator_b_failure: annotatorB,
      });
    }
  }
}

const columns: (keyof Row)[] = [
  "task_id",
  "difficulty",
  "seed",
  "condition",
  "score",
  "passed",
  "simulator_score",
  "human_score",
  "predicted_failure",
  "annotator_a_failure",
  "annotator_b_failure",
];

const csv = [
  columns.join(","),
  ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
].join("\n");

async function main(): Promise<void> {
  const outputDirectory = join(process.cwd(), "evals", "statistics-tutorial");
  const output = join(outputDirectory, "results.csv");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(output, `${csv}\n`, "utf8");

  console.log(
    `Wrote ${rows.length} sessions (${tasks} tasks × ${seeds} seeds × ${conditions.length} conditions) to ${output}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
