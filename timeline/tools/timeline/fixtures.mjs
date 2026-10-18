/** Scoped cleanup for synthetic topic fixtures in the local development emulator. */
export function assertFixtureEmulator(db) {
  if (
    db.projectId !== "demo-timeline" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-timeline")
  ) throw Error("Fixture cleanup requires demo-timeline on the local Firestore emulator");
}

export function isTopicFixture(id, data) {
  if (!data || data.id !== id || data.slug !== id || data.categoryId !== "test") return false;
  return (
    (/^test_[a-z0-9]+_\d+$/.test(id) &&
      data.descriptionTh === "SYNTHETIC EMULATOR ONLY" &&
      data.calendar?.id === "symbolic-test") ||
    (/^browser-[a-z0-9]+$/.test(id) &&
      data.descriptionTh === "SYNTHETIC — Emulator only" &&
      data.calendar?.id === "browser-symbolic")
  );
}

export async function findTopicFixtures(db) {
  assertFixtureEmulator(db);
  const topics = await db.collection("topics").where("categoryId", "==", "test").get();
  return topics.docs.filter(d => isTopicFixture(d.id, d.data()));
}

export async function cleanupTopicFixtures(db, topicIds, bucket) {
  assertFixtureEmulator(db);
  const cleaned = [];
  for (const id of new Set(topicIds)) {
    if (!/^(test_[a-z0-9]+_\d+|browser-[a-z0-9]+)$/.test(id))
      throw Error(`Refusing to clean a non-fixture topic: ${id}`);
    const topic = await db.doc(`topics/${id}`).get();
    if (!topic.exists) continue;
    if (!isTopicFixture(id, topic.data())) throw Error(`Fixture metadata does not match: ${id}`);
    const snapshots = await Promise.all(
      ["publicStories", "stories", "requests", "namedEntities", "media", "abuseReports"]
        .map(name => db.collection(name).where("topicId", "==", id).get()),
    );
    const media = snapshots[4];
    if (bucket) {
      if (process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199" ||
          bucket.name !== "demo-timeline.appspot.com")
        throw Error("Fixture media cleanup requires the local Storage emulator");
      for (const doc of media.docs) {
        const data = doc.data();
        for (const path of new Set([data.path, data.validatedPath].filter(Boolean))) {
          const validatedPrefix = `validated/${doc.id}/`;
          if (path !== `staging/${data.ownerUid}/${data.draftId}/${doc.id}` &&
              !(path.startsWith(validatedPrefix) && /^[a-f0-9]{64}$/.test(path.slice(validatedPrefix.length))))
            throw Error(`Unexpected fixture media path: ${path}`);
          await bucket.file(path).delete({ ignoreNotFound: true });
        }
      }
    }
    const followed = await db.collectionGroup("followedTopics").where("topicId", "==", id).get();
    for (const doc of followed.docs) await db.recursiveDelete(doc.ref);
    for (const snapshot of snapshots)
      for (const doc of snapshot.docs) await db.recursiveDelete(doc.ref);
    await db.recursiveDelete(db.doc(`topicStats/${id}`));
    await db.recursiveDelete(topic.ref);
    cleaned.push(id);
  }
  return cleaned;
}
