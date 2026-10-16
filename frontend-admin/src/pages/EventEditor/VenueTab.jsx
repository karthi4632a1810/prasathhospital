import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';

export default function VenueTab({ event, onSaved }) {
  const [venue, setVenue] = useState({ ...emptyVenue(), ...event.venue });
  const [virtualLink, setVirtualLink] = useState(event.virtualLink || '');
  const [contact, setContact] = useState({ ...emptyContact(), ...event.contact });
  const [organizer, setOrganizer] = useState({ ...emptyOrganizer(), ...event.organizer });

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, { venue, virtualLink, contact, organizer });
    onSaved(res.data);
  });

  const v = (key) => (e) => setVenue((s) => ({ ...s, [key]: e.target.value }));
  const c = (key) => (e) => setContact((s) => ({ ...s, [key]: e.target.value }));
  const o = (key) => (e) => setOrganizer((s) => ({ ...s, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Venue</h3>
        </div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Name</span>
              <input className="field__input" value={venue.name} onChange={v('name')} />
            </label>
            <label className="field">
              <span className="field__label">Landmark</span>
              <input className="field__input" value={venue.landmark} onChange={v('landmark')} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Address line 1</span>
              <input
                className="field__input"
                value={venue.addressLine1}
                onChange={v('addressLine1')}
              />
            </label>
            <label className="field">
              <span className="field__label">Address line 2</span>
              <input
                className="field__input"
                value={venue.addressLine2}
                onChange={v('addressLine2')}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">City</span>
              <input className="field__input" value={venue.city} onChange={v('city')} />
            </label>
            <label className="field">
              <span className="field__label">State</span>
              <input className="field__input" value={venue.state} onChange={v('state')} />
            </label>
            <label className="field">
              <span className="field__label">Pincode</span>
              <input className="field__input" value={venue.pincode} onChange={v('pincode')} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Google Maps embed URL</span>
              <input
                className="field__input"
                value={venue.mapEmbedUrl}
                onChange={v('mapEmbedUrl')}
              />
            </label>
            <label className="field">
              <span className="field__label">Google Maps link</span>
              <input className="field__input" value={venue.mapLink} onChange={v('mapLink')} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Parking info</span>
            <input className="field__input" value={venue.parkingInfo} onChange={v('parkingInfo')} />
          </label>
          <label className="field">
            <span className="field__label">Virtual join link (for virtual/hybrid events)</span>
            <input
              className="field__input"
              value={virtualLink}
              onChange={(e) => setVirtualLink(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Contact</h3>
        </div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Name</span>
              <input className="field__input" value={contact.name} onChange={c('name')} />
            </label>
            <label className="field">
              <span className="field__label">Phone</span>
              <input className="field__input" value={contact.phone} onChange={c('phone')} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">WhatsApp</span>
              <input className="field__input" value={contact.whatsapp} onChange={c('whatsapp')} />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input className="field__input" value={contact.email} onChange={c('email')} />
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Organizer</h3>
        </div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Name</span>
              <input className="field__input" value={organizer.name} onChange={o('name')} />
            </label>
            <label className="field">
              <span className="field__label">Department</span>
              <input
                className="field__input"
                value={organizer.department}
                onChange={o('department')}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Logo URL</span>
              <input className="field__input" value={organizer.logoUrl} onChange={o('logoUrl')} />
            </label>
            <label className="field">
              <span className="field__label">Website URL</span>
              <input
                className="field__input"
                value={organizer.websiteUrl}
                onChange={o('websiteUrl')}
              />
            </label>
          </div>
        </div>
      </div>

      {SaveBar}
    </div>
  );
}

function emptyVenue() {
  return {
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    mapEmbedUrl: '',
    mapLink: '',
    parkingInfo: '',
  };
}
function emptyContact() {
  return { name: '', phone: '', whatsapp: '', email: '' };
}
function emptyOrganizer() {
  return { name: 'Prashanth Hospitals', department: '', logoUrl: '', websiteUrl: '' };
}
