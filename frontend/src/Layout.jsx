import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/dashboards" className="brand">
          IoT Platform
        </Link>
        <Link to="/reports">Reports</Link>
        <Link to="/devices">Devices</Link>
        <Link to="/firmware">Firmware</Link>
        <Link to="/plugins">Plugins</Link>
        <button onClick={logout}>Log out</button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
