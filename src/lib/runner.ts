// C++ code execution via Wandbox (https://wandbox.org) — free, no API key, and
// far more reliable than the public Judge0 instance (which rate-limits hard).
// Override the compiler with WANDBOX_COMPILER if needed.

const WANDBOX_URL = "https://wandbox.org/api/compile.json";
const COMPILER = process.env.WANDBOX_COMPILER ?? "gcc-13.2.0";

export interface RunResult {
  status: string; // "Accepted" | "Compilation Error" | "Runtime Error (...)" | "Exited (code)"
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null; // Wandbox doesn't report time/memory
  memory: number | null;
}

interface WandboxResponse {
  status?: string; // exit code as string ("0" = success)
  signal?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
}

export async function runCpp(sourceCode: string, stdin: string): Promise<RunResult> {
  const res = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: COMPILER,
      code: sourceCode,
      stdin,
      "compiler-option-raw": "-std=c++17",
    }),
  });
  if (!res.ok) {
    throw new Error(`Wandbox HTTP ${res.status}: ${await res.text()}`);
  }
  const d = (await res.json()) as WandboxResponse;

  const compileOutput = d.compiler_error?.trim() ? d.compiler_error : null;
  let status: string;
  if (compileOutput) {
    status = "Compilation Error";
  } else if (d.signal) {
    status = `Runtime Error (${d.signal})`;
  } else if (d.status === "0" || d.status === undefined) {
    status = "Accepted";
  } else {
    status = `Exited with code ${d.status}`;
  }

  return {
    status,
    stdout: d.program_output ?? null,
    stderr: d.program_error?.trim() ? d.program_error : null,
    compileOutput,
    time: null,
    memory: null,
  };
}
