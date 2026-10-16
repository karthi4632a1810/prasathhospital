import { useCallback, useEffect, useRef, useState } from 'react';
import { checkinApi } from '../../lib/checkinApi';
import { LoadingState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import './CheckIn.css';

export default function CheckIn() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [stats, setStats] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | starting | active | unavailable

  const scannerRef = useRef(null);
  const scannerDivId = 'checkin-camera';
  const busyRef = useRef(false); // guards against double-processing while a scan is in flight

  useEffect(() => {
    checkinApi
      .events()
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setEventId((id) => id || res.data[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  const loadStats = useCallback(() => {
    if (!eventId) return;
    checkinApi
      .stats(eventId)
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, [eventId]);

  useEffect(loadStats, [loadStats]);

  // The actual API call — used by both the camera path and manual entry.
  // Manual submissions must NOT be blocked by the camera's debounce below:
  // a human deliberately clicking "Check in" is never a duplicate frame.
  const submitScan = useCallback(
    async (rawValue) => {
      if (!rawValue) return;
      setScanning(true);
      try {
        const res = await checkinApi.scan(rawValue);
        setScanResult({ tone: res.data.result === 'success' ? 'success' : 'warning', ...res.data });
        loadStats();
      } catch (err) {
        setScanResult({ tone: 'error', message: err.message });
      } finally {
        setScanning(false);
      }
    },
    [loadStats]
  );

  // Camera frames fire the success callback continuously while the same QR
  // sits in view, so only THIS path needs debouncing against re-submitting
  // the same code a dozen times a second.
  const handleCameraDetect = useCallback(
    (rawValue) => {
      if (busyRef.current || !rawValue) return;
      busyRef.current = true;
      submitScan(rawValue).finally(() => {
        setTimeout(() => {
          busyRef.current = false;
        }, 2000);
      });
    },
    [submitScan]
  );

  // Camera scanner (progressive enhancement — manual entry always works).
  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;
      setCameraStatus('starting');

      let instance;
      try {
        instance = new Html5Qrcode(scannerDivId);
      } catch {
        // Element not mounted yet, or the library couldn't init — fall back
        // to manual entry rather than getting stuck on "Starting camera…".
        if (!cancelled) setCameraStatus('unavailable');
        return;
      }
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (decodedText) => handleCameraDetect(decodedText),
          () => {} // per-frame "no QR found" — expected constantly, ignore
        )
        .then(() => !cancelled && setCameraStatus('active'))
        .catch(() => !cancelled && setCameraStatus('unavailable'));
    });

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      if (instance) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualSubmit(e) {
    e.preventDefault();
    submitScan(manualCode.trim());
    setManualCode('');
  }

  if (events === null) return <LoadingState label="Loading events…" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Check-in</h2>
          <p className="page-header__subtitle">
            Scan a ticket's QR code, or enter the code manually.
          </p>
        </div>
        {events.length > 1 && (
          <select
            className="field__select"
            value={eventId || ''}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile">
            <p className="stat-tile__label">Checked in</p>
            <p className="stat-tile__value">{stats.checkedIn}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-tile__label">Remaining</p>
            <p className="stat-tile__value">{stats.remaining}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-tile__label">Total confirmed</p>
            <p className="stat-tile__value">{stats.total}</p>
          </div>
        </div>
      )}

      <div className="checkin-grid">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Scanner</h3>
          </div>
          <div className="card__body">
            <div id={scannerDivId} className="checkin-camera" />
            {cameraStatus === 'unavailable' && (
              <p className="checkin-camera__hint">
                Camera not available in this browser/device — use manual entry below.
              </p>
            )}
            {cameraStatus === 'starting' && (
              <p className="checkin-camera__hint">Starting camera…</p>
            )}

            <form onSubmit={handleManualSubmit} className="checkin-manual">
              <input
                className="field__input"
                placeholder="Paste QR token or ticket URL"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!manualCode.trim() || scanning}>
                Check in
              </Button>
            </form>
          </div>
        </div>

        <div className={`checkin-result checkin-result--${scanResult?.tone || 'idle'}`}>
          {!scanResult && <p className="checkin-result__idle">Awaiting a scan…</p>}

          {scanResult?.tone === 'success' && (
            <>
              <div className="checkin-result__icon">✓</div>
              <h3>Checked in</h3>
              <p className="checkin-result__name">{scanResult.attendee?.name}</p>
              <p className="checkin-result__meta">
                {[
                  scanResult.company?.name,
                  scanResult.ticketType?.name,
                  scanResult.registrationCode,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </>
          )}

          {scanResult?.tone === 'warning' && (
            <>
              <div className="checkin-result__icon">↻</div>
              <h3>Already checked in</h3>
              <p className="checkin-result__name">{scanResult.attendee?.name}</p>
              <p className="checkin-result__meta">
                {scanResult.company?.name ? `${scanResult.company.name} · ` : ''}
                {scanResult.ticketType?.name} · at{' '}
                {new Date(scanResult.checkedInAt).toLocaleTimeString('en-IN')}
              </p>
            </>
          )}

          {scanResult?.tone === 'error' && (
            <>
              <div className="checkin-result__icon">✕</div>
              <h3>Not valid</h3>
              <p className="checkin-result__meta">{scanResult.message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
