import { useCallback, useEffect, useRef, useState } from 'react';
import { checkinApi } from '../../lib/checkinApi';
import Button from '../../components/ui/Button';
import './CheckIn.css';

/**
 * Web Audio API synthesized audio effects for check-in desks.
 * Zero external audio files required, works offline.
 */
function playTone(freq, type = 'sine', duration = 0.12, delay = 0) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch {
    // browser autoplay policy may ignore until first interaction
  }
}

function playScanAudio(type, enabled = true) {
  if (!enabled) return;
  if (type === 'success') {
    // Cheerful, executive double chime (880Hz -> 1320Hz)
    playTone(880, 'sine', 0.1, 0);
    playTone(1320, 'sine', 0.18, 0.1);
  } else if (type === 'warning') {
    // Amber duplicate warning chime (587Hz -> 440Hz)
    playTone(587, 'triangle', 0.12, 0);
    playTone(440, 'triangle', 0.22, 0.12);
  } else {
    // Error low buzz (180Hz)
    playTone(180, 'sawtooth', 0.28, 0);
  }
}

export default function CheckIn() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [stats, setStats] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | starting | active | unavailable
  const [retryCount, setRetryCount] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('ciim_checkin_sound') !== 'false';
  });
  const [recentScans, setRecentScans] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [printAttendee, setPrintAttendee] = useState(null);

  const scannerRef = useRef(null);
  const scannerDivId = 'checkin-camera';
  const busyRef = useRef(false); // guards against camera rapid duplicate frames

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('ciim_checkin_sound', next ? 'true' : 'false');
      return next;
    });
  };

  // Load events
  useEffect(() => {
    checkinApi
      .events()
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setEventId((id) => id || res.data[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  // Load check-in stats
  const loadStats = useCallback(() => {
    if (!eventId) return;
    checkinApi
      .stats(eventId)
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, [eventId]);

  useEffect(loadStats, [loadStats]);

  // Main submission handler
  const submitScan = useCallback(
    async (rawValue) => {
      if (!rawValue) return;
      setScanning(true);
      try {
        const res = await checkinApi.scan(rawValue);
        const isSuccess = res.data.result === 'success';
        const tone = isSuccess ? 'success' : 'warning';
        const resultData = { tone, ...res.data };

        setScanResult(resultData);
        playScanAudio(tone, soundEnabled);

        // Append to recent scans session desk stream
        setRecentScans((prev) => [
          {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            name: res.data.attendee?.name || 'Delegate',
            ticketType: res.data.ticketType?.name || 'Attendee Pass',
            company: res.data.company?.name || '',
            code: res.data.registrationCode || '',
            tone,
            statusText: isSuccess ? 'Checked in' : 'Duplicate',
            data: resultData,
          },
          ...prev.slice(0, 9),
        ]);

        loadStats();
      } catch (err) {
        const errorData = { tone: 'error', message: err.message || 'Ticket code is invalid or cancelled.' };
        setScanResult(errorData);
        playScanAudio('error', soundEnabled);

        setRecentScans((prev) => [
          {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            name: rawValue.length > 20 ? rawValue.slice(0, 16) + '…' : rawValue,
            ticketType: 'Unknown',
            company: '',
            code: '',
            tone: 'error',
            statusText: 'Rejected',
            data: errorData,
          },
          ...prev.slice(0, 9),
        ]);
      } finally {
        setScanning(false);
      }
    },
    [loadStats, soundEnabled]
  );

  // Camera frame detection callback
  const handleCameraDetect = useCallback(
    (rawValue) => {
      if (busyRef.current || !rawValue) return;
      busyRef.current = true;
      submitScan(rawValue).finally(() => {
        setTimeout(() => {
          busyRef.current = false;
        }, 1800);
      });
    },
    [submitScan]
  );

  // Initialize camera scanner
  useEffect(() => {
    let cancelled = false;
    let activeScanner = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const container = document.getElementById(scannerDivId);
        if (!container) {
          if (!cancelled) setCameraStatus('unavailable');
          return;
        }

        setCameraStatus('starting');

        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
          } catch {
            // ignore
          }
          scannerRef.current = null;
        }

        const instance = new Html5Qrcode(scannerDivId);
        scannerRef.current = instance;
        activeScanner = instance;

        let availableCameras = [];
        try {
          availableCameras = await Html5Qrcode.getCameras();
          if (!cancelled && availableCameras && availableCameras.length > 0) {
            setCameras(availableCameras);
          }
        } catch {
          // ignore
        }

        const scanConfig = { fps: 12, qrbox: { width: 240, height: 240 } };
        const onDetect = (decodedText) => handleCameraDetect(decodedText);
        const onIgnore = () => {};

        if (availableCameras.length > 0 && currentCameraIndex < availableCameras.length) {
          await instance.start(availableCameras[currentCameraIndex].id, scanConfig, onDetect, onIgnore);
        } else {
          try {
            await instance.start({ facingMode: 'environment' }, scanConfig, onDetect, onIgnore);
          } catch {
            if (cancelled) return;
            try {
              await instance.start({ facingMode: 'user' }, scanConfig, onDetect, onIgnore);
            } catch (userErr) {
              if (cancelled) return;
              if (availableCameras.length > 0) {
                await instance.start(availableCameras[0].id, scanConfig, onDetect, onIgnore);
              } else {
                throw userErr;
              }
            }
          }
        }

        if (!cancelled) {
          setCameraStatus('active');
          // Check torch capability
          try {
            const track = instance.getRunningTrackCameraCapabilities?.();
            if (track?.torchFeature?.isSupported?.()) {
              setTorchAvailable(true);
            }
          } catch {
            setTorchAvailable(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[CheckIn] Camera start failed:', err);
          setCameraStatus('unavailable');
        }
      }
    }

    initScanner();

    return () => {
      cancelled = true;
      if (activeScanner) {
        try {
          if (activeScanner.isScanning) {
            activeScanner.stop().then(() => activeScanner.clear()).catch(() => {});
          } else {
            activeScanner.clear();
          }
        } catch {
          // ignore
        }
      }
    };
  }, [retryCount, currentCameraIndex, handleCameraDetect]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
      setTorchOn(false);
    }
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      // torch constraint not supported or failed
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim() || scanning) return;
    submitScan(manualCode.trim());
    setManualCode('');
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePrintBadge = (attendeeData) => {
    setPrintAttendee(attendeeData);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Stats computation
  const checkedInCount = stats ? stats.checkedIn : 0;
  const remainingCount = stats ? stats.remaining : 0;
  const totalCount = stats ? stats.total : 0;
  const checkinRate = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  return (
    <div className="checkin-container">
      {/* Page Header with Event Select and Sound Toggle */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h2 className="page-header__title" style={{ margin: 0 }}>Check-in Desk</h2>
            <span
              className={`checkin-status-badge checkin-status-badge--${
                cameraStatus === 'active'
                  ? 'ready'
                  : cameraStatus === 'starting'
                  ? 'starting'
                  : 'offline'
              }`}
            >
              <span className="checkin-pulse-dot" />
              {cameraStatus === 'active'
                ? 'Scanner Ready'
                : cameraStatus === 'starting'
                ? 'Starting…'
                : 'Camera Offline'}
            </span>
          </div>
          <p className="page-header__subtitle" style={{ marginTop: '4px' }}>
            Scan delegate QR passes or enter registration codes manually.
          </p>
        </div>

        <div className="checkin-header-actions">
          {events && events.length > 1 && (
            <select
              className="field__select"
              value={eventId || ''}
              onChange={(e) => setEventId(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className={`checkin-ctrl-btn${soundEnabled ? ' is-active' : ''}`}
            onClick={toggleSound}
            title={soundEnabled ? 'Mute audio feedback' : 'Enable audio chimes'}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
          </button>

          <button
            type="button"
            className="checkin-ctrl-btn"
            onClick={loadStats}
            title="Refresh statistics"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Top Metric Cards with Progress Bar */}
      <div className="stat-grid">
        <div className="checkin-stat-card">
          <div className="checkin-stat-card__head">
            <span className="checkin-stat-card__label">Checked in</span>
            <span className="checkin-stat-card__badge checkin-stat-card__badge--green">
              {checkinRate}% Completed
            </span>
          </div>
          <p className="checkin-stat-card__value checkin-stat-card__value--green">
            {checkedInCount}
          </p>
          <div className="checkin-stat-card__progress-wrap">
            <div
              className="checkin-stat-card__progress-bar"
              style={{ width: `${Math.min(checkinRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="checkin-stat-card">
          <div className="checkin-stat-card__head">
            <span className="checkin-stat-card__label">Remaining</span>
            <span className="stat-tile__meta">Expected today</span>
          </div>
          <p className="checkin-stat-card__value">{remainingCount}</p>
          <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>
            Pending arrival at desk
          </span>
        </div>

        <div className="checkin-stat-card">
          <div className="checkin-stat-card__head">
            <span className="checkin-stat-card__label">Total Confirmed</span>
            <span className="stat-tile__meta">Event capacity</span>
          </div>
          <p className="checkin-stat-card__value">{totalCount}</p>
          <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>
            Confirmed delegate passes
          </span>
        </div>
      </div>

      {/* Main 2-Column Check-in Grid */}
      <div className="checkin-grid">
        {/* Left Column: Scanner Card */}
        <div className="checkin-scanner-card">
          <div className="checkin-scanner-card__header">
            <h3 className="checkin-scanner-card__title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </svg>
              QR Scanner
            </h3>
            {cameras.length > 1 && (
              <button
                type="button"
                className="checkin-quick-btn"
                onClick={handleSwitchCamera}
                title="Switch between front/back camera"
              >
                🔄 Flip ({currentCameraIndex + 1}/{cameras.length})
              </button>
            )}
          </div>

          <div className="checkin-viewport">
            {/* Target camera container */}
            <div id={scannerDivId} className="checkin-camera" />

            {/* Futuristic HUD with Animated Laser and Corner Reticles */}
            {cameraStatus === 'active' && (
              <div className="checkin-hud">
                <div className="checkin-hud__laser" />
                <div className="checkin-hud__reticle">
                  <span className="checkin-hud__corner checkin-hud__corner--tl" />
                  <span className="checkin-hud__corner checkin-hud__corner--tr" />
                  <span className="checkin-hud__corner checkin-hud__corner--bl" />
                  <span className="checkin-hud__corner checkin-hud__corner--br" />
                  <div className="checkin-hud__guide">Align QR Code</div>
                </div>
              </div>
            )}

            {/* Offline Fallback */}
            {cameraStatus === 'unavailable' && (
              <div className="checkin-viewport__state-box">
                <div className="checkin-viewport__icon">📷</div>
                <h4 className="checkin-viewport__state-title">Camera Unavailable</h4>
                <p className="checkin-viewport__state-desc">
                  Camera permission was not granted or device camera is busy. Check browser permissions or use manual code entry below.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRetryCount((c) => c + 1)}
                  style={{ color: 'var(--white)', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' }}
                >
                  ↻ Retry Camera
                </Button>
              </div>
            )}

            {/* Starting State */}
            {cameraStatus === 'starting' && (
              <div className="checkin-viewport__state-box">
                <div className="checkin-pulse-dot" style={{ width: '14px', height: '14px', color: '#38bdf8' }} />
                <p className="checkin-viewport__state-desc" style={{ marginTop: '8px' }}>
                  Starting camera feed…
                </p>
              </div>
            )}
          </div>

          {/* Quick Toolbar below camera */}
          <div className="checkin-viewport-bar">
            <div className="checkin-viewport-bar__left">
              <span style={{ fontSize: '11px', opacity: 0.8 }}>
                {cameraStatus === 'active' ? '● Camera Feed Active' : '○ Standby'}
              </span>
            </div>
            <div className="checkin-viewport-bar__right">
              {torchAvailable && (
                <button
                  type="button"
                  className="checkin-quick-btn"
                  onClick={handleToggleTorch}
                  title="Toggle Flashlight"
                >
                  {torchOn ? '🔦 Torch On' : '🔦 Torch Off'}
                </button>
              )}
              <button
                type="button"
                className="checkin-quick-btn"
                onClick={() => setRetryCount((c) => c + 1)}
                title="Restart Camera"
              >
                ↻ Restart
              </button>
            </div>
          </div>

          {/* Manual Code Input Dock */}
          <div className="checkin-manual-dock">
            <form onSubmit={handleManualSubmit} className="checkin-manual-form">
              <div className="checkin-manual-input-wrap">
                <span className="checkin-manual-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                  </svg>
                </span>
                <input
                  className="field__input"
                  placeholder="Paste QR token, ticket URL, or code…"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  disabled={scanning}
                />
                {manualCode && (
                  <button
                    type="button"
                    className="checkin-manual-clear"
                    onClick={() => setManualCode('')}
                    title="Clear input"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={!manualCode.trim() || scanning}
                style={{ flexShrink: 0 }}
              >
                {scanning ? 'Checking…' : 'Check in'}
              </Button>
            </form>
            <p className="checkin-manual-hint">
              <span>💡 Tip:</span> Type 6-digit code and press Enter ↵
            </p>
          </div>
        </div>

        {/* Right Column: VIP Attendee Admission Card */}
        <div
          className={`checkin-display-card checkin-display--${
            scanResult?.tone || 'idle'
          }`}
        >
          {/* 1. Idle State */}
          {!scanResult && (
            <div className="checkin-display--idle">
              <div className="checkin-idle-radar">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                  <path d="M10 12h4" />
                </svg>
              </div>
              <h3 className="checkin-idle-title">Ready for Next Delegate</h3>
              <p className="checkin-idle-desc">
                Align the attendee's digital QR pass or printed conference badge in front of the scanner lens.
              </p>
              <div className="checkin-idle-stats">
                <div className="checkin-idle-stat-item">
                  Expected: <strong>{remainingCount}</strong>
                </div>
                <div style={{ color: 'var(--ink-200)' }}>|</div>
                <div className="checkin-idle-stat-item">
                  Checked in: <strong>{checkedInCount}</strong>
                </div>
              </div>
            </div>
          )}

          {/* 2. Success State: VIP Admission Granted */}
          {scanResult?.tone === 'success' && (
            <>
              <div className="checkin-result-banner checkin-result-banner--success">
                <div className="checkin-banner-status">
                  <span className="checkin-banner-icon">✓</span>
                  <span>ADMISSION GRANTED</span>
                </div>
                <span className="checkin-banner-time">
                  {new Date(scanResult.checkedInAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="checkin-result-body">
                <div>
                  <div className="checkin-attendee-profile">
                    <div className="checkin-attendee-avatar checkin-attendee-avatar--success">
                      {scanResult.attendee?.name?.[0]?.toUpperCase() || '✓'}
                    </div>
                    <div className="checkin-attendee-info">
                      <h3 className="checkin-attendee-name">
                        {scanResult.attendee?.name}
                      </h3>
                      <p className="checkin-attendee-meta">
                        {scanResult.attendee?.email && (
                          <span>📧 {scanResult.attendee.email}</span>
                        )}
                        {scanResult.attendee?.phone && (
                          <span>📱 {scanResult.attendee.phone}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="checkin-meta-grid">
                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Pass Category</span>
                      <span className="checkin-meta-chip__value">
                        🎫 {scanResult.ticketType?.name || 'Delegate Pass'}
                      </span>
                    </div>

                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Organization / Sponsor</span>
                      <span className="checkin-meta-chip__value">
                        🏢 {scanResult.company?.name || 'Direct Attendee'}
                      </span>
                    </div>

                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Registration ID</span>
                      <span className="checkin-meta-chip__value mono">
                        {scanResult.registrationCode}
                        <button
                          type="button"
                          className="checkin-copy-btn"
                          onClick={() => handleCopyCode(scanResult.registrationCode)}
                          title="Copy registration code"
                        >
                          {copiedCode ? '✓ Copied' : '📋'}
                        </button>
                      </span>
                    </div>

                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Check-in Timestamp</span>
                      <span className="checkin-meta-chip__value">
                        ⏰ {new Date(scanResult.checkedInAt).toLocaleTimeString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="checkin-action-bar">
                  <div className="checkin-action-bar__left">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePrintBadge(scanResult)}
                    >
                      🖨️ Print Badge Slip
                    </Button>
                  </div>
                  <div className="checkin-action-bar__right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setScanResult(null)}
                    >
                      Ready for Next Scan ➔
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 3. Warning State: Already Checked In */}
          {scanResult?.tone === 'warning' && (
            <>
              <div className="checkin-result-banner checkin-result-banner--warning">
                <div className="checkin-banner-status">
                  <span className="checkin-banner-icon">⚠️</span>
                  <span>ALREADY CHECKED IN</span>
                </div>
                <span className="checkin-banner-time">DUPLICATE ENTRY</span>
              </div>

              <div className="checkin-result-body">
                <div>
                  <div className="checkin-attendee-profile">
                    <div className="checkin-attendee-avatar checkin-attendee-avatar--warning">
                      !
                    </div>
                    <div className="checkin-attendee-info">
                      <h3 className="checkin-attendee-name">
                        {scanResult.attendee?.name}
                      </h3>
                      <p className="checkin-attendee-meta">
                        {scanResult.ticketType?.name}
                        {scanResult.company?.name ? ` · ${scanResult.company.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="checkin-alert-banner checkin-alert-banner--warning" style={{ marginTop: 'var(--space-4)' }}>
                    <span>⚠️</span>
                    <div>
                      <strong>Pass already used for admission today.</strong>
                      <div style={{ marginTop: '2px', fontSize: '13px' }}>
                        First scanned at {new Date(scanResult.checkedInAt).toLocaleTimeString('en-IN')} on {new Date(scanResult.checkedInAt).toLocaleDateString('en-IN')}. Please verify delegate identity before admitting.
                      </div>
                    </div>
                  </div>

                  <div className="checkin-meta-grid" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Pass Category</span>
                      <span className="checkin-meta-chip__value">
                        {scanResult.ticketType?.name || 'Standard'}
                      </span>
                    </div>
                    <div className="checkin-meta-chip">
                      <span className="checkin-meta-chip__label">Registration ID</span>
                      <span className="checkin-meta-chip__value mono">
                        {scanResult.registrationCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="checkin-action-bar">
                  <div className="checkin-action-bar__left">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePrintBadge(scanResult)}
                    >
                      🖨️ Re-print Slip
                    </Button>
                  </div>
                  <div className="checkin-action-bar__right">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setScanResult(null)}
                    >
                      Clear & Next Scan
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 4. Error State: Invalid / Unrecognized */}
          {scanResult?.tone === 'error' && (
            <>
              <div className="checkin-result-banner checkin-result-banner--error">
                <div className="checkin-banner-status">
                  <span className="checkin-banner-icon">✕</span>
                  <span>TICKET NOT VALID</span>
                </div>
                <span className="checkin-banner-time">REJECTED</span>
              </div>

              <div className="checkin-result-body">
                <div>
                  <div className="checkin-attendee-profile">
                    <div className="checkin-attendee-avatar checkin-attendee-avatar--error">
                      ✕
                    </div>
                    <div className="checkin-attendee-info">
                      <h3 className="checkin-attendee-name" style={{ color: '#b91c1c' }}>
                        Invalid Pass
                      </h3>
                      <p className="checkin-attendee-meta">
                        Unable to authenticate ticket credentials
                      </p>
                    </div>
                  </div>

                  <div className="checkin-alert-banner checkin-alert-banner--error" style={{ marginTop: 'var(--space-4)' }}>
                    <span>✕</span>
                    <div>
                      <strong>{scanResult.message || 'No ticket found for this code.'}</strong>
                      <div style={{ marginTop: '2px', fontSize: '13px' }}>
                        Ask the attendee for their registration email or WhatsApp confirmation message, or direct them to the Help Desk for lookup.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="checkin-action-bar">
                  <div className="checkin-action-bar__left" />
                  <div className="checkin-action-bar__right">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setScanResult(null)}
                    >
                      Dismiss & Retry
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desk Activity Log: Recent Scans Stream */}
      <div className="checkin-history-card">
        <div className="checkin-history-header">
          <h3 className="checkin-history-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Desk Check-in History
            {recentScans.length > 0 && (
              <span className="checkin-history-count">{recentScans.length}</span>
            )}
          </h3>
          {recentScans.length > 0 && (
            <button
              type="button"
              className="checkin-ctrl-btn"
              onClick={() => setRecentScans([])}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              Clear Log
            </button>
          )}
        </div>

        {recentScans.length === 0 ? (
          <div className="checkin-history-empty">
            Scanned passes and delegate admissions will be recorded here in real time.
          </div>
        ) : (
          <div className="checkin-history-list">
            {recentScans.map((item) => (
              <div
                key={item.id}
                className="checkin-history-row"
                onClick={() => setScanResult(item.data)}
                title="Click to view details"
              >
                <span className="checkin-history-time">{item.timestamp}</span>
                <span className="checkin-history-name">{item.name}</span>
                <span className="checkin-history-meta">
                  {item.ticketType} {item.company ? `(${item.company})` : ''}
                </span>
                <div>
                  <span className={`checkin-history-badge checkin-history-badge--${item.tone}`}>
                    {item.statusText}
                  </span>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--ink-400)', fontSize: '12px' }}>
                  ➔
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden printable badge slip (visible only during window.print()) */}
      {printAttendee && (
        <div className="checkin-badge-print">
          <div className="checkin-badge-print__header">
            <h3 className="checkin-badge-print__title">Prashanth Hospitals</h3>
            <p className="checkin-badge-print__sub">CIIM 2026 · ADMISSION BADGE</p>
          </div>
          <div className="checkin-badge-print__body">
            <h2 className="checkin-badge-print__name">{printAttendee.attendee?.name}</h2>
            <div className="checkin-badge-print__type">
              {printAttendee.ticketType?.name || 'CONFERENCE DELEGATE'}
            </div>
            {printAttendee.company?.name && (
              <p className="checkin-badge-print__org">{printAttendee.company.name}</p>
            )}
          </div>
          <div className="checkin-badge-print__footer">
            <span className="checkin-badge-print__code">
              {printAttendee.registrationCode}
            </span>
            <span>
              Admitted: {new Date(printAttendee.checkedInAt).toLocaleTimeString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
