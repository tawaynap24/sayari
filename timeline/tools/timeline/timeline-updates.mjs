/** Recover publication/edit/hide times from authoritative history, never submission times. */
export async function findTimelineUpdates(db, topicIds) {
  const topics = topicIds ? await db.getAll(...topicIds.map(id => db.doc(`topics/${id}`))) : (await db.collection("topics").get()).docs;
  const changes = [];
  for (const topic of topics) {
    if (!topic.exists) continue;
    const stories = await db.collection("stories").where("topicId", "==", topic.id).get();
    let latest = Number(topic.get("timelineUpdatedAt")) || 0;
    for (const story of stories.docs) {
      const data = story.data();
      if (!data.revisionNumber || !data.activeRevisionId) continue; // A request has never been published.
      const revision = await story.ref.collection("revisions").doc(data.activeRevisionId).get();
      latest = Math.max(latest, Number(revision.get("approvedAt")) || 0, Number(data.hiddenAt) || 0);
      if (data.restricted && !data.hiddenAt) {
        const audits = await db.collection("auditLog").where("storyId", "==", story.id).get();
        for (const audit of audits.docs)
          if (audit.get("action") === "emergencyRestriction") latest = Math.max(latest, Number(audit.get("at")) || 0);
      }
    }
    if (latest > (Number(topic.get("timelineUpdatedAt")) || 0)) changes.push({ topicId: topic.id, timelineUpdatedAt: latest });
  }
  return changes;
}

export async function applyTimelineUpdates(db, changes) {
  for (const change of changes) {
    await db.runTransaction(async tx => {
      const ref = db.doc(`topics/${change.topicId}`), topic = await tx.get(ref);
      // A concurrent approval must win over an older backfill observation.
      if (topic.exists && (Number(topic.get("timelineUpdatedAt")) || 0) < change.timelineUpdatedAt)
        tx.update(ref, { timelineUpdatedAt: change.timelineUpdatedAt });
    });
  }
}
