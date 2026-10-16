import { useState } from 'react';
import Button from './ui/Button';

/** Shared "Save changes" footer + status message for every CMS tab. */
export function useSaveBar(onSave) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [message, setMessage] = useState('');

  async function save() {
    setStatus('saving');
    setMessage('');
    try {
      await onSave();
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Save failed. Please try again.');
    }
  }

  const bar = (
    <div className="tab-save-bar">
      <Button variant="primary" onClick={save} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : 'Save changes'}
      </Button>
      {status === 'saved' && (
        <span className="tab-save-bar__status tab-save-bar__status--success">Saved</span>
      )}
      {status === 'error' && (
        <span className="tab-save-bar__status tab-save-bar__status--error">{message}</span>
      )}
    </div>
  );

  return { save, status, SaveBar: bar };
}
