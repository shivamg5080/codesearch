/**
 * Ingest the LeetCode problem list into our DB.
 * Run: npx tsx scripts/ingest-leetcode.ts  (or npm run ingest:lc)
 *
 * Stores metadata + topic tags + link. Statements stay behind LeetCode (paste
 * them in the tutor like the other sources).
 */
import { prisma } from "../src/lib/prisma";
import {
  fetchLeetcodeProblems,
  lcUrl,
  normalizeLcDifficulty,
} from "../src/lib/leetcode";

async function main() {
  console.log("Fetching LeetCode problem list...");
  const problems = await fetchLeetcodeProblems();
  console.log(`Fetched ${problems.length} problems. Upserting...`);

  let count = 0;
  for (const p of problems) {
    await prisma.problem.upsert({
      where: { source_sourceId: { source: "LEETCODE", sourceId: p.titleSlug } },
      create: {
        source: "LEETCODE",
        sourceId: p.titleSlug,
        title: `${p.questionFrontendId}. ${p.title}`,
        url: lcUrl(p),
        tags: p.topicTags.map((t) => t.name),
        difficultyRaw: null, // LeetCode has no numeric rating
        difficultyNormalized: normalizeLcDifficulty(p.difficulty),
      },
      update: {
        title: `${p.questionFrontendId}. ${p.title}`,
        tags: p.topicTags.map((t) => t.name),
        difficultyNormalized: normalizeLcDifficulty(p.difficulty),
      },
    });
    if (++count % 500 === 0) console.log(`  ...${count}`);
  }

  console.log(`Done. Upserted ${count} LeetCode problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
