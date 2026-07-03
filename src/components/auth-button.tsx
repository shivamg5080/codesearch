import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getUsage } from "@/lib/usage";

export async function AuthButton() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="rounded-lg bg-[#6d7cff] px-3.5 py-1.5 text-sm font-semibold text-[#0b0c10] transition hover:bg-[#8490ff]"
      >
        Sign in
      </Link>
    );
  }

  const usage = await getUsage(session.user.id);
  const name = session.user.name ?? session.user.email ?? "";
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="flex items-center gap-3.5">
      <Link
        href="/dashboard"
        className="text-[12.5px] text-[#8b8e98] transition hover:text-[#e8e9ee]"
      >
        Dashboard
      </Link>
      <div
        className="hidden items-center gap-[7px] sm:flex"
        title={`${usage.count} of ${usage.cap} tutor messages used today`}
      >
        <span className="font-mono text-[11px] text-[#8b8e98]">
          {usage.count}/{usage.cap} today
        </span>
        <div className="h-1 w-11 overflow-hidden rounded-sm bg-white/10">
          <div
            className="h-full bg-[#8b8e98]"
            style={{ width: `${Math.min(100, (usage.count / usage.cap) * 100)}%` }}
          />
        </div>
      </div>
      <div
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/[0.14] bg-[#1b1d27] text-[11px] font-semibold text-[#e8e9ee]"
        title={name}
      >
        {initials}
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="text-[12.5px] text-[#8b8e98] transition hover:text-[#e8e9ee]">
          Sign out
        </button>
      </form>
    </div>
  );
}
