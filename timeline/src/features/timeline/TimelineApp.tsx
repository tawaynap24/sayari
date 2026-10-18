import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { signOut, type User } from "firebase/auth";
import { api, auth, configured, emulated, errorText } from "./client";
import { useAuth, useCollection, useDoc, usePages } from "./hooks";
import type { Entity, Request, Revision, Topic } from "./types";
import AuthPanel from "./AuthPanel";
import ContentForm from "./ContentForm";
import RequestPanel from "./RequestPanel";
import ReasonForm from "./ReasonForm";
import StoryCard from "./StoryCard";
import TimelineCanvas, { type CanvasNode } from "./TimelineCanvas";
import "./style.css";
interface Category {
  id: string;
  displayNameTh: string;
  order: number;
}
function Explorer({
  topics,
  categories,
}: {
  topics: Topic[];
  categories: Category[];
}) {
  const [category, setCategory] = useState("all");
  return (
    <>
      <section className="tl-hero">
        <p className="tl-eyebrow">TIMELINE</p>
        <h1>
          ทุกเรื่องราว
          <br />
          <em>มีช่วงเวลาของมัน</em>
        </h1>
        <p>
          สำรวจลำดับเหตุการณ์ เชื่อมโยงเรื่องราว
          <br />
          และร่วมบันทึกแหล่งอ้างอิงกับชุมชน
        </p>
      </section>
      <nav className="tl-categories" aria-label="หมวดหมู่">
        <button
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          ทุกหมวด
        </button>
        {categories
          .sort((a, b) => a.order - b.order)
          .map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.displayNameTh}
            </button>
          ))}
      </nav>
      <div className="tl-topics">
        {topics
          .filter((t) => category === "all" || t.categoryId === category)
          .map((t, i) => (
            <Link
              className="tl-topic-card"
              to={`/timeline/${t.slug}`}
              key={t.id}
            >
              <span className="tl-topic-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="tl-eyebrow">
                  {categories.find((c) => c.id === t.categoryId)?.displayNameTh}
                </p>
                <h2>{t.displayNames["th-TH"]}</h2>
                <p>{t.descriptionTh}</p>
              </div>
              <span className="tl-topic-arrow">↗</span>
            </Link>
          ))}
      </div>
      {!topics.length && <p className="tl-notice">ยังไม่มีหัวข้อในระบบ</p>}
    </>
  );
}
function TopicPage({
  topics,
  user,
  authReady,
}: {
  topics: Topic[];
  user: User | null;
  authReady: boolean;
}) {
  const { topicSlug } = useParams();
  const topic = topics.find((t) => t.slug === topicSlug);
  const membership = useDoc<{ uid: string }>(
    user && topic ? `topics/${topic.id}/interests/${user.uid}` : null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!topic)
    return <p role="status">ไม่พบหัวข้อนี้ หรือข้อมูลยังโหลดไม่เสร็จ</p>;
  return (
    <>
      <nav className="tl-breadcrumb">
        <Link to="/timeline">Timeline</Link>
        <span>/</span>
        <span>{topic.displayNames["th-TH"]}</span>
      </nav>
      <section className="tl-topic-hero">
        <p className="tl-eyebrow">COMMUNITY TIMELINE</p>
        <h1>{topic.displayNames["th-TH"]}</h1>
        <p className="tl-muted">{topic.descriptionTh}</p>
      </section>
      {!authReady || (user && !membership.ready) ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : user && !membership.value ? (
        <section className="tl-follow-gate">
          <span className="tl-orbit">＋</span>
          <h2>ร่วมติดตามเรื่องราวในหัวข้อนี้</h2>
          <p>กดสนใจเพื่ออ่านเรื่องราว เพิ่มเนื้อหา และร่วมพิจารณาคำขอ</p>
          <button
            className="tl-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("followTopic", { topicId: topic.id });
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "กำลังบันทึก…" : "สนใจหัวข้อนี้"}
          </button>
          {(error || membership.error) && (
            <p role="alert" className="tl-error">
              {error || membership.error}
            </p>
          )}
        </section>
      ) : (
        <TopicContent
          key={`${topic.id}:${user?.uid || "guest"}`}
          topic={topic}
          user={user}
        />
      )}
    </>
  );
}
function TopicContent({ topic, user }: { topic: Topic; user: User | null }) {
  const location = useLocation(),
    navigate = useNavigate();
  const { storyId } = useParams();
  const hub = location.pathname.endsWith("/requests") && !!user;
  const [overlay, setOverlay] = useState(false),
    [filter, setFilter] = useState("ALL"),
    [selected, setSelected] = useState<string[] | null>(null),
    [requestId, setRequestId] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState<{
      base?: Revision;
      request?: Request;
    } | null>(null),
    [reason, setReason] = useState<{
      story: Revision;
      action: "proposeHide" | "reportStory" | "privilegedHide";
    } | null>(null),
    [privileged, setPrivileged] = useState(false);
  const stories = usePages<Revision>("publicStories", topic.id);
  const single = useDoc<Revision>(storyId ? `publicStories/${storyId}` : null);
  const pending = usePages<Request>(
    "requests",
    user && (overlay || hub) ? topic.id : null,
    hub ? filter : "ALL",
  );
  const entities = useCollection<Entity>("namedEntities", topic.id);
  const stats = useDoc<{ interestCount: number }>(
    user ? `topicStats/${topic.id}` : null,
  );
  useEffect(() => {
    let alive = true;
    user?.getIdTokenResult().then((r) => {
      if (alive) setPrivileged(r.claims.timelineModerator === true);
    });
    return () => {
      alive = false;
    };
  }, [user]);
  useEffect(() => {
    setOverlay(false);
    setSelected(null);
    setRequestId(null);
  }, [location.pathname]);
  const nodes = useMemo<CanvasNode[]>(
    () => [
      ...stories.items.map((s) => ({
        id: s.storyId,
        time: s.time,
        addedAt: s.addedAt,
        titleTh: s.titleTh,
      })),
      ...(overlay
        ? pending.items
            .filter((r) => r.kind === "CREATE" && r.proposal)
            .map((r) => ({
              id: r.storyId,
              time: r.proposal!.time,
              addedAt: r.submittedAt,
              titleTh: r.proposal!.titleTh,
              ghost: true,
              requestId: r.id,
            }))
        : []),
    ],
    [stories.items, pending.items, overlay],
  );
  const displayed = storyId
    ? single.value
      ? [single.value]
      : []
    : stories.items.filter((s) => !selected || selected.includes(s.storyId));
  const openRequest = (id: string) => setRequestId(id);
  return (
    <>
      <div className="tl-content-nav">
        <div className="tl-actions">
          <Link
            className={!hub ? "is-active" : ""}
            to={`/timeline/${topic.slug}`}
          >
            เส้นเวลา
          </Link>
          {user && (
            <Link
              className={hub ? "is-active" : ""}
              to={`/timeline/${topic.slug}/requests`}
            >
              คำขอปัจจุบัน
            </Link>
          )}
        </div>
        {user && (
          <span className="tl-muted">
            ผู้สนใจ {stats.value?.interestCount ?? "…"} บัญชี
          </span>
        )}
      </div>
      {hub ? (
        <section>
          <div className="tl-row">
            <h2>คำขอที่รอพิจารณา</h2>
            <label>
              กรองคำขอ
              <select
                aria-label="กรองคำขอ"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="CREATE">เพิ่มเรื่องราว</option>
                <option value="EDIT">แก้ไข</option>
                <option value="HIDE">ซ่อน</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
          </div>
          {!pending.ready && <p role="status">กำลังโหลดคำขอ…</p>}
          {pending.error && <p role="alert">{pending.error}</p>}
          {pending.ready && !pending.items.length && (
            <p className="tl-empty">ไม่มีคำขอในหมวดนี้</p>
          )}
          <div className="tl-request-list">
            {pending.items.map((r) => (
              <button
                key={r.id}
                className="tl-request-row"
                onClick={() => openRequest(r.id)}
              >
                <span className="tl-request-kind">
                  {r.kind === "CREATE"
                    ? "＋ เพิ่ม"
                    : r.kind === "EDIT"
                      ? "! แก้ไข"
                      : "× ซ่อน"}
                </span>
                <span>
                  <strong>
                    {r.proposal?.titleTh ||
                      stories.items.find((s) => s.storyId === r.storyId)
                        ?.titleTh ||
                      "เรื่องราว"}
                  </strong>
                  <small>
                    ผู้เสนอ {r.authorLabel} · เห็นด้วย {r.yesCount}/
                    {r.requiredVotes} · ไม่เห็นด้วย {r.noCount}/
                    {r.requiredVotes}
                  </small>
                </span>
                <span>↗</span>
              </button>
            ))}
          </div>
          {pending.more && (
            <button onClick={pending.loadMore}>โหลดคำขอเพิ่มเติม</button>
          )}
        </section>
      ) : (
        <>
          {user && (
            <label className="tl-check tl-overlay-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={overlay}
                onChange={(e) => setOverlay(e.target.checked)}
              />
              ดูเหตุการณ์คำขอ
            </label>
          )}
          <TimelineCanvas
            nodes={nodes}
            topic={topic}
            requests={overlay ? pending.items : []}
            onSelect={(ids) => {
              setSelected(ids);
              if (storyId) navigate(`/timeline/${topic.slug}`);
              document
                .getElementById("tl-stories")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onRequest={openRequest}
          />
          {overlay && pending.more && (
            <button onClick={pending.loadMore}>โหลดตำแหน่งคำขอเพิ่มเติม</button>
          )}
          <div className="tl-story-toolbar">
            {user && (
              <button className="tl-primary" onClick={() => setForm({})}>
                ＋ เพิ่มเรื่องราว
              </button>
            )}
            {selected && (
              <button onClick={() => setSelected(null)}>
                แสดงทุกเรื่องราว
              </button>
            )}
            <span className="tl-muted">
              {displayed.length} เรื่องราวที่โหลดแล้ว
            </span>
          </div>
          {notice && (
            <p role="status" className="tl-notice">
              {notice}
            </p>
          )}
          {stories.error && (
            <p role="alert" className="tl-error">
              {stories.error}
              <button onClick={() => window.location.reload()}>ลองใหม่</button>
            </p>
          )}
          <section
            id="tl-stories"
            className="tl-stories"
            aria-label="รายการเรื่องราว"
          >
            {!stories.ready && <p role="status">กำลังโหลดเรื่องราว…</p>}
            {storyId && single.ready && !single.value && (
              <p className="tl-empty">
                ไม่พบเรื่องราวที่เผยแพร่ หรือเรื่องราวถูกซ่อนแล้ว
              </p>
            )}
            {displayed.map((s) => (
              <StoryCard
                key={`${s.storyId}:${s.revisionNumber}`}
                story={s}
                topic={topic}
                entities={entities.items}
                member={!!user}
                expanded={!!storyId}
                onEdit={(base) => setForm({ base })}
                onHide={(story) => setReason({ story, action: "proposeHide" })}
                onReport={(story) =>
                  setReason({ story, action: "reportStory" })
                }
                onPrivilegedHide={
                  privileged
                    ? (story) => setReason({ story, action: "privilegedHide" })
                    : undefined
                }
              />
            ))}
          </section>
          {stories.more && (
            <button onClick={stories.loadMore}>โหลดเรื่องราวเพิ่มเติม</button>
          )}
        </>
      )}
      {form && user && (
        <ContentForm
          topic={topic}
          anchors={stories.items}
          {...form}
          onClose={() => setForm(null)}
          onSaved={() =>
            setNotice("บันทึกแล้ว เรื่องราวที่ต้องโหวตจะอยู่ในหน้าคำขอปัจจุบัน")
          }
        />
      )}
      {requestId && user && (
        <RequestPanel
          privileged={privileged}
          requestId={requestId}
          topic={topic}
          onClose={() => setRequestId(null)}
          onEdit={(request) => {
            setRequestId(null);
            setForm({ request });
          }}
        />
      )}
      {reason && user && (
        <ReasonForm topic={topic} {...reason} onClose={() => setReason(null)} />
      )}
    </>
  );
}
export default function TimelineApp() {
  const { user, ready } = useAuth();
  const [login, setLogin] = useState(false);
  const topics = useCollection<Topic>(configured ? "topics" : null),
    categories = useCollection<Category>(configured ? "categories" : null);
  return (
    <main className="tl">
      <header className="tl-header">
        <Link className="tl-brand" to="/timeline">
          <span className="tl-brand-mark">T</span><span>Timeline</span>
        </Link>
        <nav className="tl-actions">
          <Link to="/">หน้าแรก</Link>
          {ready &&
            (user ? (
              <>
                <span className="tl-account">
                  {user.displayName || "สมาชิก"}
                </span>
                <button onClick={() => void signOut(auth)}>ออกจากระบบ</button>
              </>
            ) : (
              <button disabled={!configured} onClick={() => setLogin(true)}>
                เข้าสู่ระบบ
              </button>
            ))}
        </nav>
      </header>
      {!configured ? (
        <section className="tl-empty">
          <h1>Timeline</h1>
          <p>
            ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาตั้งค่า Firebase
            ของเว็บไซต์ก่อนใช้งาน
          </p>
        </section>
      ) : (
        <>
          {emulated && (
            <p className="tl-local-label">
              พื้นที่ทดสอบในเครื่อง · ข้อมูลไม่เชื่อมต่อเว็บไซต์จริง
            </p>
          )}
          {(topics.error || categories.error) && (
            <p className="tl-error" role="alert">
              {topics.error || categories.error}
              <button onClick={() => window.location.reload()}>ลองใหม่</button>
            </p>
          )}
          {!topics.ready ? (
            <p role="status">กำลังโหลดหัวข้อ…</p>
          ) : (
            <Routes>
              <Route
                index
                element={
                  <Explorer
                    topics={topics.items}
                    categories={categories.items}
                  />
                }
              />
              <Route
                path=":topicSlug"
                element={
                  <TopicPage
                    topics={topics.items}
                    user={user}
                    authReady={ready}
                  />
                }
              />
              <Route
                path=":topicSlug/requests"
                element={
                  <TopicPage
                    topics={topics.items}
                    user={user}
                    authReady={ready}
                  />
                }
              />
              <Route
                path=":topicSlug/story/:storyId"
                element={
                  <TopicPage
                    topics={topics.items}
                    user={user}
                    authReady={ready}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <p>
                    ไม่พบหน้านี้ <Link to="/timeline">กลับ Timeline</Link>
                  </p>
                }
              />
            </Routes>
          )}
        </>
      )}
      <footer className="tl-footer">
        <span>TIMELINE</span>
        <span>เรื่องราวของชุมชน · เชื่อมโยงด้วยเวลา</span>
      </footer>
      {login && <AuthPanel onClose={() => setLogin(false)} />}
    </main>
  );
}
