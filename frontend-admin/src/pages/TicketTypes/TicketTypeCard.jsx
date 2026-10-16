import { useState } from 'react';
import { ticketTypeApi } from '../../lib/ticketTypeApi';
import { useSaveBar } from '../../components/SaveBar';
import Badge from '../../components/ui/Badge';

const KINDS = ['free', 'paid', 'vip', 'complimentary', 'couple'];

export default function TicketTypeCard({ ticket, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    name: ticket.name,
    code: ticket.code,
    description: ticket.description || '',
    kind: ticket.kind,
    price: ticket.price,
    taxPercent: ticket.taxPercent,
    admitsCount: ticket.admitsCount,
    quantityTotal: ticket.quantityTotal,
    minPerOrder: ticket.minPerOrder,
    maxPerOrder: ticket.maxPerOrder,
    benefits: (ticket.benefits || []).join('\n'),
    isPubliclyVisible: ticket.isPubliclyVisible,
    isActive: ticket.isActive,
  });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { SaveBar } = useSaveBar(async () => {
    const res = await ticketTypeApi.update(ticket._id || ticket.id, {
      ...form,
      price: Number(form.price) || 0,
      taxPercent: Number(form.taxPercent) || 0,
      admitsCount: Number(form.admitsCount) || 1,
      quantityTotal: Number(form.quantityTotal) || 0,
      minPerOrder: Number(form.minPerOrder) || 1,
      maxPerOrder: Number(form.maxPerOrder) || 1,
      benefits: form.benefits
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onSaved(res.data);
  });

  async function handleDelete() {
    if (!window.confirm(`Delete "${ticket.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await ticketTypeApi.remove(ticket._id || ticket.id);
      onDeleted(ticket._id || ticket.id);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const held = ticket.quantityHeld || 0;
  const sold = ticket.quantitySold || 0;
  const available =
    ticket.quantityTotal > 0 ? Math.max(ticket.quantityTotal - sold - held, 0) : null;

  return (
    <div className="card">
      <div className="card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <h3 className="card__title">{ticket.name || 'Untitled pass'}</h3>
          <Badge tone={ticket.isActive ? 'success' : 'neutral'} size="sm">
            {ticket.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-6)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-500)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--ink-800)' }}>{sold}</strong> sold
          </span>
          <span>
            <strong style={{ color: 'var(--ink-800)' }}>{held}</strong> held
          </span>
          <span>
            <strong style={{ color: 'var(--ink-800)' }}>
              {available === null ? '∞' : available}
            </strong>{' '}
            available
          </span>
        </div>
      </div>

      <div className="card__body">
        <div className="field-row">
          <label className="field">
            <span className="field__label">Name</span>
            <input className="field__input" value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span className="field__label">Code</span>
            <input
              className="field__input"
              value={form.code}
              onChange={set('code')}
              style={{ textTransform: 'uppercase' }}
            />
          </label>
          <label className="field">
            <span className="field__label">Kind</span>
            <select className="field__select" value={form.kind} onChange={set('kind')}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__textarea"
            value={form.description}
            onChange={set('description')}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Price (₹)</span>
            <input
              type="number"
              min="0"
              className="field__input"
              value={form.price}
              onChange={set('price')}
            />
          </label>
          <label className="field">
            <span className="field__label">Tax %</span>
            <input
              type="number"
              min="0"
              max="100"
              className="field__input"
              value={form.taxPercent}
              onChange={set('taxPercent')}
            />
          </label>
          <label className="field">
            <span className="field__label">Admits</span>
            <input
              type="number"
              min="1"
              className="field__input"
              value={form.admitsCount}
              onChange={set('admitsCount')}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Total inventory</span>
            <input
              type="number"
              min="0"
              className="field__input"
              value={form.quantityTotal}
              onChange={set('quantityTotal')}
            />
            <span className="field__hint">0 = unlimited</span>
          </label>
          <label className="field">
            <span className="field__label">Min per order</span>
            <input
              type="number"
              min="1"
              className="field__input"
              value={form.minPerOrder}
              onChange={set('minPerOrder')}
            />
          </label>
          <label className="field">
            <span className="field__label">Max per order</span>
            <input
              type="number"
              min="1"
              className="field__input"
              value={form.maxPerOrder}
              onChange={set('maxPerOrder')}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Benefits (one per line)</span>
          <textarea className="field__textarea" value={form.benefits} onChange={set('benefits')} />
        </label>

        <div className="field-row">
          <label className="field__label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              style={{ marginRight: 'var(--space-2)' }}
            />
            Active (on sale)
          </label>
          <label className="field__label">
            <input
              type="checkbox"
              checked={form.isPubliclyVisible}
              onChange={(e) => setForm((f) => ({ ...f, isPubliclyVisible: e.target.checked }))}
              style={{ marginRight: 'var(--space-2)' }}
            />
            Publicly visible
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-5)',
            borderTop: '1px solid var(--ink-100)',
          }}
        >
          {SaveBar}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {deleteError && (
              <span className="tab-save-bar__status tab-save-bar__status--error">
                {deleteError}
              </span>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
