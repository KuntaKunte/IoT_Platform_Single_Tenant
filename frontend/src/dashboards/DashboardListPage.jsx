import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function DashboardListPage() {
  const [dashboards, setDashboards] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  async function loadDashboards() {
    const result = await api.get('/dashboards');
    setDashboards(result.dashboards);
  }

  useEffect(() => {
    loadDashboards().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await api.post('/dashboards', { name, layout: [] });
      setName('');
      await loadDashboards();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Dashboards</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleCreate} className="inline-form">
        <input placeholder="New dashboard name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit">Create</button>
      </form>
      <ul className="dashboard-list">
        {dashboards.map((dashboard) => (
          <li key={dashboard.id}>
            <Link to={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link> <Link to={`/dashboards/${dashboard.id}/edit`}>Edit</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
