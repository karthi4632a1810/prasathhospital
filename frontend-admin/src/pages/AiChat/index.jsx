import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../../lib/aiApi';
import { getToken } from '../../lib/api';
import { downloadFile } from '../../lib/download';
import Button from '../../components/ui/Button';
import './AiChat.css';

const QUICK_PROMPTS = [
  {
    icon: '🎓',
    label: 'Certificate for Karthikeyan',
    prompt: 'I want certificate for this name Karthikeyan',
  },
  {
    icon: '🪪',
    label: 'Instant ID Card',
    prompt: 'Create instant ID card for Dr. Karthikeyan',
  },
  {
    icon: '📊',
    label: 'TNMC Scanned-in Excel',
    prompt:
      'I want only TNMC registor user who have the scaned in and i waant only detail od name , email and phone in excel',
  },
  {
    icon: '📈',
    label: 'Overall Stats',
    prompt: 'How many delegates registered and checked in?',
  },
  {
    icon: '🔍',
    label: 'Non-TNMC Delegates',
    prompt: 'Show attendees without TNMC',
  },
];

function renderInline(str) {
  if (!str) return '';
  const parts = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={keyIdx++} className="aichat-md-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={keyIdx++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={keyIdx++}>{token.slice(1, -1)}</em>);
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }
  return parts.length ? parts : str;
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let currentList = null;

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      if (currentList) {
        elements.push(currentList);
        currentList = null;
      }
      elements.push(
        <h4 key={lineIdx} className="aichat-md-h4">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      if (currentList) {
        elements.push(currentList);
        currentList = null;
      }
      elements.push(
        <h3 key={lineIdx} className="aichat-md-h3">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*•]\s+/, '');
      if (!currentList || currentList.type !== 'ul') {
        if (currentList) elements.push(currentList);
        currentList = { type: 'ul', key: `ul_${lineIdx}`, items: [] };
      }
      currentList.items.push(<li key={`li_${lineIdx}`}>{renderInline(content)}</li>);
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      if (!currentList || currentList.type !== 'ol') {
        if (currentList) elements.push(currentList);
        currentList = { type: 'ol', key: `ol_${lineIdx}`, items: [] };
      }
      currentList.items.push(<li key={`li_${lineIdx}`}>{renderInline(content)}</li>);
      return;
    }

    if (currentList) {
      elements.push(
        currentList.type === 'ul' ? (
          <ul key={currentList.key} className="aichat-md-ul">
            {currentList.items}
          </ul>
        ) : (
          <ol key={currentList.key} className="aichat-md-ol">
            {currentList.items}
          </ol>
        )
      );
      currentList = null;
    }

    if (!trimmed) {
      elements.push(<div key={`sp_${lineIdx}`} className="aichat-md-space" />);
      return;
    }

    elements.push(
      <p key={lineIdx} className="aichat-md-p">
        {renderInline(line)}
      </p>
    );
  });

  if (currentList) {
    elements.push(
      currentList.type === 'ul' ? (
        <ul key={currentList.key} className="aichat-md-ul">
          {currentList.items}
        </ul>
      ) : (
        <ol key={currentList.key} className="aichat-md-ol">
          {currentList.items}
        </ol>
      )
    );
  }

  return elements;
}

