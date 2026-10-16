import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import DashboardOverview from './pages/DashboardOverview';
import EventEditor from './pages/EventEditor';
import TicketTypes from './pages/TicketTypes';
import Companies from './pages/Companies';
import Coupons from './pages/Coupons';
import Registrations from './pages/Registrations';
import CheckIn from './pages/CheckIn';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Feedback from './pages/Feedback';
import AuditLog from './pages/AuditLog';
import Help from './pages/Help';
import ComingSoon from './pages/ComingSoon';

const OPS = ['superadmin', 'manager'];

function Shielded({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <Shielded>
                <DashboardOverview />
              </Shielded>
            }
          />
          <Route
            path="/event"
            element={
              <Shielded roles={OPS}>
                <EventEditor />
              </Shielded>
            }
          />
          <Route
            path="/ticket-types"
            element={
              <Shielded roles={OPS}>
                <TicketTypes />
              </Shielded>
            }
          />
          <Route
            path="/companies"
            element={
              <Shielded roles={OPS}>
                <Companies />
              </Shielded>
            }
          />
          <Route
            path="/coupons"
            element={
              <Shielded roles={OPS}>
                <Coupons />
              </Shielded>
            }
          />
          <Route
            path="/registrations"
            element={
              <Shielded roles={OPS}>
                <Registrations />
              </Shielded>
            }
          />
          <Route
            path="/checkin"
            element={
              <Shielded>
                <CheckIn />
              </Shielded>
            }
          />
          <Route
            path="/feedback"
            element={
              <Shielded roles={OPS}>
                <Feedback />
              </Shielded>
            }
          />
          <Route
            path="/reports"
            element={
              <Shielded roles={OPS}>
                <Reports />
              </Shielded>
            }
          />
          <Route
            path="/users"
            element={
              <Shielded roles={['superadmin']}>
                <Users />
              </Shielded>
            }
          />
          <Route
            path="/audit-log"
            element={
              <Shielded roles={['superadmin']}>
                <AuditLog />
              </Shielded>
            }
          />
          <Route
            path="/help"
            element={
              <Shielded>
                <Help />
              </Shielded>
            }
          />

          <Route
            path="*"
            element={
              <Shielded>
                <ComingSoon title="Not found" module="404" />
              </Shielded>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
