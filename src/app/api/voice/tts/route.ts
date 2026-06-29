import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { sarvamTTS } from "@/lib/sarvam";
import { isSupportedLanguage } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 30;

// bulbul:v2 caps a request at 1500 chars; leave headroom.
const MAX_TTS_CHARS = 1400;

/**
 * Strip markdown/code/LaTeX so the spoken reply sounds natural — code blocks and
 * formulae don't read well aloud, so we drop them and speak the prose.
 */
function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code block) ") // fenced code
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // block math
    .replace(/\$[^$]*\$/g, " ") // inline math
    .replace(/[*_#>~|]/g, "") // markdown punctuation
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/\s+/g, " ")
    .trim();
}

// Text-to-speech for spoken tutor replies. Body: { text, language }.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to use voice." }, { status: 401 });
  }

  const { text, language } = (await req.json().catch(() => ({}))) as {
    text?: string;
    language?: string;
  };
  if (!text?.trim()) {
    return Response.json({ error: "No text provided." }, { status: 400 });
  }
  const lang = language && isSupportedLanguage(language) ? language : "en-IN";
  const clean = speakable(text).slice(0, MAX_TTS_CHARS);
  if (!clean) {
    return Response.json({ audios: [] });
  }

  try {
    const audios = await sarvamTTS(clean, lang);
    return Response.json({ audios });
  } catch (err) {
    console.error("TTS error:", err);
    return Response.json({ error: "Speech synthesis failed." }, { status: 502 });
  }
}
