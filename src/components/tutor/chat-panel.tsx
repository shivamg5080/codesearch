"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import "@copilotkit/react-ui/styles.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildInstructions, type TutorMode } from "@/prompts";
import { TUTOR_LANGUAGES } from "@/lib/languages";
import { useVoice } from "./use-voice";
import type { ChatHistoryMessage, TutorProvider } from "./tutor-workspace";

const PROVIDERS: { id: TutorProvider; label: string }[] = [
  { id: "sarvam", label: "Sarvam AI" },
  { id: "openai", label: "OpenAI" },
];

/**
 * The tutor chat: CopilotChat + the Sarvam voice bar (language, mic, speak-replies,
 * model picker) + collapsible previous-conversation history.
 *
 * Completed assistant replies are read from CopilotKit's message store (the
 * `isLoading` false-transition marks a finished generation) — they're persisted
 * for reload and optionally spoken via TTS.
 */
export function ChatPanel({
  problemId,
  mode,
  language,
  setLanguage,
  trackActivity,
  history,
  provider,
  setProvider,
}: {
  problemId: string;
  mode: TutorMode;
  language: string;
  setLanguage: (code: string) => void;
  trackActivity: (message: string) => void;
  history: ChatHistoryMessage[];
  provider: TutorProvider;
  setProvider: (p: TutorProvider) => void;
}) {
  const { visibleMessages, isLoading, appendMessage } = useCopilotChat();

  const [speakReplies, setSpeakReplies] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Last completed (real) assistant reply — never the static greeting, since
  // capture only runs after a generation finishes.
  const lastReplyRef = useRef<{ id: string; content: string } | null>(null);

  // Mark Attempting + log the learner's message.
  const handleUserMessage = useCallback(
    (message: string) => trackActivity(message),
    [trackActivity],
  );

  const voice = useVoice({
    language,
    onDetectLanguage: setLanguage,
    onTranscript: async (transcript) => {
      handleUserMessage(transcript);
      await appendMessage(new TextMessage({ content: transcript, role: Role.User }));
    },
  });
  const { speak } = voice;

  // Persist an assistant reply so it reloads next time.
  const logAssistantReply = useCallback(
    (content: string) => {
      fetch(`/api/problems/${problemId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, role: "assistant", mode }),
      }).catch(() => {});
    },
    [problemId, mode],
  );

  // --- Capture each completed assistant reply from the message store. ---
  // When isLoading flips false a generation just finished; the newest assistant
  // text message is the reply. Persist it, and speak it if enabled.
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const finished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!finished) return;

    const last = [...visibleMessages]
      .reverse()
      .find(
        (m): m is TextMessage =>
          m.isTextMessage() && m.role === Role.Assistant && !!m.content.trim(),
      );
    if (!last || last.id === lastReplyRef.current?.id) return;

    lastReplyRef.current = { id: last.id, content: last.content };
    logAssistantReply(last.content);
    if (speakReplies) void speak(last.content);
  }, [isLoading, visibleMessages, logAssistantReply, speak, speakReplies]);

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

        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>🤖</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as TutorProvider)}
            title="Choose which AI model answers"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={voice.recording ? voice.stopRecording : voice.startRecording}
          disabled={voice.voiceBusy}
          title="Ask by voice (Sarvam speech-to-text)"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
            voice.recording
              ? "border-red-500 bg-red-500/15 text-red-300"
              : "border-neutral-700 text-neutral-300 hover:border-indigo-500 hover:text-indigo-300"
          }`}
        >
          <span>{voice.recording ? "⏺" : "🎤"}</span>
          {voice.recording ? "Stop" : voice.voiceBusy ? "…" : "Speak"}
        </button>

        <button
          type="button"
          onClick={() => {
            const turningOn = !speakReplies;
            setSpeakReplies(turningOn);
            if (turningOn) {
              // Unlock autoplay within this user gesture, then speak the most
              // recent reply right away (future replies use the same element).
              voice.unlockAudio();
              if (lastReplyRef.current) void speak(lastReplyRef.current.content);
            } else {
              voice.pauseAudio();
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

        {voice.voiceError && <span className="text-xs text-red-400">{voice.voiceError}</span>}
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

      <div className="min-h-0 flex-1">
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
