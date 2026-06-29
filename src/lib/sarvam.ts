// Server-only Sarvam AI client: speech-to-text (saaras) + text-to-speech
// (bulbul). Powers vernacular voice tutoring. Auth header is
// `api-subscription-key`; never import this from a client component.

const SARVAM_BASE = "https://api.sarvam.ai";

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY is not set");
  return key;
}

export interface SttResult {
  transcript: string;
  languageCode: string | null;
}

/**
 * Transcribe an audio blob. `languageCode` may be "unknown" to auto-detect.
 * Returns the text plus the detected BCP-47 language (so the UI can switch the
 * tutor into that language automatically).
 */
export async function sarvamSTT(
  audio: Blob,
  languageCode = "unknown",
): Promise<SttResult> {
  const form = new FormData();
  // Sarvam infers format from the filename extension; webm is what the browser
  // MediaRecorder produces by default.
  form.append("file", audio, "audio.webm");
  form.append("model", "saaras:v3");
  form.append("language_code", languageCode);

  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": apiKey() },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Sarvam STT failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    transcript?: string;
    language_code?: string | null;
  };
  return {
    transcript: data.transcript ?? "",
    languageCode: data.language_code ?? null,
  };
}

/**
 * Convert text to speech in the given language. Returns a single base64-encoded
 * WAV string (Sarvam splits long text into multiple chunks, which we
 * concatenate at the client by playing them in sequence — but we cap length so
 * one chunk suffices here).
 */
export async function sarvamTTS(
  text: string,
  targetLanguageCode: string,
  speaker = "anushka",
): Promise<string[]> {
  const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      target_language_code: targetLanguageCode,
      speaker,
      model: "bulbul:v2",
      output_audio_codec: "wav",
    }),
  });
  if (!res.ok) {
    throw new Error(`Sarvam TTS failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { audios?: string[] };
  return data.audios ?? [];
}
