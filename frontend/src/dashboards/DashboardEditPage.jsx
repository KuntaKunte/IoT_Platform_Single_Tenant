import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const WIDGET_TYPES = ['chart', 'gauge', 'map', 'status_card', 'alarm_list'];

function defaultConfigFor(type) {
  switch (type) {
    case 'chart':
    case 'gauge':
      return { deviceId: '', metric: '' };
    case 'status_card':
      return { deviceId: '' };
    case 'map':
      return { deviceIds: '' };
    case 'alarm_list':
      return { limit: 10 };
    default:
      return {};
  }
}

export default function DashboardEditPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);

  const [newWidget, setNewWidget] = useState({
    type: 'chart',
    title: '',
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    config: defaultConfigFor('chart')
  });

  useEffect(() => {
    async function load() {
      const [dashboardResult, registryResult] = await Promise.all([
        api.get(`/dashboards/${dashboardId}`),
        api.get('/devices/registry')
      ]);
      setDashboard(dashboardResult.dashboard);
      setDevices(registryResult.devices);
    }
    load().catch((err) => setError(err.message));
  }, [dashboardId]);

  function updateNewWidgetType(type) {
    setNewWidget((prev) => ({ ...prev, type, config: defaultConfigFor(type) }));
  }

  function updateConfigField(field, value) {
    setNewWidget((prev) => ({ ...prev, config: { ...prev.config, [field]: value } }));
  }

  async function persistLayout(layout) {
    const result = await api.put(`/dashboards/${dashboardId}`, {
      name: dashboard.name,
      description: dashboard.description,
      layout
    });
    setDashboard(result.dashboard);
  }

  async function handleAddWidget(event) {
    event.preventDefault();
    try {
      const config = { ...newWidget.config };
      if ('deviceId' in config) config.deviceId = Number(config.deviceId);
      if ('deviceIds' in config) {
        config.deviceIds = String(config.deviceIds)
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isInteger(id));
      }

      const widget = {
        id: `w-${Date.now()}`,
        type: newWidget.type,
        title: newWidget.title,
        position: { x: Number(newWidget.x), y: Number(newWidget.y), w: Number(newWidget.w), h: Number(newWidget.h) },
        config
      };
      await persistLayout([...dashboard.layout, widget]);
      setNewWidget({ type: 'chart', title: '', x: 0, y: 0, w: 2, h: 2, config: defaultConfigFor('chart') });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveWidget(widgetId) {
    try {
      await persistLayout(dashboard.layout.filter((widget) => widget.id !== widgetId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!dashboard) return <p>Loading…</p>;

  return (
    <div>
      <h1>Edit {dashboard.name}</h1>
      <button onClick={() => navigate(`/dashboards/${dashboardId}`)}>Back to dashboard</button>

      <h2>Widgets</h2>
      <ul>
        {dashboard.layout.map((widget) => (
          <li key={widget.id}>
            {widget.title} ({widget.type}) — x:{widget.position.x} y:{widget.position.y} w:{widget.position.w} h:{widget.position.h}{' '}
            <button onClick={() => handleRemoveWidget(widget.id)}>Remove</button>
          </li>
        ))}
      </ul>

      <h2>Add widget</h2>
      <form onSubmit={handleAddWidget} className="widget-form">
        <label>
          Type
          <select value={newWidget.type} onChange={(event) => updateNewWidgetType(event.target.value)}>
            {WIDGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            value={newWidget.title}
            onChange={(event) => setNewWidget((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
        </label>

        {(newWidget.type === 'chart' || newWidget.type === 'gauge') && (
          <>
            <label>
              Device
              <select value={newWidget.config.deviceId} onChange={(event) => updateConfigField('deviceId', event.target.value)} required>
                <option value="" disabled>
                  Select a device
                </option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metric
              <input value={newWidget.config.metric} onChange={(event) => updateConfigField('metric', event.target.value)} required />
            </label>
          </>
        )}

        {newWidget.type === 'status_card' && (
          <label>
            Device
            <select value={newWidget.config.deviceId} onChange={(event) => updateConfigField('deviceId', event.target.value)} required>
              <option value="" disabled>
                Select a device
              </option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {newWidget.type === 'map' && (
          <label>
            Device IDs (comma-separated)
            <input value={newWidget.config.deviceIds} onChange={(event) => updateConfigField('deviceIds', event.target.value)} required />
          </label>
        )}

        {newWidget.type === 'alarm_list' && (
          <label>
            Limit
            <input
              type="number"
              value={newWidget.config.limit}
              onChange={(event) => updateConfigField('limit', Number(event.target.value))}
            />
          </label>
        )}

        <fieldset>
          <legend>Position</legend>
          <label>
            X
            <input type="number" min="0" value={newWidget.x} onChange={(event) => setNewWidget((prev) => ({ ...prev, x: event.target.value }))} />
          </label>
          <label>
            Y
            <input type="number" min="0" value={newWidget.y} onChange={(event) => setNewWidget((prev) => ({ ...prev, y: event.target.value }))} />
          </label>
          <label>
            W
            <input type="number" min="1" value={newWidget.w} onChange={(event) => setNewWidget((prev) => ({ ...prev, w: event.target.value }))} />
          </label>
          <label>
            H
            <input type="number" min="1" value={newWidget.h} onChange={(event) => setNewWidget((prev) => ({ ...prev, h: event.target.value }))} />
          </label>
        </fieldset>

        <button type="submit">Add widget</button>
      </form>
    </div>
  );
}
