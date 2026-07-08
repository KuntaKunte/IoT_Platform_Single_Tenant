import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiDownload, triggerBlobDownload } from '../api/client.js';

export default function ReportViewPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [reportResult, dataResult] = await Promise.all([
        api.get(`/reports/${reportId}`),
        api.get(`/reports/${reportId}/data`)
      ]);
      if (!cancelled) {
        setReport(reportResult.report);
        setData(dataResult);
      }
    }

    load().catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function handleDownload(format) {
    try {
      const { blob, filename } = await apiDownload(`/reports/${reportId}/export?format=${format}`);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!report || !data) return <p>Loading…</p>;

  return (
    <div>
      <h1>{report.name}</h1>
      <p>{report.description}</p>
      <Link to={`/reports/${reportId}/edit`}>Edit</Link> <Link to={`/reports/${reportId}/schedules`}>Schedules</Link>
      <div>
        <button onClick={() => handleDownload('pdf')}>Download PDF</button>{' '}
        <button onClick={() => handleDownload('excel')}>Download Excel</button>
      </div>

      <p>
        Period: {new Date(data.period.from).toLocaleString()} — {new Date(data.period.to).toLocaleString()}
      </p>

      {data.alertSummary && (
        <>
          <h2>Alert Summary</h2>
          <ul>
            {data.alertSummary.length === 0 && <li>No alerts in this period.</li>}
            {data.alertSummary.map((row) => (
              <li key={row.severity}>
                {row.severity}: {row.count} (avg ack {row.avgAckSeconds != null ? `${row.avgAckSeconds.toFixed(0)}s` : 'n/a'})
              </li>
            ))}
          </ul>
        </>
      )}

      {data.commandSummary && (
        <>
          <h2>Command Summary</h2>
          <ul>
            {data.commandSummary.length === 0 && <li>No commands in this period.</li>}
            {data.commandSummary.map((row) => (
              <li key={row.status}>
                {row.status}: {row.count}
              </li>
            ))}
          </ul>
        </>
      )}

      {data.metrics.map((metric) => (
        <div key={metric.field}>
          <h2>{metric.label}</h2>
          <p>
            Current: {metric.trend.current ?? 'n/a'} | Previous: {metric.trend.previous ?? 'n/a'} | Change:{' '}
            {metric.trend.changePercent != null ? `${metric.trend.changePercent.toFixed(1)}%` : 'n/a'}
          </p>
          <table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {metric.series.map((point) => (
                <tr key={point.bucket}>
                  <td>{new Date(point.bucket).toLocaleString()}</td>
                  <td>{point.value ?? 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
