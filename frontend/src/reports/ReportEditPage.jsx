import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const AGGREGATIONS = ['avg', 'min', 'max', 'sum', 'count'];
const BUCKET_INTERVALS = ['hour', 'day', 'week'];

export default function ReportEditPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [newMetric, setNewMetric] = useState({ field: '', label: '', aggregation: 'avg' });

  useEffect(() => {
    api
      .get(`/reports/${reportId}`)
      .then((result) => setReport(result.report))
      .catch((err) => setError(err.message));
  }, [reportId]);

  async function persist(updated) {
    const result = await api.put(`/reports/${reportId}`, {
      name: updated.name,
      description: updated.description,
      deviceIds: updated.device_ids,
      metrics: updated.metrics,
      includeAlertSummary: updated.include_alert_summary,
      includeCommandSummary: updated.include_command_summary,
      bucketInterval: updated.bucket_interval,
      periodDays: updated.period_days
    });
    setReport(result.report);
  }

  async function handleSave(event) {
    event.preventDefault();
    try {
      await persist(report);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMetric(event) {
    event.preventDefault();
    try {
      await persist({ ...report, metrics: [...report.metrics, newMetric] });
      setNewMetric({ field: '', label: '', aggregation: 'avg' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveMetric(index) {
    try {
      await persist({ ...report, metrics: report.metrics.filter((_, i) => i !== index) });
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p>Loading…</p>;

  return (
    <div>
      <h1>Edit {report.name}</h1>
      <button onClick={() => navigate(`/reports/${reportId}`)}>Back to report</button>

      <form onSubmit={handleSave}>
        <label>
          Name
          <input value={report.name} onChange={(event) => setReport({ ...report, name: event.target.value })} required />
        </label>
        <label>
          Description
          <input
            value={report.description || ''}
            onChange={(event) => setReport({ ...report, description: event.target.value })}
          />
        </label>
        <label>
          Device IDs (comma-separated, blank = all devices)
          <input
            value={(report.device_ids || []).join(',')}
            onChange={(event) =>
              setReport({
                ...report,
                device_ids: event.target.value
                  .split(',')
                  .map((id) => Number(id.trim()))
                  .filter((id) => Number.isInteger(id))
              })
            }
          />
        </label>
        <label>
          Bucket interval
          <select
            value={report.bucket_interval}
            onChange={(event) => setReport({ ...report, bucket_interval: event.target.value })}
          >
            {BUCKET_INTERVALS.map((interval) => (
              <option key={interval} value={interval}>
                {interval}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period (days)
          <input
            type="number"
            min="1"
            value={report.period_days}
            onChange={(event) => setReport({ ...report, period_days: Number(event.target.value) })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={report.include_alert_summary}
            onChange={(event) => setReport({ ...report, include_alert_summary: event.target.checked })}
          />
          Include alert summary
        </label>
        <label>
          <input
            type="checkbox"
            checked={report.include_command_summary}
            onChange={(event) => setReport({ ...report, include_command_summary: event.target.checked })}
          />
          Include command summary
        </label>
        <button type="submit">Save</button>
      </form>

      <h2>Metrics</h2>
      <ul>
        {report.metrics.map((metric, index) => (
          <li key={`${metric.field}-${index}`}>
            {metric.label} ({metric.field}, {metric.aggregation}){' '}
            <button onClick={() => handleRemoveMetric(index)}>Remove</button>
          </li>
        ))}
      </ul>

      <h2>Add metric</h2>
      <form onSubmit={handleAddMetric} className="widget-form">
        <label>
          Field (dot-path)
          <input value={newMetric.field} onChange={(event) => setNewMetric({ ...newMetric, field: event.target.value })} required />
        </label>
        <label>
          Label
          <input value={newMetric.label} onChange={(event) => setNewMetric({ ...newMetric, label: event.target.value })} required />
        </label>
        <label>
          Aggregation
          <select value={newMetric.aggregation} onChange={(event) => setNewMetric({ ...newMetric, aggregation: event.target.value })}>
            {AGGREGATIONS.map((aggregation) => (
              <option key={aggregation} value={aggregation}>
                {aggregation}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Add metric</button>
      </form>
    </div>
  );
}
