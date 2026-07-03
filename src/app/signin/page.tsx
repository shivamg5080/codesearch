import Link from "next/link";
import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0c10] px-6 text-[#e8e9ee]">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-mono text-xs text-[#8b8e98] hover:text-[#e8e9ee]">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold">
          Sign in to <span className="text-[#aab2ff]">CodeSearch</span>
        </h1>
        <p className="mt-1 mb-6 text-sm text-[#8b8e98]">
          Sign in to use the AI tutor and save your progress.
        </p>

        <div className="space-y-3">
          {hasGitHub && (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: to });
              }}
            >
              <button className="w-full rounded-lg border border-white/[0.12] bg-[#0f1015] px-4 py-2.5 font-medium text-[#e8e9ee] transition hover:border-white/25">
                Continue with GitHub
              </button>
            </form>
          )}
          {hasGoogle && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: to });
              }}
            >
              <button className="w-full rounded-lg border border-white/[0.12] bg-[#0f1015] px-4 py-2.5 font-medium text-[#e8e9ee] transition hover:border-white/25">
                Continue with Google
              </button>
            </form>
          )}

          {devLogin && (
            <>
              {(hasGitHub || hasGoogle) && (
                <div className="flex items-center gap-3 py-1 font-mono text-[10px] text-[#6b6e79]">
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
                className="space-y-2"
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/[0.10] bg-[#0f1015] px-4 py-2.5 text-[#e8e9ee] outline-none placeholder:text-[#6b6e79] focus:border-[#6d7cff]"
                />
                <button className="w-full rounded-lg bg-[#6d7cff] px-4 py-2.5 font-semibold text-[#0b0c10] transition hover:bg-[#8490ff]">
                  Continue with email (dev)
                </button>
              </form>
              <p className="font-mono text-[10.5px] text-[#6b6e79]">
                Dev login is enabled for local testing — no password, no OAuth setup needed.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
