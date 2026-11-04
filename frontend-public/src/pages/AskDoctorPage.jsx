import { useState } from 'react';
import { Link } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Button from '../components/ui/Button';
import { api, ApiError } from '../lib/api';
import './AskDoctorPage.css';

export const TOPICS = [
  {
    id: 'thin-endometrium',
    step: 1,
    name: 'Thin Endometrium',
    shortName: 'Thin Endometrium',
    icon: '🔬',
    description: 'Cutoff thickness, Intrauterine PRP/G-CSF protocols, estrogen regimens & Asherman syndrome.',
  },
  {
    id: 'low-ovarian-reserve',
    step: 2,
    name: 'Low Ovarian Reserve & Exosomes',
    shortName: 'Ovarian Reserve & Exosomes',
    icon: '✨',
    description: 'Intraovarian exosome evidence, POSEIDON group stimulation, priming adjuvants & ICMR/FDA guidelines.',
  },
  {
    id: 'recurrent-implantation-failure',
    step: 3,
    name: 'Recurrent Implantation Failure',
    shortName: 'Implantation Failure (RIF)',
    icon: '🧬',
    description: 'Euploid blastocyst failure algorithm, ERA timing, CD138 chronic endometritis & immunotherapy.',
  },
  {
    id: 'recurrent-pregnancy-loss',
    step: 4,
    name: 'Recurrent Pregnancy Loss',
    shortName: 'Pregnancy Loss (RPL)',
    icon: '🩺',
    description: 'APLA & thrombophilia workup, timing of LMWH & Aspirin, Sperm DFI, PGT-A & unexplained RPL.',
  },
  {
    id: 'adenomyosis-fertility',
    step: 5,
    name: 'Adenomyosis & Fertility',
    shortName: 'Adenomyosis & Fertility',
    icon: '🌸',
    description: 'Ultra-long GnRH agonist depot protocols, adenomyomectomy vs medical, junctional zone & co-existing DIE.',
  },
];

const FACULTY_LIST = [
  'Any Faculty / Open Panel',
  'Dr. Hafeez Rahman',
  'Dr. Asha Rao',
  'Dr. Jayesh Amin',
  'Dr. Malaraj',
  'Dr. Leena Mehrotra',
  'Dr. Sanjeeva Reddy',
  'Dr. Rajesh Koradia',
  'Dr. Jathin Shah',
  'Dr. Rohit Gutgutia',
  'Dr. Devika Gunasheela',
  'Dr. Vasundara Jagannathan',
];

const STEP_LABELS = [
  'Your Details',
  '1. Thin Endometrium',
  '2. Low Ovarian Reserve',
  '3. Implantation Failure',
  '4. Pregnancy Loss',
  '5. Adenomyosis',
  'Review & Submit',
];

