import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import WidgetRenderer from '../widgets/WidgetRenderer.jsx';

const POLL_INTERVAL_MS = 5000;

export default function DashboardViewPage() {
  const { dashboardId } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [widgetsData, setWidgetsData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const result = await api.get(`/dashboards/${dashboardId}`);
      if (!cancelled) setDashboard(result.dashboard);
    }

    async function loadData() {
      try {
        const result = await api.get(`/dashboards/${dashboardId}/data`);
        if (!cancelled) setWidgetsData(result.widgets);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    loadDashboard().catch((err) => setError(err.message));
    loadData();
    const interval = setInterval(loadData, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dashboardId]);

  if (error) return <p className="error">{error}</p>;
  if (!dashboard) return <p>Loading…</p>;

  const dataById = Object.fromEntries(widgetsData.map((widget) => [widget.id, widget]));

  return (
    <div>
      <h1>{dashboard.name}</h1>
      <Link to={`/dashboards/${dashboardId}/edit`}>Edit layout</Link>
      <div className="dashboard-grid">
        {dashboard.layout.map((widget) => (
          <div
            key={widget.id}
            className="widget-cell"
            style={{
              gridColumn: `${widget.position.x + 1} / span ${widget.position.w}`,
              gridRow: `${widget.position.y + 1} / span ${widget.position.h}`
            }}
          >
            <WidgetRenderer widget={widget} data={dataById[widget.id]?.data} error={dataById[widget.id]?.error} />
          </div>
        ))}
      </div>
    </div>
  );
}
