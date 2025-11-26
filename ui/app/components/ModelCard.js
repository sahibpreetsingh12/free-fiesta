export default function ModelCard({ title, content, loading, latency }) {
  return (
    <div className="card">
      <h3>{title}</h3>

      {loading ? (
        <div className="loader"></div>
      ) : (
        <pre style={{ whiteSpace: "pre-wrap" }}>{content}</pre>
      )}

      {latency !== null && (
        <div className="latency">
          ⏱ {latency} ms
        </div>
      )}
    </div>
  );
}

