import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { sarvamSTT } from "@/lib/sarvam";

export const runtime = "nodejs";
export const maxDuration = 30;

// Speech-to-text for voice input. Accepts multipart/form-data with `file`
// (audio) and optional `language_code` ("unknown" = auto-detect).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to use voice." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "No audio provided." }, { status: 400 });
  }
  const languageCode = (form.get("language_code") as string) || "unknown";

  try {
    const result = await sarvamSTT(file, languageCode);
    return Response.json(result);
  } catch (err) {
    console.error("STT error:", err);
    return Response.json({ error: "Transcription failed." }, { status: 502 });
  }
}
