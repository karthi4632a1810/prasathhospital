import { useCallback, useEffect, useRef, useState } from 'react';
import { checkinApi } from '../../lib/checkinApi';
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
  const [retryCount, setRetryCount] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

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

  // Camera scanner lifecycle
  // Notice: The component renders #checkin-camera immediately (without blocking on events fetch),
  // so the DOM container is guaranteed to exist right on mount / page refresh.
  useEffect(() => {
    let cancelled = false;
    let activeScanner = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        // Ensure target container exists
        const container = document.getElementById(scannerDivId);
        if (!container) {
          if (!cancelled) setCameraStatus('unavailable');
          return;
        }

        setCameraStatus('starting');

        // Stop previous instance if any
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

        // Discover available cameras
        let availableCameras = [];
        try {
          availableCameras = await Html5Qrcode.getCameras();
          if (!cancelled && availableCameras && availableCameras.length > 0) {
            setCameras(availableCameras);
          }
        } catch {
          // getCameras might fail if permissions are not yet granted
        }

        const scanConfig = { fps: 10, qrbox: { width: 240, height: 240 } };
        const onDetect = (decodedText) => handleCameraDetect(decodedText);
        const onIgnore = () => {};

        // If user picked a camera from the discovered list
        if (availableCameras.length > 0 && currentCameraIndex < availableCameras.length) {
          await instance.start(availableCameras[currentCameraIndex].id, scanConfig, onDetect, onIgnore);
        } else {
          // Try environment (rear) camera first, fallback to user (webcam)
          try {
            await instance.start({ facingMode: 'environment' }, scanConfig, onDetect, onIgnore);
          } catch (envErr) {
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
    }
  };

  function handleManualSubmit(e) {
    e.preventDefault();
    submitScan(manualCode.trim());
    setManualCode('');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Check-in</h2>
          <p className="page-header__subtitle">
            Scan a ticket's QR code, or enter the code manually.
          </p>
        </div>
        {events && events.length > 1 && (
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

      <div className="stat-grid">
        <div className="stat-tile">
          <p className="stat-tile__label">Checked in</p>
          <p className="stat-tile__value">{stats ? stats.checkedIn : 0}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile__label">Remaining</p>
          <p className="stat-tile__value">{stats ? stats.remaining : 0}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-tile__label">Total confirmed</p>
          <p className="stat-tile__value">{stats ? stats.total : 0}</p>
        </div>
      </div>

      <div className="checkin-grid">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Scanner</h3>
          </div>
          <div className="card__body">
            <div id={scannerDivId} className="checkin-camera" />

            {cameraStatus === 'unavailable' && (
              <div className="checkin-camera__status-box">
                <p className="checkin-camera__hint">
                  Camera not available or access blocked. Check browser permissions or use manual entry below.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRetryCount((c) => c + 1)}
                >
                  ↻ Retry camera
                </Button>
              </div>
            )}

            {cameraStatus === 'starting' && (
              <p className="checkin-camera__hint">Starting camera…</p>
            )}

            {cameraStatus === 'active' && cameras.length > 1 && (
              <div className="checkin-camera__controls">
                <button
                  type="button"
                  className="checkin-camera__switch-btn"
                  onClick={handleSwitchCamera}
                >
                  🔄 Switch camera ({currentCameraIndex + 1}/{cameras.length})
                </button>
              </div>
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

