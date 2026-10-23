import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import EventMicrosite from './pages/EventMicrosite';
import RegisterPage from './pages/RegisterPage';
import TicketPage from './pages/TicketPage';
import FeedbackPage from './pages/FeedbackPage';
import { NotFoundState } from './components/ui/States';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Root shows the featured/default event so a bare campaign link works. */}
        <Route path="/" element={<EventMicrosite />} />
        <Route path="/events/:slug" element={<EventMicrosite />} />
        <Route path="/events/:slug/register" element={<RegisterPage />} />
        <Route path="/tickets/:qrToken" element={<TicketPage />} />
        <Route path="/feedback/:qrToken" element={<FeedbackPage />} />

        <Route path="/404" element={<NotFoundState />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
