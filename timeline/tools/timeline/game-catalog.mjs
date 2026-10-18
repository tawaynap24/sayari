import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { FieldValue } = require("firebase-admin/firestore");

export const gameCatalog = JSON.parse(readFileSync(new URL("../../src/features/timeline/gameCatalog.json", import.meta.url), "utf8"));

export async function seedGameTopics(db) {
  for (const [index, game] of gameCatalog.entries()) {
    await db.runTransaction(async tx => {
      const topicRef = db.doc(`topics/${game.id}`), statsRef = db.doc(`topicStats/${game.id}`);
      const [topic, stats] = await tx.getAll(topicRef, statsRef);
      const current = topic.data();
      const interestCount = stats.get("interestCount") ?? 0;
      if (!Number.isSafeInteger(interestCount) || interestCount < 0) throw Error(`Invalid interest count for ${game.id}`);
      const presentation = {
        id: game.id,
        slug: current?.slug || game.id,
        categoryId: "games",
        displayNames: { ...current?.displayNames, "th-TH": game.name, "en-US": game.name },
        descriptionTh: current?.descriptionTh || "ร่วมเรียงเรื่องราวและเชื่อมโยงเหตุการณ์",
        coverPosition: game.position,
        order: index + 1,
        listed: true,
        interestCount,
      };
      if (topic.exists) tx.set(topicRef, { ...presentation, coverImage: FieldValue.delete() }, { merge: true });
      else tx.create(topicRef, { ...presentation, calendar: { id: `${game.id}-symbolic` }, publishedCount: 0 });
      if (!stats.exists) tx.create(statsRef, { interestCount: 0, graphVersion: 0 });
    });
  }
  // Preserve existing content and deep links; the landing page lists only the
  // five configured games. No topic, story, membership or counter is deleted.
  const legacy = db.doc("topics/community");
  await db.runTransaction(async tx => {
    if ((await tx.get(legacy)).exists) tx.update(legacy, { listed: false });
  });
}
