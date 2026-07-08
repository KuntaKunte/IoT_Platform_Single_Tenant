import { useState } from 'react';
import { api } from '../api/client.js';

export default function AlarmListWidget({ data }) {
  const [acknowledged, setAcknowledged] = useState([]);
  const alerts = (data || []).filter((alert) => !acknowledged.includes(alert.id));

  async function handleAcknowledge(alertId) {
    await api.post(`/notifications/alerts/${alertId}/ack`, {});
    setAcknowledged((prev) => [...prev, alertId]);
  }

  if (alerts.length === 0) {
    return <p>No active alarms</p>;
  }

  return (
    <ul className="alarm-list">
      {alerts.map((alert) => (
        <li key={alert.id} className={`severity-${alert.severity}`}>
          <strong>{alert.title}</strong>
          <p>{alert.message}</p>
          {alert.status === 'active' && <button onClick={() => handleAcknowledge(alert.id)}>Acknowledge</button>}
        </li>
      ))}
    </ul>
  );
}
