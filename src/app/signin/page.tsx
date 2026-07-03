import Link from "next/link";
import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.46H12v4.65h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#e8e9ee" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Ambient gradient blobs in the workbench palette (indigo / amber / emerald). */
function Blobs() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="signin-blob -right-10 top-16 h-44 w-52 opacity-70"
        style={{
          background: "radial-gradient(ellipse at 30% 30%, #8490ff, #6d7cff 45%, #2a2f66 90%)",
          borderRadius: "58% 42% 55% 45% / 45% 58% 42% 55%",
          animationDelay: "0s",
        }}
      />
      <div
        className="signin-blob right-24 top-[45%] h-32 w-36 opacity-60"
        style={{
          background: "radial-gradient(ellipse at 35% 25%, #ffd57a, #f5b942 50%, #6e5218 95%)",
          borderRadius: "45% 55% 62% 38% / 55% 45% 55% 45%",
          animationDelay: "-3s",
        }}
      />
      <div
        className="signin-blob -left-8 bottom-24 h-52 w-56 opacity-60"
        style={{
          background: "radial-gradient(ellipse at 35% 30%, #6ee7b4, #34d399 45%, #14543c 90%)",
          borderRadius: "40% 60% 48% 52% / 62% 38% 62% 38%",
          animationDelay: "-6s",
        }}
      />
      <div
        className="signin-blob bottom-40 left-36 h-24 w-28 opacity-50"
        style={{
          background: "radial-gradient(ellipse at 30% 30%, #b0a8ff, #6d7cff 55%, #23264d 95%)",
          borderRadius: "52% 48% 40% 60% / 48% 52% 48% 52%",
          animationDelay: "-1.5s",
        }}
      />
    </div>
  );
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const to = callbackUrl || "/";
  if (session?.user) redirect(to);

  const devLogin = process.env.AUTH_DEV_LOGIN === "true";
  const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const hasGitHub = !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

  const oauthBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/[0.12] bg-[#12131a] px-4 py-2.5 text-sm font-medium text-[#e8e9ee] transition hover:border-white/25 hover:bg-[#171922]";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c10] px-6 text-[#e8e9ee] [color-scheme:dark]">
      <Blobs />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6d7cff] text-[#0b0c10]">
            ⚡
          </span>
          <span className="text-[15px] font-semibold tracking-tight">CodeSearch</span>
        </Link>
        <Link
          href="/"
          className="font-mono text-xs text-[#8b8e98] transition hover:text-[#e8e9ee]"
        >
          ← All problems
        </Link>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f1015]/95 px-8 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:px-10">
        <h1 className="mb-8 text-center text-[34px] font-extrabold tracking-[-0.03em]">
          Log in
        </h1>

        <div className="space-y-3">
          {hasGoogle && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: to });
              }}
            >
              <button className={oauthBtn}>
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          )}
          {hasGitHub && (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: to });
              }}
            >
              <button className={oauthBtn}>
                <GitHubIcon />
                Continue with GitHub
              </button>
            </form>
          )}

          {devLogin && (
            <>
              {(hasGitHub || hasGoogle) && (
                <div className="flex items-center gap-3 py-2 font-mono text-[10px] text-[#6b6e79]">
                  <div className="h-px flex-1 bg-white/[0.08]" />
                  or
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>
              )}
              <form
                action={async (formData) => {
                  "use server";
                  await signIn("dev", {
                    email: formData.get("email"),
                    redirectTo: to,
                  });
                }}
                className="space-y-6"
              >
                <div className="rounded-lg border border-white/[0.12] bg-[#0b0c10] px-4 py-3 transition focus-within:border-[#6d7cff]">
                  <label
                    htmlFor="signin-email"
                    className="block font-mono text-[10px] tracking-[0.14em] text-[#8b8e98]"
                  >
                    EMAIL
                  </label>
                  <input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="yourname@email.com"
                    className="mt-1 w-full bg-transparent text-sm text-[#e8e9ee] outline-none placeholder:text-[#4d505c]"
                  />
                </div>

                {/* Split log-in button */}
                <div className="flex justify-center">
                  <button className="group flex items-stretch gap-1.5" title="Log in">
                    <span className="flex -skew-x-12 items-center rounded-lg bg-[#6d7cff] px-7 py-2.5 transition group-hover:bg-[#8490ff]">
                      <span className="skew-x-12 text-sm font-semibold text-[#0b0c10]">
                        Log in
                      </span>
                    </span>
                    <span className="flex -skew-x-12 items-center rounded-lg bg-[#6d7cff] px-3.5 transition group-hover:translate-x-0.5 group-hover:bg-[#8490ff]">
                      <span className="skew-x-12 text-sm font-bold text-[#0b0c10]">→</span>
                    </span>
                  </button>
                </div>
                <p className="text-center font-mono text-[10.5px] text-[#6b6e79]">
                  dev login — local testing only, no password
                </p>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-[#8b8e98]">
          New here? Signing in creates your account — free, hints included.
        </p>
      </div>
    </main>
  );
}
