'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowUpDown, ArrowUpRight, BedDouble, CalendarDays, Check, ChevronDown, Droplets, Heart, Map, MapPin,
  Plus, Search, ShoppingCart, SlidersHorizontal, Users, X,
} from 'lucide-react';
import SearchWidget, { SearchModal } from '@/components/stay/SearchWidget';
import { createClient } from '@/lib/supabase/client';
import type { StayProperty, UniversalStaySettings } from '@/lib/stay/fetchProperties';
import { toRoomSlug } from '@/lib/stay/roomSlug';
import { getSellOptions } from '@/lib/sellOptions';
import { compareProperties } from '@/lib/propertySort';
import { normalizeType } from '@/lib/stay/roomType';
import { StayFooter, StayGallery, StayTopbar, buildRoomsPath, type StaySelection } from '@/components/stay/shared/StayChrome';

const ROOM_TYPES = ['All', 'Studio', 'Bedsitter', 'One Bedroom', 'Two Bedroom'];
const SORT_OPTIONS: [SortKey, string][] = [['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name A–Z']];

type SortKey = 'price_asc' | 'price_desc' | 'name';
type CartItem = { property: StayProperty; qty: number };

interface Props {
  initialProperties: StayProperty[];
  initialCheckIn: string;
  initialCheckOut: string;
  initialAdults: number;
  initialChildren: number;
  initialRooms: number;
  universalSettings: UniversalStaySettings;
}

