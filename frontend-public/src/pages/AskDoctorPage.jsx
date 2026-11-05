import { useState } from 'react';
import { Link } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Button from '../components/ui/Button';
import { api, ApiError } from '../lib/api';
import './AskDoctorPage.css';

export const CONFERENCE_TOPICS = [
  { id: 1, title: 'Thin Endometrium', desc: 'PRP, G-CSF, Asherman syndrome & refractory endometrium protocols' },
  { id: 2, title: 'Low Ovarian Reserve & Exosomes', desc: 'Intraovarian exosome therapy, POSEIDON criteria & priming' },
  { id: 3, title: 'Recurrent Implantation Failure', desc: 'Euploid blastocyst failure, ERA timing, CD138 & immunotherapy' },
  { id: 4, title: 'Recurrent Pregnancy Loss', desc: 'APLA, thrombophilia, LMWH/Aspirin, Sperm DFI & genetics' },
  { id: 5, title: 'Adenomyosis & Fertility', desc: 'Depot GnRH agonists, junctional zone & adenomyomectomy' },
];

export default function AskDoctorPage() {
  // Attendee Information: Only 3 required fields
  const [doctorInfo, setDoctorInfo] = useState({
    doctorName: '',
    email: '',
    phone: '',
  });

  // Questions: Start with ONLY ONE question input field
  const [questions, setQuestions] = useState([
    { id: 'q-1', text: '' },
  ]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Popup Alert Modal state
  const [alertModal, setAlertModal] = useState({
    open: false,
    title: '',
    message: '',
  });

  const showAlert = (title, message) => {
    setAlertModal({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertModal({ open: false, title: '', message: '' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  // Attendee input change
  const handleInfoChange = (field, value) => {
    setDoctorInfo((prev) => ({ ...prev, [field]: value }));
  };

  // Question text change
  const handleQuestionChange = (id, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text: value } : q))
    );
  };

  // Add Question button: Unlocks another question input field
  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${prev.length + 1}`,
        text: '',
      },
    ]);
  };

  // Remove question
  const handleRemoveQuestion = (id) => {
    setQuestions((prev) => {
      if (prev.length <= 1) {
        return [{ id: 'q-1', text: '' }];
      }
      return prev.filter((q) => q.id !== id);
    });
  };

  // Form Submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // 1. Validate Attendee Inputs
    if (!doctorInfo.doctorName.trim() || doctorInfo.doctorName.trim().length < 2) {
      showAlert('Name Required', 'Please enter your full name (e.g. Dr. Priya Raman).');
      return;
    }

    const cleanEmail = doctorInfo.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      showAlert('Valid Email Required', 'Please enter a valid email address (e.g. doctor@hospital.org).');
      return;
    }

    const cleanPhone = doctorInfo.phone.replace(/[\s()-]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      showAlert('Phone Number Required', 'Please enter a valid mobile or WhatsApp number (at least 10 digits).');
      return;
    }

    // 2. Validate Questions: Collect all non-empty questions
    const validQuestions = questions
      .map((q) => ({
        question: q.text.trim(),
        topic: 'General / CME Question',
        targetFaculty: 'Organising Committee of CME',
      }))
      .filter((q) => q.question.length >= 3);

    if (validQuestions.length === 0) {
      showAlert('Question Required', 'Please enter at least one question in Question 1 before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctorName: doctorInfo.doctorName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        eventSlug: 'fertility-gynaecology-summit-2026',
        questions: validQuestions,
      };

      const res = await api.submitTopicQuestions(payload);

      setSubmittedData({
        refId: res.data?.id || `CIIM-Q-${Math.floor(100000 + Math.random() * 900000)}`,
        doctorName: doctorInfo.doctorName.trim(),
        totalQuestions: validQuestions.length,
        questions: validQuestions,
      });

      scrollToTop();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit questions. Please try again.';
      showAlert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setDoctorInfo({ doctorName: '', email: '', phone: '' });
    setQuestions([{ id: 'q-1', text: '' }]);
    scrollToTop();
  };

  return (
    <>
      <SiteHeader
        event={{ title: 'CIIM 2026' }}
        canRegister={true}
        onRegister={() => (window.location.href = '/#tickets')}
        availableSections={['about', 'speakers', 'agenda', 'tickets']}
      />

      <main id="main" className="ask-page">
        <div className="container ask-page__container">
          <Link to="/" className="ask-page__back">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Conference Overview
          </Link>

          {/* Banner Flyer Header */}
          <header className="ask-header">
            <div className="ask-header__badge">CIIM 2026 • Interactive Scientific Panel</div>
            <h1 className="ask-header__title">
              ASK QUESTIONS IN <br />
              <span>THE FOLLOWING TOPICS</span>
            </h1>
            <p className="ask-header__subtitle">
              You are welcome to ask questions on <strong>any topic</strong>. The topics below are suggestions from our scientific committee to guide your questions. All questions will be reviewed and addressed by the <strong>Organising Committee of CME</strong>.
            </p>
          </header>

          {/* SUCCESS SCREEN */}
          {submittedData ? (
            <div className="ask-success animate-fadeIn">
              <div className="ask-success__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2 className="ask-success__title">Questions Submitted Successfully!</h2>
              <p className="ask-success__lead">
                Thank you, <strong>{submittedData.doctorName}</strong>. Your questions have been forwarded directly to the <strong>Organising Committee of CME</strong> for the panel discussions at <strong>CIIM 2026</strong>.
              </p>

              <div className="ask-success__ref">
                Reference ID: <code>{submittedData.refId}</code>
              </div>

              <div className="ask-success__body">
                <h3 className="ask-success__body-title">
                  Submitted Questions ({submittedData.totalQuestions})
                </h3>
                <ul className="ask-success__list">
                  {submittedData.questions.map((q, idx) => (
                    <li key={idx} className="ask-success__item">
                      <span className="ask-success__item-num">Question #{idx + 1}</span>
                      <p className="ask-success__item-text">{q.question}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ask-success__actions">
                <Button variant="outline" onClick={handleResetForm}>
                  Ask Another Question
                </Button>
                <Button variant="primary" href="/">
                  Return to Conference Page
                </Button>
              </div>
            </div>
          ) : (
            /* SIMPLE SINGLE-PAGE FORM */
            <form className="ask-card animate-fadeIn" onSubmit={handleSubmit} noValidate>

              {/* 1. ATTENDEE INFORMATION (TOP 3 INPUTS) */}
              <div className="ask-section">
                <div className="ask-section__header">
                  <span className="ask-section__badge">1</span>
                  <h2 className="ask-section__title">Attendee Information</h2>
                </div>
                <p className="ask-section__desc">
                  Please provide your contact information to receive updates and panel outcomes.
                </p>

                <div className="ask-inputs-row">
                  <label className="ask-field">
                    <span className="ask-field__label">
                      Name <span className="req">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Priya Raman"
                      value={doctorInfo.doctorName}
                      onChange={(e) => handleInfoChange('doctorName', e.target.value)}
                    />
                  </label>

                  <label className="ask-field">
                    <span className="ask-field__label">
                      Email ID <span className="req">*</span>
                    </span>
                    <input
                      type="email"
                      inputMode="email"
                      required
                      placeholder="e.g. doctor@hospital.org"
                      value={doctorInfo.email}
                      onChange={(e) => handleInfoChange('email', e.target.value)}
                    />
                  </label>

                  <label className="ask-field">
                    <span className="ask-field__label">
                      Phone Number <span className="req">*</span>
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={doctorInfo.phone}
                      onChange={(e) => handleInfoChange('phone', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {/* 2. TOPICS SECTION (SHOWN AFTER ATTENDEE INFORMATION AS SUGGESTIONS) */}
              <div className="ask-section">
                <div className="ask-section__header">
                  <span className="ask-section__badge">2</span>
                  <div className="ask-section__header-text">
                    <h2 className="ask-section__title">Suggested Topics for Discussion</h2>
                    <span className="ask-section__pill-hint">Questions on ANY topic are welcome</span>
                  </div>
                </div>
                <p className="ask-section__desc">
                  The topics below are <strong>suggestions</strong> to guide your questions, not fixed boundaries. You are completely free to ask about <strong>any clinical dilemma or topic</strong>:
                </p>

                <div className="ask-topics-grid">
                  {CONFERENCE_TOPICS.map((topic) => (
                    <div key={topic.id} className="ask-topic-item">
                      <span className="ask-topic-item__num">{topic.id}</span>
                      <div className="ask-topic-item__content">
                        <strong className="ask-topic-item__title">{topic.title}</strong>
                        <span className="ask-topic-item__desc">{topic.desc}</span>
                      </div>
                    </div>
                  ))}

                  <div className="ask-topic-item ask-topic-item--open">
                    <span className="ask-topic-item__num ask-topic-item__num--open">★</span>
                    <div className="ask-topic-item__content">
                      <strong className="ask-topic-item__title">Any Other Clinical Topic</strong>
                      <span className="ask-topic-item__desc">
                        Open to any fertility, IVF, embryology, or gynaecology dilemma.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. QUESTION INPUT & ADD QUESTION BUTTON */}
              <div className="ask-section">
                <div className="ask-section__header">
                  <span className="ask-section__badge">3</span>
                  <h2 className="ask-section__title">Your Questions</h2>
                </div>
                <p className="ask-section__desc">
                  Type your clinical question on any topic below. Click "Add Question" if you wish to ask more questions.
                </p>

                <div className="ask-questions-container">
                  {questions.map((q, index) => {
                    const isFirst = index === 0;
                    return (
                      <div key={q.id} className="ask-q-card">
                        <div className="ask-q-card__header">
                          <span className="ask-q-card__title">
                            Question {index + 1} {isFirst && <span className="ask-q-card__req">(Required)</span>}
                          </span>

                          {!isFirst && (
                            <button
                              type="button"
                              className="ask-q-card__remove"
                              onClick={() => handleRemoveQuestion(q.id)}
                              title="Remove this question"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        <textarea
                          rows={3}
                          className="ask-q-card__textarea"
                          required={isFirst}
                          placeholder={
                            isFirst
                              ? 'Type your question on any topic for the CME Organising Committee...'
                              : `Type question #${index + 1} on any topic...`
                          }
                          value={q.text}
                          onChange={(e) => handleQuestionChange(q.id, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Next below: ADD QUESTION button to unlock more question fields */}
                <div className="ask-add-action">
                  <button
                    type="button"
                    className="ask-add-btn"
                    onClick={handleAddQuestion}
                  >
                    <span className="ask-add-btn__plus">+</span>
                    <span>Add Question</span>
                  </button>
                </div>
              </div>

              {/* 4. SIMPLE SUBMIT AT BOTTOM */}
              <div className="ask-footer-bar">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={submitting}
                  className="ask-footer-bar__submit"
                >
                  {submitting ? 'Submitting Questions...' : 'Submit Questions to Organising Committee →'}
                </Button>
              </div>

            </form>
          )}

          {/* ALERT POPUP MODAL */}
          {alertModal.open && (
            <div className="ask-popup-overlay" onClick={closeAlert}>
              <div
                className="ask-popup-modal animate-popIn"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ask-popup-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" strokeLinecap="round" />
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="3" />
                  </svg>
                </div>

                <h3 className="ask-popup-title">{alertModal.title}</h3>
                <p className="ask-popup-message">{alertModal.message}</p>

                <div className="ask-popup-action">
                  <button
                    type="button"
                    className="ask-popup-btn"
                    onClick={closeAlert}
                    autoFocus
                  >
                    Got It, Continue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter event={{ title: 'CIIM 2026' }} />
    </>
  );
}
