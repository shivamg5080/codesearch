"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import {
  CopilotChat,
  Markdown,
  type AssistantMessageProps,
  type UserMessageProps,
  type InputProps,
} from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import "@copilotkit/react-ui/styles.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { buildInstructions, type TutorMode } from "@/prompts";
import { TUTOR_LANGUAGES } from "@/lib/languages";
import { useVoice } from "./use-voice";
import type { ChatHistoryMessage, TutorProvider } from "./tutor-workspace";

const PROVIDERS: { id: TutorProvider; label: string }[] = [
  { id: "sarvam", label: "Sarvam AI" },
  { id: "openai", label: "OpenAI" },
];

const STARTERS = [
  "What is this problem really asking?",
  "Nudge me — smallest hint",
  "क्या मैं हिंदी में पूछ सकता हूँ?",
];

/* ------------------------------------------------------------------ */
/* Custom CopilotKit subcomponents (module-level so they stay stable). */
/* ------------------------------------------------------------------ */

/** AG-UI message content is string | content-part[]; flatten to plain text. */
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === "object" && "text" in p ? String((p as { text?: unknown }).text ?? "") : "",
      )
      .join("");
  }
  return "";
}

function TutorMessage({ message, isLoading, isCurrentMessage }: AssistantMessageProps) {
  const content = messageText(message?.content);
  const thinking = !content.trim() && !!isLoading && !!isCurrentMessage;
  if (!content.trim() && !thinking) return null;
  return (
    <div className="mb-3 flex max-w-[88%] flex-col gap-2 self-start rounded-xl border border-white/[0.06] border-l-2 border-l-[#6d7cff] bg-[#191b24] px-[15px] py-3">
      <div className="flex items-center gap-2">
        <span className="h-[7px] w-[7px] rounded-full bg-[#6d7cff]" />
        <span className="font-mono text-[10px] text-[#8b8e98]">TUTOR</span>
      </div>
      {thinking ? (
        <span className="flex items-center gap-2 py-1" aria-label="The tutor is thinking">
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6d7cff]"
                style={{ animationDelay: `${i * 220}ms` }}
              />
            ))}
          </span>
          <span className="font-mono text-[11px] text-[#8b8e98]">thinking</span>
        </span>
      ) : (
        <div className="tutor-markdown text-[13.5px] leading-relaxed text-[#d7d9e0]">
          <Markdown content={content} />
        </div>
      )}
    </div>
  );
}

function LearnerMessage({ message }: UserMessageProps) {
  const content = messageText(message?.content);
  if (!content) return null;
  return (
    <div className="mb-3 max-w-[78%] self-end rounded-xl border border-white/[0.08] bg-[#0e0f14] px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-[#d7d9e0]">
      {content}
    </div>
  );
}

/* The composer needs live chat-panel state; a context keeps the component
   identity stable across renders (an inline component would remount and drop
   the draft text on every keystroke). */
interface ComposerState {
  language: string;
  setLanguage: (code: string) => void;
  provider: TutorProvider;
  setProvider: (p: TutorProvider) => void;
  speakReplies: boolean;
  toggleSpeakReplies: () => void;
  recording: boolean;
  voiceBusy: boolean;
  voiceError: string | null;
  startRecording: () => void;
  stopRecording: () => void;
}
const ComposerContext = createContext<ComposerState | null>(null);

