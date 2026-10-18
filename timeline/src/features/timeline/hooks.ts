import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  limit,
  orderBy,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db, configured, errorText } from "./client";
export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );
  return { user, ready };
}
export function useDoc<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    value: T | null;
    ready: boolean;
    error: string;
  }>({ path: null, value: null, ready: false, error: "" });
  useEffect(() => {
    if (!path || !configured) return;
    return onSnapshot(
      doc(db, path),
      (s) =>
        setState({
          path,
          value: s.exists() ? (s.data() as T) : null,
          ready: true,
          error: "",
        }),
      (e) => setState({ path, value: null, ready: true, error: errorText(e) }),
    );
  }, [path]);
  return state.path === path
    ? state
    : { path, value: null, ready: !path, error: "" };
}
export function useCollection<T>(path: string | null, topicId?: string) {
  const [state, setState] = useState<{
    key: string;
    items: T[];
    ready: boolean;
    error: string;
  }>({ key: "", items: [], ready: false, error: "" });
  const key = `${path}:${topicId}`;
  useEffect(() => {
    if (!path || !configured) return;
    const q = query(
      collection(db, path),
      ...(topicId ? [where("topicId", "==", topicId)] : []),
      limit(200),
    );
    return onSnapshot(
      q,
      (s) =>
        setState({
          key,
          items: s.docs.map((d) => ({ ...d.data(), id: d.id }) as T),
          ready: true,
          error: "",
        }),
      (e) => setState({ key, items: [], ready: true, error: errorText(e) }),
    );
  }, [path, topicId, key]);
  return state.key === key
    ? state
    : { key, items: [], ready: !path, error: "" };
}
export function usePages<T>(
  path: "publicStories" | "requests",
  topicId: string | null,
  kind = "ALL",
) {
  const key = `${path}:${topicId}:${kind}`;
  const [cursors, setCursors] = useState<{
    key: string;
    list: (QueryDocumentSnapshot<DocumentData> | null)[];
  }>({ key, list: [null] });
  const [state, setState] = useState<{
    key: string;
    pages: Map<number, QueryDocumentSnapshot<DocumentData>[]>;
    error: string;
    ready: boolean;
  }>({ key: "", pages: new Map(), error: "", ready: false });
  const active = cursors.key === key ? cursors.list : [null];
  const cursorCount = active.length;
  useEffect(() => {
    if (!topicId || !configured) return;
    const pages = new Map<number, QueryDocumentSnapshot<DocumentData>[]>();
    const cs = cursors.key === key ? cursors.list : [null];
    const off = cs.map((cursor, i) => {
      const clauses: QueryConstraint[] = [where("topicId", "==", topicId)];
      if (path === "requests") {
        clauses.push(
          where("status", "==", "pending"),
          where("restricted", "==", false),
        );
        if (kind !== "ALL") clauses.push(where("kind", "==", kind));
      }
      clauses.push(
        orderBy(
          path === "requests" ? "submittedAt" : "addedAt",
          path === "requests" ? "desc" : "asc",
        ),
        orderBy("__name__"),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(60),
      );
      return onSnapshot(
        query(collection(db, path), ...clauses),
        (s) => {
          // Keep adjacent page boundaries contiguous when an insertion, reset,
          // settlement or hide moves rows across the first page's old cursor.
          const nextCursor = cs[i + 1],
            last = s.docs.at(-1);
          const sortField = path === "requests" ? "submittedAt" : "addedAt";
          if (
            nextCursor &&
            last &&
            (nextCursor.id !== last.id ||
              nextCursor.get(sortField) !== last.get(sortField))
          ) {
            setCursors((previous) => {
              if (
                previous.key !== key ||
                previous.list[i + 1]?.id !== nextCursor.id
              )
                return previous;
              const list = [...previous.list];
              list[i + 1] = last;
              return { key, list };
            });
          }
          pages.set(i, s.docs);
          setState({
            key,
            pages: new Map(pages),
            error: "",
            ready: pages.size === cs.length,
          });
        },
        (e) =>
          setState({ key, pages: new Map(), error: errorText(e), ready: true }),
      );
    });
    return () => off.forEach((f) => f());
  }, [path, topicId, kind, key, cursors, cursorCount]);
  const valid = state.key === key;
  const docs = valid
    ? [...state.pages.entries()]
        .sort(([a], [b]) => a - b)
        .flatMap(([, ds]) => ds)
    : [];
  const items = [
    ...new Map(
      docs.map((d) => [d.id, { ...d.data(), id: d.id } as T]),
    ).values(),
  ];
  const last = valid ? state.pages.get(cursorCount - 1) : undefined;
  return {
    items,
    ready: !topicId || (valid && state.ready),
    error: valid ? state.error : "",
    more: last?.length === 60,
    loadMore: () => {
      if (last?.length)
        setCursors({ key, list: [...active, last[last.length - 1]] });
    },
  };
}
