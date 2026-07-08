import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function PluginListPage() {
  const [plugins, setPlugins] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    const result = await api.get('/plugins');
    setPlugins(result.plugins);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleToggle(plugin) {
    try {
      const action = plugin.status === 'active' ? 'disable' : 'enable';
      await api.post(`/plugins/${plugin.name}/${action}`, {});
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Plugins</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Description</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => (
            <tr key={plugin.name}>
              <td>{plugin.name}</td>
              <td>{plugin.version}</td>
              <td>{plugin.description}</td>
              <td>
                {plugin.status}
                {plugin.error && <div className="error">{plugin.error}</div>}
              </td>
              <td>
                <button onClick={() => handleToggle(plugin)}>
                  {plugin.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
