import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../../lib/aiApi';
import Button from '../../components/ui/Button';
import './AiChat.css';

const QUICK_PROMPTS = [
  { label: '🎓 Certificate for Karthikeyan', prompt: 'I want certificate for this name Karthikeyan' },
  { label: '🪪 Instant ID Card', prompt: 'Create instant ID card for Dr. Karthikeyan' },
  {
    label: '📊 TNMC Scanned-in Excel (Name, Email, Phone)',
    prompt:
      'I want only TNMC registor user who have the scaned in and i waant only detail od name , email and phone in excel',
  },
  { label: '📈 Overall Registration Stats', prompt: 'How many delegates registered and checked in?' },
  { label: '🔍 Non-TNMC Delegates', prompt: 'Show attendees without TNMC' },
];

export default function AiChat() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      text: `Hello! I am your **CIIM 2026 AI Assistant** powered by Groq & Gemini.\n\nYou can ask me anything about the event or request instant actions:\n\n- 🎓 **Instant Certificates**: *"I want certificate for this name Karthikeyan"* → Get PNG, JPG, and PDF download links!\n- 🪪 **Instant ID Cards**: *"Create instant ID card for Dr. Karthikeyan"* → Download ready in PNG, JPG, and PDF!\n- 📊 **Custom Excel Reports**: *"I want only TNMC registor user who have the scaned in and i waant only detail od name , email and phone in excel"* → Generates Excel with only those 3 columns!\n- 🔍 **Database Queries & Stats**: Ask to check totals, find attendees, update details, or cancel registrations.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(textToSend) {
    const prompt = (textToSend || input).trim();
    if (!prompt || loading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      text: prompt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiApi.chat(prompt);
      const aiData = res.data || {};

      const aiMsg = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        text: aiData.reply || 'Request processed successfully.',
        action: aiData.action,
        downloads: aiData.downloads,
        excelDownload: aiData.excelDownload,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: 'ai',
          text: `⚠️ **Error:** ${err.message || 'Failed to process your request. Please try again.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleDownloadItem(download) {
    if (download.url) {
      window.open(download.url, '_blank');
    }
  }

  function handleExcelDownload(fileId, filename) {
    aiApi.downloadExcel(fileId, filename);
  }

  function clearHistory() {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'ai',
        text: 'Chat history cleared. How can I assist you with CIIM 2026 admin today?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }

  return (
    <div className="aichat-container">
      {/* Top Header */}
      <div className="aichat-header">
        <div className="aichat-header__left">
          <div className="aichat-avatar-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
            </svg>
          </div>
          <div>
            <h2 className="aichat-header__title">
              CIIM 2026 Admin AI Assistant
              <span className="aichat-badge-status">
                <span></span> Active
              </span>
            </h2>
            <p className="aichat-header__subtitle">
              Instant Certificates, ID Cards, Custom Excel Reports &amp; Database Controls
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={clearHistory}>
          Clear Chat
        </Button>
      </div>

      {/* Messages Scroll View */}
      <div className="aichat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`aichat-msg is-${m.role}`}>
            <div className="aichat-msg__avatar">
              {m.role === 'user' ? (
                'You'
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                </svg>
              )}
            </div>

            <div className="aichat-msg__content">
              <div className="aichat-msg__bubble">{m.text}</div>

              {/* Render Instant Certificate / ID Card Downloads */}
              {m.downloads && m.downloads.length > 0 && (
                <div className="aichat-card-actions">
                  <div className="aichat-card-actions__header">
                    <h4 className="aichat-card-actions__title">
                      <span>📥</span> Available Instant Export Formats:
                    </h4>
                  </div>
                  <div className="aichat-buttons-group">
                    {m.downloads.map((dl) => (
                      <button
                        key={dl.format}
                        type="button"
                        className={`aichat-btn-dl is-${dl.format}`}
                        onClick={() => handleDownloadItem(dl)}
                      >
                        <span>⬇</span> {dl.label} (.{dl.format.toUpperCase()})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Custom Excel Download */}
              {m.excelDownload && (
                <div className="aichat-card-actions">
                  <div className="aichat-card-actions__header">
                    <h4 className="aichat-card-actions__title">
                      <span>📊</span> Excel File Ready ({m.excelDownload.rowCount} Rows)
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>
                      Columns: {m.excelDownload.columns?.join(', ')}
                    </span>
                  </div>
                  <div className="aichat-buttons-group">
                    <button
                      type="button"
                      className="aichat-btn-dl is-excel"
                      onClick={() =>
                        handleExcelDownload(m.excelDownload.fileId, m.excelDownload.filename)
                      }
                    >
                      <span>📥</span> Download Excel (.XLSX)
                    </button>
                  </div>
                </div>
              )}

              <span className="aichat-msg__time">{m.time}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="aichat-msg is-ai">
            <div className="aichat-msg__avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
            </div>
            <div className="aichat-msg__bubble" style={{ fontStyle: 'italic', color: 'var(--ink-500)' }}>
              Thinking &amp; executing request…
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="aichat-prompts-bar">
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            className="aichat-prompt-pill"
            onClick={() => handleSend(qp.prompt)}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <div className="aichat-input-bar">
        <textarea
          ref={inputRef}
          rows="1"
          placeholder="Ask anything (e.g. 'I want certificate for Karthikeyan', 'Give only TNMC users in excel with name, email and phone', 'Total registrations')..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          type="button"
          className="aichat-btn-send"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <span>Send</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}
