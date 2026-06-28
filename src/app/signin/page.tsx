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
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold">
          Sign in to <span className="text-indigo-400">CodeSearch</span>
        </h1>
        <p className="mt-1 mb-6 text-sm text-neutral-400">
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
              <button className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 font-medium hover:border-neutral-500">
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
              <button className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 font-medium hover:border-neutral-500">
                Continue with Google
              </button>
            </form>
          )}

          {devLogin && (
            <>
              {(hasGitHub || hasGoogle) && (
                <div className="flex items-center gap-3 py-1 text-xs text-neutral-600">
                  <div className="h-px flex-1 bg-neutral-800" />
                  or
                  <div className="h-px flex-1 bg-neutral-800" />
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
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 outline-none focus:border-indigo-500"
                />
                <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium hover:bg-indigo-500">
                  Continue with email (dev)
                </button>
              </form>
              <p className="text-xs text-neutral-600">
                Dev login is enabled for local testing — no password, no OAuth setup needed.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
