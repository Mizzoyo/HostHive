'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, BedDouble, CalendarDays, Clock3, Droplets, House, MapPin, ShoppingCart, Trash2, Users } from 'lucide-react';
import { StayFooter, StayTopbar } from '@/components/stay/shared/StayChrome';
import { roomTypeLabel } from '@/lib/stay/roomType';
import { createClient } from '@/lib/supabase/client';
import { useApplicableDiscounts } from '@/lib/stay/useApplicableDiscounts';
import { getSellOptions } from '@/lib/sellOptions';
import '../../stay.css';

type CartProperty = {
  id: string;
  name: string;
  type?: string;
  slug?: string | null;
  nightly_rate: number;
  bedrooms?: number;
  bathrooms?: number;
  max_guests?: number;
  photos?: string[];
  sell_options?: unknown;
};
type CartItem = { property: CartProperty; qty: number; soldAsBedrooms?: number | null };
type CartMeta = { checkIn: string; checkOut: string; guests: number };

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function money(value: number) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);
}

export default function CartPage() {
  const [cart, setCart]     = useState<CartItem[]>([]);
  const [meta, setMeta]     = useState<CartMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // sessionStorage is client-only; defer reads so no setState runs synchronously in the effect
    const id = setTimeout(() => {
      try {
        const c = sessionStorage.getItem('roomCart');
        const m = sessionStorage.getItem('roomCartMeta');
        if (c) setCart(JSON.parse(c) as CartItem[]);
        if (m) setMeta(JSON.parse(m));
      } catch { /* ignore */ }
      setLoaded(true);
    }, 0);
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    } catch { /* non-critical */ }
    return () => clearTimeout(id);
  }, []);

  const save = (next: CartItem[]) => {
    setCart(next);
    try { sessionStorage.setItem('roomCart', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const removeFromCart = (id: string) => save(cart.filter(c => c.property.id !== id));
  const setItemOption = (id: string, bedrooms: number | null) =>
    save(cart.map(c => c.property.id === id ? { ...c, soldAsBedrooms: bedrooms } : c));

  const optionOf = (item: CartItem) => {
    const opts = getSellOptions(item.property);
    return opts.find(o => o.bedrooms === item.soldAsBedrooms) ?? opts[0];
  };

  const nights = meta?.checkIn && meta?.checkOut && meta.checkOut > meta.checkIn
    ? Math.round((new Date(`${meta.checkOut}T12:00:00`).getTime() - new Date(`${meta.checkIn}T12:00:00`).getTime()) / 86400000)
    : 0;

  const totalRooms = cart.reduce((s, c) => s + c.qty, 0);
  const total      = cart.reduce((s, c) => s + optionOf(c).nightly_rate * (nights || 1) * c.qty, 0);

  const deal = useApplicableDiscounts({
    rooms: cart.map(c => ({
      propertyId: c.property.id,
      subtotal: optionOf(c).nightly_rate * (nights || 1) * c.qty,
    })),
    checkIn: meta?.checkIn ?? '',
    userId,
    enabled: cart.length > 0 && nights > 0,
  });
  const netTotal = Math.max(0, total - deal.discountTotal);

  const handleCheckout = () => {
    if (!meta) return;
    try {
      sessionStorage.setItem('roomCart', JSON.stringify(cart));
      sessionStorage.setItem('roomCartMeta', JSON.stringify(meta));
    } catch { /* ignore */ }
    const q = new URLSearchParams({
      fromCart: 'true',
      checkIn:  meta.checkIn,
      checkOut: meta.checkOut,
      guests:   String(meta.guests),
    });
    window.location.href = `/stay/book/group?${q.toString()}`;
  };

  const chrome = (
    <>
      <StayTopbar
        brandHref="/stay"
        links={[
          { href: '/stay#rooms', label: 'Stay' },
          { href: '/stay#amenities', label: 'Our place' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
        ]}
        cta={{ href: '/stay/house-rules', label: <><MapPin size={15} /> Kisumu, Kenya</> }}
      />
    </>
  );

  const footer = (
    <StayFooter
      brandHref="/stay"
      links={[
        { href: '/stay', label: 'Explore the stay' },
        { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
        { href: '/stay/house-rules', label: 'Location' },
      ]}
      note="Rates shown are current nightly rates. Final price and availability are confirmed by our team."
    />
  );

  if (!loaded) return (
    <main className="stay-shell gb-page">
      {chrome}
      <div className="gb-wrap gb-center"><div className="rooms-spinner" /></div>
      {footer}
    </main>
  );

  if (cart.length === 0) return (
    <main className="stay-shell gb-page">
      {chrome}
      <div className="gb-wrap gb-center">
        <div className="gb-empty gb-empty-page">
          <ShoppingCart size={44} />
          <strong>Your cart is empty.</strong>
          <p>Add rooms from the rooms page, then come back to check out as a group.</p>
          <Link href="/stay/rooms" className="gb-button gb-primary">Browse rooms <ArrowRight size={15} /></Link>
        </div>
      </div>
      {footer}
    </main>
  );

  return (
    <main className="stay-shell gb-page">
      {chrome}

      <div className="gb-wrap">
        <div className="gb-intro">
          <div className="eyebrow">Your selection</div>
          <h1>Your <em>rooms.</em></h1>
          <p>Review your rooms, then send the whole group&apos;s request in one go.</p>
        </div>

        <div className="gb-grid">
          <section className="gb-panel">
            <div className="gb-room-list">
              {cart.map(item => {
                const p = item.property;
                const qty = item.qty;
                const opts = getSellOptions(p);
                const option = optionOf(item);
                return (
                  <article className="gb-room gb-selected" key={p.id}>
                    <div className="gb-room-thumb" aria-hidden="true">
                      {p.photos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote Supabase storage URL
                        <img src={p.photos[0]} alt="" />
                      ) : (
                        <div className="gb-room-thumb-empty"><House size={26} /></div>
                      )}
                    </div>
                    <div className="gb-room-copy">
                      <p className="room-type">{roomTypeLabel(p)}</p>
                      <h3>{p.name}</h3>
                      <div className="gb-room-facts">
                        <span><BedDouble size={13} /> {option.bedrooms}</span>
                        <span><Droplets size={13} /> {p.bathrooms ?? 1}</span>
                        <span><Users size={13} /> Sleeps {option.max_guests}</span>
                      </div>
                      {opts.length > 1 && (
                        <select
                          className="gb-book-as"
                          aria-label={`Book ${p.name} as`}
                          value={option.isFull ? '' : String(option.bedrooms)}
                          onChange={e => setItemOption(p.id, e.target.value === '' ? null : Number(e.target.value))}
                        >
                          {opts.map(o => (
                            <option key={o.bedrooms} value={o.isFull ? '' : String(o.bedrooms)}>
                              {o.label} — KSh {money(o.nightly_rate)} / night
                            </option>
                          ))}
                        </select>
                      )}
                      <button type="button" className="gb-remove" onClick={() => removeFromCart(p.id)}>
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                    <div className="gb-room-select">
                      <strong>KSh {money(option.nightly_rate * (nights || 1) * qty)}</strong>
                      <small>KSh {money(option.nightly_rate)} / night{nights > 1 ? ` × ${nights}` : ''}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="gb-summary" aria-label="Order summary">
            <p className="gb-summary-kicker">Order summary</p>
            <h2 className="gb-summary-heading">Almost there.</h2>
            <div className="gb-summary-rule" />
            <div className="gb-summary-line">
              <span><CalendarDays size={13} /> Dates</span>
              <b>{formatDate(meta?.checkIn ?? '')}<br />{formatDate(meta?.checkOut ?? '')}</b>
            </div>
            <div className="gb-summary-line">
              <span><Clock3 size={13} /> Length</span>
              <b>{nights || '—'} {nights === 1 ? 'night' : 'nights'}</b>
            </div>
            <div className="gb-summary-line">
              <span><Users size={13} /> Guests</span>
              <b>{meta?.guests ?? '—'}</b>
            </div>
            <div className="gb-summary-rooms">
              {cart.map(item => {
                const option = optionOf(item);
                return (
                  <div className="gb-summary-room" key={item.property.id}>
                    <span>{item.property.name}{!option.isFull ? ` · ${option.label}` : ''}</span>
                    <b>KSh {money(option.nightly_rate * (nights || 1) * item.qty)}</b>
                    <small>KSh {money(option.nightly_rate)} / room / night</small>
                  </div>
                );
              })}
            </div>
            <div className="gb-summary-rule" />
            {deal.appliedDiscounts.map(d => (
              <div className="gb-summary-line gb-discount-line" key={d.id}>
                <span>{d.name}{d.value_type === 'percentage' ? ` (${d.value}%)` : ''}</span>
                <b>−KSh {money(d.amount)}</b>
              </div>
            ))}
            {!userId && deal.gated.length > 0 && (
              <Link
                href={`/stay/auth?redirect=${encodeURIComponent('/stay/book/cart')}`}
                className="gb-discount-hint"
              >
                Sign in to unlock {deal.gated.map(d => `“${d.name}”`).join(', ')}
              </Link>
            )}
            <div className="gb-summary-price">
              <span>Estimated total</span>
              <b>KSh {money(netTotal)}</b>
            </div>
            <div className="gb-summary-line">
              <span>{totalRooms} room{totalRooms !== 1 ? 's' : ''} · {nights || 1} {(nights || 1) === 1 ? 'night' : 'nights'}</span>
              <b>KSh {money(netTotal)}</b>
            </div>
            <div className="gb-summary-note">
              <Users size={14} />
              <span>Payment is settled at the property — this sends a request to our team.</span>
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky checkout bar */}
      <div className="gb-checkout-bar">
        <div className="gb-checkout-inner">
          <div>
            <p className="gb-checkout-count">{totalRooms} room{totalRooms !== 1 ? 's' : ''}</p>
            <p className="gb-checkout-total">KSh {money(netTotal)}</p>
          </div>
          <button type="button" className="gb-checkout-cta" onClick={handleCheckout}>
            Proceed to checkout <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {footer}
    </main>
  );
}
