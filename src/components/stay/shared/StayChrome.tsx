'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, House, Minus, Plus } from 'lucide-react';

export type StayLink = { href: string; label: ReactNode; className?: string };

export type StaySelection = { checkIn: string; checkOut: string; adults: number; children: number; rooms: number };

export function buildRoomsPath(sel: StaySelection) {
  const query = new URLSearchParams({
    checkIn: sel.checkIn,
    checkOut: sel.checkOut,
    adults: String(sel.adults),
    children: String(sel.children),
    guests: String(sel.adults + sel.children),
    rooms: String(sel.rooms),
  });
  return `/stay/rooms?${query.toString()}`;
}

function SmartLink({ href, className, children, ariaLabel }: { href: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  if (href.startsWith('/')) return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
  const external = href.startsWith('http');
  return (
    <a href={href} className={className} aria-label={ariaLabel} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {children}
    </a>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <SmartLink href={href} className="stay-brand" ariaLabel="Kogelo Suites home">
      <span className="brand-mark">K</span>
      <span><span className="brand-title">Kogelo Suites</span><span className="brand-sub">Stay a little longer</span></span>
    </SmartLink>
  );
}

export function StayTopbar({ brandHref, links, cta }: { brandHref: string; links: StayLink[]; cta: StayLink }) {
  return (
    <header className="stay-topbar">
      <Brand href={brandHref} />
      <nav className="stay-nav" aria-label="Main navigation">
        {links.map((l) => <SmartLink key={l.href} href={l.href}>{l.label}</SmartLink>)}
        <SmartLink href={cta.href} className="nav-book">{cta.label}</SmartLink>
      </nav>
    </header>
  );
}

export function StayFooter({ brandHref, links, note }: { brandHref: string; links: StayLink[]; note: string }) {
  return (
    <footer className="stay-footer">
      <div className="footer-inner">
        <Brand href={brandHref} />
        <p>Studios, suites and a private compound.<br />Make yourself at home.</p>
        <div className="footer-links">
          {links.map((l) => <SmartLink key={l.href} href={l.href}>{l.label}</SmartLink>)}
        </div>
      </div>
      <div className="live-note">{note}</div>
    </footer>
  );
}

export function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  const id = `counter-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="field-group">
      <span id={id} className="field-label">{label}</span>
      <div role="group" aria-labelledby={id} className="field-control counter-control">
        <button type="button" className="counter-step" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus size={14} />
        </button>
        <span aria-live="polite" data-testid={`text-${label.toLowerCase()}`}>{value}</span>
        <button type="button" className="counter-step" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(value + 1)}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export function StayGallery({
  photos, alt, eager, tag, testId, children,
}: { photos: string[]; alt: string; eager?: boolean; tag?: string; testId?: string | number; children?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const shift = (step: number) => setIndex((current) => (current + step + count) % count);
  const stop = (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); };

  return (
    <div
      className="room-gallery"
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); shift(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); shift(1); }
      }}
      tabIndex={0}
      aria-label={`${alt} photo gallery. Use left and right arrow keys to change photos.`}
    >
      {count ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[index]} alt={`${alt} — photo ${index + 1}`} loading={eager ? 'eager' : 'lazy'} />
      ) : (
        <div className="room-gallery-empty"><House size={40} /></div>
      )}
      {tag && <span className="room-tag">{tag}</span>}
      {count > 1 && (
        <>
          <button type="button" className="gallery-arrow gallery-prev" aria-label={`Previous photo of ${alt}`} onClick={(e) => { stop(e); shift(-1); }} data-testid={testId !== undefined ? `button-photo-prev-${testId}` : undefined}><ArrowLeft size={17} /></button>
          <button type="button" className="gallery-arrow gallery-next" aria-label={`Next photo of ${alt}`} onClick={(e) => { stop(e); shift(1); }} data-testid={testId !== undefined ? `button-photo-next-${testId}` : undefined}><ArrowRight size={17} /></button>
          <span className="gallery-count" aria-live="polite">{index + 1} / {count}</span>
        </>
      )}
      {children}
    </div>
  );
}
