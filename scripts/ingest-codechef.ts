/**
 * Ingest the CodeChef practice problemset into our DB.
 * Run: npx tsx scripts/ingest-codechef.ts  (or npm run ingest:cc)
 *
 * Stores metadata + link only (no tags available from the list endpoint).
 */
import { prisma } from "../src/lib/prisma";
import {
  fetchCodechefProblems,
  ccUrl,
  ccRating,
  normalizeCcDifficulty,
} from "../src/lib/codechef";

async function main() {
  console.log("Fetching CodeChef problemset...");
  const problems = await fetchCodechefProblems();
  console.log(`Fetched ${problems.length} problems. Upserting...`);

  let count = 0;
  for (const p of problems) {
    await prisma.problem.upsert({
      where: { source_sourceId: { source: "CODECHEF", sourceId: p.code } },
      create: {
        source: "CODECHEF",
        sourceId: p.code,
        title: p.name,
        url: ccUrl(p),
        tags: [],
        difficultyRaw: ccRating(p.difficulty_rating),
        difficultyNormalized: normalizeCcDifficulty(p.difficulty_rating),
      },
      update: {
        title: p.name,
        difficultyRaw: ccRating(p.difficulty_rating),
        difficultyNormalized: normalizeCcDifficulty(p.difficulty_rating),
      },
    });
    if (++count % 1000 === 0) console.log(`  ...${count}`);
  }

  console.log(`Done. Upserted ${count} CodeChef problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
