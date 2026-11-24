'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Droplets,
  House,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { StayPageSkeleton } from '@/components/stay/shared/StaySkeleton';
import { StayFooter, StayTopbar } from '@/components/stay/shared/StayChrome';
import { roomTypeLabel } from '@/lib/stay/roomType';
import { createClient } from '@/lib/supabase/client';
import '../../stay.css';

type Property = {
  id: string;
  name: string;
  type?: string;
  nightly_rate: number;
  bedrooms?: number;
  bathrooms?: number;
  max_guests?: number;
  description?: string;
  photos?: string[];
};

type Guest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
};

type CartItem = { property: { id: string; name: string }; qty: number };

const MAX_ROOM_QTY = 8;
const MAX_ADULTS = 30;
const MAX_CHILDREN = 20;

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function defaultDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return isoDate(date);
}

function formatDate(value: string) {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function nightsBetween(arrive: string, leave: string) {
  if (!arrive || !leave || leave <= arrive) return 0;
  return Math.round(
    (new Date(`${leave}T12:00:00`).getTime() - new Date(`${arrive}T12:00:00`).getTime()) / 86400000,
  );
}

function money(value: number) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);
}

/* Same short-ref formula the API uses for confirmation emails */
function shortRef(id: string) {
  return `KGS-${Math.floor(1000000 + (parseInt(id.replace(/-/g, '').slice(0, 9), 16) % 9000000))}`;
}

