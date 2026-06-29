// Languages the tutor supports for vernacular voice/text. Codes are BCP-47 as
// required by Sarvam (TTS supports these 11; STT supports more + auto-detect).
// Client-safe (no secrets) so both UI and server can import it.

export interface TutorLanguage {
  code: string; // BCP-47, e.g. "hi-IN"
  label: string; // English name
  native: string; // endonym, shown in the picker
}

export const TUTOR_LANGUAGES: TutorLanguage[] = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "od-IN", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
];

export const DEFAULT_LANGUAGE = "en-IN";

export function languageLabel(code: string): string {
  return TUTOR_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function isSupportedLanguage(code: string): boolean {
  return TUTOR_LANGUAGES.some((l) => l.code === code);
}
