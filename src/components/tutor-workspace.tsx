"use client";

import {
  CopilotKit,
  useCopilotReadable,
  useCopilotAction,
  useCopilotChat,
  useCopilotAdditionalInstructions,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import "@copilotkit/react-ui/styles.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildInstructions, type TutorMode } from "@/lib/tutor-prompt";
import {
  TUTOR_LANGUAGES,
  DEFAULT_LANGUAGE,
  languageLabel,
  isSupportedLanguage,
} from "@/lib/languages";

export interface ProblemMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  rating?: number | null;
  url: string;
}

const MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: "UNDERSTAND", label: "Understand", hint: "Grasp the problem" },
  { id: "HINT", label: "Hint", hint: "One nudge at a time" },
  { id: "REVIEW", label: "Review code", hint: "Find bugs & complexity" },
  { id: "TEACH", label: "Teach pattern", hint: "Learn the technique" },
  { id: "QUIZ", label: "Quiz me", hint: "Check understanding" },
];

const SOURCE_LABEL: Record<string, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

const HINT_LABELS = [
  "No hints yet",
  "L1 · Observation",
  "L2 · Technique",
  "L3 · Approach",
  "L4 · Pseudo-code",
  "L5 · Full solution",
];

export interface ChatHistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

export function TutorWorkspace({
  problem,
  authed,
  history = [],
}: {
  problem: ProblemMeta & { statement?: string | null };
  authed: boolean;
  history?: ChatHistoryMessage[];
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <Workspace
        problem={problem}
        initialStatement={problem.statement ?? ""}
        authed={authed}
        history={history}
      />
    </CopilotKit>
  );
}

