import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ReportListPage() {
  const [reports, setReports] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  async function loadReports() {
    const result = await api.get('/reports');
    setReports(result.reports);
  }

  useEffect(() => {
    loadReports().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await api.post('/reports', {
        name,
        metrics: [{ field: 'temperature', label: 'Temperature', aggregation: 'avg' }]
      });
      setName('');
      await loadReports();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(reportId) {
    try {
      await api.delete(`/reports/${reportId}`);
      await loadReports();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Reports</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleCreate} className="inline-form">
        <input placeholder="New report name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit">Create</button>
      </form>
      <ul className="dashboard-list">
        {reports.map((report) => (
          <li key={report.id}>
            <Link to={`/reports/${report.id}`}>{report.name}</Link> <Link to={`/reports/${report.id}/edit`}>Edit</Link>{' '}
            <Link to={`/reports/${report.id}/schedules`}>Schedules</Link>{' '}
            <button onClick={() => handleDelete(report.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
