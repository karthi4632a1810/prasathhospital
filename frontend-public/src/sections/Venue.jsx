import Button from '../components/ui/Button';
import { buildAddress } from '../lib/format';
import { useTilt } from '../lib/useTilt';
import './Venue.css';

export default function Venue({ event }) {
  const { venue, mode, virtualLink } = event;
  const mapTilt = useTilt({ max: 5, scale: 1.012 });

  // Online-only events get a joining panel instead of a map.
  if (mode === 'virtual') {
    return (
      <section className="section section--alt venue" id="venue">
        <div className="container venue__virtual">
          <div className="section-head section-head--center">
            <span className="section-eyebrow">Attending</span>
            <h2 className="section-title">This is an online event</h2>
            <p className="section-subtitle">
              Your joining link is sent on WhatsApp and email as soon as you register, and again one
              hour before the session starts.
            </p>
          </div>
          {virtualLink && (
            <div className="venue__virtual-actions">
              <Button variant="primary" href={virtualLink} external>
                Joining link
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!venue?.name && !venue?.city) return null;

  const address = buildAddress(venue);

  return (
    <section className="section section--alt venue" id="venue">
      <div className="venue__glow venue__glow--navy" aria-hidden="true" />
      <div className="venue__glow venue__glow--gold" aria-hidden="true" />

      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">Getting there</span>
          <h2 className="section-title">Venue</h2>
        </div>

        <div className="venue__grid">
          <div className="venue__card">
            <h3 className="venue__name">{venue.name}</h3>

            {address && (
              <p className="venue__address">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>{address}</span>
              </p>
            )}

            {(venue.landmark || venue.parkingInfo) && (
              <div className="venue__chips">
                {venue.landmark && (
                  <span className="venue__chip">
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M3 11 12 4l9 7M5 10v9h14v-9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {venue.landmark}
                  </span>
                )}
                {venue.parkingInfo && (
                  <span className="venue__chip">
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path
                        d="M9 8h3.5a2 2 0 0 1 0 4H9V8Zm0 4v4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {venue.parkingInfo}
                  </span>
                )}
              </div>
            )}

            <div className="venue__actions">
              {venue.mapLink && (
                <Button
                  variant="primary"
                  href={venue.mapLink}
                  external
                  iconLeft={
                    <svg
                      viewBox="0 0 24 24"
                      width="17"
                      height="17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                    >
                      <path
                        d="M3 7.5 9 5l6 2.5L21 5v11.5L15 19l-6-2.5L3 19V7.5Z"
                        strokeLinejoin="round"
                      />
                      <path d="M9 5v11.5M15 7.5V19" />
                    </svg>
                  }
                >
                  Open in Maps
                </Button>
              )}
              {address && (
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(`${venue.name}, ${address}`)}
                >
                  Copy address
                </Button>
              )}
            </div>
          </div>

          {venue.mapEmbedUrl && (
            <div
              ref={mapTilt.ref}
              onMouseEnter={mapTilt.onMouseEnter}
              onMouseMove={mapTilt.onMouseMove}
              onMouseLeave={mapTilt.onMouseLeave}
              className="venue__map-frame"
            >
              <div className="venue__map">
                <iframe
                  src={venue.mapEmbedUrl}
                  title={`Map showing ${venue.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
