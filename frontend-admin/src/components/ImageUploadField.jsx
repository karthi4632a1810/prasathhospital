import { useEffect, useRef, useState } from 'react';
import { eventApi } from '../lib/eventApi';
import { Spinner } from './ui/States';

/** Upload-and-preview widget backing every image field in the Event CMS. */
export default function ImageUploadField({ label, value, onChange, hint }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);

  // A stored URL (e.g. a seed placeholder) can 404 — fall back to the
  // neutral icon instead of a blank box, and re-check whenever it changes.
  useEffect(() => setBroken(false), [value]);
  const showImage = value && !broken;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await eventApi.upload(file);
      onChange(res.data.url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--radius-md)',
            background: 'var(--ink-100)',
            border: '1px solid var(--ink-200)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-400)',
            overflow: 'hidden',
          }}
        >
          {showImage && (
            <img
              src={value}
              alt=""
              onError={() => setBroken(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {!showImage && !uploading && (
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.6" />
              <path d="m21 15-5-5-11 11" />
            </svg>
          )}
          {uploading && <Spinner size={22} />}
        </div>

        <div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {value ? 'Replace image' : 'Upload image'}
          </button>
          {value && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onChange('')}
              style={{ marginLeft: 'var(--space-2)' }}
            >
              Remove
            </button>
          )}
          {hint && (
            <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
              {hint}
            </p>
          )}
          {error && <p className="field__error">{error}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
