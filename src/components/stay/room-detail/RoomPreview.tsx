'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Heart,
  MapPin,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
  Utensils,
  Waves,
  Wifi,
  X,
  AirVent,
  BriefcaseBusiness,
  CarFront,
  type LucideIcon,
} from 'lucide-react';
import RoomDetailReviews from './RoomDetailReviews';

type Guest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
};

export type PreviewPhoto = { src: string; alt: string };

export type PreviewProperty = {
  id: string;
  slug: string;
  name: string;
  typeLabel: string;
  nightlyRate: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  /** Short area label, e.g. "Milimani, Kisumu" */
  areaLabel: string;
  /** Full location line, e.g. "Museum Road, Milimani, Kisumu, Kenya" */
  locationLine: string;
  city: string;
  description: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  houseRules: {
    noSmoking?: boolean;
    noPets?: boolean;
    noParties?: boolean;
    quietHours?: boolean;
  };
};

type Props = {
  property: PreviewProperty;
  photos: PreviewPhoto[];
  amenities: string[];
  alsoAs?: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuests: number;
};

const CANCELLATION_COPY: Record<string, { title: string; body: string }> = {
  flexible: { title: 'Flexible cancellation', body: 'Cancel free up to 24 hours before check-in.' },
  moderate: { title: 'Moderate cancellation', body: 'Cancel free up to 5 days before check-in.' },
  strict: { title: 'Strict cancellation', body: 'No refund once booking is confirmed.' },
  'non-refundable': { title: 'Non-refundable rate', body: 'This rate is non-refundable.' },
};

function amenityIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('wifi') || n.includes('wi-fi') || n.includes('internet')) return Wifi;
  if (n.includes('workspace') || n.includes('desk') || n.includes('office')) return BriefcaseBusiness;
  if (n.includes('tv') || n.includes('television') || n.includes('netflix')) return Tv;
  if (n.includes('pool') || n.includes('swim')) return Waves;
  if (n.includes('park') || n.includes('garage')) return CarFront;
  if (n.includes('secur') || n.includes('guard') || n.includes('cctv') || n.includes('safe')) return ShieldCheck;
  if (n.includes('kitchen') || n.includes('cook') || n.includes('fridge') || n.includes('utensil')) return Utensils;
  if (n.includes('breakfast') || n.includes('coffee') || n.includes('tea')) return Coffee;
  if (n.includes('air') || n.includes('ac') || n.includes('climate') || n.includes('fan') || n.includes('vent')) return AirVent;
  if (n.includes('bed') || n.includes('linen') || n.includes('blanket')) return BedDouble;
  if (n.includes('bath') || n.includes('shower') || n.includes('toilet') || n.includes('water')) return Bath;
  return Check;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

function shiftDate(value: string, days: number) {
  if (!validIsoDate(value)) return toIsoDate(new Date());
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) {
  if (!validIsoDate(value)) return 'Choose a date';
  return new Intl.DateTimeFormat('en-KE', options).format(new Date(`${value}T12:00:00`));
}

function countNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 1;
  const distance = new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime();
  return Math.max(1, Math.round(distance / 86_400_000));
}

function money(value: number) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);
}