function Workspace({
  problem,
  initialStatement,
  authed,
  history,
}: {
  problem: ProblemMeta;
  initialStatement: string;
  authed: boolean;
  history: ChatHistoryMessage[];
}) {
  const [mode, setMode] = useState<TutorMode>("UNDERSTAND");
  const [code, setCode] = useState("");
  const [statement, setStatement] = useState(initialStatement);
  const [showStatement, setShowStatement] = useState(!initialStatement);
  const [hintLevel, setHintLevel] = useState(0);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  // --- Context the tutor can read (sent with each request) ---
  useCopilotReadable({
    description: "The current coding problem the learner is working on",
    value: {
      title: problem.title,
      source: problem.source,
      tags: problem.tags,
      rating: problem.rating,
      url: problem.url,
    },
  });
  useCopilotReadable({
    description:
      "The full problem statement (may be empty — if so and you don't recognise the problem, ask the learner to paste it)",
    value: statement || "(not provided)",
  });
  useCopilotReadable({ description: "Current tutor mode", value: mode });
  useCopilotReadable({
    description: "The learner's current code attempt",
    value: code || "(none yet)",
  });
  useCopilotReadable({
    description: "Highest progressive-hint level reached so far (0-5)",
    value: hintLevel,
  });

  // --- Vernacular tutoring: reply in the learner's chosen Indian language. ---
  // Code, identifiers and LaTeX stay as-is so the technical content is intact.
  useCopilotAdditionalInstructions(
    {
      instructions: `IMPORTANT: Reply ENTIRELY in ${languageLabel(
        language,
      )} (language code ${language}). Write all prose, hints and explanations in ${languageLabel(
        language,
      )}, but keep code blocks, variable names, function names and LaTeX math exactly as they are (do not translate code or math). Keep technical terms the learner will see in an editor (like "binary search", "DP", "array") in English where natural.`,
      available: language === "en-IN" ? "disabled" : "enabled",
    },
    [language],
  );

  // --- The tutor pushes progress into the UI via this action ---
  useCopilotAction({
    name: "update_progress",
    description:
      "Record the learner's progress. Call this when you give a hint or surface a key insight: pass the new highest hint level (1-5) and the FULL list of key understanding points.",
    parameters: [
      {
        name: "hintLevel",
        type: "number",
        description: "Highest progressive-hint level reached (1-5).",
      },
      {
        name: "keyPoints",
        type: "string[]",
        description: "Full list of key understanding points so far.",
        required: false,
      },
    ],
    handler: ({ hintLevel: hl, keyPoints: kp }) => {
      if (typeof hl === "number") setHintLevel((prev) => Math.max(prev, hl));
      if (Array.isArray(kp)) setKeyPoints(kp as string[]);
    },
    render: () => <></>,
  });

  // Persist a pasted statement so it's cached for everyone next time.
  const saveStatement = (text: string) => {
    if (!text.trim() || text === initialStatement) return;
    fetch(`/api/problems/${problem.id}/statement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: text }),
    }).catch(() => {});
  };

  // Mark the problem Attempting + log the message when the learner asks something.
  const trackActivity = (message: string) => {
    fetch(`/api/problems/${problem.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => {});
  };

  return (
    <div className="grid h-[calc(100vh-49px)] grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Left: problem + workspace */}
      <div className="overflow-y-auto border-r border-neutral-800 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{problem.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">
                {SOURCE_LABEL[problem.source] ?? problem.source}
              </span>
              {problem.rating != null && (
                <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-semibold text-indigo-300">
                  Rating {problem.rating}
                </span>
              )}
              {problem.tags.slice(0, 6).map((t) => (
                <span key={t} className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-400">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-indigo-500 hover:text-indigo-300"
          >
            Open on judge ↗
          </a>
        </div>

        <p className="mb-4 text-sm text-neutral-400">
          {statement.trim()
            ? "Statement loaded ✓ — pick a mode and start chatting with the tutor on the right."
            : "Open the statement on the judge above and paste it below so the tutor knows the exact problem (cached after the first time), then pick a mode and chat."}
        </p>

        {/* Problem statement — paste once, cached to DB, read by the tutor */}
        <div className="mb-5">
          <button
            onClick={() => setShowStatement((s) => !s)}
            className="mb-1.5 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <span className={`transition ${showStatement ? "rotate-90" : ""}`}>▸</span>
            Problem statement
            {statement.trim() ? (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
                provided
              </span>
            ) : (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">
                paste to improve answers
              </span>
            )}
          </button>
          {showStatement && (
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onBlur={(e) => saveStatement(e.target.value)}
              placeholder="Paste the full problem statement here…"
              spellCheck={false}
              className="h-40 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm leading-relaxed text-neutral-200 outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Mode selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                mode === m.id
                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                  : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Hint-level meter — updated by the tutor via update_progress */}
        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-neutral-400">Hint level</span>
            <span className="font-medium text-indigo-300">{HINT_LABELS[hintLevel]}</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((l) => (
              <div
                key={l}
                className={`h-2 flex-1 rounded-full ${
                  l <= hintLevel ? "bg-indigo-500" : "bg-neutral-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Key takeaways — populated by the tutor */}
        {keyPoints.length > 0 && (
          <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-300">Key takeaways</h3>
            <ul className="space-y-1.5">
              {keyPoints.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-400">
                  <span className="text-indigo-400">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Code editor — read by the tutor in Review mode, and runnable below */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-neutral-400">
            Your code
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
              C++
            </span>
            <span className="text-neutral-600">(review with the tutor, or run it below)</span>
          </label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// paste or write your C++ attempt here…"
            spellCheck={false}
            className="h-64 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-sm leading-relaxed text-neutral-200 outline-none focus:border-indigo-500"
          />
        </div>

        <RunPanel code={code} authed={authed} />
      </div>

      {/* Right: the AI tutor */}
      <div className="flex min-h-0 flex-col bg-neutral-900/30">
        <div className="border-b border-neutral-800 px-5 py-3">
          <h2 className="font-semibold">CodeSearch Tutor</h2>
          <p className="text-xs text-neutral-500">
            Hints, not spoilers — it won’t hand over the full solution unless you really insist.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          {authed ? (
            <ChatPanel
              problemId={problem.id}
              mode={mode}
              language={language}
              setLanguage={setLanguage}
              trackActivity={trackActivity}
              history={history}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="max-w-xs text-neutral-400">
                Sign in to chat with the tutor and save your progress.
              </p>
              <a
                href={`/signin?callbackUrl=/problems/${problem.id}`}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Sign in to start
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The chat + the Sarvam-powered voice bar. Split out so the voice hooks
 * (mic capture, auto-speak) only mount when the learner is signed in.
 */
function ChatPanel({
  problemId,
  mode,
  language,
  setLanguage,
  trackActivity,
  history,
}: {
  problemId: string;
  mode: TutorMode;
  language: string;
  setLanguage: (code: string) => void;
  trackActivity: (message: string) => void;
  history: ChatHistoryMessage[];
}) {
  const { appendMessage } = useCopilotChat();

  const [speakReplies, setSpeakReplies] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // One persistent <audio> element, reused for every reply. Browsers grant
  // autoplay to an element that was first played during a user gesture, so we
  // "unlock" this one on the Speak-replies click and replay it programmatically.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // The chat DOM (CopilotKit's message store isn't readable in this build, so we
  // read assistant replies straight from the rendered DOM instead).
  const chatRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenRef = useRef("");
  // Persist assistant replies for reload: only after the learner has sent
  // something (skips the static greeting), deduped by text.
  const lastLoggedRef = useRef("");
  const sentAtLeastOnceRef = useRef(false);
  // The static greeting bubble — never log or speak it.
  const greetingRef = useRef("");
  const speakRepliesRef = useRef(speakReplies);
  speakRepliesRef.current = speakReplies;
  const languageRef = useRef(language);
  languageRef.current = language;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Mark Attempting + log the learner's message, and remember a turn happened.
  const handleUserMessage = useCallback(
    (message: string) => {
      sentAtLeastOnceRef.current = true;
      trackActivity(message);
    },
    [trackActivity],
  );

  // Persist an assistant reply so it reloads next time.
  const logAssistantReply = useCallback(
    (content: string) => {
      fetch(`/api/problems/${problemId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, role: "assistant", mode: modeRef.current }),
      }).catch(() => {});
    },
    [problemId],
  );

  // Text of the most recent assistant bubble rendered by CopilotChat.
  const latestReplyText = useCallback(() => {
    const els = chatRef.current?.querySelectorAll(".copilotKitAssistantMessage");
    const last = els && els[els.length - 1];
    return last ? (last.textContent ?? "").trim() : "";
  }, []);

  // A valid (silent) WAV so the first play during a click actually resolves and
  // grants autoplay permission for later programmatic plays.
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }, []);

  // --- Speak a string via Sarvam TTS in the current language. ---
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const audio = getAudio();
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: languageRef.current }),
        });
        if (!res.ok) {
          setVoiceError(`Voice failed (${res.status}).`);
          return;
        }
        const { audios } = (await res.json()) as { audios?: string[] };
        if (!audios?.length) {
          setVoiceError("No audio returned.");
          return;
        }
        // Play chunks back-to-back on the same (unlocked) element.
        for (const b64 of audios) {
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.src = `data:audio/wav;base64,${b64}`;
            audio.play().then(
              () => setVoiceError(null),
              () => {
                setVoiceError("Tap 🔊 once to allow audio.");
                resolve();
              },
            );
          });
        }
      } catch {
        setVoiceError("Voice request failed.");
      }
    },
    [getAudio],
  );

  // Capture the static greeting bubble once it renders so we never persist or
  // speak it (only real replies).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!greetingRef.current) greetingRef.current = latestReplyText();
    }, 800);
    return () => clearTimeout(t);
  }, [latestReplyText]);

  // --- Auto-speak each completed assistant reply when enabled. ---
  // Watch the chat DOM; once it stops mutating (stream finished), speak the
  // latest assistant bubble if it's new.
  useEffect(() => {
    const root = chatRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const text = latestReplyText();
        if (!text || text === greetingRef.current) return;
        // Persist the reply (after a real turn) so it reloads next visit.
        if (sentAtLeastOnceRef.current && text !== lastLoggedRef.current) {
          lastLoggedRef.current = text;
          logAssistantReply(text);
        }
        // Speak it if enabled.
        if (speakRepliesRef.current && text !== lastSpokenRef.current) {
          lastSpokenRef.current = text;
          void speak(text);
        }
      }, 1200);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [latestReplyText, speak, logAssistantReply]);

  // --- Mic: record → Sarvam STT → send as a chat message. ---
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Mic not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        setVoiceBusy(true);
        try {
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          // Auto-detect when on English, else bias to the chosen language.
          form.append("language_code", language === "en-IN" ? "unknown" : language);
          const res = await fetch("/api/voice/stt", { method: "POST", body: form });
          if (!res.ok) {
            setVoiceError("Couldn't transcribe — try again.");
            return;
          }
          const { transcript, languageCode } = (await res.json()) as {
            transcript: string;
            languageCode: string | null;
          };
          if (!transcript.trim()) {
            setVoiceError("Didn't catch that — try again.");
            return;
          }
          // If we auto-detected a supported Indian language, switch the tutor to it.
          if (languageCode && languageCode !== language && isSupportedLanguage(languageCode)) {
            setLanguage(languageCode);
          }
          handleUserMessage(transcript);
          await appendMessage(new TextMessage({ content: transcript, role: Role.User }));
        } finally {
          setVoiceBusy(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceError("Mic permission denied.");
    }
  }, [language, setLanguage, handleUserMessage, appendMessage]);

  return (
    <div className="flex h-full flex-col">
      {/* Sarvam voice bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>🌐</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500"
          >
            {TUTOR_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
                {l.code === "en-IN" ? "" : ` · ${l.label}`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={voiceBusy}
          title="Ask by voice (Sarvam speech-to-text)"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
            recording
              ? "border-red-500 bg-red-500/15 text-red-300"
              : "border-neutral-700 text-neutral-300 hover:border-indigo-500 hover:text-indigo-300"
          }`}
        >
          <span>{recording ? "⏺" : "🎤"}</span>
          {recording ? "Stop" : voiceBusy ? "…" : "Speak"}
        </button>

        <button
          type="button"
          onClick={() => {
            const turningOn = !speakReplies;
            setSpeakReplies(turningOn);
            if (turningOn) {
              // Unlock autoplay within this user gesture, then speak the most
              // recent reply right away (future replies use the same element).
              const audio = getAudio();
              audio.src = SILENT_WAV;
              audio.play().catch(() => {});
              const text = latestReplyText();
              if (text && text !== greetingRef.current) {
                lastSpokenRef.current = text;
                void speak(text);
              }
            } else {
              audioRef.current?.pause();
            }
          }}
          title="Read the tutor's replies aloud (Sarvam text-to-speech)"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
            speakReplies
              ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
              : "border-neutral-700 text-neutral-300 hover:border-indigo-500 hover:text-indigo-300"
          }`}
        >
          <span>{speakReplies ? "🔊" : "🔈"}</span>
          Speak replies
        </button>

        {voiceError && <span className="text-xs text-red-400">{voiceError}</span>}
        <span className="ml-auto text-[10px] text-neutral-600">voice by Sarvam AI</span>
      </div>

      {/* Previous conversation — reloaded from the DB on revisit. */}
      {history.length > 0 && (
        <div className="border-b border-neutral-800 bg-neutral-900/40">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200"
          >
            <span className={`transition ${showHistory ? "rotate-90" : ""}`}>▸</span>
            Previous conversation ({history.length} message{history.length === 1 ? "" : "s"})
          </button>
          {showHistory && (
            <div className="max-h-72 space-y-2 overflow-y-auto px-4 pb-3">
              {history.map((m, i) => (
                <div key={i} className={m.role === "USER" ? "text-right" : "text-left"}>
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-left text-sm ${
                      m.role === "USER"
                        ? "bg-neutral-800 text-neutral-100"
                        : "bg-neutral-900 text-neutral-300"
                    }`}
                  >
                    {m.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={chatRef} className="min-h-0 flex-1">
        <CopilotChat
          instructions={buildInstructions(mode)}
          onSubmitMessage={handleUserMessage}
          labels={{
            initial:
              "Hi! Ask me anything about this problem — I'll guide you with hints, not spoilers. You can also ask by voice in your language.",
            placeholder: "Ask the tutor…",
          }}
          className="h-full"
        />
      </div>
    </div>
  );
}

interface RunResult {
  status: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
}

/**
 * Run the C++ code in the editor against a sample input via Judge0, in-browser.
 */
function RunPanel({ code, authed }: { code: string; authed: boolean }) {
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!code.trim()) {
      setError("Write some C++ code first.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Run failed.");
        return;
      }
      setResult(data as RunResult);
    } catch {
      setError("Run failed — try again.");
    } finally {
      setRunning(false);
    }
  };

  if (!authed) return null;

  const accepted = result?.status === "Accepted";
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-sm text-neutral-400">
          Input (stdin) <span className="text-neutral-600">— paste a sample input</span>
        </label>
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {running ? "Running…" : "▶ Run C++"}
        </button>
      </div>
      <textarea
        value={stdin}
        onChange={(e) => setStdin(e.target.value)}
        placeholder="e.g.&#10;15 10"
        spellCheck={false}
        className="h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 font-mono text-sm text-neutral-200 outline-none focus:border-sky-500"
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                accepted
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {result.status}
            </span>
            {result.time != null && (
              <span className="text-xs text-neutral-500">{result.time}s</span>
            )}
            {result.memory != null && (
              <span className="text-xs text-neutral-500">
                {Math.round(result.memory / 1024)} MB
              </span>
            )}
          </div>

          {result.stdout && (
            <div>
              <div className="mb-1 text-xs text-neutral-500">Output</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-neutral-200">
                {result.stdout}
              </pre>
            </div>
          )}
          {result.compileOutput && (
            <div>
              <div className="mb-1 text-xs text-amber-400">Compile error</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-amber-200">
                {result.compileOutput}
              </pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <div className="mb-1 text-xs text-red-400">Runtime error / stderr</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-red-200">
                {result.stderr}
              </pre>
            </div>
          )}
          {!result.stdout && !result.compileOutput && !result.stderr && (
            <p className="text-xs text-neutral-500">(no output)</p>
          )}
        </div>
      )}
    </div>
  );
}
