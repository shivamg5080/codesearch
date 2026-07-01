"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupportedLanguage } from "@/lib/languages";

// A valid (silent) WAV so the first play during a click actually resolves and
// grants autoplay permission for later programmatic plays.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Sarvam voice I/O for the tutor chat:
 *  - `speak(text)`   → /api/voice/tts (bulbul), played on one persistent <audio>
 *    element that gets autoplay-unlocked via `unlockAudio()` inside a user gesture.
 *  - `startRecording`/`stopRecording` → mic capture → /api/voice/stt (saaras),
 *    then `onTranscript` with the text; `onDetectLanguage` when STT auto-detects
 *    a supported language different from the current one.
 */
export function useVoice({
  language,
  onTranscript,
  onDetectLanguage,
}: {
  language: string;
  onTranscript: (text: string) => void | Promise<void>;
  onDetectLanguage: (code: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // One persistent <audio> element, reused for every reply. Browsers grant
  // autoplay to an element that was first played during a user gesture.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest language, readable from long-lived callbacks (recorder.onstop).
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }, []);

  /** Call inside a click handler to grant autoplay to the shared element. */
  const unlockAudio = useCallback(() => {
    const audio = getAudio();
    audio.src = SILENT_WAV;
    audio.play().catch(() => {});
  }, [getAudio]);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
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

  // --- Mic: record → Sarvam STT → onTranscript. ---
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
          form.append(
            "language_code",
            languageRef.current === "en-IN" ? "unknown" : languageRef.current,
          );
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
          if (
            languageCode &&
            languageCode !== languageRef.current &&
            isSupportedLanguage(languageCode)
          ) {
            onDetectLanguage(languageCode);
          }
          await onTranscript(transcript);
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
  }, [onTranscript, onDetectLanguage]);

  return {
    recording,
    voiceBusy,
    voiceError,
    speak,
    unlockAudio,
    pauseAudio,
    startRecording,
    stopRecording,
  };
}