export default function RoomPreview({
  property,
  photos,
  amenities,
  alsoAs,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}: Props) {
  const router = useRouter();
  const maxGuests = Math.max(1, property.maxGuests || 2);
  const rate = Math.max(0, property.nightlyRate || 0);
  const cancellation = CANCELLATION_COPY[property.cancellationPolicy] ?? CANCELLATION_COPY.flexible;

  const [checkIn, setCheckIn] = useState(validIsoDate(initialCheckIn) ? initialCheckIn : toIsoDate(new Date()));
  const [checkOut, setCheckOut] = useState(
    validIsoDate(initialCheckOut) && initialCheckOut > checkIn ? initialCheckOut : shiftDate(checkIn, 1),
  );
  const [guestCount, setGuestCount] = useState(Math.min(maxGuests, Math.max(1, initialGuests || 1)));
  const [step, setStep] = useState(0);
  const [guest, setGuest] = useState<Guest>({ firstName: '', lastName: '', email: '', phone: '', note: '' });
  const [saved, setSaved] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  const nights = useMemo(() => countNights(checkIn, checkOut), [checkIn, checkOut]);
  const total = nights * rate;
  const earliestCheckOut = shiftDate(checkIn, 1);
  const roomTag = property.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bookingReference = `KGS-${roomTag}-${checkIn.replaceAll('-', '').slice(2)}-${String(guestCount).padStart(2, '0')}`;
  const bookingSteps = ['Guest details', 'Review', 'Complete'];
  const displayPhotos = photos.length > 0 ? photos : [];

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function beginBooking() {
    setError('');
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError('Choose a check-out date after your check-in date.');
      document.getElementById('booking-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep(1);
    scrollToTop();
  }

  function updateGuest(key: keyof Guest, value: string) {
    setGuest((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function continueFlow() {
    setError('');
    if (step === 0) {
      beginBooking();
      return;
    }
    if (step === 1) {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email);
      if (!guest.firstName.trim() || !guest.lastName.trim() || !validEmail || !guest.phone.trim()) {
        setError('Enter your first and last name, a valid email, and a phone number to continue.');
        return;
      }
      setStep(2);
      scrollToTop();
      return;
    }
    if (step === 2) {
      setStep(3);
      scrollToTop();
      return;
    }
    goToCheckout();
  }

  function goToCheckout() {
    const qs = new URLSearchParams({
      propertyId: property.slug || property.id,
      checkIn,
      checkOut,
      guests: String(guestCount),
      rooms: '1',
    });
    const fullName = `${guest.firstName} ${guest.lastName}`.trim();
    if (fullName) qs.set('guestName', fullName);
    if (guest.phone.trim()) qs.set('guestPhone', guest.phone.trim());
    if (guest.email.trim()) qs.set('guestEmail', guest.email.trim());
    if (guest.note.trim()) qs.set('guestNote', guest.note.trim());
    router.push(`/stay/checkout?${qs.toString()}`);
  }

  function backToRoom() {
    setError('');
    setStep(0);
    scrollToTop();
  }

  function changeGuestCount(delta: number) {
    setGuestCount((current) => Math.min(maxGuests, Math.max(1, current + delta)));
  }

  async function shareRoom() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${property.name} at Kogelo Suites`, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Room link copied');
        window.setTimeout(() => setShareMessage(''), 2200);
      } else {
        setShareMessage('Copy this page link to share');
        window.setTimeout(() => setShareMessage(''), 2800);
      }
    } catch {
      setShareMessage('');
    }
  }

  function changeDate(kind: 'checkIn' | 'checkOut', value: string) {
    if (kind === 'checkIn') {
      setCheckIn(value);
      if (value >= checkOut) setCheckOut(shiftDate(value, 1));
    } else {
      setCheckOut(value);
    }
    setError('');
  }

  function closeConfirmation() {
    setStep(0);
    setGuest({ firstName: '', lastName: '', email: '', phone: '', note: '' });
    setError('');
    scrollToTop();
  }

  const photoLabel = `${displayPhotos.length} photo${displayPhotos.length === 1 ? '' : 's'}`;
  // Types that describe a layout rather than a bedroom count (Studio, Executive
  // Studio, Bedsitter, Budget room, Cottage) shouldn't claim "1 bedroom".
  const isStudioType = !/bedroom/i.test(property.typeLabel) || property.bedrooms === 0;
  const bedroomLabel = isStudioType
    ? property.typeLabel
    : `${property.bedrooms} bedroom${property.bedrooms === 1 ? '' : 's'}`;
  const bedroomSub = isStudioType ? 'Open-plan layout' : property.typeLabel;
  const bathroomLabel = `${property.bathrooms} bathroom${property.bathrooms === 1 ? '' : 's'}`;
  const rulesLine = [
    property.houseRules.noSmoking && 'no smoking',
    property.houseRules.noPets && 'no pets',
    property.houseRules.noParties && 'no parties or events',
  ].filter(Boolean).join(', ');
  const houseNote = rulesLine
    ? `Please ${rulesLine.charAt(0).toUpperCase() + rulesLine.slice(1)} during your stay${property.houseRules.quietHours ? ' — quiet hours begin at 10 pm.' : '.'}`
    : property.houseRules.quietHours
      ? 'Quiet hours begin at 10 pm.'
      : 'Please treat the space with care during your stay.';
  const descriptionParagraphs = property.description
    ? property.description.split(/\n{2,}/).filter(Boolean)
    : null;

  return (
    <div className="room-shell" id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Kogelo Suites home">
          <span className="brand-mark">K</span>
          <span className="brand-copy">
            <strong>Kogelo Suites</strong>
            <small>Stay a little longer</small>
          </span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#room-details">Stay</a>
          <a href="#location">Our place</a>
          <a href="#amenities">The details</a>
          <button className="nav-plan" type="button" onClick={step === 0 ? beginBooking : backToRoom}>
            <span>Plan your stay</span><ArrowRight size={14} />
          </button>
        </nav>
      </header>

      {step === 0 ? (
        <main className="room-page">
          <div className="room-intro-bar">
            <Link className="back-link" href="/stay/rooms"><ArrowLeft size={14} /> All rooms</Link>
            <div className="room-actions">
              <button type="button" onClick={shareRoom} aria-label={`Share ${property.name}`}><Share2 size={15} /> Share</button>
              <button type="button" className={saved ? 'is-saved' : ''} onClick={() => setSaved((value) => !value)} aria-pressed={saved}>
                <Heart size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
              </button>
              {shareMessage && <span className="share-feedback" role="status">{shareMessage}</span>}
            </div>
          </div>

          <div className="room-title-row" id="room-details">
            <div>
              <p className="eyebrow">A private compound in {property.city || 'Kisumu'}</p>
              <h1>{property.name} <em>{property.typeLabel}</em></h1>
              <p className="room-subtitle">A quiet little place to land, in the heart of {property.areaLabel}.</p>
            </div>
            <div className="room-location"><MapPin size={15} /><span>{property.locationLine}</span></div>
          </div>

          {displayPhotos.length > 0 && (
            <section className="photo-grid" aria-label={`Photos of ${property.name}`}>
              <button className="photo-main" type="button" onClick={() => setPhotoIndex(0)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase storage URL; no remotePatterns configured */}
                <img src={displayPhotos[0].src} alt={displayPhotos[0].alt} />
              </button>
              {displayPhotos.slice(1, 5).map((photo, index) => (
                <button className={`photo-tile photo-tile-${index + 1}`} key={photo.src} type="button" onClick={() => setPhotoIndex(index + 1)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase storage URL; no remotePatterns configured */}
                  <img src={photo.src} alt={photo.alt} />
                  {index === Math.min(3, displayPhotos.length - 2) && displayPhotos.length > 5 && (
                    <span className="photo-count"><Sparkles size={13} /> {photoLabel}</span>
                  )}
                </button>
              ))}
              <button className="all-photos-button" type="button" onClick={() => setPhotoIndex(0)}>
                <Sparkles size={14} /> Show all photos
              </button>
            </section>
          )}

          <div className="details-layout">
            <div className="details-main">
              <section className="room-facts">
                <div>
                  <span className="fact-icon"><Users size={17} /></span>
                  <span><strong>{maxGuests} {maxGuests === 1 ? 'guest' : 'guests'}</strong><small>Comfortable for {maxGuests === 1 ? 'one' : 'a group'}</small></span>
                </div>
                <div>
                  <span className="fact-icon"><BedDouble size={17} /></span>
                  <span><strong>{bedroomLabel}</strong><small>{bedroomSub}</small></span>
                </div>
                <div>
                  <span className="fact-icon"><Bath size={17} /></span>
                  <span><strong>{bathroomLabel}</strong><small>Private to your stay</small></span>
                </div>
              </section>

              <section className="content-section about-section">
                <p className="eyebrow">Your own pace, your own space</p>
                <h2>A little room to exhale.</h2>
                {descriptionParagraphs ? (
                  descriptionParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <>
                    <p>
                      {property.name} is a cozy {property.typeLabel.toLowerCase()} retreat in {property.areaLabel}, made for a slower
                      stay. Settle into the living area after a day out, catch up on work with high-speed Wi-Fi, or simply
                      enjoy a quiet evening in. The sleeping area and bathroom have the essentials close at hand, while
                      the shared pool and secure compound give you room to unwind outside.
                    </p>
                    <p>
                      When you’re ready to explore, Kisumu’s lakeside walks, local markets, and favorite neighborhood
                      spots are within easy reach. Come for a few days of discovery or stay a little longer.
                    </p>
                  </>
                )}
                {alsoAs && <p className="also-as">{alsoAs}</p>}
              </section>

              {amenities.length > 0 && (
                <section className="content-section" id="amenities">
                  <div className="section-heading">
                    <div><p className="eyebrow">Thoughtful comforts</p><h2>What the room offers</h2></div>
                  </div>
                  <div className="amenity-grid">
                    {amenities.slice(0, 10).map((name) => {
                      const Icon = amenityIcon(name);
                      return (
                        <div className="amenity" key={name}>
                          <span className="amenity-icon"><Icon size={18} strokeWidth={1.6} /></span>
                          <span><strong>{name}</strong></span>
                        </div>
                      );
                    })}
                  </div>
                  {amenities.length > 10 && (
                    <p className="amenity-more">+ {amenities.length - 10} more amenities</p>
                  )}
                </section>
              )}

              <section className="content-section location-section" id="location">
                <p className="eyebrow">A calm corner of town</p>
                <h2>Find us in {property.areaLabel}.</h2>
                <div className="location-card">
                  <div className="location-art" aria-hidden="true">
                    <span className="map-road map-road-one" /><span className="map-road map-road-two" />
                    <span className="map-pin"><MapPin size={19} fill="currentColor" /></span>
                  </div>
                  <div>
                    <strong>Kogelo Suites · {property.areaLabel}</strong>
                    <p>A peaceful residential neighborhood in {property.city || 'Kisumu'}, with the city and lakeside close by.</p>
                    <span><MapPin size={13} /> {property.locationLine}</span>
                  </div>
                </div>
              </section>

              <section className="content-section rules-section">
                <p className="eyebrow">Before you arrive</p>
                <h2>A few house notes.</h2>
                <div className="rule-grid">
                  <div className="rule-card">
                    <Clock3 size={18} />
                    <div><strong>Check-in & check-out</strong><p>Check in from {property.checkInTime} · check out by {property.checkOutTime}</p></div>
                  </div>
                  <div className="rule-card">
                    <ShieldCheck size={18} />
                    <div><strong>Good to know</strong><p>{houseNote}</p></div>
                  </div>
                </div>
                <div className="cancellation-note">
                  <CheckCircle2 size={18} />
                  <div><strong>{cancellation.title}</strong><p>{cancellation.body}</p></div>
                </div>
              </section>

              <section className="content-section reviews-section">
                <p className="eyebrow">Guest notes</p>
                <h2>What guests say.</h2>
                <RoomDetailReviews propertyId={property.id} propertyName={property.name} />
              </section>
            </div>

            <aside className="booking-card" id="booking-card" aria-label={`Book ${property.name}`}>
              <div className="booking-card-top">
                <div><span className="nightly-price">KSh {money(rate)}</span><span className="per-night"> / night</span></div>
                <span className="fee-pill"><Check size={12} /> All fees included</span>
              </div>
              <div className="booking-fields">
                <div className="date-pair">
                  <label>
                    <span>Check-in</span>
                    <input data-testid="input-check-in" type="date" value={checkIn} onChange={(event) => changeDate('checkIn', event.target.value)} />
                  </label>
                  <label>
                    <span>Check-out</span>
                    <input data-testid="input-check-out" type="date" min={earliestCheckOut} value={checkOut} onChange={(event) => changeDate('checkOut', event.target.value)} />
                  </label>
                </div>
                <div className="guest-picker">
                  <div><span>Guests</span><strong>{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</strong></div>
                  <div className="counter">
                    <button type="button" aria-label="Remove one guest" disabled={guestCount <= 1} onClick={() => changeGuestCount(-1)}><Minus size={13} /></button>
                    <b>{guestCount}</b>
                    <button type="button" aria-label="Add one guest" disabled={guestCount >= maxGuests} onClick={() => changeGuestCount(1)}><Plus size={13} /></button>
                  </div>
                </div>
              </div>
              <div className="price-breakdown">
                <span>KSh {money(rate)} × {nights} {nights === 1 ? 'night' : 'nights'}</span>
                <b>KSh {money(total)}</b>
              </div>
              <div className="total-line"><strong>Total</strong><strong>KSh {money(total)}</strong></div>
              {error && <div className="validation" role="alert">{error}</div>}
              <button className="button primary card-reserve" type="button" onClick={beginBooking}>Reserve {property.name} <ArrowRight size={15} /></button>
              <p className="booking-assurance">No payment now — we’ll confirm within 2 hours.</p>
              <div className="card-cancellation"><CheckCircle2 size={15} /><span>{cancellation.body}</span></div>
            </aside>
          </div>
        </main>
      ) : (
        <main className="flow-page">
          <button className="back-link flow-back" type="button" onClick={step === 1 ? backToRoom : () => { setStep((current) => current - 1); setError(''); scrollToTop(); }}>
            <ArrowLeft size={14} /> {step === 1 ? `Back to ${property.name}` : 'Back'}
          </button>

          {step < 3 && (
            <>
              <div className="flow-heading">
                <p className="eyebrow">Your stay at Kogelo Suites</p>
                <h1>{step === 1 ? 'Who will we welcome?' : 'Take a moment to review.'}</h1>
                <p>{step === 1 ? 'Add the lead guest’s details. We’ll carry them through to checkout.' : 'Check the details below before you continue to secure checkout.'}</p>
              </div>
              <nav className="stepper" aria-label="Booking progress">
                {bookingSteps.map((label, index) => {
                  const number = index + 1;
                  const active = number === step;
                  const complete = number < step;
                  return (
                    <div className="step-group" key={label}>
                      <div className={`step-item ${active ? 'active' : ''} ${complete ? 'done' : ''}`}>
                        <span className="step-number">{complete ? <Check size={13} /> : number}</span>
                        <span>{label}</span>
                      </div>
                      {index < bookingSteps.length - 1 && <span className="step-line" />}
                    </div>
                  );
                })}
              </nav>
              <div className="flow-layout">
                <section className="flow-panel">
                  {step === 1 ? (
                    <>
                      <div className="selected-stay">
                        {displayPhotos[0] && (
                          <div className="selected-stay-photo">
                            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase storage URL; no remotePatterns configured */}
                            <img src={displayPhotos[0].src} alt="" />
                          </div>
                        )}
                        <div className="selected-stay-copy">
                          <span className="room-type">Kogelo Suites · {property.areaLabel}</span>
                          <strong>{property.name} {property.typeLabel}</strong>
                          <small>{formatDate(checkIn, { day: 'numeric', month: 'short' })} – {formatDate(checkOut, { day: 'numeric', month: 'short' })} · {nights} {nights === 1 ? 'night' : 'nights'} · {guestCount} {guestCount === 1 ? 'guest' : 'guests'}</small>
                        </div>
                        <button className="edit-link" type="button" onClick={backToRoom}>Edit stay</button>
                      </div>
                      <h2 className="form-heading">Lead guest details</h2>
                      <div className="form-grid">
                        <label className="field"><span>First name</span><input data-testid="input-first-name" autoComplete="given-name" value={guest.firstName} placeholder="Your first name" onChange={(event) => updateGuest('firstName', event.target.value)} /></label>
                        <label className="field"><span>Last name</span><input data-testid="input-last-name" autoComplete="family-name" value={guest.lastName} placeholder="Your last name" onChange={(event) => updateGuest('lastName', event.target.value)} /></label>
                        <label className="field"><span>Email address</span><input data-testid="input-email" type="email" autoComplete="email" value={guest.email} placeholder="you@example.com" onChange={(event) => updateGuest('email', event.target.value)} /></label>
                        <label className="field"><span>Phone number</span><input data-testid="input-phone" type="tel" autoComplete="tel" value={guest.phone} placeholder="+254 700 000 000" onChange={(event) => updateGuest('phone', event.target.value)} /></label>
                        <label className="field field-full"><span>A note for your host <small>Optional</small></span><textarea data-testid="input-note" value={guest.note} placeholder="Anything that would make your stay easier?" onChange={(event) => updateGuest('note', event.target.value)} /></label>
                      </div>
                      <div className="privacy-note"><ShieldCheck size={16} /><span>Your details go to checkout only — nothing is sent before then.</span></div>
                    </>
                  ) : (
                    <>
                      <div className="review-title">
                        <span className="review-check"><Check size={16} /></span>
                        <div><h2>Your stay details</h2><p>Everything in one place before you finish.</p></div>
                      </div>
                      <div className="review-summary">
                        <div><span>Room</span><strong>{property.name} {property.typeLabel} · {property.areaLabel}</strong></div>
                        <div><span>Check-in</span><strong>{formatDate(checkIn)} · from {property.checkInTime}</strong></div>
                        <div><span>Check-out</span><strong>{formatDate(checkOut)} · by {property.checkOutTime}</strong></div>
                        <div><span>Guests</span><strong>{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</strong></div>
                        <div><span>Lead guest</span><strong>{guest.firstName} {guest.lastName}</strong></div>
                        <div><span>Contact</span><strong>{guest.email}<br />{guest.phone}</strong></div>
                        {guest.note.trim() && <div className="review-note"><span>Note for your host</span><strong>{guest.note}</strong></div>}
                      </div>
                      <div className="cancellation-note review-cancel"><CheckCircle2 size={18} /><div><strong>{cancellation.title}</strong><p>{cancellation.body}</p></div></div>
                      <div className="privacy-note"><ShieldCheck size={16} /><span>No payment is collected on this page — you’ll confirm on secure checkout.</span></div>
                    </>
                  )}
                  {error && <div className="validation" role="alert">{error}</div>}
                </section>
                <aside className="flow-summary">
                  <p className="summary-kicker">A little getaway</p>
                  <h2>{property.name} {property.typeLabel}</h2>
                  <p className="summary-location"><MapPin size={13} /> {property.areaLabel}</p>
                  <div className="summary-dates"><span>{formatDate(checkIn, { day: 'numeric', month: 'short' })} — {formatDate(checkOut, { day: 'numeric', month: 'short' })}</span><small>{nights} {nights === 1 ? 'night' : 'nights'} · {guestCount} {guestCount === 1 ? 'guest' : 'guests'}</small></div>
                  <div className="price-breakdown"><span>KSh {money(rate)} × {nights} {nights === 1 ? 'night' : 'nights'}</span><b>KSh {money(total)}</b></div>
                  <div className="total-line"><strong>Total</strong><strong>KSh {money(total)}</strong></div>
                  <p className="booking-assurance">All fees included · no payment now</p>
                </aside>
              </div>
            </>
          )}

          {step === 3 && (
            <section className="confirmation-card">
              <div className="confirmation-icon"><CheckCircle2 size={29} /></div>
              <p className="eyebrow">Ready when you are</p>
              <h1>Everything is ready.</h1>
              <p className="confirmation-copy">Your {property.name} stay is set for secure checkout — no reservation has been created yet, and no payment is taken on this page.</p>
              <div className="confirmation-reference">{bookingReference}</div>
              <div className="confirmation-details">
                <div><span>Lead guest</span><strong>{guest.firstName} {guest.lastName}</strong></div>
                <div><span>Room</span><strong>{property.name} {property.typeLabel} · {property.areaLabel}</strong></div>
                <div><span>Dates</span><strong>{formatDate(checkIn)} – {formatDate(checkOut)}</strong></div>
                <div><span>Guests</span><strong>{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</strong></div>
                <div><span>Contact</span><strong>{guest.email}<br />{guest.phone}</strong></div>
                <div><span>Estimated total</span><strong>KSh {money(total)} · {nights} {nights === 1 ? 'night' : 'nights'}</strong></div>
              </div>
              <div className="preview-warning"><ShieldCheck size={16} /><span>Continue to secure checkout to confirm this stay — that’s where your booking is created and our team confirms within 2 hours.</span></div>
              <button className="button secondary-button" type="button" onClick={closeConfirmation}>Back to {property.name} <ArrowRight size={14} /></button>
            </section>
          )}
        </main>
      )}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark">K</span><span className="brand-copy"><strong>Kogelo Suites</strong><small>Stay a little longer</small></span></a>
        <span>{property.areaLabel} · Kenya</span>
        <span className="footer-private"><ShieldCheck size={13} /> Secure checkout via Kogelo Suites</span>
      </footer>

      <div className="booking-dock" role="region" aria-label="Booking actions">
        {step === 3 ? (
          <>
            <div className="dock-price"><strong>{property.name} {property.typeLabel}</strong><span>Ready for checkout · KSh {money(total)}</span></div>
            <button className="button primary dock-button" type="button" onClick={goToCheckout}>Continue to checkout <ArrowRight size={15} /></button>
          </>
        ) : (
          <>
            <div className="dock-price"><strong>KSh {money(step === 0 ? rate : total)} <small>{step === 0 ? '/ night' : `· ${nights} ${nights === 1 ? 'night' : 'nights'}`}</small></strong><span>{formatDate(checkIn, { day: 'numeric', month: 'short' })} – {formatDate(checkOut, { day: 'numeric', month: 'short' })} · {guestCount} {guestCount === 1 ? 'guest' : 'guests'}</span></div>
            <button className="button primary dock-button" type="button" onClick={continueFlow}>
              {step === 0 ? `Reserve ${property.name}` : step === 1 ? 'Review your stay' : 'Finish review'} <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>

      {photoIndex !== null && displayPhotos[photoIndex] && (
        <div className="photo-modal" role="dialog" aria-modal="true" aria-label={`${property.name} photo gallery`} onClick={() => setPhotoIndex(null)}>
          <div className="photo-modal-top">
            <button type="button" aria-label="Close photo gallery" onClick={() => setPhotoIndex(null)}><X size={18} /> Close</button>
            <span>{photoIndex + 1} / {displayPhotos.length}</span>
            <span className="modal-spacer" />
          </div>
          <div className="photo-modal-view" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Previous photo" onClick={() => setPhotoIndex((photoIndex + displayPhotos.length - 1) % displayPhotos.length)}><ArrowLeft size={19} /></button>
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase storage URL; no remotePatterns configured */}
            <img src={displayPhotos[photoIndex].src} alt={displayPhotos[photoIndex].alt} />
            <button type="button" aria-label="Next photo" onClick={() => setPhotoIndex((photoIndex + 1) % displayPhotos.length)}><ArrowRight size={19} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
