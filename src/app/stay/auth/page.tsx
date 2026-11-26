'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, KeyRound, Phone, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { StayPageSkeleton } from '@/components/stay/shared/StaySkeleton';
import '../rooms/[id]/room-detail.css';

const RESEND_SECONDS = 60;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return raw.trim();
}

function StayAuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedRedirect = params.get('redirect');
  const returnPath =
    requestedRedirect?.startsWith('/stay/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/stay';

  const [screen, setScreen]       = useState<'phone' | 'code'>('phone');
  const [phone, setPhone]         = useState('');
  const [formattedPhone, setFmtPhone] = useState('');
  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const fp = formatPhone(phone);
    if (fp.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number, including your country code.');
      return;
    }
    setLoading(true);
    const { error: err } = await createClient().auth.signInWithOtp({ phone: fp });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setFmtPhone(fp);
    setCode('');
    setScreen('code');
    setCountdown(RESEND_SECONDS);
    setNotice(`We sent a 6-digit code to ${fp}.`);
  }

  async function verifyCode(token: string) {
    setError('');
    setNotice('');
    setLoading(true);
    const { error: err } = await createClient().auth.verifyOtp({ phone: formattedPhone, token, type: 'sms' });
    setLoading(false);
    if (err) { setError(err.message); setCode(''); return; }
    router.replace(returnPath);
  }

  function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code to continue.');
      return;
    }
    verifyCode(code);
  }

  async function resendCode() {
    if (countdown > 0 || loading) return;
    setError('');
    setNotice('');
    setLoading(true);
    const { error: err } = await createClient().auth.signInWithOtp({ phone: formattedPhone });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setCountdown(RESEND_SECONDS);
    setCode('');
    setNotice(`A new code was sent to ${formattedPhone}.`);
  }

  function changeNumber() {
    setScreen('phone');
    setCode('');
    setError('');
    setNotice('');
  }

  return (
    <div className="room-shell auth-shell">
      <header className="site-header">
        <Link className="brand" href="/stay" aria-label="Kogelo Suites home">
          <span className="brand-mark">K</span>
          <span className="brand-copy">
            <strong>Kogelo Suites</strong>
            <small>Stay a little longer</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/stay#rooms">Stay</Link>
          <Link href="/stay#amenities">Our place</Link>
          <Link href="/stay#location">The details</Link>
          <Link
            className="nav-plan auth-return-link"
            href={returnPath}
            aria-label="Back to your stay"
          >
            <span>Back to your stay</span>
            <ArrowRight size={14} />
          </Link>
        </nav>
      </header>
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-emblem" aria-hidden="true">
            {screen === 'phone' ? (
              <Phone size={19} strokeWidth={1.6} />
            ) : (
              <KeyRound size={19} strokeWidth={1.6} />
            )}
          </div>
          <p className="eyebrow auth-eyebrow">A private compound in Kisumu</p>
          <h1 id="auth-title">
            {screen === 'phone'
              ? 'Your stay starts here.'
              : 'A quick check, then you’re in.'}
          </h1>
          <p className="auth-intro">
            {screen === 'phone' ? (
              'Sign in or create an account with your phone number. We’ll use it to keep your stay details together.'
            ) : (
              <>
                Enter the six-digit code for <strong>{formattedPhone}</strong>.
              </>
            )}
          </p>
          {screen === 'phone' ? (
            <form className="auth-form" onSubmit={requestCode} noValidate>
              <label className="field auth-field" htmlFor="auth-phone">
                <span>Phone number</span>
                <span className="auth-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <input
                    id="auth-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setError('');
                      setNotice('');
                    }}
                    placeholder="+254 700 000 000"
                    aria-describedby="auth-phone-help"
                    required
                  />
                </span>
              </label>
              <small className="auth-help" id="auth-phone-help">
                For example, 0712 345 678 or +254 712 345 678
              </small>
              {error && (
                <div className="validation" role="alert">
                  {error}
                </div>
              )}
              <button className="button primary auth-submit" type="submit" disabled={loading}>
                {loading ? 'Sending code…' : 'Continue with phone'} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={checkCode} noValidate>
              <label className="field auth-field" htmlFor="auth-code">
                <span>Verification code</span>
                <span className="auth-input-wrap auth-code-wrap">
                  <KeyRound size={16} aria-hidden="true" />
                  <input
                    id="auth-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => {
                      const next = event.target.value.replace(/\D/g, '').slice(0, 6);
                      setCode(next);
                      setError('');
                      setNotice('');
                      if (next.length === 6) verifyCode(next);
                    }}
                    placeholder="Enter 6 digits"
                    aria-describedby="auth-code-help"
                    required
                  />
                </span>
              </label>
              <small className="auth-help" id="auth-code-help">
                {countdown > 0
                  ? <>Didn&apos;t get it? Request a new code in <strong>{countdown}s</strong></>
                  : 'Enter the six-digit code we sent by SMS.'}
              </small>
              {error && (
                <div className="validation" role="alert">
                  {error}
                </div>
              )}
              <button className="button primary auth-submit" type="submit" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying…' : 'Continue'} <ArrowRight size={15} />
              </button>
              <button
                className="auth-text-button"
                type="button"
                disabled={countdown > 0 || loading}
                onClick={resendCode}
              >
                Resend code
              </button>
              <button
                className="auth-text-button"
                type="button"
                onClick={changeNumber}
              >
                Use a different phone number
              </button>
            </form>
          )}
          {notice && (
            <div className="auth-notice" role="status">
              <ShieldCheck size={16} />
              {notice}
            </div>
          )}
          <div className="auth-legal">
            <span>
              By continuing, you agree to the terms and privacy practices for
              your stay.
            </span>
          </div>
          <Link className="auth-back-link" href={returnPath}>
            <ArrowLeft size={14} />
            Return to your room
          </Link>
        </section>
      </main>
      <footer className="site-footer auth-footer">
        <Link className="brand footer-brand" href="/stay">
          <span className="brand-mark">K</span>
          <span className="brand-copy">
            <strong>Kogelo Suites</strong>
            <small>Stay a little longer</small>
          </span>
        </Link>
        <span>Milimani, Kisumu · Kenya</span>
        <span className="footer-private">
          <ShieldCheck size={13} /> Secure sign-in via Kogelo Suites
        </span>
      </footer>
    </div>
  );
}

export default function StayAuthPage() {
  return (
    <Suspense fallback={<StayPageSkeleton />}>
      <StayAuthContent />
    </Suspense>
  );
}
