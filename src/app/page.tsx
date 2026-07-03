import Link from "next/link";
import type { Source } from "@prisma/client";
import { searchProblems, getTopTags } from "@/lib/problems";
import { getStatusMap } from "@/lib/progress";
import { AuthButton } from "@/components/auth-button";
import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SOLVED: {
    label: "✓ solved",
    cls: "border-(--green-brd) bg-(--green-bg) text-(--green)",
  },
  ATTEMPTING: {
    label: "attempting",
    cls: "border-(--amber-brd) bg-(--amber-bg) text-(--amber)",
  },
  BOOKMARKED: {
    label: "☆ saved",
    cls: "border-(--accent-brd) bg-(--accent-bg) text-(--accent-soft)",
  },
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

// Three restrained tiers (matches the dashboard's easy/medium/hard mix).
function diffTier(d: number): string {
  if (d <= 3) return "border-(--green-brd) bg-(--green-bg) text-(--green)";
  if (d <= 6) return "border-(--amber-brd) bg-(--amber-bg) text-(--amber)";
  return "border-(--red-brd) bg-(--red-bg) text-(--red)";
}

const inputCls =
  "rounded-lg border border-(--border) bg-(--surface) px-3.5 py-2.5 text-sm text-(--text) outline-none placeholder:text-(--dim) focus:border-(--accent)";

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
    <main className="min-h-screen bg-(--bg) text-(--text)">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-extrabold leading-tight tracking-[-0.03em]">
              CodeSearch
            </h1>
            <p className="mt-1 font-mono text-[12.5px] text-(--muted)">
              pick a problem · learn it with an AI tutor — hints, not spoilers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthButton />
          </div>
        </header>

        <form className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search problems by title…"
            className={inputCls}
          />
          <select name="source" defaultValue={sp.source ?? ""} className={inputCls}>
            <option value="">All sources</option>
            <option value="cf">Codeforces</option>
            <option value="cc">CodeChef</option>
            <option value="lc">LeetCode</option>
            <option value="cses">CSES</option>
          </select>
          <select name="tag" defaultValue={sp.tag ?? ""} className={inputCls}>
            <option value="">All tags</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="min" defaultValue={sp.min ?? ""} className={inputCls}>
            <option value="">Any difficulty</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
              <option key={d} value={d}>
                Min diff {d}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-(--accent) px-5 py-2.5 text-sm font-semibold text-(--accent-contrast) transition hover:bg-(--accent-hover)"
          >
            Search
          </button>
        </form>

        <p className="mb-4 font-mono text-[11.5px] text-(--dim)">
          {total.toLocaleString()} problems
          {sp.q ? ` matching “${sp.q}”` : ""} ·{" "}
          {filters.source ? SOURCE_LABEL[filters.source] : "all sources"}
        </p>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                href={`/problems/${p.id}`}
                className="group block rounded-lg border border-(--border) bg-(--surface) p-4 transition hover:border-(--accent-brd) hover:bg-(--surface-2)"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-(--body) group-hover:text-(--text)">
                    {p.title}
                  </span>
                  {p.difficultyNormalized != null && (
                    <span
                      className={`shrink-0 rounded border px-2 py-[3px] font-mono text-[10.5px] ${diffTier(
                        p.difficultyNormalized,
                      )}`}
                    >
                      {difficultyBadge(p)}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
                  <span className="rounded border border-(--border-strong) px-2 py-[3px] text-(--body-2)">
                    {SOURCE_LABEL[p.source]}
                  </span>
                  {statusMap[p.id] && (
                    <span
                      className={`rounded border px-2 py-[3px] ${STATUS_BADGE[statusMap[p.id]].cls}`}
                    >
                      {STATUS_BADGE[statusMap[p.id]].label}
                    </span>
                  )}
                  {p.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded border border-(--border) px-2 py-[3px] text-(--muted)"
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
          <p className="py-16 text-center text-(--muted)">
            No problems match these filters — clear one and try again.
          </p>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4 font-mono text-xs">
            <PageLink sp={sp} page={page - 1} disabled={page <= 1} label="← prev" />
            <span className="text-(--dim)">
              page {page} / {totalPages}
            </span>
            <PageLink sp={sp} page={page + 1} disabled={page >= totalPages} label="next →" />
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
  if (disabled) return <span className="text-(--faint)">{label}</span>;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.source) params.set("source", sp.source);
  if (sp.tag) params.set("tag", sp.tag);
  if (sp.min) params.set("min", sp.min);
  if (sp.max) params.set("max", sp.max);
  params.set("page", String(page));
  return (
    <Link
      href={`/?${params.toString()}`}
      className="text-(--accent-soft) transition hover:text-(--text)"
    >
      {label}
    </Link>
  );
}
