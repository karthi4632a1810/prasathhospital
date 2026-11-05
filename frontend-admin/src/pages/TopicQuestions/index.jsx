import { useCallback, useEffect, useState } from 'react';
import { topicQuestionApi } from '../../lib/topicQuestionApi';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import './index.css';

export default function TopicQuestions() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Export & Action state
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    topicQuestionApi
      .list({
        search: search.trim(),
        status: selectedStatus,
      })
      .then((res) => {
        setData(res.data);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle status toggle (shortlist/pending)
  const handleToggleShortlist = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'shortlisted' ? 'pending' : 'shortlisted';
    setActionError('');
    try {
      await topicQuestionApi.update(id, { status: nextStatus });
      setData((prev) =>
        (prev || []).map((item) => (item._id === id ? { ...item, status: nextStatus } : item))
      );
      if (meta) {
        setMeta((prev) => ({
          ...prev,
          shortlistedCount:
            nextStatus === 'shortlisted'
              ? (prev.shortlistedCount || 0) + 1
              : Math.max((prev.shortlistedCount || 0) - 1, 0),
        }));
      }
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Handle Delete Entire Submission
  const handleDeleteSubmission = async (id, doctorName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this entire submission from ${doctorName || 'this doctor'}?\n\nThis will permanently remove all questions submitted in this entry.`
    );
    if (!confirmed) return;

    setActionError('');
    setActionSuccess('');
    try {
      await topicQuestionApi.deleteSubmission(id);
      setActionSuccess(`Submission from ${doctorName || 'doctor'} was successfully deleted.`);
      setData((prev) => (prev || []).filter((item) => item._id !== id));
      if (meta) {
        setMeta((prev) => ({
          ...prev,
          totalDoctors: Math.max((prev.totalDoctors || 1) - 1, 0),
        }));
      }
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError('Failed to delete submission: ' + err.message);
    }
  };

  // Handle Delete Individual Question
  const handleDeleteQuestion = async (submissionId, questionId, questionText) => {
    const preview = questionText
      ? questionText.slice(0, 70) + (questionText.length > 70 ? '...' : '')
      : 'this question';
    const confirmed = window.confirm(`Are you sure you want to delete this question?\n\n"${preview}"`);
    if (!confirmed) return;

    setActionError('');
    setActionSuccess('');
    try {
      const res = await topicQuestionApi.deleteQuestion(submissionId, questionId);
      setActionSuccess('Question deleted successfully.');

      if (res.data?.deletedSubmission) {
        // If the last question was deleted, remove submission
        setData((prev) => (prev || []).filter((item) => item._id !== submissionId));
        if (meta) {
          setMeta((prev) => ({
            ...prev,
            totalDoctors: Math.max((prev.totalDoctors || 1) - 1, 0),
            totalQuestions: Math.max((prev.totalQuestions || 1) - 1, 0),
          }));
        }
      } else {
        // Update questions list within this submission
        setData((prev) =>
          (prev || []).map((item) => {
            if (item._id !== submissionId) return item;
            return {
              ...item,
              questions: (item.questions || []).filter((q) => q._id !== questionId),
            };
          })
        );
        if (meta) {
          setMeta((prev) => ({
            ...prev,
            totalQuestions: Math.max((prev.totalQuestions || 1) - 1, 0),
          }));
        }
      }

      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError('Failed to delete question: ' + err.message);
    }
  };

  // Handle Export CSV
  const handleExport = async () => {
    setExporting(true);
    setActionError('');
    try {
      await topicQuestionApi.downloadCsv();
    } catch (err) {
      setActionError('Failed to export questions: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="topic-questions-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Doctor Questions</h2>
          <p className="page-header__subtitle">
            Clinical doubts, debate points, and questions submitted by doctors for the CME Organising Committee at CIIM 2026.
          </p>
        </div>

        <div className="page-header__actions">
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={exporting || (data && data.length === 0)}
          >
            {exporting ? 'Exporting...' : '📥 Export to CSV / Excel'}
          </Button>
        </div>
      </div>

      {actionError && <div className="tq-alert tq-alert--error">{actionError}</div>}
      {actionSuccess && <div className="tq-alert tq-alert--success">{actionSuccess}</div>}

      {/* Summary Stat Tiles */}
      <div className="stat-grid tq-stat-grid">
        <div className="stat-tile">
          <p className="stat-tile__label">Total Doctors</p>
          <p className="stat-tile__value">{meta?.totalDoctors ?? '-'}</p>
        </div>

        <div className="stat-tile">
          <p className="stat-tile__label">Total Questions</p>
          <p className="stat-tile__value" style={{ color: 'var(--brand-600)' }}>
            {meta?.totalQuestions ?? '-'}
          </p>
        </div>

        <div className="stat-tile">
          <p className="stat-tile__label">Shortlisted for Panel</p>
          <p className="stat-tile__value" style={{ color: 'var(--success-600)' }}>
            {meta?.shortlistedCount ?? '-'}
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="tq-filter-bar card">
        <div className="tq-filter-bar__inner">
          <div className="tq-filter-bar__search">
            <input
              type="text"
              placeholder="Search by doctor name, phone, email, or question text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field__input"
            />
          </div>

          <div className="tq-filter-bar__selects">
            <select
              className="field__select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="addressed">Addressed</option>
            </select>

            {(search || selectedStatus) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedStatus('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content State */}
      {loading && !data ? (
        <LoadingState label="Loading submitted questions..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No questions found"
          message={
            search || selectedStatus
              ? 'No submissions match your active filter criteria.'
              : 'Doctor submissions from the public form will appear here in real-time.'
          }
        />
      ) : (
        <div className="tq-list">
          {data.map((item) => {
            const isShortlisted = item.status === 'shortlisted';
            const questions = item.questions || [];

            return (
              <div
                key={item._id}
                className={`card tq-card ${isShortlisted ? 'tq-card--shortlisted' : ''}`}
              >
                {/* Doctor Info Header */}
                <div className="tq-card__header">
                  <div className="tq-card__doctor">
                    <h3 className="tq-card__doctor-name">
                      {item.doctorName}
                    </h3>

                    <div className="tq-card__doctor-meta">
                      {item.phone && (
                        <a href={`tel:${item.phone}`} className="tq-link">
                          📱 {item.phone}
                        </a>
                      )}
                      {item.email && (
                        <a href={`mailto:${item.email}`} className="tq-link">
                          ✉️ {item.email}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="tq-card__header-actions">
                    <span
                      className={`tq-status-badge tq-status-badge--${item.status || 'pending'}`}
                    >
                      {item.status === 'shortlisted'
                        ? '★ Shortlisted'
                        : item.status === 'addressed'
                        ? '✓ Addressed'
                        : 'Pending'}
                    </span>

                    <button
                      type="button"
                      className={`tq-shortlist-btn ${isShortlisted ? 'is-active' : ''}`}
                      onClick={() => handleToggleShortlist(item._id, item.status)}
                      title={
                        isShortlisted
                          ? 'Remove from panel shortlist'
                          : 'Shortlist this doctor’s questions for panel debate'
                      }
                    >
                      {isShortlisted ? '★ Shortlisted' : '☆ Shortlist'}
                    </button>

                    <button
                      type="button"
                      className="tq-delete-submission-btn"
                      onClick={() => handleDeleteSubmission(item._id, item.doctorName)}
                      title="Delete this entire submission"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete Submission
                    </button>

                    <span className="tq-card__time">{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>

                {/* Questions List (Clean: Question #, Text, and Delete) */}
                <div className="tq-card__body">
                  <div className="tq-questions-grid">
                    {questions.map((q, qIdx) => (
                      <div key={q._id || qIdx} className="tq-q-box">
                        <div className="tq-q-box__top">
                          <span className="tq-q-box__num">Question #{qIdx + 1}</span>

                          <button
                            type="button"
                            className="tq-delete-q-btn"
                            onClick={() => handleDeleteQuestion(item._id, q._id, q.question)}
                            title="Delete this question"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Delete Question
                          </button>
                        </div>

                        <p className="tq-q-box__text">{q.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
