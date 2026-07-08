import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultNewSchedule() {
  return { frequency: 'daily', hourOfDay: 8, dayOfWeek: 1, dayOfMonth: 1, recipients: '', format: 'pdf' };
}

export default function ReportSchedulesPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [newSchedule, setNewSchedule] = useState(defaultNewSchedule());

  async function load() {
    const [schedulesResult, runsResult] = await Promise.all([
      api.get(`/reports/${reportId}/schedules`),
      api.get(`/reports/${reportId}/runs`)
    ]);
    setSchedules(schedulesResult.schedules);
    setRuns(runsResult.runs);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [reportId]);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      const payload = {
        frequency: newSchedule.frequency,
        hourOfDay: Number(newSchedule.hourOfDay),
        recipients: newSchedule.recipients.split(',').map((email) => email.trim()).filter(Boolean),
        format: newSchedule.format
      };
      if (newSchedule.frequency === 'weekly') payload.dayOfWeek = Number(newSchedule.dayOfWeek);
      if (newSchedule.frequency === 'monthly') payload.dayOfMonth = Number(newSchedule.dayOfMonth);

      await api.post(`/reports/${reportId}/schedules`, payload);
      setNewSchedule(defaultNewSchedule());
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(scheduleId) {
    try {
      await api.delete(`/reports/${reportId}/schedules/${scheduleId}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Schedules</h1>
      <button onClick={() => navigate(`/reports/${reportId}`)}>Back to report</button>

      <h2>Existing schedules</h2>
      <ul>
        {schedules.map((schedule) => (
          <li key={schedule.id}>
            {schedule.frequency} at {schedule.hour_of_day}:00 ({schedule.format}) → {(schedule.recipients || []).join(', ')} — next
            run: {new Date(schedule.next_run_at).toLocaleString()}{' '}
            <button onClick={() => handleDelete(schedule.id)}>Delete</button>
          </li>
        ))}
      </ul>

      <h2>Add schedule</h2>
      <form onSubmit={handleCreate} className="widget-form">
        <label>
          Frequency
          <select value={newSchedule.frequency} onChange={(event) => setNewSchedule({ ...newSchedule, frequency: event.target.value })}>
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hour of day
          <input
            type="number"
            min="0"
            max="23"
            value={newSchedule.hourOfDay}
            onChange={(event) => setNewSchedule({ ...newSchedule, hourOfDay: event.target.value })}
          />
        </label>
        {newSchedule.frequency === 'weekly' && (
          <label>
            Day of week
            <select value={newSchedule.dayOfWeek} onChange={(event) => setNewSchedule({ ...newSchedule, dayOfWeek: event.target.value })}>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        )}
        {newSchedule.frequency === 'monthly' && (
          <label>
            Day of month
            <input
              type="number"
              min="1"
              max="28"
              value={newSchedule.dayOfMonth}
              onChange={(event) => setNewSchedule({ ...newSchedule, dayOfMonth: event.target.value })}
            />
          </label>
        )}
        <label>
          Recipients (comma-separated emails)
          <input
            value={newSchedule.recipients}
            onChange={(event) => setNewSchedule({ ...newSchedule, recipients: event.target.value })}
            required
          />
        </label>
        <label>
          Format
          <select value={newSchedule.format} onChange={(event) => setNewSchedule({ ...newSchedule, format: event.target.value })}>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
          </select>
        </label>
        <button type="submit">Add schedule</button>
      </form>

      <h2>Run history</h2>
      <ul>
        {runs.map((run) => (
          <li key={run.id}>
            {new Date(run.generated_at).toLocaleString()} — {run.status}
            {run.error ? ` (${run.error})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
