/** Shared patch artwork for game cards and each game's Timeline header. */
export default function GameArtwork({ url, eager = false }: { url?: string; eager?: boolean }) {
  if (!url) return null;
  const loading = eager ? "eager" : "lazy";
  return (
    <div className="tl-topic-art" key={url} aria-hidden="true">
      <img
        className="tl-topic-ambience"
        src={url}
        alt=""
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={e => { e.currentTarget.hidden = true; }}
      />
      <img
        className="tl-topic-cover"
        src={url}
        alt=""
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={e => { e.currentTarget.hidden = true; }}
        width={1280}
        height={720}
      />
    </div>
  );
}
