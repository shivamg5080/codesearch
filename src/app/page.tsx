import Link from "next/link";
import type { Source } from "@prisma/client";
import { searchProblems, getTopTags } from "@/lib/problems";
import { getStatusMap } from "@/lib/progress";
import { AuthButton } from "@/components/auth-button";
import { auth } from "@/auth";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SOLVED: { label: "✓ Solved", cls: "bg-emerald-500/15 text-emerald-300" },
  ATTEMPTING: { label: "In progress", cls: "bg-amber-500/15 text-amber-300" },
  BOOKMARKED: { label: "☆", cls: "bg-indigo-500/15 text-indigo-300" },
};

const SOURCE_PARAM: Record<string, Source> = {
  cf: "CODEFORCES",
  cc: "CODECHEF",
  lc: "LEETCODE",
  cses: "CSES",
};

const SOURCE_LABEL: Record<Source, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

// LeetCode has no numeric rating — show its tier word; others show their rating.
function difficultyBadge(p: {
  source: Source;
  difficultyRaw: number | null;
  difficultyNormalized: number | null;
}): string {
  if (p.source === "LEETCODE") {
    const d = p.difficultyNormalized ?? 5;
    return d <= 2 ? "Easy" : d <= 5 ? "Medium" : "Hard";
  }
  return p.difficultyRaw != null ? String(p.difficultyRaw) : `D${p.difficultyNormalized}`;
}

const DIFF_COLORS: Record<number, string> = {
  1: "bg-emerald-500/15 text-emerald-300",
  2: "bg-emerald-500/15 text-emerald-300",
  3: "bg-teal-500/15 text-teal-300",
  4: "bg-sky-500/15 text-sky-300",
  5: "bg-blue-500/15 text-blue-300",
  6: "bg-indigo-500/15 text-indigo-300",
  7: "bg-violet-500/15 text-violet-300",
  8: "bg-fuchsia-500/15 text-fuchsia-300",
  9: "bg-rose-500/15 text-rose-300",
  10: "bg-red-500/15 text-red-300",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    source?: string;
    min?: string;
    max?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q,
    tag: sp.tag,
    source: sp.source ? SOURCE_PARAM[sp.source] : undefined,
    minDiff: sp.min ? Number(sp.min) : undefined,
    maxDiff: sp.max ? Number(sp.max) : undefined,
    page: sp.page ? Number(sp.page) : 1,
  };
  const [{ problems, total, page, pageSize }, tagOptions, session] = await Promise.all([
    searchProblems(filters),
    getTopTags(filters.source),
    auth(),
  ]);
  const totalPages = Math.ceil(total / pageSize);
  const statusMap = session?.user?.id
    ? await getStatusMap(session.user.id, problems.map((p) => p.id))
    : {};

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              CodeSearch <span className="text-indigo-400">2.0</span>
            </h1>
            <p className="mt-1 text-neutral-400">
              Pick a problem and learn it with an AI tutor — hints, not spoilers.
            </p>
          </div>
          <AuthButton />
        </header>

        <form className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search problems by title…"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 outline-none focus:border-indigo-500"
          />
          <select
            name="source"
            defaultValue={sp.source ?? ""}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 outline-none focus:border-indigo-500"
          >
            <option value="">All sources</option>
            <option value="cf">Codeforces</option>
            <option value="cc">CodeChef</option>
            <option value="lc">LeetCode</option>
            <option value="cses">CSES</option>
          </select>
          <select
            name="tag"
            defaultValue={sp.tag ?? ""}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 outline-none focus:border-indigo-500"
          >
            <option value="">All tags</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            name="min"
            defaultValue={sp.min ?? ""}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 outline-none focus:border-indigo-500"
          >
            <option value="">Any difficulty</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
              <option key={d} value={d}>
                Min diff {d}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500"
          >
            Search
          </button>
        </form>

        <p className="mb-4 text-sm text-neutral-500">
          {total.toLocaleString()} problems
          {sp.q ? ` matching “${sp.q}”` : ""} ·{" "}
          {filters.source ? SOURCE_LABEL[filters.source] : "all sources"}
        </p>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/problems/${p.id}`}
                className="group block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-indigo-600 hover:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium group-hover:text-indigo-300">
                    {p.title}
                  </span>
                  {p.difficultyNormalized != null && (
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        DIFF_COLORS[p.difficultyNormalized] ?? "bg-neutral-700 text-neutral-300"
                      }`}
                    >
                      {difficultyBadge(p)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-neutral-800/80 px-2 py-0.5 text-xs font-medium text-neutral-400">
                    {SOURCE_LABEL[p.source]}
                  </span>
                  {statusMap[p.id] && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[statusMap[p.id]].cls
                      }`}
                    >
                      {STATUS_BADGE[statusMap[p.id]].label}
                    </span>
                  )}
                  {p.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {problems.length === 0 && (
          <p className="py-16 text-center text-neutral-500">
            No problems found. Try a different search.
          </p>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4 text-sm">
            <PageLink sp={sp} page={page - 1} disabled={page <= 1} label="← Prev" />
            <span className="text-neutral-500">
              Page {page} of {totalPages}
            </span>
            <PageLink sp={sp} page={page + 1} disabled={page >= totalPages} label="Next →" />
          </div>
        )}
      </div>
    </main>
  );
}

function PageLink({
  sp,
  page,
  disabled,
  label,
}: {
  sp: Record<string, string | undefined>;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) return <span className="text-neutral-700">{label}</span>;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.source) params.set("source", sp.source);
  if (sp.tag) params.set("tag", sp.tag);
  if (sp.min) params.set("min", sp.min);
  if (sp.max) params.set("max", sp.max);
  params.set("page", String(page));
  return (
    <Link href={`/?${params.toString()}`} className="text-indigo-400 hover:text-indigo-300">
      {label}
    </Link>
  );
}
