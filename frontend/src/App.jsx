import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import Layout from './Layout.jsx';
import DashboardListPage from './dashboards/DashboardListPage.jsx';
import DashboardViewPage from './dashboards/DashboardViewPage.jsx';
import DashboardEditPage from './dashboards/DashboardEditPage.jsx';
import ReportListPage from './reports/ReportListPage.jsx';
import ReportViewPage from './reports/ReportViewPage.jsx';
import ReportEditPage from './reports/ReportEditPage.jsx';
import ReportSchedulesPage from './reports/ReportSchedulesPage.jsx';
import DeviceListPage from './devices/DeviceListPage.jsx';
import DeviceManagementPage from './devices/DeviceManagementPage.jsx';
import FirmwareListPage from './firmware/FirmwareListPage.jsx';
import PluginListPage from './plugins/PluginListPage.jsx';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboards" replace />} />
        <Route path="dashboards" element={<DashboardListPage />} />
        <Route path="dashboards/:dashboardId" element={<DashboardViewPage />} />
        <Route path="dashboards/:dashboardId/edit" element={<DashboardEditPage />} />
        <Route path="reports" element={<ReportListPage />} />
        <Route path="reports/:reportId" element={<ReportViewPage />} />
        <Route path="reports/:reportId/edit" element={<ReportEditPage />} />
        <Route path="reports/:reportId/schedules" element={<ReportSchedulesPage />} />
        <Route path="devices" element={<DeviceListPage />} />
        <Route path="devices/:deviceId" element={<DeviceManagementPage />} />
        <Route path="firmware" element={<FirmwareListPage />} />
        <Route path="plugins" element={<PluginListPage />} />
      </Route>
    </Routes>
  );
}
