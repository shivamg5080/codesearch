// Code execution via Judge0. Defaults to the free public CE instance; override
// JUDGE0_URL (+ JUDGE0_KEY/JUDGE0_HOST for RapidAPI or a self-hosted instance).
// C++ only for now (GCC, language_id 54).

const JUDGE0_URL = process.env.JUDGE0_URL ?? "https://ce.judge0.com";
const CPP_LANGUAGE_ID = 54; // C++ (GCC 9.2.0)

export interface RunResult {
  status: string; // e.g. "Accepted", "Compilation Error", "Runtime Error (SIGSEGV)"
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null; // seconds, as string
  memory: number | null; // KB
}

export async function runCpp(sourceCode: string, stdin: string): Promise<RunResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.JUDGE0_KEY) {
    headers["X-RapidAPI-Key"] = process.env.JUDGE0_KEY;
    headers["X-RapidAPI-Host"] = process.env.JUDGE0_HOST ?? "judge0-ce.p.rapidapi.com";
  }

  const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      language_id: CPP_LANGUAGE_ID,
      source_code: sourceCode,
      stdin,
    }),
  });
  if (!res.ok) {
    throw new Error(`Judge0 HTTP ${res.status}: ${await res.text()}`);
  }
  const d = (await res.json()) as {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    time: string | null;
    memory: number | null;
    status?: { description?: string };
  };
  return {
    status: d.status?.description ?? "Unknown",
    stdout: d.stdout,
    stderr: d.stderr,
    compileOutput: d.compile_output,
    time: d.time,
    memory: d.memory,
  };
}
