/**
 * Ingest the CSES problemset into our DB.
 * Run: npx tsx scripts/ingest-cses.ts  (or npm run ingest:cses)
 *
 * CSES has no difficulty ratings; the problem's category is stored as its tag.
 */
import { prisma } from "../src/lib/prisma";
import { fetchCsesProblems, csesUrl } from "../src/lib/cses";

async function main() {
  console.log("Fetching CSES problemset...");
  const problems = await fetchCsesProblems();
  console.log(`Fetched ${problems.length} problems. Upserting...`);

  let count = 0;
  for (const p of problems) {
    await prisma.problem.upsert({
      where: { source_sourceId: { source: "CSES", sourceId: p.id } },
      create: {
        source: "CSES",
        sourceId: p.id,
        title: p.title,
        url: csesUrl(p),
        tags: [p.category],
        difficultyRaw: null, // CSES has no ratings
        difficultyNormalized: null,
      },
      update: {
        title: p.title,
        tags: [p.category],
      },
    });
    if (++count % 100 === 0) console.log(`  ...${count}`);
  }

  console.log(`Done. Upserted ${count} CSES problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
