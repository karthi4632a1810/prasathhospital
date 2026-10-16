import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Button from '../components/ui/Button';
import { LoadingState, ErrorState, NotFoundState } from '../components/ui/States';

import { api, ApiError } from '../lib/api';
import './FeedbackPage.css';

export default function FeedbackPage() {
  const { qrToken } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api
      .getTicket(qrToken)
      .then((res) => setState({ status: 'ready', data: res.data, error: null }))
      .catch((err) =>
        setState({ status: err.status === 404 ? 'not-found' : 'error', data: null, error: err })
      );
  }, [qrToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) {
      setSubmitError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.submitFeedback({ qrToken, rating, comments });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'not-found') {
    return <NotFoundState message="This feedback link is invalid or has expired." />;
  }
  if (state.status === 'error') return <ErrorState message={state.error?.message} />;

  const ticket = state.data;

  return (
    <>
      <SiteHeader event={ticket.event} canRegister={false} availableSections={[]} />
      <main id="main" className="feedback-page">
        <div className="container feedback-page__grid">
          {submitted ? (
            <div className="feedback-card feedback-card--success">
              <div className="feedback-card__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="36"
                  height="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1>Thank you!</h1>
              <p>Your feedback for {ticket.event.title} has been recorded.</p>
              <Button variant="primary" href="/">
                Back to Prashanth Hospitals
              </Button>
            </div>
          ) : (
            <div className="feedback-card">
              <p className="feedback-card__eyebrow">{ticket.event.title}</p>
              <h1 className="feedback-card__title">How was your experience?</h1>
              <p className="feedback-card__subtitle">
                Hi {ticket.attendee.name}, your feedback helps us improve future events.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="star-rating" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      className={`star-rating__star ${(hoverRating || rating) >= n ? 'is-filled' : ''}`}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <label className="feedback-field">
                  <span>Comments (optional)</span>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="What went well? What could be better?"
                    rows={4}
                  />
                </label>

                {submitError && <p className="feedback-error">{submitError}</p>}

                <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit feedback'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
      <SiteFooter event={ticket.event} />
    </>
  );
}
