/**
 * Ingest the full Codeforces problemset into our DB.
 * Run: npx tsx scripts/ingest-codeforces.ts
 *
 * Stores metadata + link only (statement is fetched/rendered on demand or
 * linked out) to stay light and ToS-safe.
 */
import { prisma } from "../src/lib/prisma";
import {
  fetchCodeforcesProblems,
  cfSourceId,
  cfUrl,
  normalizeCfDifficulty,
} from "../src/lib/codeforces";

async function main() {
  console.log("Fetching Codeforces problemset...");
  const problems = await fetchCodeforcesProblems();
  console.log(`Fetched ${problems.length} problems. Upserting...`);

  let count = 0;
  for (const p of problems) {
    const sourceId = cfSourceId(p);
    await prisma.problem.upsert({
      where: { source_sourceId: { source: "CODEFORCES", sourceId } },
      create: {
        source: "CODEFORCES",
        sourceId,
        title: p.name,
        url: cfUrl(p),
        tags: p.tags,
        difficultyRaw: p.rating ?? null,
        difficultyNormalized: normalizeCfDifficulty(p.rating),
      },
      update: {
        title: p.name,
        tags: p.tags,
        difficultyRaw: p.rating ?? null,
        difficultyNormalized: normalizeCfDifficulty(p.rating),
      },
    });
    if (++count % 500 === 0) console.log(`  ...${count}`);
  }

  console.log(`Done. Upserted ${count} Codeforces problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
