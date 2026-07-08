import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiDownload, triggerBlobDownload } from '../api/client.js';

export default function DeviceManagementPage() {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [firmwareOptions, setFirmwareOptions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [selectedFirmwareId, setSelectedFirmwareId] = useState('');
  const [configuration, setConfiguration] = useState(null);
  const [desiredConfigText, setDesiredConfigText] = useState('{}');
  const [diagnostics, setDiagnostics] = useState(null);
  const [collections, setCollections] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function loadAll() {
    const deviceResult = await api.get(`/devices/${deviceId}`);
    setDevice(deviceResult.device);

    const [firmwareResult, currentResult, deploymentsResult, configResult, diagnosticsResult, collectionsResult] =
      await Promise.all([
        api.get(`/firmware?deviceType=${encodeURIComponent(deviceResult.device.device_type)}`),
        api.get(`/devices/${deviceId}/firmware/current`),
        api.get(`/devices/${deviceId}/firmware/deployments`),
        api.get(`/devices/${deviceId}/configuration`),
        api.get(`/devices/${deviceId}/diagnostics`),
        api.get(`/devices/${deviceId}/logs`)
      ]);
    setFirmwareOptions(firmwareResult.firmware);
    setCurrent(currentResult.current);
    setDeployments(deploymentsResult.deployments);
    setConfiguration(configResult.configuration);
    setDesiredConfigText(JSON.stringify(configResult.configuration.desired_config ?? {}, null, 2));
    setDiagnostics(diagnosticsResult.diagnostics);
    setCollections(collectionsResult.collections);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, [deviceId]);

  async function withErrorHandling(action) {
    try {
      setError(null);
      await action();
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDeploy(event) {
    event.preventDefault();
    withErrorHandling(async () => {
      await api.post(`/devices/${deviceId}/firmware/deploy`, { firmwareId: Number(selectedFirmwareId) });
      setNotice('Deployment created — dispatch and device ack happen asynchronously.');
    });
  }

  function handleRollback() {
    withErrorHandling(async () => {
      await api.post(`/devices/${deviceId}/firmware/rollback`, {});
      setNotice('Rollback deployment created.');
    });
  }

  function handlePushConfig(event) {
    event.preventDefault();
    withErrorHandling(async () => {
      const config = JSON.parse(desiredConfigText);
      await api.put(`/devices/${deviceId}/configuration`, { config });
      setNotice('Desired configuration updated.');
    });
  }

  function handleRequestDiagnostics() {
    withErrorHandling(async () => {
      await api.post(`/devices/${deviceId}/diagnostics`, {});
      setNotice('Diagnostics requested — waiting on device response.');
    });
  }

  function handleRequestLogs() {
    withErrorHandling(async () => {
      await api.post(`/devices/${deviceId}/logs`, {});
      setNotice('Log collection requested — waiting on device upload.');
    });
  }

  function handleReboot() {
    withErrorHandling(async () => {
      await api.post(`/devices/${deviceId}/reboot`, {});
      setNotice('Reboot command created.');
    });
  }

  async function handleDownloadLog(collectionId) {
    try {
      const { blob, filename } = await apiDownload(`/devices/${deviceId}/logs/${collectionId}/download`);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!device || !configuration) return <p>Loading…</p>;

  return (
    <div>
      <h1>{device.name}</h1>
      <p>Type: {device.device_type}</p>
      <Link to="/devices">Back to devices</Link>
      {notice && <p>{notice}</p>}

      <h2>Firmware</h2>
      <p>Current: {current ? `${current.firmware_version} (deployed ${new Date(current.created_at).toLocaleString()})` : 'none'}</p>
      <form onSubmit={handleDeploy} className="inline-form">
        <select value={selectedFirmwareId} onChange={(event) => setSelectedFirmwareId(event.target.value)} required>
          <option value="" disabled>
            Select firmware
          </option>
          {firmwareOptions.map((fw) => (
            <option key={fw.id} value={fw.id}>
              {fw.version}
            </option>
          ))}
        </select>
        <button type="submit">Deploy</button>
      </form>
      <button onClick={handleRollback}>Rollback</button>

      <h3>Deployment history</h3>
      <ul>
        {deployments.map((deployment) => (
          <li key={deployment.id}>
            {deployment.firmware_version} — {deployment.command_status}
            {deployment.is_rollback ? ' (rollback)' : ''} — {new Date(deployment.created_at).toLocaleString()}
          </li>
        ))}
      </ul>

      <h2>Configuration</h2>
      <p>
        Desired version: {configuration.desired_version} | Reported version: {configuration.reported_version ?? 'n/a'}
      </p>
      <p>Reported config: {configuration.reported_config ? JSON.stringify(configuration.reported_config) : 'n/a'}</p>
      <form onSubmit={handlePushConfig}>
        <label>
          Desired config (JSON)
          <textarea
            rows={4}
            cols={50}
            value={desiredConfigText}
            onChange={(event) => setDesiredConfigText(event.target.value)}
          />
        </label>
        <button type="submit">Push configuration</button>
      </form>

      <h2>Diagnostics</h2>
      <button onClick={handleRequestDiagnostics}>Request diagnostics</button>
      <p>Latest: {diagnostics ? JSON.stringify(diagnostics.response) : 'none yet'}</p>

      <h2>Logs</h2>
      <button onClick={handleRequestLogs}>Request log collection</button>
      <ul>
        {collections.map((collection) => (
          <li key={collection.id}>
            #{collection.id} — {collection.status}
            {collection.status === 'uploaded' && (
              <>
                {' '}
                <button onClick={() => handleDownloadLog(collection.id)}>Download</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2>Power</h2>
      <button onClick={handleReboot}>Reboot device</button>
    </div>
  );
}
