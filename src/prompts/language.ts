// Vernacular reply instruction — injected when the learner picks a non-English
// language. Code, identifiers and LaTeX stay untouched so the technical content
// survives translation.

export function buildLanguageInstruction(languageLabel: string, languageCode: string): string {
  return (
    `IMPORTANT: Reply ENTIRELY in ${languageLabel} (language code ${languageCode}). ` +
    `Write all prose, hints and explanations in ${languageLabel}, but keep code ` +
    `blocks, variable names, function names and LaTeX math exactly as they are ` +
    `(do not translate code or math). Keep technical terms the learner will see ` +
    `in an editor (like "binary search", "DP", "array") in English where natural. ` +
    `Answer directly and keep any private deliberation very brief — a short ` +
    `${languageLabel} reply beats a long deliberation.`
  );
}
