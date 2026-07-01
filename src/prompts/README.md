# Prompts

Every prompt in CodeSearch lives here — edit the text in these files and the
behaviour changes everywhere; no application code needs to touch prompt strings.

| File | Prompt | Used by |
|---|---|---|
| `pedagogy.ts` | Core tutor rules (hint-gating, Socratic style, progress tool) | CopilotKit runtime, LangGraph agent, eval harness |
| `modes/understand.ts` | UNDERSTAND mode | tutor chat |
| `modes/hint.ts` | HINT mode | tutor chat |
| `modes/review.ts` | REVIEW MY CODE mode | tutor chat |
| `modes/teach.ts` | TEACH THE PATTERN mode | tutor chat |
| `modes/quiz.ts` | QUIZ ME mode | tutor chat |
| `language.ts` | Vernacular reply instruction (non-English languages) | tutor chat |
| `eval-judge.ts` | LLM-judge classification prompt | `evals/run-hint-leakage.ts` |

`index.ts` assembles them (`buildInstructions(mode)`) and is the only import
site the rest of the codebase uses (`@/prompts`, or `../src/prompts` from
`agent/` and `evals/`).

After editing a prompt, re-run the hint-leakage eval to check the gating still
holds: `npm run eval:hints` (see `evals/README.md`).
