export default function StatusCardWidget({ data }) {
  if (!data) {
    return <p>No data yet</p>;
  }

  return (
    <div className={`status-card ${data.online ? 'online' : 'offline'}`}>
      <span className="status-dot" />
      <span>{data.online ? 'Online' : 'Offline'}</span>
      {data.lastSeenAt && <p className="status-meta">Last seen: {new Date(data.lastSeenAt).toLocaleString()}</p>}
    </div>
  );
}