function formatDate(date: string) {
  if (!date) return 'Any date';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function nightsBetween(checkIn: string, checkOut: string) {
  return checkIn && checkOut && checkOut > checkIn
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 0;
}

export default function RoomsListClient({
  initialProperties, initialCheckIn, initialCheckOut, initialAdults, initialChildren, initialRooms, universalSettings,
}: Props) {
  const router = useRouter();
  const brandName = universalSettings.businessName || 'Kogelo Suites';
  const locationLabel = [universalSettings.businessArea, universalSettings.businessAddress]
    .filter(Boolean)
    .join(' • ') || [universalSettings.defaultPropertyLocation, universalSettings.defaultPropertyCity, universalSettings.defaultPropertyCounty]
    .filter(Boolean)
    .join(', ') || 'Kenya';
  const mapQuery = encodeURIComponent(universalSettings.mapQuery || locationLabel || 'Kenya');
  const mapUrl = `https://maps.google.com/maps?q=${mapQuery}`;

  const [properties,  setProperties]  = useState<StayProperty[]>(initialProperties);
  const [loading,     setLoading]     = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishPending, setWishPending] = useState<Set<string>>(new Set());
  const [typeFilter,  setTypeFilter]  = useState('All');
  const [adults,      setAdults]      = useState(initialAdults);
  const [children,    setChildren]    = useState(initialChildren);
  const [rooms,       setRooms]       = useState(initialRooms);
  const [isMultiMode, setIsMultiMode] = useState(initialRooms >= 2);
  const [cart,        setCart]        = useState<CartItem[]>([]);
  const [checkIn,     setCheckIn]     = useState(initialCheckIn);
  const [checkOut,    setCheckOut]    = useState(initialCheckOut);
  const [applied,     setApplied]     = useState({ checkIn: initialCheckIn, checkOut: initialCheckOut, guests: initialAdults + initialChildren });
  const [sortBy,      setSortBy]      = useState<SortKey>('price_asc');
  const [showSortSheet,   setShowSortSheet]   = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showMapView,     setShowMapView]     = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const [priceMin,    setPriceMin]    = useState<number | ''>('');
  const [priceMax,    setPriceMax]    = useState<number | ''>('');

  useEffect(() => {
    const anyOpen = showSortSheet || showFilterSheet || showMapView || showSearch;
    if (!anyOpen) return;
    const y = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    };
  }, [showSortSheet, showFilterSheet, showMapView, showSearch]);

  useEffect(() => {
    fetch('/api/stay/wishlist')
      .then(r => r.json())
      .then(d => setWishlistIds(new Set(d.property_ids ?? [])));
  }, []);

  const applySearch = (sel: StaySelection) => {
    setCheckIn(sel.checkIn); setCheckOut(sel.checkOut);
    setAdults(sel.adults); setChildren(sel.children); setRooms(sel.rooms);
    setIsMultiMode(sel.rooms >= 2);
    setApplied({ checkIn: sel.checkIn, checkOut: sel.checkOut, guests: sel.adults + sel.children });
    router.replace(buildRoomsPath(sel), { scroll: false });
    if (sel.checkIn === applied.checkIn && sel.checkOut === applied.checkOut) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (sel.checkIn)  qs.set('checkIn',  sel.checkIn);
    if (sel.checkOut) qs.set('checkOut', sel.checkOut);
    fetch(`/api/stay/properties?${qs.toString()}`)
      .then(r => r.json())
      .then(d => setProperties(d.properties ?? []))
      .finally(() => setLoading(false));
  };

  const toggleWishlist = useCallback(async (e: React.MouseEvent, propertyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push(`/stay/auth?redirect=/stay/rooms`); return; }
    if (wishPending.has(propertyId)) return;
    const wasInSet = wishlistIds.has(propertyId);
    setWishPending(prev => new Set(prev).add(propertyId));
    setWishlistIds(prev => { const s = new Set(prev); if (s.has(propertyId)) s.delete(propertyId); else s.add(propertyId); return s; });
    const res = await fetch('/api/stay/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: propertyId }) });
    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.error || 'Failed to update wishlist'}`);
      setWishlistIds(prev => { const s = new Set(prev); if (wasInSet) s.add(propertyId); else s.delete(propertyId); return s; });
    } else {
      alert(data.wishlisted ? 'Room saved to your wishlist' : 'Room removed from your wishlist');
    }
    setWishPending(prev => { const s = new Set(prev); s.delete(propertyId); return s; });
  }, [router, wishPending, wishlistIds]);

  const filtersActive = typeFilter !== 'All' || priceMin !== '' || priceMax !== '';
  const clearFilters = () => { setTypeFilter('All'); setPriceMin(''); setPriceMax(''); };

  const filtered = properties
    .filter(p => typeFilter === 'All' || normalizeType(p.type || '') === typeFilter)
    .filter(p => (p.max_guests ?? 2) >= applied.guests)
    .filter(p => priceMin === '' || Number(p.nightly_rate || 0) >= priceMin)
    .filter(p => priceMax === '' || Number(p.nightly_rate || 0) <= priceMax)
    .sort((a, b) => {
      if (sortBy === 'price_asc') return (a.nightly_rate || 0) - (b.nightly_rate || 0);
      if (sortBy === 'price_desc') return (b.nightly_rate || 0) - (a.nightly_rate || 0);
      return compareProperties(a, b);
    });

  const nights = nightsBetween(applied.checkIn, applied.checkOut);
  const goToCart = () => {
    sessionStorage.setItem('roomCart', JSON.stringify(cart));
    sessionStorage.setItem('roomCartMeta', JSON.stringify({ checkIn: applied.checkIn, checkOut: applied.checkOut, guests: applied.guests }));
    window.location.href = '/stay/book/cart';
  };
  // sessionStorage write lives in the event handler, not inside the state
  // updater (updaters must be pure — they can run more than once).
  const updateCart = (next: (prev: CartItem[]) => CartItem[]) => {
    const n = next(cart);
    setCart(n);
    sessionStorage.setItem('roomCart', JSON.stringify(n));
  };
  const totalRooms = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + Number(c.property.nightly_rate || 0) * (nights || 1) * c.qty, 0);
  const groupUrl = `/stay/book/group?checkIn=${encodeURIComponent(applied.checkIn)}&checkOut=${encodeURIComponent(applied.checkOut)}&guests=${applied.guests}`;

  const sortOptions = (name: string, onPick?: () => void) => SORT_OPTIONS.map(([v, l]) => (
    <label key={v} className="filter-option">
      <input type="radio" name={name} checked={sortBy === v} onChange={() => { setSortBy(v); onPick?.(); }} />
      <span>{l}</span>
    </label>
  ));

  const priceInputs = (
    <div className="price-inputs">
      <input type="number" inputMode="numeric" placeholder="Min" aria-label="Minimum price per night" className="field-control" value={priceMin}
        onChange={e => setPriceMin(e.target.value === '' ? '' : Number(e.target.value))} />
      <input type="number" inputMode="numeric" placeholder="Max" aria-label="Maximum price per night" className="field-control" value={priceMax}
        onChange={e => setPriceMax(e.target.value === '' ? '' : Number(e.target.value))} />
    </div>
  );

  return (
    <main className="stay-shell rooms-page">
      <StayTopbar
        brandHref="/stay"
        links={[
          { href: '/stay#rooms', label: 'Stay' },
          { href: '/stay#amenities', label: 'Our place' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
        ]}
        cta={{ href: mapUrl, label: <><MapPin size={15} /> Find us</> }}
      />

      <section className="results-intro">
        <div className="results-intro-copy">
          <div className="eyebrow">{locationLabel} · {brandName}</div>
          <h1>Find your <em>space.</em></h1>
          <p>Compare studios and suites across the compound. Pick your dates, browse live rates, then open a room to book.</p>
        </div>
        <div className="results-side-note">
          <span className="results-side-kicker">A stay that fits</span>
          <strong>{properties.length} spaces available</strong>
          <span>Private compound · room for groups</span>
        </div>
      </section>

      <section className="rooms-searchbar" aria-label="Search dates and guests">
        <div className="rooms-searchbar-inner hidden lg:block">
          <SearchWidget initialCheckIn={applied.checkIn} initialCheckOut={applied.checkOut} initialAdults={adults}
            initialChildren={children} initialRooms={rooms} onSearch={applySearch} />
        </div>

        <div className="lg:hidden">
          <div className="msearch-card" role="group" aria-label="Modify search">
            <button type="button" className="msearch-field" onClick={() => setShowSearch(true)}>
              <span className="msearch-field-icon"><CalendarDays size={17} /></span>
              <span className="msearch-field-text">
                <small>Dates & Guests</small>
                <strong>
                  {checkIn && checkOut
                    ? `${formatDate(checkIn)} – ${formatDate(checkOut)}${nightsBetween(checkIn, checkOut) > 0 ? ` · ${nightsBetween(checkIn, checkOut)} night${nightsBetween(checkIn, checkOut) !== 1 ? 's' : ''}` : ''} · ${adults + children} guest${adults + children !== 1 ? 's' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}`
                    : 'Select dates & guests'}
                </strong>
              </span>
              <ChevronDown size={16} className="msearch-chevron" />
            </button>
          </div>
        </div>
      </section>

      <section className="results-content">
        <div className="rooms-mobile-tools">
          <button type="button" className="tool-button" onClick={() => setShowSortSheet(true)}>
            <ArrowUpDown size={14} /> Sort
          </button>
          <button type="button" className={`tool-button ${filtersActive ? 'is-active' : ''}`} onClick={() => setShowFilterSheet(true)}>
            <SlidersHorizontal size={14} /> Filter{filtersActive && <span className="tool-dot">•</span>}
          </button>
          <button type="button" className="tool-button" onClick={() => setShowMapView(true)}>
            <Map size={14} /> Map
          </button>
        </div>

        <div className="results-layout">
          <aside className="rooms-sidebar" aria-label="Filters">
            <h3>Filters</h3>
            <div className="sidebar-section">
              <span className="filter-caption">Sort by</span>
              {sortOptions('sort')}
            </div>
            <div className="sidebar-section">
              <span className="filter-caption">Room type</span>
              {ROOM_TYPES.map(t => (
                <label key={t} className="filter-option">
                  <input type="radio" name="roomType" checked={typeFilter === t} onChange={() => setTypeFilter(t)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
            <div className="sidebar-section">
              <span className="filter-caption">Price / night (KSh)</span>
              {priceInputs}
              {filtersActive && <button type="button" className="clear-link" onClick={clearFilters}>Clear filters</button>}
            </div>
            <div className="sidebar-section">
              <span className="filter-caption">Location</span>
              <div className="sidebar-map">
                <iframe src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`${brandName} location`} />
              </div>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="button-primary map-button">
                <Map size={15} /> View on Map
              </a>
            </div>
          </aside>

          <div className="results-main">
            <div className="results-head">
              <p className="results-count">
                {loading ? 'Loading…' : `${filtered.length} room${filtered.length !== 1 ? 's' : ''} available`}
                {nights > 0 && ` · ${nights} night${nights !== 1 ? 's' : ''}`}
              </p>
              <div className="group-toggle-wrap">
                <span>Group Booking</span>
                <button type="button" role="switch" aria-checked={isMultiMode} aria-label="Toggle group booking"
                  className={`group-toggle ${isMultiMode ? 'is-on' : ''}`}
                  onClick={() => { setIsMultiMode(v => !v); setCart([]); }}>
                  <span />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="rooms-grid results-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-card"><div /><span /><span /></div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-rooms results-empty">
                <Search size={40} />
                <strong>No rooms match your filters</strong>
                Try adjusting your dates, guest count or filters.
                <button type="button" className="button-primary" onClick={() => { clearFilters(); setAdults(2); setChildren(0); setRooms(1); setApplied(a => ({ ...a, guests: 2 })); }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="rooms-grid results-grid">
                {filtered.map((p, i) => {
                  const href = `/stay/rooms/${toRoomSlug(p.slug, p.name, p.id)}${applied.checkIn ? `?checkIn=${applied.checkIn}&checkOut=${applied.checkOut}&guests=${applied.guests}` : ''}`;
                  const inCart = cart.some(c => c.property.id === p.id);
                  const type = normalizeType(p.type || '');
                  const smaller = getSellOptions(p).filter(o => !o.isFull);
                  const cheapest = smaller.length ? smaller.reduce((m, o) => (o.nightly_rate < m.nightly_rate ? o : m)) : null;
                  const hasBreakfast = Number(p.breakfast_rate) > 0;
                  return (
                    <article key={p.id} className={`room-card result-card ${isMultiMode && inCart ? 'in-cart' : ''}`}>
                      <StayGallery photos={p.photos ?? []} alt={p.name} eager={i < 3} tag={type || undefined} testId={i}>
                        <button type="button" className={`wish-button ${wishlistIds.has(p.id) ? 'is-saved' : ''}`} onClick={e => toggleWishlist(e, p.id)}
                          aria-label={wishlistIds.has(p.id) ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}>
                          <Heart size={16} fill={wishlistIds.has(p.id) ? 'currentColor' : 'none'} />
                        </button>
                        {nights > 0 && <span className="room-total">KSh {(Number(p.nightly_rate || 0) * nights).toLocaleString()} total</span>}
                      </StayGallery>
                      <div className="room-body">
                        <Link href={href} className="result-link">
                          {type && <span className="room-type">{type}</span>}
                          <h3>{p.name}</h3>
                          <div className="room-stats">
                            <span><BedDouble size={13} /> {p.bedrooms ?? 1}</span>
                            <span><Droplets size={13} /> {p.bathrooms ?? 1}</span>
                            <span><Users size={13} /> {p.max_guests ?? 2}</span>
                          </div>
                          {(p.amenities?.length > 0 || hasBreakfast) && (
                            <div className="room-chips">
                              {hasBreakfast && <span className="chip chip-bb">B&amp;B available</span>}
                              {p.amenities?.slice(0, hasBreakfast ? 2 : 3).map((a: string) => <span key={a} className="chip">{a}</span>)}
                            </div>
                          )}
                        </Link>
                        <div className="room-card-foot">
                          <div className="result-price">
                            <strong>KSh {Number(p.nightly_rate || 0).toLocaleString()}</strong> <small>/ night</small>
                            {cheapest && (
                              <span className="sell-note">Also as {smaller.map(o => `${o.bedrooms} BR`).join(' / ')} from KSh {cheapest.nightly_rate.toLocaleString()}</span>
                            )}
                          </div>
                          {isMultiMode ? (
                            <button type="button" className={`cart-add ${inCart ? 'added' : ''}`}
                              onClick={() => updateCart(prev => inCart ? prev.filter(c => c.property.id !== p.id) : [...prev, { property: p, qty: 1 }])}>
                              {inCart ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                            </button>
                          ) : (
                            <Link href={href} className="room-link">View room <ArrowRight size={14} /></Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="group-banner">
              <div>
                <span className="eyebrow">Travelling together?</span>
                <h3>Need space for a group?</h3>
                <p>Combine several rooms in one booking, or ask us about our larger homes.</p>
              </div>
              <Link className="button-primary" href={groupUrl}>Ask about group stays <ArrowUpRight size={15} /></Link>
            </div>
          </div>
        </div>
      </section>

      <StayFooter
        brandHref="/stay"
        links={[
          { href: '/stay', label: 'Explore the stay' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
          { href: mapUrl, label: 'Location' },
        ]}
        note="Rates shown are current nightly rates. Final price and availability are confirmed at checkout."
      />

      {isMultiMode && cart.length > 0 && (
        <>
          <button type="button" className="cart-fab" onClick={goToCart} aria-label={`View cart, ${totalRooms} room${totalRooms !== 1 ? 's' : ''}`}>
            <ShoppingCart size={20} /><span>{totalRooms}</span>
          </button>
          <div className="cart-bar">
            <div className="cart-bar-inner">
              <div className="cart-bar-info">
                <ShoppingCart size={20} />
                <div>
                  <strong>{totalRooms} room{totalRooms !== 1 ? 's' : ''} selected</strong>
                  {nights > 0 && <span>KSh {totalPrice.toLocaleString()} · {nights} night{nights !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              <button type="button" className="button-primary" onClick={goToCart}>View cart <ArrowRight size={15} /></button>
            </div>
          </div>
        </>
      )}

      {showSearch && (
        <SearchModal checkIn={checkIn} checkOut={checkOut} adults={adults} childCount={children} rooms={rooms}
          onConfirm={(ci, co, a, c, r) => { applySearch({ checkIn: ci, checkOut: co, adults: a, children: c, rooms: r }); setShowSearch(false); }}
          onClose={() => setShowSearch(false)} />
      )}

      {showSortSheet && (
        <div className="sheet-backdrop" onClick={() => setShowSortSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Sort rooms" onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>Sort by</h3>
              <button type="button" className="modal-close" onClick={() => setShowSortSheet(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="sheet-body">{sortOptions('sort_sheet', () => setShowSortSheet(false))}</div>
          </div>
        </div>
      )}

      {showFilterSheet && (
        <div className="sheet-backdrop" onClick={() => setShowFilterSheet(false)}>
          <div className="sheet sheet-tall" role="dialog" aria-modal="true" aria-label="Filter rooms" onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <button type="button" className="modal-close" onClick={() => setShowFilterSheet(false)} aria-label="Close"><X size={16} /></button>
              <h3>Filters</h3>
              <button type="button" className="clear-link" onClick={clearFilters}>Clear</button>
            </div>
            <div className="sheet-body">
              <h4>Your budget (per night)</h4>
              <p className="sheet-hint">KSh {priceMin !== '' ? Number(priceMin).toLocaleString() : '0'} — KSh {priceMax !== '' ? Number(priceMax).toLocaleString() : 'Any'}</p>
              {priceInputs}
              <h4>Room type</h4>
              {ROOM_TYPES.filter(t => t !== 'All').map(t => (
                <label key={t} className="filter-option">
                  <input type="checkbox" checked={typeFilter === t} onChange={() => setTypeFilter(typeFilter === t ? 'All' : t)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
            <div className="sheet-foot">
              <button type="button" className="button-primary" onClick={() => setShowFilterSheet(false)}>
                Show {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMapView && (
        <div className="map-overlay">
          <div className="map-overlay-head">
            <button type="button" className="modal-close" onClick={() => setShowMapView(false)} aria-label="Close map"><X size={16} /></button>
            <span><Search size={14} /> {locationLabel}</span>
          </div>
          <div className="map-overlay-body">
            <iframe src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`${brandName} map`} />
            <button type="button" className="tool-button map-filter" onClick={() => { setShowMapView(false); setShowFilterSheet(true); }}>
              <SlidersHorizontal size={14} /> Filter
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
