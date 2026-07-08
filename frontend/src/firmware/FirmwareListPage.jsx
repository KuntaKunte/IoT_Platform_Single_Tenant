import { useEffect, useState } from 'react';
import { api, apiUpload } from '../api/client.js';

export default function FirmwareListPage() {
  const [firmware, setFirmware] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ deviceType: '', version: '', description: '' });
  const [file, setFile] = useState(null);

  async function load() {
    const result = await api.get('/firmware');
    setFirmware(result.firmware);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    try {
      if (!file) {
        setError('Select a firmware file first');
        return;
      }
      const formData = new FormData();
      formData.append('deviceType', form.deviceType);
      formData.append('version', form.version);
      formData.append('description', form.description);
      formData.append('file', file);

      await apiUpload('/firmware', formData);
      setForm({ deviceType: '', version: '', description: '' });
      setFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Firmware Registry</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Device type</th>
            <th>Version</th>
            <th>Size</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {firmware.map((fw) => (
            <tr key={fw.id}>
              <td>{fw.device_type}</td>
              <td>{fw.version}</td>
              <td>{fw.size_bytes} bytes</td>
              <td>{new Date(fw.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Upload firmware</h2>
      <form onSubmit={handleUpload} className="widget-form">
        <label>
          Device type
          <input value={form.deviceType} onChange={(event) => setForm({ ...form, deviceType: event.target.value })} required />
        </label>
        <label>
          Version
          <input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} required />
        </label>
        <label>
          Description
          <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <label>
          File
          <input type="file" onChange={(event) => setFile(event.target.files[0])} required />
        </label>
        <button type="submit">Upload</button>
      </form>
    </div>
  );
}
