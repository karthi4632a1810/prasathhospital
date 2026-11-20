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
import IdCardStudio from './pages/IdCardStudio';
import Communications from './pages/Communications';
import WhatsAppMarketing from './pages/WhatsAppMarketing';
import WhatsAppEmailMarketing from './pages/WhatsAppEmailMarketing';
import CheckIn from './pages/CheckIn';
import CheckinLocations from './pages/CheckinLocations';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Feedback from './pages/Feedback';
import TopicQuestions from './pages/TopicQuestions';
import AuditLog from './pages/AuditLog';
import Help from './pages/Help';
import ComingSoon from './pages/ComingSoon';

const OPS = ['superadmin', 'manager'];
const COUNTER_ROLES = ['superadmin', 'manager', 'counter_staff'];

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
              <Shielded roles={COUNTER_ROLES}>
                <Registrations />
              </Shielded>
            }
          />
          <Route
            path="/id-cards"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <IdCardStudio />
              </Shielded>
            }
          />
          <Route
            path="/communications"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <Communications />
              </Shielded>
            }
          />
          <Route
            path="/whatsapp-marketing"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <WhatsAppMarketing />
              </Shielded>
            }
          />
          <Route
            path="/whatsapp-email-marketing"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <WhatsAppEmailMarketing />
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
            path="/checkin-locations"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <CheckinLocations />
              </Shielded>
            }
          />
          <Route
            path="/feedback"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <Feedback />
              </Shielded>
            }
          />
          <Route
            path="/topic-questions"
            element={
              <Shielded roles={COUNTER_ROLES}>
                <TopicQuestions />
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
              <Shielded roles={OPS}>
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
