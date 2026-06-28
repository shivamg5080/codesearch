import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getUsage } from "@/lib/usage";

export async function AuthButton() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Sign in
      </Link>
    );
  }

  const usage = await getUsage(session.user.id);

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
        Dashboard
      </Link>
      <span className="hidden text-neutral-500 sm:inline">
        {usage.count}/{usage.cap} today
      </span>
      <span className="hidden text-neutral-300 sm:inline">
        {session.user.name ?? session.user.email}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-neutral-500">
          Sign out
        </button>
      </form>
    </div>
  );
}