export default function AiChat() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      text: `Hello! I am your **CIIM 2026 Admin AI Assistant** powered by Groq & Gemini.\n\nAsk me anything in plain language or try these instant actions:\n\n- 🎓 **Instant Certificates**: *"I want certificate for this name Karthikeyan"* → Get PNG, JPG, and PDF download links!\n- 🪪 **Instant ID Cards**: *"Create instant ID card for Dr. Karthikeyan"* → Download ready in PNG, JPG, and PDF!\n- 📊 **Custom Excel Reports**: *"I want only TNMC registor user who have the scaned in and i waant only detail od name , email and phone in excel"* → Generates custom Excel with only those 3 columns!\n- 🔍 **Database Queries & Stats**: Total registrations, check-in stats, find attendees, or cancel registrations.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleInputChange(e) {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
  }

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
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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

  async function handleDownloadItem(download, msgId) {
    if (!download || !download.url) return;
    const key = `${download.label}_${download.format}_${msgId || ''}`;
    setDownloadingKey(key);
    setDownloadNotice(null);

    const fmt = (download.format || 'png').toLowerCase().replace(/^\./, '');
    const cleanName = (download.name || 'Delegate')
      .replace(/^Dr\.\s*/i, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeLabel = (download.label || 'Card')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `CIIM2026_${safeLabel}_${cleanName}.${fmt}`;

    try {
      await downloadFile(download.url, filename);
      setDownloadNotice({
        type: 'success',
        text: `Downloaded ${filename} successfully!`,
      });
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err) {
      console.warn('downloadFile failed, trying authenticated direct download:', err);
      try {
        const token = getToken();
        const sep = download.url.includes('?') ? '&' : '?';
        const rawUrl = download.url.startsWith('/api/v1')
          ? download.url
          : `/api/v1${download.url.startsWith('/') ? download.url : `/${download.url}`}`;
        const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const authUrl = `${base}${rawUrl}${sep}token=${encodeURIComponent(token || '')}`;

        const fallbackLink = document.createElement('a');
        fallbackLink.href = authUrl;
        fallbackLink.download = filename;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        setTimeout(() => {
          try {
            fallbackLink.remove();
          } catch {}
        }, 2000);

        setDownloadNotice({
          type: 'success',
          text: `Download started: ${filename}`,
        });
        setTimeout(() => setDownloadNotice(null), 4000);
      } catch {
        setDownloadNotice({
          type: 'error',
          text: `Download failed: ${err.message || 'Please try again.'}`,
        });
      }
    } finally {
      setDownloadingKey(null);
    }
  }

  async function handleExcelDownload(fileId, filename) {
    if (!fileId) return;
    const key = `excel_${fileId}`;
    setDownloadingKey(key);
    setDownloadNotice(null);
    try {
      await aiApi.downloadExcel(fileId, filename);
      setDownloadNotice({
        type: 'success',
        text: `Downloaded ${filename || 'Excel report'} successfully!`,
      });
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err) {
      setDownloadNotice({
        type: 'error',
        text: `Failed to download Excel: ${err.message || 'File may have expired.'}`,
      });
    } finally {
      setDownloadingKey(null);
    }
  }

  function clearHistory() {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'ai',
        text: 'Chat history cleared. How can I assist you with CIIM 2026 operations today?',
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
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
            </svg>
          </div>
          <div>
            <h2 className="aichat-header__title">
              CIIM 2026 Admin AI Assistant
              <span className="aichat-badge-status">
                <span></span> Active
              </span>
              <span className="aichat-badge-model">Groq + Gemini</span>
            </h2>
            <p className="aichat-header__subtitle">
              Instant Certificates, ID Cards, Custom Excel Reports &amp; Database Controls
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={clearHistory}>
          <span>🗑️</span> Clear Chat
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                </svg>
              )}
            </div>

            <div className="aichat-msg__content">
              <div className="aichat-msg__bubble">
                {m.role === 'ai' ? renderMarkdown(m.text) : m.text}
              </div>

              {/* Render Instant Certificate / ID Card Downloads */}
              {m.downloads && m.downloads.length > 0 && (
                <div className="aichat-card-actions">
                  <div className="aichat-card-actions__header">
                    <h4 className="aichat-card-actions__title">
                      <span>📥</span> Available Instant Export Formats:
                    </h4>
                  </div>
                  <div className="aichat-buttons-group">
                    {m.downloads.map((dl) => {
                      const itemKey = `${dl.label}_${dl.format}_${m.id}`;
                      const isDownloading = downloadingKey === itemKey;
                      return (
                        <button
                          key={dl.format}
                          type="button"
                          className={`aichat-btn-dl is-${dl.format} ${isDownloading ? 'is-busy' : ''}`}
                          onClick={() => handleDownloadItem(dl, m.id)}
                          disabled={Boolean(downloadingKey)}
                          title={`Download ${dl.label} (.${dl.format.toUpperCase()})`}
                        >
                          {isDownloading ? (
                            <>
                              <span className="aichat-spinner" />
                              <span>Downloading…</span>
                            </>
                          ) : (
                            <>
                              <span>⬇</span>
                              <span>{dl.label} (.{dl.format.toUpperCase()})</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {downloadNotice && (
                    <div className={`aichat-dl-notice is-${downloadNotice.type}`}>
                      <span>{downloadNotice.type === 'success' ? '✅' : '⚠️'}</span>
                      <span>{downloadNotice.text}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Render Custom Excel Download */}
              {m.excelDownload && (
                <div className="aichat-card-actions">
                  <div className="aichat-card-actions__header">
                    <h4 className="aichat-card-actions__title">
                      <span>📊</span> Custom Excel Ready ({m.excelDownload.rowCount} Rows)
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>
                      Columns: {m.excelDownload.columns?.join(', ')}
                    </span>
                  </div>
                  <div className="aichat-buttons-group">
                    <button
                      type="button"
                      className={`aichat-btn-dl is-excel ${downloadingKey === `excel_${m.excelDownload.fileId}` ? 'is-busy' : ''}`}
                      onClick={() =>
                        handleExcelDownload(m.excelDownload.fileId, m.excelDownload.filename)
                      }
                      disabled={Boolean(downloadingKey)}
                    >
                      {downloadingKey === `excel_${m.excelDownload.fileId}` ? (
                        <>
                          <span className="aichat-spinner" />
                          <span>Downloading Excel…</span>
                        </>
                      ) : (
                        <>
                          <span>📥</span> Download Excel (.XLSX)
                        </>
                      )}
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
            </div>
            <div className="aichat-msg__bubble aichat-msg__bubble--loading">
              <span className="aichat-typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Thinking &amp; executing request…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Section: Quick Prompts & Modern Input Box */}
      <div className="aichat-bottom-panel">
        {/* Quick Prompts Bar */}
        <div className="aichat-prompts-bar">
          <span className="aichat-prompts-label">✨ Quick:</span>
          <div className="aichat-prompts-scroll">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                className="aichat-prompt-pill"
                onClick={() => handleSend(qp.prompt)}
              >
                <span>{qp.icon}</span>
                <span>{qp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Card Container with aligned layout */}
        <div className="aichat-input-wrapper">
          <div className="aichat-input-box">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask anything (e.g. 'I want certificate for Karthikeyan', 'Give only TNMC users in excel with name, email and phone', 'Total registrations')..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />

            <div className="aichat-input-actions">
              <div className="aichat-input-hints">
                <span className="aichat-key-hint">
                  <kbd>Enter ↵</kbd> send &bull; <kbd>Shift+Enter</kbd> new line
                </span>
              </div>

              <div className="aichat-input-btns">
                {input.trim() && (
                  <button
                    type="button"
                    className="aichat-btn-clear-input"
                    onClick={() => {
                      setInput('');
                      if (inputRef.current) {
                        inputRef.current.style.height = 'auto';
                        inputRef.current.focus();
                      }
                    }}
                    title="Clear text"
                  >
                    ✕
                  </button>
                )}

                <button
                  type="button"
                  className="aichat-btn-send"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  title={loading ? 'Thinking…' : 'Send message (Enter)'}
                >
                  {loading ? (
                    <span className="aichat-spinner" />
                  ) : (
                    <>
                      <span>Send</span>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