function GroupBookingContent() {
  const params = useSearchParams();
  const fromCart = params.get('fromCart') === 'true';
  const paramCheckIn = params.get('checkIn') ?? '';

  const [step, setStep] = useState(fromCart ? 3 : 1);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  const [checkIn, setCheckIn] = useState(paramCheckIn);
  const [checkOut, setCheckOut] = useState(params.get('checkOut') ?? '');
  const [today, setToday] = useState('');
  const [adults, setAdults] = useState(
    Math.min(MAX_ADULTS, Math.max(1, Number(params.get('guests')) || 2)),
  );
  const [children, setChildren] = useState(0);
  const [groupName, setGroupName] = useState('');

  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const knownNames = useRef<Record<string, string>>({});

  const [guest, setGuest] = useState<Guest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  /* ── Defaults + cart restore (deferred — clock/sessionStorage are client-only) ── */
  useEffect(() => {
    Promise.resolve().then(() => {
      const t = defaultDate(0);
      setToday(t);
      setCheckIn(prev => prev || t);
      setCheckOut(prev => {
        if (prev) return prev;
        const base = paramCheckIn || t;
        return isoDate(new Date(new Date(`${base}T12:00:00`).getTime() + 86400000));
      });
      if (fromCart) {
        try {
          const cart = sessionStorage.getItem('roomCart');
          if (cart) {
            const items = JSON.parse(cart) as CartItem[];
            const seeded: Record<string, number> = {};
            items.forEach(item => {
              if (item.property?.id && item.qty > 0) {
                seeded[item.property.id] = Math.min(MAX_ROOM_QTY, item.qty);
                knownNames.current[item.property.id] = item.property.name;
              }
            });
            setQuantities(seeded);
          }
        } catch { /* ignore */ }
      }
    });
  }, [fromCart, paramCheckIn]);

  /* ── Load rooms for the chosen dates (abort-guarded against stale responses) ── */
  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ checkIn, checkOut });
    // Deferred — calling setState synchronously in an effect body is not allowed
    Promise.resolve().then(() => {
      setLoadingRooms(true);
      fetch(`/api/stay/properties?${qs.toString()}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => {
          const list = (d.properties ?? []) as Property[];
          list.forEach(p => { knownNames.current[p.id] = p.name; });
          setProperties(list);
          setRoomsError(false);
        })
        .catch(err => {
          if (err?.name !== 'AbortError') setRoomsError(true);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoadingRooms(false);
        });
    });
    return () => ctrl.abort();
  }, [checkIn, checkOut, reloadNonce]);

  /* ── Drop selections whose rooms are no longer available ── */
  useEffect(() => {
    if (loadingRooms || roomsError) return;
    const ids = new Set(properties.map(p => p.id));
    const dropped = Object.keys(quantities).filter(id => !ids.has(id));
    if (!dropped.length) return;
    const names = dropped.map(id => knownNames.current[id]).filter(Boolean);
    // Deferred — calling setState synchronously in an effect body is not allowed
    Promise.resolve().then(() => {
      if (names.length) {
        setNote(
          `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available for these dates.`,
        );
      }
      setQuantities(prev => {
        const next = { ...prev };
        dropped.forEach(id => { delete next[id]; });
        return next;
      });
    });
  }, [properties, quantities, loadingRooms, roomsError]);

  /* ── Derived values ── */
  const nights = nightsBetween(checkIn, checkOut);
  const partySize = adults + children;
  const selectedRooms = properties
    .map(p => ({ ...p, quantity: quantities[p.id] || 0 }))
    .filter(p => p.quantity > 0);
  const totalRooms = selectedRooms.reduce((s, r) => s + r.quantity, 0);
  const totalCapacity = selectedRooms.reduce((s, r) => s + (r.max_guests ?? 2) * r.quantity, 0);
  const total = selectedRooms.reduce(
    (s, r) => s + Number(r.nightly_rate ?? 0) * r.quantity * (nights || 1),
    0,
  );
  const capacityShortfall = Math.max(0, partySize - totalCapacity);
  const maxSelectableCapacity = properties.reduce(
    (s, p) => s + (p.max_guests ?? 2) * MAX_ROOM_QTY,
    0,
  );
  const capacityImpossible = capacityShortfall > 0 && partySize > maxSelectableCapacity;

  const lastDate = checkIn ? new Date(`${checkIn}T12:00:00`) : null;
  lastDate?.setDate(lastDate.getDate() + 1);
  const minCheckout = lastDate ? isoDate(lastDate) : undefined;

  /* ── Helpers ── */
  function setCount(kind: 'adults' | 'children', change: number) {
    setError('');
    if (kind === 'adults') {
      setAdults(v => Math.min(MAX_ADULTS, Math.max(1, v + change)));
    } else {
      setChildren(v => Math.min(MAX_CHILDREN, Math.max(0, v + change)));
    }
  }

  function setRoomQuantity(roomId: string, change: number) {
    setQuantities(current => ({
      ...current,
      [roomId]: Math.min(MAX_ROOM_QTY, Math.max(0, (current[roomId] || 0) + change)),
    }));
    setError('');
    setNote('');
  }

  function updateGuest(key: keyof Guest, value: string) {
    setGuest(current => ({ ...current, [key]: value }));
    setError('');
  }

  function advance() {
    setError('');
    if (step === 1) {
      if (!checkIn || !checkOut || checkOut <= checkIn) {
        setError('Please choose a check-out date after your check-in date.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!totalRooms) {
        setError('Add at least one room to continue.');
        return;
      }
      if (capacityShortfall && !capacityImpossible) {
        setError(
          `Add room capacity for ${capacityShortfall} more ${
            capacityShortfall === 1 ? 'guest' : 'guests'
          } before continuing.`,
        );
        return;
      }
      setStep(3);
      return;
    }
    if (
      !guest.firstName.trim() ||
      !guest.lastName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim()) ||
      !guest.phone.trim()
    ) {
      setError(
        'Add your first and last name, a valid email address, and phone number to send your request.',
      );
      return;
    }
    handleSubmit();
  }

  function goBack() {
    setError('');
    setStep(v => Math.max(1, v - 1));
  }

  function editStep(target: number) {
    setSubmitted(false);
    setStep(target);
    setError('');
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      let userId: string | null = null;
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id ?? null;
      } catch { /* non-critical */ }

      const res = await fetch('/api/stay/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: `${guest.firstName.trim()} ${guest.lastName.trim()}`.trim(),
          guest_phone: guest.phone.trim(),
          guest_email: guest.email.trim(),
          check_in: checkIn,
          check_out: checkOut,
          nights,
          num_adults: adults,
          num_children: children,
          room_details: selectedRooms.map(r => ({
            property_id: r.id,
            property_name: r.name,
            nightly_rate: r.nightly_rate,
            qty: r.quantity,
            nights,
            subtotal: Number(r.nightly_rate) * r.quantity * nights,
          })),
          total_amount: total,
          special_requests: [groupName.trim() && `Group: ${groupName.trim()}`, guest.note.trim()]
            .filter(Boolean)
            .join(' | '),
          ...(userId ? { user_id: userId } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409 || data.conflict) {
        setError(data.error || 'One of your rooms was just booked for those dates.');
        setReloadNonce(n => n + 1);
        return;
      }
      if (data.error) { setError(data.error); return; }
      setBookingRef(data.id ? shortRef(String(data.id)) : '');
      try {
        sessionStorage.removeItem('roomCart');
        sessionStorage.removeItem('roomCartMeta');
      } catch { /* ignore */ }
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const steps = ['Dates & group', 'Choose rooms', 'Guest details'];

  /* ── Confirmation ── */
  if (submitted) {
    return (
      <main className="stay-shell gb-page">
        <StayTopbar
          brandHref="/stay"
          links={[
            { href: '/stay#rooms', label: 'Stay' },
            { href: '/stay#amenities', label: 'Our place' },
            { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
          ]}
          cta={{ href: '/stay/house-rules', label: <><MapPin size={15} /> Kisumu, Kenya</> }}
        />
        <div className="gb-wrap">
          <section className="gb-confirm" data-testid="panel-confirmation">
            <div className="gb-confirm-icon"><CheckCircle2 size={28} strokeWidth={1.6} /></div>
            <div className="eyebrow">Request sent</div>
            <h2>Everything looks lovely.</h2>
            <p>
              We&apos;ve received your group request — our team will call{' '}
              <strong>{guest.phone}</strong> shortly to confirm availability and payment.
            </p>
            {bookingRef && (
              <div className="gb-ref" data-testid="text-booking-reference">{bookingRef}</div>
            )}
            <div className="gb-confirm-grid">
              <div className="gb-confirm-cell">
                <span>Lead guest</span>
                <b>{guest.firstName} {guest.lastName}</b>
              </div>
              <div className="gb-confirm-cell">
                <span>Dates</span>
                <b>{formatDate(checkIn)} – {formatDate(checkOut)}</b>
              </div>
              <div className="gb-confirm-cell">
                <span>Group</span>
                <b>
                  {partySize} {partySize === 1 ? 'guest' : 'guests'}
                  {groupName.trim() ? ` · ${groupName.trim()}` : ''}
                </b>
              </div>
              <div className="gb-confirm-cell gb-confirm-rooms">
                <span>Selected rooms</span>
                <ul>
                  {selectedRooms.map(room => (
                    <li key={room.id}>
                      <b>{room.name} × {room.quantity}</b>
                      <small>
                        KSh {money(Number(room.nightly_rate))} / room / night · sleeps{' '}
                        {room.max_guests ?? 2} each
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="gb-confirm-cell">
                <span>Estimated total</span>
                <b>KSh {money(total)} · {nights} {nights === 1 ? 'night' : 'nights'}</b>
              </div>
              <div className="gb-confirm-cell">
                <span>Contact</span>
                <b>{guest.email}</b>
              </div>
            </div>
            <div className="gb-confirm-actions">
              <Link href="/stay/rooms" className="gb-button"><ArrowLeft size={15} /> Browse rooms</Link>
              <Link href="/stay" className="gb-button gb-primary">Back to stays <ArrowRight size={15} /></Link>
            </div>
            <p className="gb-fine-print">
              This is a booking request, not a confirmed reservation — your stay is only secured once
              our team confirms it with you. No payment was taken on this page.
            </p>
          </section>
        </div>
        <StayFooter
          brandHref="/stay"
          links={[
            { href: '/stay', label: 'Explore the stay' },
            { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
            { href: '/stay/house-rules', label: 'Location' },
          ]}
          note="Rates shown are current nightly rates. Final price and availability are confirmed by our team."
        />
      </main>
    );
  }

  return (
    <main className="stay-shell gb-page">
      <StayTopbar
        brandHref="/stay"
        links={[
          { href: '/stay#rooms', label: 'Stay' },
          { href: '/stay#amenities', label: 'Our place' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
        ]}
        cta={{ href: '/stay/house-rules', label: <><MapPin size={15} /> Kisumu, Kenya</> }}
      />

      <div className="gb-wrap">
        <div className="gb-intro">
          <div className="eyebrow">A stay, at your own pace</div>
          <h1>Bring everyone <em>along.</em></h1>
          <p>
            Pick your dates, choose as many rooms as your group needs, and send the request over —
            our team will confirm availability and arrange the rest. No payment is taken here.
          </p>
        </div>

        <nav className="gb-stepper" aria-label="Booking steps">
          {steps.map((label, index) => {
            const number = index + 1;
            const done = number < step;
            return (
              <div className="gb-step-wrap" key={label}>
                <div
                  className={`gb-step ${number === step ? 'active' : ''} ${done ? 'done' : ''}`}
                  aria-current={number === step ? 'step' : undefined}
                >
                  <span className="gb-step-num">{done ? <Check size={14} /> : number}</span>
                  <span className="gb-step-label">{label}</span>
                </div>
                {number < steps.length && <span className="gb-step-line" />}
              </div>
            );
          })}
        </nav>

        <div className="gb-grid">
          <section className="gb-panel" key={step}>
            {/* ── Step 1: dates & group ── */}
            {step === 1 && (
              <>
                <h2 className="gb-section-title">When will you be with us?</h2>
                <p className="gb-section-lead">
                  Choose your dates and tell us a little about your group.
                </p>
                <div className="gb-form-grid">
                  <div className="field-group">
                    <label htmlFor="gb-check-in">Check-in</label>
                    <input
                      id="gb-check-in"
                      data-testid="input-check-in"
                      className="field-control"
                      type="date"
                      min={today || undefined}
                      value={checkIn}
                      onChange={event => {
                        const next = event.target.value;
                        setCheckIn(next);
                        if (next && next >= checkOut) {
                          const bumped = new Date(`${next}T12:00:00`);
                          bumped.setDate(bumped.getDate() + 1);
                          setCheckOut(isoDate(bumped));
                        }
                        setError('');
                      }}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="gb-check-out">Check-out</label>
                    <input
                      id="gb-check-out"
                      data-testid="input-check-out"
                      className="field-control"
                      type="date"
                      min={minCheckout}
                      value={checkOut}
                      onChange={event => { setCheckOut(event.target.value); setError(''); }}
                    />
                  </div>
                  <div className="field-group gb-full">
                    <span className="field-label">Guests</span>
                    <div className="gb-counts">
                      <div className="gb-count-row">
                        <div className="gb-count-info">
                          <strong>Adults</strong>
                          <span>Ages 13 and above</span>
                        </div>
                        <div className="gb-counter">
                          <button
                            type="button"
                            aria-label="Remove an adult"
                            data-testid="button-adult-minus"
                            disabled={adults <= 1}
                            onClick={() => setCount('adults', -1)}
                          ><Minus size={13} /></button>
                          <b data-testid="text-adult-count">{adults}</b>
                          <button
                            type="button"
                            aria-label="Add an adult"
                            data-testid="button-adult-plus"
                            disabled={adults >= MAX_ADULTS}
                            onClick={() => setCount('adults', 1)}
                          ><Plus size={13} /></button>
                        </div>
                      </div>
                      <div className="gb-count-row">
                        <div className="gb-count-info">
                          <strong>Children</strong>
                          <span>Ages 0–12</span>
                        </div>
                        <div className="gb-counter">
                          <button
                            type="button"
                            aria-label="Remove a child"
                            data-testid="button-child-minus"
                            disabled={children <= 0}
                            onClick={() => setCount('children', -1)}
                          ><Minus size={13} /></button>
                          <b data-testid="text-child-count">{children}</b>
                          <button
                            type="button"
                            aria-label="Add a child"
                            data-testid="button-child-plus"
                            disabled={children >= MAX_CHILDREN}
                            onClick={() => setCount('children', 1)}
                          ><Plus size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="field-group gb-full">
                    <label htmlFor="gb-group-name">
                      Group name <span className="gb-optional">· optional</span>
                    </label>
                    <input
                      id="gb-group-name"
                      data-testid="input-group-name"
                      className="field-control"
                      value={groupName}
                      placeholder="e.g. Otieno family"
                      onChange={event => setGroupName(event.target.value)}
                    />
                  </div>
                </div>
                <div className="gb-actions">
                  <span className="gb-helper">A minimum stay of one night.</span>
                  <button
                    className="gb-button gb-primary"
                    data-testid="button-continue-dates"
                    type="button"
                    onClick={advance}
                  >
                    Choose rooms <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: rooms ── */}
            {step === 2 && (
              <>
                <h2 className="gb-section-title">Find your corner.</h2>
                <p className="gb-section-lead">
                  {nights} {nights === 1 ? 'night' : 'nights'} · {partySize}{' '}
                  {partySize === 1 ? 'guest' : 'guests'} · choose as many rooms as your group needs.
                </p>

                {loadingRooms ? (
                  <div className="gb-room-list">
                    {[1, 2, 3].map(i => <div key={i} className="gb-room-skeleton" />)}
                  </div>
                ) : roomsError ? (
                  <div className="gb-empty">
                    <strong>We couldn&apos;t load the rooms.</strong>
                    <p>Check your connection and try again.</p>
                    <button
                      type="button"
                      className="gb-button gb-primary"
                      onClick={() => setReloadNonce(n => n + 1)}
                    >
                      Try again
                    </button>
                  </div>
                ) : properties.length === 0 ? (
                  <div className="gb-empty">
                    <strong>No rooms free for those dates.</strong>
                    <p>Try different dates — our calendar fills quickly for groups.</p>
                    <button type="button" className="gb-button" onClick={() => editStep(1)}>
                      <ArrowLeft size={15} /> Change dates
                    </button>
                  </div>
                ) : (
                  <div className="gb-room-list">
                    {properties.map(room => {
                      const quantity = quantities[room.id] || 0;
                      const isSelected = quantity > 0;
                      return (
                        <article
                          className={`gb-room ${isSelected ? 'gb-selected' : ''}`}
                          key={room.id}
                          data-testid={`card-room-${room.id}`}
                        >
                          <div className="gb-room-thumb" aria-hidden="true">
                            {room.photos?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote Supabase storage URL
                              <img src={room.photos[0]} alt="" />
                            ) : (
                              <div className="gb-room-thumb-empty"><House size={26} /></div>
                            )}
                          </div>
                          <div className="gb-room-copy">
                            <p className="room-type">{roomTypeLabel(room)}</p>
                            <h3>{room.name}</h3>
                            <div className="gb-room-facts">
                              <span><BedDouble size={13} /> {room.bedrooms ?? 1}</span>
                              <span><Droplets size={13} /> {room.bathrooms ?? 1}</span>
                              <span><Users size={13} /> Sleeps {room.max_guests ?? 2}</span>
                            </div>
                          </div>
                          <div className="gb-room-select">
                            <strong>KSh {money(Number(room.nightly_rate ?? 0))}</strong>
                            <small>/ room / night</small>
                            <div
                              className="gb-qty"
                              role="group"
                              aria-label={`${room.name} quantity selector`}
                            >
                              <button
                                type="button"
                                aria-label={`Remove one ${room.name}`}
                                data-testid={`button-remove-${room.id}`}
                                disabled={quantity === 0}
                                onClick={() => setRoomQuantity(room.id, -1)}
                              ><Minus size={13} /></button>
                              <span aria-live="polite" data-testid={`text-quantity-${room.id}`}>
                                {quantity}
                              </span>
                              <button
                                type="button"
                                aria-label={`Add one ${room.name}`}
                                data-testid={`button-add-${room.id}`}
                                disabled={quantity >= MAX_ROOM_QTY}
                                onClick={() => setRoomQuantity(room.id, 1)}
                              ><Plus size={13} /></button>
                            </div>
                            <span className="gb-select-mark">
                              {isSelected
                                ? <><CheckCircle2 size={14} /> {quantity} selected</>
                                : 'Add a room'}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div
                  className={`gb-capacity ${
                    !totalRooms ? '' : capacityShortfall ? 'needs' : 'ok'
                  }`}
                  role="status"
                  aria-live="polite"
                  data-testid="status-room-capacity"
                >
                  <Users size={16} />
                  <span>
                    {totalRooms ? (
                      <>
                        <strong>{totalRooms} {totalRooms === 1 ? 'room' : 'rooms'} selected</strong>
                        {' '}· capacity for {totalCapacity} of {partySize} guests
                      </>
                    ) : (
                      <>Add room(s) to cover your group of {partySize} {partySize === 1 ? 'guest' : 'guests'}.</>
                    )}
                    {capacityShortfall > 0 && totalRooms > 0 && (
                      <em>
                        {capacityImpossible
                          ? `Your group needs ${capacityShortfall} more places than we can show online — send the request and our team will arrange the rest.`
                          : `Add capacity for ${capacityShortfall} more ${capacityShortfall === 1 ? 'guest' : 'guests'} to continue.`}
                      </em>
                    )}
                  </span>
                </div>

                <div className="gb-actions">
                  <button
                    className="gb-button gb-text"
                    type="button"
                    data-testid="button-back-dates"
                    onClick={goBack}
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    className="gb-button gb-primary"
                    type="button"
                    data-testid="button-continue-room"
                    disabled={!totalRooms || (capacityShortfall > 0 && !capacityImpossible)}
                    onClick={advance}
                  >
                    Guest details <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: guest details ── */}
            {step === 3 && (
              <>
                <h2 className="gb-section-title">Who should we welcome?</h2>
                <p className="gb-section-lead">
                  Share contact details for the lead guest — we&apos;ll use them to confirm the booking.
                </p>

                {selectedRooms.length > 0 && (
                  <div className="gb-review">
                    <div className="gb-review-top">
                      <div>
                        <h3>Your selected rooms</h3>
                        <p>
                          {formatDate(checkIn)} — {formatDate(checkOut)} · {nights}{' '}
                          {nights === 1 ? 'night' : 'nights'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="gb-edit"
                        data-testid="button-edit-room"
                        onClick={() => editStep(2)}
                      >
                        Edit <ArrowRight size={13} />
                      </button>
                    </div>
                    <div className="gb-review-list">
                      {selectedRooms.map(room => (
                        <div className="gb-review-row" key={room.id} data-testid={`review-room-${room.id}`}>
                          <span>
                            <b>{room.name}</b>
                            <small>
                              {room.quantity} × KSh {money(Number(room.nightly_rate))} / room / night
                            </small>
                          </span>
                          <strong>KSh {money(Number(room.nightly_rate) * room.quantity * nights)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="gb-review-info">
                      <div>
                        <span>Group / capacity</span>
                        <b>{partySize} guests · {totalCapacity} places</b>
                      </div>
                      <div>
                        <span>Estimated total</span>
                        <b>KSh {money(total)}</b>
                      </div>
                    </div>
                  </div>
                )}

                <div className="gb-form-grid">
                  <div className="field-group">
                    <label htmlFor="gb-first-name">First name</label>
                    <input
                      id="gb-first-name"
                      data-testid="input-first-name"
                      className="field-control"
                      autoComplete="given-name"
                      value={guest.firstName}
                      placeholder="Amina"
                      onChange={event => updateGuest('firstName', event.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="gb-last-name">Last name</label>
                    <input
                      id="gb-last-name"
                      data-testid="input-last-name"
                      className="field-control"
                      autoComplete="family-name"
                      value={guest.lastName}
                      placeholder="Otieno"
                      onChange={event => updateGuest('lastName', event.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="gb-email">Email address</label>
                    <input
                      id="gb-email"
                      data-testid="input-email"
                      className="field-control"
                      type="email"
                      autoComplete="email"
                      value={guest.email}
                      placeholder="you@example.com"
                      onChange={event => updateGuest('email', event.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="gb-phone">Phone number</label>
                    <input
                      id="gb-phone"
                      data-testid="input-phone"
                      className="field-control"
                      type="tel"
                      autoComplete="tel"
                      value={guest.phone}
                      placeholder="+254 700 000 000"
                      onChange={event => updateGuest('phone', event.target.value)}
                    />
                  </div>
                  <div className="field-group gb-full">
                    <label htmlFor="gb-note">
                      Anything that would make your stay easier?{' '}
                      <span className="gb-optional">· optional</span>
                    </label>
                    <textarea
                      id="gb-note"
                      data-testid="input-special-request"
                      className="field-control gb-textarea"
                      value={guest.note}
                      placeholder="Adjacent rooms, dietary needs, arrival time…"
                      onChange={event => updateGuest('note', event.target.value)}
                    />
                  </div>
                </div>

                <div className="gb-shield">
                  <ShieldCheck size={16} />
                  <span>
                    No payment is taken on this page — your details go straight to our team, who will
                    confirm your stay by phone or email.
                  </span>
                </div>

                <div className="gb-actions">
                  <button
                    className="gb-button gb-text"
                    type="button"
                    data-testid="button-back-room"
                    onClick={goBack}
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    className="gb-button gb-primary"
                    type="button"
                    data-testid="button-submit"
                    disabled={submitting}
                    onClick={advance}
                  >
                    {submitting ? 'Sending…' : 'Send booking request'} <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="gb-error" role="alert" data-testid="status-validation">{error}</div>
            )}
            {!error && note && (
              <div className="gb-error gb-note-banner" role="status">{note}</div>
            )}
          </section>

          {/* ── Sidebar summary ── */}
          <aside className="gb-summary" aria-label="Trip summary">
            <p className="gb-summary-kicker">Your stay at a glance</p>
            <h2 className="gb-summary-heading">A little getaway.</h2>
            <div className="gb-summary-rule" />
            <div className="gb-summary-line">
              <span><CalendarDays size={13} /> Dates</span>
              <b>{formatDate(checkIn)}<br />{formatDate(checkOut)}</b>
            </div>
            <div className="gb-summary-line">
              <span><Clock3 size={13} /> Length</span>
              <b>{nights || '—'} {nights === 1 ? 'night' : 'nights'}</b>
            </div>
            <div className="gb-summary-line">
              <span><Users size={13} /> Guests</span>
              <b>
                {adults} adult{adults === 1 ? '' : 's'}
                {children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}
              </b>
            </div>
            {selectedRooms.length ? (
              <>
                <div className="gb-summary-line">
                  <span><BedDouble size={13} /> Selected rooms</span>
                  <b>{totalRooms} {totalRooms === 1 ? 'room' : 'rooms'}</b>
                </div>
                <div className="gb-summary-rooms">
                  {selectedRooms.map(room => (
                    <div className="gb-summary-room" key={room.id} data-testid={`summary-room-${room.id}`}>
                      <span>{room.name} <small>× {room.quantity}</small></span>
                      <b>KSh {money(Number(room.nightly_rate) * room.quantity * (nights || 1))}</b>
                      <small>
                        KSh {money(Number(room.nightly_rate))} / room / night · sleeps{' '}
                        {room.max_guests ?? 2} each
                      </small>
                    </div>
                  ))}
                </div>
                <div className="gb-summary-line gb-capacity-summary">
                  <span>Capacity</span>
                  <b>{totalCapacity} places for {partySize} guests</b>
                </div>
                <div className="gb-summary-rule" />
                <div className="gb-summary-price">
                  <span>Estimated total</span>
                  <b>KSh {money(total)}</b>
                </div>
                <div className="gb-summary-line">
                  <span>{nights || 1} {(nights || 1) === 1 ? 'night' : 'nights'} · all selected rooms</span>
                  <b>KSh {money(total)}</b>
                </div>
              </>
            ) : (
              <p className="gb-summary-empty">
                Your selected rooms and price estimate will appear here once you add a room.
              </p>
            )}
            <div className="gb-summary-note">
              <ShieldCheck size={14} />
              <span>
                A booking request, not a charge — availability and the final total are confirmed by
                our team.
              </span>
            </div>
          </aside>
        </div>
      </div>

      <StayFooter
        brandHref="/stay"
        links={[
          { href: '/stay', label: 'Explore the stay' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
          { href: '/stay/house-rules', label: 'Location' },
        ]}
        note="Rates shown are current nightly rates. Final price and availability are confirmed by our team."
      />
    </main>
  );
}

export default function GroupBookPage() {
  return (
    <Suspense fallback={<StayPageSkeleton />}>
      <GroupBookingContent />
    </Suspense>
  );
}
