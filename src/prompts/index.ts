// Single entry point for every prompt in the product. The prompt *text* lives
// in the sibling files — edit those to change tutor behaviour; no other code
// needs to change.

import { PEDAGOGY, GATE_REMINDER } from "./pedagogy";
import { UNDERSTAND_MODE } from "./modes/understand";
import { HINT_MODE } from "./modes/hint";
import { REVIEW_MODE } from "./modes/review";
import { TEACH_MODE } from "./modes/teach";
import { QUIZ_MODE } from "./modes/quiz";

export type TutorMode = "UNDERSTAND" | "HINT" | "REVIEW" | "TEACH" | "QUIZ";

export const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  UNDERSTAND: UNDERSTAND_MODE,
  HINT: HINT_MODE,
  REVIEW: REVIEW_MODE,
  TEACH: TEACH_MODE,
  QUIZ: QUIZ_MODE,
};

/** Behavioural system prompt for a given tutor mode (pedagogy + mode + gate). */
export function buildInstructions(mode: TutorMode): string {
  return `${PEDAGOGY}\n\n${MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.UNDERSTAND}\n\n${GATE_REMINDER}`;
}

export { PEDAGOGY } from "./pedagogy";
export { buildLanguageInstruction } from "./language";
export { EVAL_JUDGE_SYSTEM, buildJudgeUserMessage } from "./eval-judge";
export { VERNACULAR_JUDGE_SYSTEM, buildVernacularJudgeUserMessage } from "./eval-vernacular";
