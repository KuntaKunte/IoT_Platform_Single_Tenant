import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function DeviceListPage() {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/devices/registry')
      .then((result) => setDevices(result.devices))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Devices</h1>
      <ul className="dashboard-list">
        {devices.map((device) => (
          <li key={device.id}>
            <Link to={`/devices/${device.id}`}>{device.name}</Link> ({device.device_type})
          </li>
        ))}
      </ul>
    </div>
  );
}