export default function AskDoctorPage() {
  // Step state: 0 = Details, 1..5 = Topics 1..5, 6 = Review Overview
  const [currentStep, setCurrentStep] = useState(0);

  // Track if user has reached review screen at least once (allows direct "Return to Overview" on edits)
  const [hasReachedReview, setHasReachedReview] = useState(false);

  // Easily visible Alert Popup Modal state
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

  // Doctor Details
  const [doctorInfo, setDoctorInfo] = useState({
    doctorName: '',
    phone: '',
    email: '',
    hospital: '',
    city: '',
    delegateId: '',
  });

  // Topic questions stored per topic ID
  const [topicQuestions, setTopicQuestions] = useState(() => {
    const initial = {};
    TOPICS.forEach((t) => {
      initial[t.id] = [
        {
          id: `${t.id}-1`,
          question: '',
          targetFaculty: 'Any Faculty / Open Panel',
          clinicalCase: '',
        },
      ];
    });
    return initial;
  });

  // Track explicitly skipped topics: { [topicId]: true/false }
  const [skippedTopics, setSkippedTopics] = useState({});

  // Multi-line paste mode for active topic
  const [multiLineMode, setMultiLineMode] = useState(false);
  const [multiLineText, setMultiLineText] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  // Helper: check if a topic has at least one valid question
  const getValidTopicQuestions = (topicId) => {
    const list = topicQuestions[topicId] || [];
    return list.filter((q) => q.question && q.question.trim().length >= 5);
  };

  const isTopicAnswered = (topicId) => {
    return getValidTopicQuestions(topicId).length > 0;
  };

  // Doctor detail field change
  const handleDoctorInfoChange = (field, value) => {
    setDoctorInfo((prev) => ({ ...prev, [field]: value }));
  };

  // Topic question operations
  const handleAddQuestion = (topicId) => {
    setTopicQuestions((prev) => ({
      ...prev,
      [topicId]: [
        ...(prev[topicId] || []),
        {
          id: `${topicId}-${Date.now()}`,
          question: '',
          targetFaculty: 'Any Faculty / Open Panel',
          clinicalCase: '',
        },
      ],
    }));
    if (skippedTopics[topicId]) {
      setSkippedTopics((prev) => ({ ...prev, [topicId]: false }));
    }
  };

  const handleUpdateQuestion = (topicId, questionId, field, value) => {
    setTopicQuestions((prev) => ({
      ...prev,
      [topicId]: (prev[topicId] || []).map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q
      ),
    }));
    if (skippedTopics[topicId]) {
      setSkippedTopics((prev) => ({ ...prev, [topicId]: false }));
    }
  };

  const handleRemoveQuestion = (topicId, questionId) => {
    setTopicQuestions((prev) => {
      const currentList = prev[topicId] || [];
      if (currentList.length <= 1) {
        return {
          ...prev,
          [topicId]: [
            {
              id: `${topicId}-1`,
              question: '',
              targetFaculty: 'Any Faculty / Open Panel',
              clinicalCase: '',
            },
          ],
        };
      }
      return {
        ...prev,
        [topicId]: currentList.filter((q) => q.id !== questionId),
      };
    });
  };

  // Convert multi-line paste to separate questions
  const handleApplyMultiLine = (topicId) => {
    const lines = multiLineText
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((l) => l.length >= 5);

    if (lines.length === 0) {
      showAlert('No Valid Lines', 'Please enter at least one question line with more than 5 characters.');
      return;
    }

    const newItems = lines.map((text, idx) => ({
      id: `${topicId}-ml-${Date.now()}-${idx}`,
      question: text,
      targetFaculty: 'Any Faculty / Open Panel',
      clinicalCase: '',
    }));

    setTopicQuestions((prev) => {
      const existing = (prev[topicId] || []).filter((q) => q.question && q.question.trim().length > 0);
      return {
        ...prev,
        [topicId]: [...existing, ...newItems],
      };
    });

    setSkippedTopics((prev) => ({ ...prev, [topicId]: false }));
    setMultiLineText('');
    setMultiLineMode(false);
  };

  // STEP NAVIGATION: Next Step
  const handleNextStep = () => {
    // If on Step 0 (Doctor Info)
    if (currentStep === 0) {
      if (!doctorInfo.doctorName.trim() || doctorInfo.doctorName.trim().length < 2) {
        showAlert('Name Required', 'Please enter your full name (e.g. Dr. S. Karthikeyan).');
        return;
      }
      const cleanPhone = doctorInfo.phone.replace(/[\s()-]/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        showAlert('Mobile / WhatsApp Required', 'Please enter a valid 10-digit mobile or WhatsApp number so faculty responses can be sent to you.');
        return;
      }
      if (!doctorInfo.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(doctorInfo.email.trim())) {
        showAlert('Valid Email Required', 'Please enter a valid email address (e.g. doctor@hospital.org).');
        return;
      }

      setCurrentStep(1);
      scrollToTop();
      return;
    }

    // If on Topic Steps 1 to 5
    if (currentStep >= 1 && currentStep <= 5) {
      const activeTopic = TOPICS[currentStep - 1];
      const answered = isTopicAnswered(activeTopic.id);
      const isSkipped = skippedTopics[activeTopic.id];

      // Must answer or explicitly skip
      if (!answered && !isSkipped) {
        showAlert(
          'Question Required for this Topic',
          `Please enter your clinical question for "${activeTopic.name}", or tap "Skip this topic" below to proceed.`
        );
        return;
      }

      if (currentStep < 5) {
        setCurrentStep((prev) => prev + 1);
      } else {
        // Go to Overview step
        setCurrentStep(6);
        setHasReachedReview(true);
      }
      scrollToTop();
      return;
    }
  };

  // Skip current topic
  const handleSkipTopic = (topicId) => {
    setSkippedTopics((prev) => ({ ...prev, [topicId]: true }));
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setCurrentStep(6);
      setHasReachedReview(true);
    }
    scrollToTop();
  };

  // Back step
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      scrollToTop();
    }
  };

  // When editing from review, direct jump back to review overview
  const handleReturnToReview = () => {
    if (currentStep === 0) {
      if (!doctorInfo.doctorName.trim() || doctorInfo.doctorName.trim().length < 2) {
        showAlert('Name Required', 'Please enter your full name before returning to overview.');
        return;
      }
      const cleanPhone = doctorInfo.phone.replace(/[\s()-]/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        showAlert('Phone Required', 'Please enter a valid 10-digit mobile number before returning to overview.');
        return;
      }
      if (!doctorInfo.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(doctorInfo.email.trim())) {
        showAlert('Email Required', 'Please enter a valid email address before returning to overview.');
        return;
      }
    } else if (currentStep >= 1 && currentStep <= 5) {
      const activeTopic = TOPICS[currentStep - 1];
      const answered = isTopicAnswered(activeTopic.id);
      const isSkipped = skippedTopics[activeTopic.id];
      if (!answered && !isSkipped) {
        showAlert(
          'Topic Notice',
          `Please provide a question for "${activeTopic.name}", or tap "Skip this topic".`
        );
        return;
      }
    }

    setCurrentStep(6);
    scrollToTop();
  };

  // Jump to specific step (used from Desktop Stepper or Review screen)
  const handleJumpToStep = (stepIndex) => {
    if (stepIndex > 0) {
      if (!doctorInfo.doctorName.trim() || !doctorInfo.phone.trim() || !doctorInfo.email.trim()) {
        setCurrentStep(0);
        showAlert('Complete Details First', 'Please enter your doctor details before selecting a topic.');
        scrollToTop();
        return;
      }
    }
    setCurrentStep(stepIndex);
    scrollToTop();
  };

  // Total valid questions across all topics
  const getAllQuestionsForSubmission = () => {
    const all = [];
    TOPICS.forEach((topic) => {
      if (!skippedTopics[topic.id]) {
        const questionsForTopic = getValidTopicQuestions(topic.id);
        questionsForTopic.forEach((q) => {
          all.push({
            topic: topic.name,
            question: q.question.trim(),
            targetFaculty: q.targetFaculty || 'Any Faculty / Open Panel',
            clinicalCase: (q.clinicalCase || '').trim(),
          });
        });
      }
    });
    return all;
  };

  // FINAL SUBMISSION on Step 6
  const handleFinalSubmit = async (e) => {
    if (e) e.preventDefault();

    const questionsToSubmit = getAllQuestionsForSubmission();

    if (questionsToSubmit.length === 0) {
      showAlert(
        'No Questions Entered',
        'You have not added questions for any topic yet. Please click "Edit" on at least one topic to enter your question before submitting.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctorName: doctorInfo.doctorName.trim(),
        email: doctorInfo.email.trim().toLowerCase(),
        phone: doctorInfo.phone.replace(/[\s()-]/g, ''),
        hospital: doctorInfo.hospital.trim(),
        city: doctorInfo.city.trim(),
        delegateId: doctorInfo.delegateId.trim(),
        eventSlug: 'fertility-gynaecology-summit-2026',
        questions: questionsToSubmit,
      };

      const res = await api.submitTopicQuestions(payload);
      setSubmittedData({
        refId: res.data?.id || 'CIIM-Q-' + Math.floor(100000 + Math.random() * 900000),
        doctorName: doctorInfo.doctorName.trim(),
        totalQuestions: questionsToSubmit.length,
        questions: questionsToSubmit,
      });
      scrollToTop();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit questions. Please try again.';
      showAlert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeTopic = currentStep >= 1 && currentStep <= 5 ? TOPICS[currentStep - 1] : null;
  const totalEnteredQuestions = getAllQuestionsForSubmission().length;

  return (
    <>
      <SiteHeader
        event={{ title: 'CIIM 2026' }}
        canRegister={true}
        onRegister={() => (window.location.href = '/#tickets')}
        availableSections={['about', 'speakers', 'agenda', 'tickets']}
      />

      <main id="main" className="ask-doctor-page">
        <div className="container ask-doctor-page__container">
          <Link to="/" className="ask-doctor-page__back">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Conference Overview
          </Link>

          {/* Banner Flyer Header */}
          <div className="ask-doctor-header">
            <div className="ask-doctor-header__badge">CIIM 2026 • Interactive Scientific Panel</div>
            <h1 className="ask-doctor-header__title">
              ASK QUESTIONS IN <br />
              <span>THE FOLLOWING TOPICS</span>
            </h1>
            <p className="ask-doctor-header__subtitle">
              Step-by-step question submission for attending doctors &amp; delegates.
              Use Next and Back to navigate through all 5 topics.
            </p>
          </div>

          {/* SUCCESS SCREEN */}
          {submittedData ? (
            <div className="ask-doctor-success">
              <div className="ask-doctor-success__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="ask-doctor-success__title">Questions Submitted Successfully!</h2>
              <p className="ask-doctor-success__meta">
                Thank you, <strong>{submittedData.doctorName}</strong>. Your clinical questions have
                been forwarded to the Scientific Committee &amp; Panel Moderators for live debate at <strong>CIIM 2026</strong>.
              </p>
              <div className="ask-doctor-success__ref">
                Reference ID: <code>{submittedData.refId}</code>
              </div>

              <div className="ask-doctor-success__summary">
                <h3>Your Submitted Questions ({submittedData.totalQuestions})</h3>
                <ul className="ask-doctor-success__list">
                  {submittedData.questions.map((q, idx) => (
                    <li key={idx} className="ask-doctor-success__item">
                      <span className="ask-doctor-success__topic-pill">{q.topic}</span>
                      <p className="ask-doctor-success__q-text">{q.question}</p>
                      {q.targetFaculty && q.targetFaculty !== 'Any Faculty / Open Panel' && (
                        <p className="ask-doctor-success__q-target">
                          Directed to: <strong>{q.targetFaculty}</strong>
                        </p>
                      )}
                      {q.clinicalCase && (
                        <p className="ask-doctor-success__q-case">
                          Case Context: <em>{q.clinicalCase}</em>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ask-doctor-success__actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmittedData(null);
                    setCurrentStep(0);
                    setHasReachedReview(false);
                    setSkippedTopics({});
                  }}
                >
                  Submit Another Question Set
                </Button>
                <Button variant="primary" href="/">
                  Return to Conference Page
                </Button>
              </div>
            </div>
          ) : (
            <div className="ask-wizard">
              {/* Top Progress Bar & Stepper: ONLY VISIBLE ON DESKTOP, HIDDEN ON MOBILE */}
              <div className="ask-stepper ask-stepper--desktop-only">
                <div className="ask-stepper__progress-wrap">
                  <div className="ask-stepper__info">
                    <span className="ask-stepper__info-step">
                      Step {currentStep + 1} of {STEP_LABELS.length}:
                    </span>
                    <strong className="ask-stepper__info-name">{STEP_LABELS[currentStep]}</strong>
                  </div>
                  <span className="ask-stepper__counter">
                    {totalEnteredQuestions} question{totalEnteredQuestions === 1 ? '' : 's'} added
                  </span>
                </div>

                {/* Progress bar track */}
                <div className="ask-stepper__bar-track" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={7}>
                  <div
                    className="ask-stepper__bar-fill"
                    style={{ width: `${((currentStep + 1) / STEP_LABELS.length) * 100}%` }}
                  />
                </div>

                {/* Stepper Pills Navigation (Desktop only) */}
                <div className="ask-stepper__pills">
                  {STEP_LABELS.map((label, idx) => {
                    const isDone =
                      idx === 0
                        ? doctorInfo.doctorName.trim() && doctorInfo.phone.trim()
                        : idx <= 5
                        ? isTopicAnswered(TOPICS[idx - 1].id) || skippedTopics[TOPICS[idx - 1].id]
                        : false;
                    const isActive = currentStep === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`ask-stepper__pill ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                        onClick={() => handleJumpToStep(idx)}
                        title={label}
                      >
                        <span className="ask-stepper__pill-circle">
                          {isDone ? '✓' : idx === 0 ? 'D' : idx === 6 ? '★' : idx}
                        </span>
                        <span className="ask-stepper__pill-text">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimal Mobile Header Indicator (No tabs, just clean progress) */}
              <div className="ask-mobile-step-indicator">
                <span className="ask-mobile-step-indicator__badge">
                  Step {currentStep + 1} of {STEP_LABELS.length}
                </span>
                <span className="ask-mobile-step-indicator__title">
                  {STEP_LABELS[currentStep]}
                </span>
              </div>

              {/* ============================================================== */}
              {/* STEP 0: DOCTOR & DELEGATE DETAILS                             */}
              {/* ============================================================== */}
              {currentStep === 0 && (
                <div className="ask-step-card animate-fadeIn">
                  <div className="ask-step-card__header">
                    <span className="ask-step-card__icon-badge">👨‍⚕️</span>
                    <div>
                      <h2 className="ask-step-card__title">Doctor &amp; Delegate Details</h2>
                      <p className="ask-step-card__desc">
                        Please enter your professional details. Panel chairs will acknowledge participating doctors by name during the discussions.
                      </p>
                    </div>
                  </div>

                  <div className="ask-form-grid">
                    <label className="ask-field">
                      <span>Doctor Full Name <span className="req">*</span></span>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Dr. S. Karthikeyan, MS, DGO"
                        value={doctorInfo.doctorName}
                        onChange={(e) => handleDoctorInfoChange('doctorName', e.target.value)}
                      />
                    </label>

                    <label className="ask-field">
                      <span>Mobile / WhatsApp Number <span className="req">*</span></span>
                      <input
                        type="tel"
                        inputMode="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={doctorInfo.phone}
                        onChange={(e) => handleDoctorInfoChange('phone', e.target.value)}
                      />
                      <small className="ask-field__hint">For receiving panel discussion answers and updates.</small>
                    </label>

                    <label className="ask-field">
                      <span>Email Address <span className="req">*</span></span>
                      <input
                        type="email"
                        inputMode="email"
                        required
                        placeholder="doctor@hospital.org"
                        value={doctorInfo.email}
                        onChange={(e) => handleDoctorInfoChange('email', e.target.value)}
                      />
                    </label>

                    <label className="ask-field">
                      <span>Hospital / Clinic / Institute</span>
                      <input
                        type="text"
                        placeholder="e.g. Prashanth Fertility Centre"
                        value={doctorInfo.hospital}
                        onChange={(e) => handleDoctorInfoChange('hospital', e.target.value)}
                      />
                    </label>

                    <label className="ask-field">
                      <span>City / State</span>
                      <input
                        type="text"
                        placeholder="e.g. Chennai, Tamil Nadu"
                        value={doctorInfo.city}
                        onChange={(e) => handleDoctorInfoChange('city', e.target.value)}
                      />
                    </label>

                    <label className="ask-field">
                      <span>Delegate Registration ID (Optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. CIIM-2026-REG-..."
                        value={doctorInfo.delegateId}
                        onChange={(e) => handleDoctorInfoChange('delegateId', e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Actions Footer */}
                  <div className="ask-step-card__footer">
                    <div className="ask-step-card__footer-left">
                      {hasReachedReview && (
                        <button
                          type="button"
                          className="ask-nav-btn ask-nav-btn--return"
                          onClick={handleReturnToReview}
                        >
                          ✓ Save &amp; Return to Overview →
                        </button>
                      )}
                    </div>

                    <div className="ask-step-card__footer-right">
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={handleNextStep}
                        className="ask-step-card__btn-next"
                      >
                        Next: Topic 1 (Thin Endometrium) →
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* STEPS 1 to 5: TOPIC-BY-TOPIC QUESTIONS                        */}
              {/* ============================================================== */}
              {currentStep >= 1 && currentStep <= 5 && activeTopic && (
                <div className="ask-step-card animate-fadeIn">
                  <div className="ask-step-card__topbar">
                    <span className="ask-step-card__badge-topic">
                      Topic {currentStep} of 5
                    </span>
                    {isTopicAnswered(activeTopic.id) ? (
                      <span className="ask-step-card__status-tag is-answered">
                        ✓ {getValidTopicQuestions(activeTopic.id).length} Question(s) Added
                      </span>
                    ) : skippedTopics[activeTopic.id] ? (
                      <span className="ask-step-card__status-tag is-skipped">
                        Skipped (No Question)
                      </span>
                    ) : (
                      <span className="ask-step-card__status-tag is-pending">
                        Awaiting Question
                      </span>
                    )}
                  </div>

                  <div className="ask-step-card__header">
                    <span className="ask-step-card__icon-badge">{activeTopic.icon}</span>
                    <div>
                      <h2 className="ask-step-card__title">{activeTopic.name}</h2>
                      <p className="ask-step-card__desc">{activeTopic.description}</p>
                    </div>
                  </div>

                  {/* Multi-Line Paste Toggle */}
                  <div className="ask-multiline-toggle-wrap">
                    <button
                      type="button"
                      className="ask-text-action-btn"
                      onClick={() => setMultiLineMode(!multiLineMode)}
                    >
                      {multiLineMode ? '✕ Cancel Paste Mode' : '📋 Paste Multiple Questions (One per line)'}
                    </button>
                  </div>

                  {/* Multi-line Paste Textarea Mode */}
                  {multiLineMode && (
                    <div className="ask-multiline-drawer animate-fadeIn">
                      <p className="ask-multiline-drawer__hint">
                        Paste your questions for <strong>{activeTopic.name}</strong> with each question on a <strong>new line</strong>:
                      </p>
                      <textarea
                        rows={4}
                        className="ask-multiline-drawer__input"
                        placeholder="Line 1: Question details...&#10;Line 2: Another question...&#10;Line 3: Third question..."
                        value={multiLineText}
                        onChange={(e) => setMultiLineText(e.target.value)}
                      />
                      <div className="ask-multiline-drawer__actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApplyMultiLine(activeTopic.id)}
                          disabled={!multiLineText.trim()}
                        >
                          Convert Lines into Separate Questions
                        </Button>
                        <button
                          type="button"
                          className="ask-text-btn"
                          onClick={() => setMultiLineMode(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Question Cards List */}
                  <div className="ask-q-list">
                    {(topicQuestions[activeTopic.id] || []).map((q, qIndex) => (
                      <div key={q.id} className="ask-q-item">
                        <div className="ask-q-item__header">
                          <span className="ask-q-item__num">
                            Question #{qIndex + 1} on {activeTopic.shortName}
                          </span>
                          {(topicQuestions[activeTopic.id] || []).length > 1 && (
                            <button
                              type="button"
                              className="ask-q-item__delete"
                              onClick={() => handleRemoveQuestion(activeTopic.id, q.id)}
                              title="Remove this question"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        <label className="ask-field">
                          <span>Your Clinical Question <span className="req">*</span></span>
                          <textarea
                            rows={4}
                            placeholder={`Type your clinical dilemma, case question, or specific debate question on ${activeTopic.name}...`}
                            value={q.question}
                            onChange={(e) =>
                              handleUpdateQuestion(activeTopic.id, q.id, 'question', e.target.value)
                            }
                          />
                        </label>

                        <div className="ask-q-item__options-grid">
                          <label className="ask-field">
                            <span>Target Speaker / Panelist (Optional)</span>
                            <select
                              value={q.targetFaculty}
                              onChange={(e) =>
                                handleUpdateQuestion(
                                  activeTopic.id,
                                  q.id,
                                  'targetFaculty',
                                  e.target.value
                                )
                              }
                            >
                              {FACULTY_LIST.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="ask-field">
                            <span>Patient / Case Background (Optional)</span>
                            <input
                              type="text"
                              placeholder="e.g. 34yo, 3 previous failed FETs, refractory lining"
                              value={q.clinicalCase}
                              onChange={(e) =>
                                handleUpdateQuestion(
                                  activeTopic.id,
                                  q.id,
                                  'clinicalCase',
                                  e.target.value
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add another question button */}
                  <div className="ask-add-more-row">
                    <button
                      type="button"
                      className="ask-add-more-btn"
                      onClick={() => handleAddQuestion(activeTopic.id)}
                    >
                      <span className="ask-add-more-btn__plus">+</span>
                      Add another question to "{activeTopic.shortName}"
                    </button>
                  </div>

                  {/* Footer Navigation (Next, Back, Skip, Return to Review) */}
                  <div className="ask-step-card__footer">
                    <div className="ask-step-card__footer-left">
                      <button
                        type="button"
                        className="ask-nav-btn ask-nav-btn--prev"
                        onClick={handlePrevStep}
                      >
                        ← Back
                      </button>

                      {hasReachedReview && (
                        <button
                          type="button"
                          className="ask-nav-btn ask-nav-btn--return"
                          onClick={handleReturnToReview}
                        >
                          ✓ Save &amp; Return to Overview →
                        </button>
                      )}
                    </div>

                    <div className="ask-step-card__footer-right">
                      <button
                        type="button"
                        className="ask-nav-btn ask-nav-btn--skip"
                        onClick={() => handleSkipTopic(activeTopic.id)}
                        title="Skip if you have no questions on this topic"
                      >
                        Skip this topic
                      </button>

                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={handleNextStep}
                        className="ask-step-card__btn-next"
                      >
                        {currentStep < 5
                          ? `Next: Topic ${currentStep + 1} →`
                          : 'Next: Review Submissions →'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* STEP 6: FINAL OVERVIEW & EDITABLE REVIEW SCREEN               */}
              {/* ============================================================== */}
              {currentStep === 6 && (
                <div className="ask-step-card animate-fadeIn">
                  <div className="ask-step-card__header">
                    <span className="ask-step-card__icon-badge">📋</span>
                    <div>
                      <h2 className="ask-step-card__title">Review Your Questions Before Submitting</h2>
                      <p className="ask-step-card__desc">
                        Please review everything you have entered below. You can click <strong>Edit</strong> on any topic to modify or add questions before final submission.
                      </p>
                    </div>
                  </div>

                  {/* Doctor Profile Summary */}
                  <div className="ask-review-card">
                    <div className="ask-review-card__top">
                      <div>
                        <span className="ask-review-card__eyebrow">Delegate Profile</span>
                        <h3 className="ask-review-card__name">{doctorInfo.doctorName || 'Doctor'}</h3>
                        <div className="ask-review-card__contacts">
                          <span>📱 {doctorInfo.phone}</span>
                          <span>✉️ {doctorInfo.email}</span>
                          {doctorInfo.hospital && <span>🏥 {doctorInfo.hospital}</span>}
                          {doctorInfo.city && <span>📍 {doctorInfo.city}</span>}
                          {doctorInfo.delegateId && <span>🎫 ID: {doctorInfo.delegateId}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ask-edit-btn"
                        onClick={() => handleJumpToStep(0)}
                      >
                        ✎ Edit Details
                      </button>
                    </div>
                  </div>

                  {/* Topics Question Review */}
                  <div className="ask-review-topics">
                    <h3 className="ask-review-topics__heading">
                      Topic-Wise Submissions ({totalEnteredQuestions} question{totalEnteredQuestions === 1 ? '' : 's'})
                    </h3>

                    {TOPICS.map((topic, tIdx) => {
                      const questionsForTopic = getValidTopicQuestions(topic.id);
                      const isSkipped = skippedTopics[topic.id];
                      const hasQuestions = questionsForTopic.length > 0;

                      return (
                        <div
                          key={topic.id}
                          className={`ask-review-topic-card ${hasQuestions ? 'is-filled' : 'is-empty'}`}
                        >
                          <div className="ask-review-topic-card__header">
                            <div className="ask-review-topic-card__title-box">
                              <span className="ask-review-topic-card__num">Topic {tIdx + 1}</span>
                              <h4 className="ask-review-topic-card__title">
                                {topic.icon} {topic.name}
                              </h4>
                            </div>

                            <button
                              type="button"
                              className="ask-edit-btn"
                              onClick={() => handleJumpToStep(tIdx + 1)}
                            >
                              ✎ Edit Topic {tIdx + 1}
                            </button>
                          </div>

                          {hasQuestions ? (
                            <ul className="ask-review-q-list">
                              {questionsForTopic.map((q, qIndex) => (
                                <li key={q.id || qIndex} className="ask-review-q-item">
                                  <div className="ask-review-q-item__text">
                                    <strong>Q{qIndex + 1}:</strong> {q.question}
                                  </div>
                                  <div className="ask-review-q-item__meta">
                                    {q.targetFaculty && q.targetFaculty !== 'Any Faculty / Open Panel' && (
                                      <span className="ask-review-tag">
                                        Faculty: <strong>{q.targetFaculty}</strong>
                                      </span>
                                    )}
                                    {q.clinicalCase && (
                                      <span className="ask-review-tag ask-review-tag--case">
                                        Case: <em>{q.clinicalCase}</em>
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="ask-review-empty-state">
                              <span>
                                {isSkipped
                                  ? 'Skipped (No questions entered for this topic)'
                                  : 'No questions entered.'}
                              </span>
                              <button
                                type="button"
                                className="ask-text-action-btn"
                                onClick={() => handleJumpToStep(tIdx + 1)}
                              >
                                + Add a question for this topic
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Final Submit Actions */}
                  <div className="ask-step-card__footer ask-step-card__footer--review">
                    <button
                      type="button"
                      className="ask-nav-btn ask-nav-btn--prev"
                      onClick={() => handleJumpToStep(5)}
                    >
                      ← Back to Topic 5
                    </button>

                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      disabled={submitting || totalEnteredQuestions === 0}
                      onClick={handleFinalSubmit}
                      className="ask-step-card__btn-submit"
                    >
                      {submitting
                        ? 'Submitting All Questions to Faculty...'
                        : `Confirm & Submit ${totalEnteredQuestions} Question(s) to Scientific Committee`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* USER-FRIENDLY ALERT POPUP MODAL                                */}
          {/* ============================================================== */}
          {alertModal.open && (
            <div className="ask-popup-overlay" onClick={closeAlert}>
              <div
                className="ask-popup-modal animate-popIn"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ask-popup-icon">
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