function Composer({ inProgress, onSend, onStop }: InputProps) {
  const ctx = useContext(ComposerContext);
  const [text, setText] = useState("");
  if (!ctx) return null;

  // onSend runs CopilotChat's onSubmitMessage (activity tracking) itself —
  // don't log here or the message gets recorded twice.
  const send = () => {
    const t = text.trim();
    if (!t || inProgress) return;
    setText("");
    void onSend(t);
  };

  const quiet =
    "h-8 rounded-md bg-transparent px-2 font-mono text-[11px] text-[#8b8e98] transition hover:bg-white/[0.06] hover:text-[#e8e9ee]";

  return (
    <div className="flex flex-col gap-[7px] px-5 pb-4 pt-3">
      {ctx.voiceError && (
        <span className="px-2 font-mono text-[10.5px] text-[#f87171]">{ctx.voiceError}</span>
      )}
      <div className="flex flex-col gap-1 rounded-2xl border border-white/[0.12] bg-[#1b1d27] px-3 pb-2 pt-3 focus-within:border-[#6d7cff]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask the tutor…"
          rows={Math.min(4, Math.max(1, text.split("\n").length))}
          className="w-full resize-none bg-transparent px-1 text-[13.5px] leading-relaxed text-[#e8e9ee] outline-none placeholder:text-[#6b6e79]"
        />
        <div className="flex items-center gap-1">
          {/* Language + model, quiet selects (Claude-composer style) */}
          <div className="relative">
            <select
              value={ctx.language}
              onChange={(e) => ctx.setLanguage(e.target.value)}
              title="Tutor language"
              className={`${quiet} cursor-pointer appearance-none pr-5`}
            >
              {TUTOR_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#1b1d27]">
                  {l.native}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-[#8b8e98]">
              ▾
            </span>
          </div>
          <div className="relative">
            <select
              value={ctx.provider}
              onChange={(e) => ctx.setProvider(e.target.value as TutorProvider)}
              title="Which AI model answers"
              className={`${quiet} cursor-pointer appearance-none pr-5`}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1b1d27]">
                  {p.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-[#8b8e98]">
              ▾
            </span>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={ctx.recording ? ctx.stopRecording : ctx.startRecording}
            disabled={ctx.voiceBusy}
            title="Speak your question (Sarvam speech-to-text)"
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] transition disabled:opacity-50 ${
              ctx.recording
                ? "bg-[#f87171]/15 text-[#f87171]"
                : "text-[#8b8e98] hover:bg-white/[0.06] hover:text-[#e8e9ee]"
            }`}
          >
            {ctx.recording ? "⏺ stop" : ctx.voiceBusy ? "…" : "🎤"}
          </button>
          <button
            type="button"
            onClick={ctx.toggleSpeakReplies}
            title="Read replies aloud (Sarvam text-to-speech)"
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[11px] transition ${
              ctx.speakReplies
                ? "bg-[#6d7cff]/15 text-[#aab2ff]"
                : "text-[#8b8e98] hover:bg-white/[0.06] hover:text-[#e8e9ee]"
            }`}
          >
            {ctx.speakReplies ? "🔊" : "🔈"}
          </button>
          {inProgress ? (
            <button
              type="button"
              onClick={() => onStop?.()}
              title="Stop generating"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm text-[#e8e9ee] transition hover:bg-white/20"
            >
              ◼
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!text.trim()}
              title="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6d7cff] text-[15px] font-bold text-[#0b0c10] transition hover:bg-[#8490ff] disabled:opacity-40"
            >
              ↑
            </button>
          )}
        </div>
      </div>
      <div className="text-center font-mono text-[10.5px] text-[#6b6e79]">
        Ask by text or voice · 11 Indian languages
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The tutor room's chat: previous-conversation drawer, CopilotChat with custom
 * bubbles, starter chips for the empty state, and the composer (language,
 * model, mic and speak-replies controls live inside it).
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
  const [hasChatted, setHasChatted] = useState(false);

  // Last completed (real) assistant reply — never the static greeting, since
  // capture only runs after a generation finishes.
  const lastReplyRef = useRef<{ id: string; content: string } | null>(null);

  const handleUserMessage = useCallback(
    (message: string) => {
      setHasChatted(true);
      trackActivity(message);
    },
    [trackActivity],
  );

  // appendMessage triggers onSubmitMessage internally — no manual tracking here.
  const voice = useVoice({
    language,
    onDetectLanguage: setLanguage,
    onTranscript: async (transcript) => {
      await appendMessage(new TextMessage({ content: transcript, role: Role.User }));
    },
  });
  const { speak, unlockAudio, pauseAudio } = voice;

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

  // Capture each completed assistant reply from the message store: when
  // isLoading flips false a generation just finished. Persist + speak it.
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const finished = prevLoadingRef.current && !isLoading;
    prevLoadingRef.current = isLoading;
    if (!finished) return;

    // visibleMessages can be undefined (and its entries plain objects) while
    // the runtime connection is still settling — guard, don't trust the types.
    const last = [...(visibleMessages ?? [])]
      .reverse()
      .find(
        (m): m is TextMessage =>
          typeof m?.isTextMessage === "function" &&
          m.isTextMessage() &&
          m.role === Role.Assistant &&
          !!m.content.trim(),
      );
    if (!last || last.id === lastReplyRef.current?.id) return;

    lastReplyRef.current = { id: last.id, content: last.content };
    logAssistantReply(last.content);
    if (speakReplies) void speak(last.content);
  }, [isLoading, visibleMessages, logAssistantReply, speak, speakReplies]);

  const toggleSpeakReplies = useCallback(() => {
    setSpeakReplies((prev) => {
      const turningOn = !prev;
      if (turningOn) {
        // Unlock autoplay within this user gesture, then speak the most
        // recent reply right away (future replies reuse the same element).
        unlockAudio();
        if (lastReplyRef.current) void speak(lastReplyRef.current.content);
      } else {
        pauseAudio();
      }
      return turningOn;
    });
  }, [unlockAudio, pauseAudio, speak]);

  const sendStarter = (text: string) => {
    void appendMessage(new TextMessage({ content: text, role: Role.User }));
  };

  const composerState: ComposerState = {
    language,
    setLanguage,
    provider,
    setProvider,
    speakReplies,
    toggleSpeakReplies,
    recording: voice.recording,
    voiceBusy: voice.voiceBusy,
    voiceError: voice.voiceError,
    startRecording: voice.startRecording,
    stopRecording: voice.stopRecording,
  };

  return (
    <ComposerContext.Provider value={composerState}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Previous conversation drawer */}
        {history.length > 0 && (
          <div className="flex-none px-5 pt-3">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="flex w-full items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#181a22] px-3.5 py-2 text-left transition hover:border-white/[0.18]"
            >
              <span className="font-mono text-[11px] text-[#8b8e98]">
                Previous conversation ({history.length} message{history.length === 1 ? "" : "s"})
              </span>
              <span className="flex-1" />
              <span className="text-[10px] text-[#8b8e98]">{showHistory ? "▴" : "▾"}</span>
            </button>
            {showHistory && (
              <div className="mt-1.5 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-[10px] border border-white/[0.06] bg-[#171922] px-3.5 py-2.5">
                {history.map((m, i) => (
                  <div key={i} className="text-xs leading-normal text-[#8b8e98]">
                    <span className="font-mono text-[10px] text-[#6b6e79]">
                      {m.role === "USER" ? "YOU · " : "TUTOR · "}
                    </span>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat + starter chips */}
        <div className="tutor-chat relative min-h-0 flex-1">
          <CopilotChat
            instructions={buildInstructions(mode)}
            onSubmitMessage={handleUserMessage}
            labels={{
              initial:
                "Ready when you are. I'll guide you with progressive hints — observations before approaches, never the answer first. Ask in any of 11 Indian languages, by text or voice.",
            }}
            AssistantMessage={TutorMessage}
            UserMessage={LearnerMessage}
            Input={Composer}
            className="flex h-full flex-col"
          />
          {!hasChatted && (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 flex flex-col items-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendStarter(s)}
                  className="pointer-events-auto rounded-full border border-white/[0.12] bg-[#1b1d27] px-4 py-2 text-[12.5px] text-[#c6c8d0] transition hover:border-[#6d7cff] hover:text-[#e8e9ee]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ComposerContext.Provider>
  );
}
