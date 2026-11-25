'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

// ── helpers ──────────────────────────────────────────────────────────────────
function isoDate(d: Date) { return d.toISOString().split('T')[0]; }
function fmt(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDesktop(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const MONTHS_AHEAD = 12;
const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildMonths(count: number) {
  const result = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

// ── DatePickerModal ──────────────────────────────────────────────────────────
interface DatePickerModalProps {
  checkIn: string;
  checkOut: string;
  onConfirm: (checkIn: string, checkOut: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ checkIn, checkOut, onConfirm, onClose }: DatePickerModalProps) {
  const [start, setStart]           = useState(checkIn);
  const [end, setEnd]               = useState(checkOut);
  const [selecting, setSelecting]   = useState<'in' | 'out'>(checkIn ? 'out' : 'in');

  const [today] = useState(() => isoDate(new Date()));
  const [months] = useState(() => buildMonths(MONTHS_AHEAD));

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (selecting === 'in' || (start && end)) {
      setStart(dateStr); setEnd(''); setSelecting('out');
    } else {
      if (dateStr <= start) { setStart(dateStr); setEnd(''); setSelecting('out'); }
      else { setEnd(dateStr); setSelecting('in'); onConfirm(start, dateStr); }
    }
  }

  function isInRange(dateStr: string) {
    return !!(start && end && dateStr > start && dateStr < end);
  }

  const n = (start && end) ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) : 0;
  const canDone = !!(start && end);

  function handleDone() {
    if (start && end) onConfirm(start, end);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex gap-6">
          <span className="text-sm font-semibold pb-1 border-b-2 border-[#205a3d] text-[#205a3d]">Calendar</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
            {months.map(({ year, month }) => {
              const firstDay = firstDayOfMonth(year, month);
              const days     = daysInMonth(year, month);
              return (
                <div key={`${year}-${month}`} className="mb-8">
                  <p className="font-bold text-gray-900 text-base mb-3">{MONTH_NAMES[month]} {year}</p>
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_NAMES.map(d => <div key={d} className="text-center text-xs text-gray-400 font-semibold py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: days }).map((_, i) => {
                      const day     = i + 1;
                      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const isStart = dateStr === start;
                      const isEnd   = dateStr === end;
                      const inRange = isInRange(dateStr);
                      const isPast  = dateStr < today;
                      return (
                        <button key={day} disabled={isPast} onClick={() => handleDayClick(dateStr)}
                          className={`h-10 w-full text-sm font-medium transition-colors
                            ${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#f1ece1]'}
                            ${(isStart || isEnd) ? 'bg-[#205a3d] text-white rounded-full font-bold' : ''}
                            ${inRange ? 'bg-[#e3ece4] text-[#205a3d]' : ''}
                            ${!isStart && !isEnd && !inRange && !isPast ? 'text-gray-900' : ''}
                          `}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 bg-white" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <p className="text-sm text-gray-500 text-center mb-3">
          {start && end ? `${fmt(start)} – ${fmt(end)} (${n} night${n !== 1 ? 's' : ''})` : 'Select check-in and check-out dates'}
        </p>
        <button onClick={handleDone} disabled={!canDone}
          className={`w-full py-4 rounded-xl text-base font-bold text-white transition-colors ${canDone ? 'bg-[#205a3d] hover:bg-[#18482f]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── GuestsModal ──────────────────────────────────────────────────────────────
interface GuestsModalProps {
  adults: number;
  childCount: number;
  rooms: number;
  onConfirm: (adults: number, children: number, rooms: number, pets: boolean) => void;
  onClose: () => void;
}

export function GuestsModal({ adults: ia, childCount: ic, rooms: ir, onConfirm, onClose }: GuestsModalProps) {
  const [adults,   setAdults]   = useState(ia);
  const [children, setChildren] = useState(ic);
  const [rooms,    setRooms]    = useState(ir);
  const [pets,     setPets]     = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <span className="font-bold text-gray-900 text-base">Guests</span>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2">
        {([
          { label: 'Adults',   val: adults,   set: setAdults,   min: 1 },
          { label: 'Children', val: children, set: setChildren, min: 0 },
          { label: 'Rooms',    val: rooms,    set: setRooms,    min: 1 },
        ] as { label: string; val: number; set: React.Dispatch<React.SetStateAction<number>>; min: number }[]).map(row => (
          <div key={row.label} className="flex items-center justify-between py-5 border-b border-gray-100">
            <span className="text-base font-semibold text-gray-900">{row.label}</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => row.set((v: number) => Math.max(row.min, v - 1))}
                disabled={row.val === row.min}
                className="w-12 h-12 flex items-center justify-center text-[#205a3d] text-xl font-bold hover:bg-gray-50 disabled:text-gray-300 border-r border-gray-200">
                −
              </button>
              <span className="w-12 text-center text-base font-bold text-gray-900">{row.val}</span>
              <button onClick={() => row.set((v: number) => Math.min(20, v + 1))}
                className="w-12 h-12 flex items-center justify-center text-[#205a3d] text-xl font-bold hover:bg-gray-50 border-l border-gray-200">
                +
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between py-5">
          <p className="text-base font-semibold text-gray-900">Travelling with pets?</p>
          <button onClick={() => setPets(v => !v)}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${pets ? 'bg-[#205a3d]' : 'bg-gray-300'}`}>
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${pets ? 'translate-x-5' : 'translate-x-0'}`}/>
          </button>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-200" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button onClick={() => onConfirm(adults, children, rooms, pets)}
          className="w-full py-4 rounded-xl text-base font-bold text-white"
          style={{ background: '#205a3d' }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── SearchModal (combined dates + guests, mobile) ────────────────────────────
interface SearchModalProps {
  checkIn: string;
  checkOut: string;
  adults: number;
  childCount: number;
  rooms: number;
  onConfirm: (checkIn: string, checkOut: string, adults: number, children: number, rooms: number, pets: boolean) => void;
  onClose: () => void;
}

export function SearchModal({ checkIn, checkOut, adults: ia, childCount: ic, rooms: ir, onConfirm, onClose }: SearchModalProps) {
  const [tab, setTab]               = useState<'calendar' | 'guests'>('calendar');
  const [start, setStart]           = useState(checkIn);
  const [end, setEnd]               = useState(checkOut);
  const [selecting, setSelecting]   = useState<'in' | 'out'>(checkIn ? 'out' : 'in');
  const [adults,   setAdults]   = useState(ia);
  const [children, setChildren] = useState(ic);
  const [rooms,    setRooms]    = useState(ir);
  const [pets,     setPets]     = useState(false);

  const [today] = useState(() => isoDate(new Date()));
  const [months] = useState(() => buildMonths(MONTHS_AHEAD));

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (selecting === 'in' || (start && end)) {
      setStart(dateStr); setEnd(''); setSelecting('out');
    } else {
      if (dateStr <= start) { setStart(dateStr); setEnd(''); setSelecting('out'); }
      else { setEnd(dateStr); setSelecting('in'); }
    }
  }

  function isInRange(dateStr: string) {
    return !!(start && end && dateStr > start && dateStr < end);
  }

  const n = (start && end) ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) : 0;
  const canDone = !!(start && end);

  function handleDone() {
    if (start && end) onConfirm(start, end, adults, children, rooms, pets);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex gap-6">
          {(['calendar', 'guests'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors capitalize ${t === tab ? 'border-[#205a3d] text-[#205a3d]' : 'border-transparent text-gray-500'}`}>
              {t === 'guests' ? 'Guests' : 'Calendar'}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900" aria-label="Close">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'calendar' ? (
          <div className="px-4 py-4">
            {months.map(({ year, month }) => {
              const firstDay = firstDayOfMonth(year, month);
              const days     = daysInMonth(year, month);
              return (
                <div key={`${year}-${month}`} className="mb-8">
                  <p className="font-bold text-gray-900 text-base mb-3">{MONTH_NAMES[month]} {year}</p>
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_NAMES.map(d => <div key={d} className="text-center text-xs text-gray-400 font-semibold py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: days }).map((_, i) => {
                      const day     = i + 1;
                      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const isStart = dateStr === start;
                      const isEnd   = dateStr === end;
                      const inRange = isInRange(dateStr);
                      const isPast  = dateStr < today;
                      return (
                        <button key={day} disabled={isPast} onClick={() => handleDayClick(dateStr)}
                          className={`h-10 w-full text-sm font-medium transition-colors
                            ${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#f1ece1]'}
                            ${(isStart || isEnd) ? 'bg-[#205a3d] text-white rounded-full font-bold' : ''}
                            ${inRange ? 'bg-[#e3ece4] text-[#205a3d]' : ''}
                            ${!isStart && !isEnd && !inRange && !isPast ? 'text-gray-900' : ''}
                          `}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-2">
            <p className="font-bold text-gray-900 text-base py-4">Who&apos;s coming</p>
          {([
            { label: 'Adults',   val: adults,   set: setAdults,   min: 1 },
            { label: 'Children', val: children, set: setChildren, min: 0 },
            { label: 'Rooms',    val: rooms,    set: setRooms,    min: 1 },
          ] as { label: string; val: number; set: React.Dispatch<React.SetStateAction<number>>; min: number }[]).map(row => (
            <div key={row.label} className="flex items-center justify-between py-5 border-b border-gray-100">
              <span className="text-base font-semibold text-gray-900">{row.label}</span>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => row.set((v: number) => Math.max(row.min, v - 1))}
                  disabled={row.val === row.min}
                  className="w-12 h-12 flex items-center justify-center text-[#205a3d] text-xl font-bold hover:bg-gray-50 disabled:text-gray-300 border-r border-gray-200">
                  −
                </button>
                <span className="w-12 text-center text-base font-bold text-gray-900">{row.val}</span>
                <button onClick={() => row.set((v: number) => Math.min(20, v + 1))}
                  className="w-12 h-12 flex items-center justify-center text-[#205a3d] text-xl font-bold hover:bg-gray-50 border-l border-gray-200">
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between py-5">
            <p className="text-base font-semibold text-gray-900">Travelling with pets?</p>
            <button onClick={() => setPets(v => !v)}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${pets ? 'bg-[#205a3d]' : 'bg-gray-300'}`}>
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${pets ? 'translate-x-5' : 'translate-x-0'}`}/>
            </button>
          </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 bg-white" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <p className="text-sm text-gray-500 text-center mb-3">
          {start && end
            ? `${fmt(start)} – ${fmt(end)} (${n} night${n !== 1 ? 's' : ''}) · ${adults + children} guest${adults + children !== 1 ? 's' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}`
            : 'Select check-in and check-out dates'}
        </p>
        <button onClick={handleDone} disabled={!canDone}
          className={`w-full py-4 rounded-xl text-base font-bold text-white transition-colors ${canDone ? 'bg-[#205a3d] hover:bg-[#18482f]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── DesktopDateDropdown ───────────────────────────────────────────────────────
function DesktopDateDropdown({ checkIn, checkOut, onConfirm, onClose }: DatePickerModalProps) {
  const [start, setStart]       = useState(checkIn);
  const [end, setEnd]           = useState(checkOut);
  const [selecting, setSelecting] = useState<'in' | 'out'>(checkIn ? 'out' : 'in');
  const [offset, setOffset]     = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [today] = useState(() => isoDate(new Date()));
  const [now]   = useState(() => new Date());
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const leftD  = new Date(now.getFullYear(), now.getMonth() + offset,     1);
  const rightD = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const leftM  = { year: leftD.getFullYear(),  month: leftD.getMonth()  };
  const rightM = { year: rightD.getFullYear(), month: rightD.getMonth() };

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (selecting === 'in' || (start && end)) {
      setStart(dateStr); setEnd(''); setSelecting('out');
    } else {
      if (dateStr <= start) { setStart(dateStr); setEnd(''); setSelecting('out'); }
      else { setEnd(dateStr); setSelecting('in'); onConfirm(start, dateStr); }
    }
  }

  function renderMonth(year: number, month: number) {
    const firstDay = firstDayOfMonth(year, month);
    const days     = daysInMonth(year, month);
    return (
      <div key={`${year}-${month}`} className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm text-center mb-3">{MONTH_NAMES[month]} {year}</p>
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day     = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isStart = dateStr === start;
            const isEnd   = dateStr === end;
            const inRange = !!(start && end && dateStr > start && dateStr < end);
            const isPast  = dateStr < today;
            return (
              <button key={day} disabled={isPast} onClick={() => handleDayClick(dateStr)}
                className={[
                  'h-9 w-full text-xs font-medium transition-colors',
                  isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#f1ece1] cursor-pointer',
                  (isStart || isEnd) ? 'bg-[#205a3d] !text-white font-bold rounded-full' : '',
                  inRange ? 'bg-[#e3ece4] text-[#205a3d]' : '',
                  !isStart && !isEnd && !inRange && !isPast ? 'text-gray-900' : '',
                ].join(' ')}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const n = (start && end) ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) : 0;

  return (
    <div ref={ref} className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] p-6" style={{ width: '680px', maxWidth: '96vw' }}>
      <div className="flex gap-6 border-b border-gray-200 mb-5">
        <span className="pb-2.5 text-sm font-semibold border-b-2 border-[#205a3d] text-[#205a3d]">Calendar</span>
      </div>

      <div className="flex items-start gap-2">
            <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}
              className="mt-1 p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 flex-shrink-0">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="flex gap-8 flex-1">
              {renderMonth(leftM.year, leftM.month)}
              {renderMonth(rightM.year, rightM.month)}
            </div>
            <button onClick={() => setOffset(o => Math.min(MONTHS_AHEAD - 2, o + 1))} disabled={offset >= MONTHS_AHEAD - 2}
              className="mt-1 p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 flex-shrink-0">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
      {start && (
        <p className="text-sm text-gray-500 text-center mt-4 mb-3">
          {end ? `${fmtDesktop(start)} — ${fmtDesktop(end)} · ${n} night${n !== 1 ? 's' : ''}` : `Check-in: ${fmtDesktop(start)} · Select check-out`}
        </p>
      )}
    </div>
  );
}

// ── DesktopGuestsDropdown ─────────────────────────────────────────────────────
function DesktopGuestsDropdown({ adults: ia, childCount: ic, rooms: ir, onConfirm, onClose }: GuestsModalProps) {
  const [adults,   setAdults]   = useState(ia);
  const [children, setChildren] = useState(ic);
  const [rooms,    setRooms]    = useState(ir);
  const [work,     setWork]     = useState(false);
  const [pets,     setPets]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] p-5 w-80">
      {([
        { label: 'Adults',   val: adults,   set: setAdults,   min: 1 },
        { label: 'Children', val: children, set: setChildren, min: 0 },
        { label: 'Rooms',    val: rooms,    set: setRooms,    min: 1 },
      ] as { label: string; val: number; set: React.Dispatch<React.SetStateAction<number>>; min: number }[]).map(row => (
        <div key={row.label} className="flex items-center justify-between py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{row.label}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => row.set((v: number) => Math.max(row.min, v - 1))} disabled={row.val === row.min}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-[#205a3d] font-bold text-lg hover:border-[#205a3d] disabled:text-gray-300 disabled:border-gray-200">−</button>
            <span className="w-5 text-center text-sm font-bold text-gray-900">{row.val}</span>
            <button onClick={() => row.set((v: number) => Math.min(20, v + 1))}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-[#205a3d] font-bold text-lg hover:border-[#205a3d]">+</button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Traveling for work?</p>
        <button onClick={() => setWork(v => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${work ? 'bg-[#205a3d]' : 'bg-gray-300'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${work ? 'translate-x-5' : 'translate-x-0'}`}/>
        </button>
      </div>
      <div className="flex items-center justify-between py-3.5">
        <p className="text-sm font-semibold text-gray-900">Traveling with pets?</p>
        <button onClick={() => setPets(v => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${pets ? 'bg-[#205a3d]' : 'bg-gray-300'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${pets ? 'translate-x-5' : 'translate-x-0'}`}/>
        </button>
      </div>
      <button onClick={() => onConfirm(adults, children, rooms, pets)}
        className="w-full mt-3 py-3 rounded-xl border-2 border-[#205a3d] text-[#205a3d] font-bold text-sm hover:bg-[#f1ece1] transition-colors">
        Done
      </button>
    </div>
  );
}

// ── SearchWidget (default export) ────────────────────────────────────────────
export default function SearchWidget({
  initialCheckIn  = '',
  initialCheckOut = '',
  initialAdults   = 2,
  initialChildren = 0,
  initialRooms    = 1,
  onSearch,
}: {
  initialCheckIn?:  string;
  initialCheckOut?: string;
  initialAdults?:   number;
  initialChildren?: number;
  initialRooms?:    number;
  onSearch?: (sel: { checkIn: string; checkOut: string; adults: number; children: number; rooms: number }) => void;
} = {}) {
  const router   = useRouter();
  const [today]    = useState(() => new Date().toISOString().split('T')[0]);
  const [tomorrow] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [checkIn,          setCheckIn]          = useState(initialCheckIn || today);
  const [checkOut,         setCheckOut]         = useState(initialCheckOut || tomorrow);
  const [adults,           setAdults]           = useState(initialAdults);
  const [children,         setChildren]         = useState(initialChildren);
  const [rooms,            setRooms]            = useState(initialRooms);
  const [pets,             setPets]             = useState(false);
  const [showMobileDate,   setShowMobileDate]   = useState(false);
  const [showDesktopDate,  setShowDesktopDate]  = useState(false);
  const [showMobileGuests, setShowMobileGuests] = useState(false);
  const [showDesktopGuests,setShowDesktopGuests]= useState(false);

  // Lock body scroll (iOS-safe: position fixed technique)
  useEffect(() => {
    if (!showMobileDate && !showMobileGuests) return;
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
  }, [showMobileDate, showMobileGuests]);

  const guestLabel = `${adults} adult${adults !== 1 ? 's' : ''} · ${children} child${children !== 1 ? 'ren' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}`;
  const dateLabel  = checkIn && checkOut ? `${fmtDesktop(checkIn)} — ${fmtDesktop(checkOut)}` : 'Select dates';

  const canSearch = !!(checkIn && checkOut);

  const handleSearch = () => {
    if (!canSearch) return;
    if (onSearch) { onSearch({ checkIn, checkOut, adults, children, rooms }); return; }
    router.push(`/stay/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}&guests=${adults + children}&rooms=${rooms}&pets=${pets}`);
  };

  const tile  = 'bg-[#fbf8f0] border border-[#d8d1c2] rounded-xl';
  const label = 'text-[10px] uppercase tracking-wider font-bold text-[#77796f] mb-0.5';
  const value = 'text-sm font-semibold text-[#283c30]';
  const icon  = 'w-4 h-4 text-[#bd6347] flex-shrink-0';

  return (
    <>
      <div className="relative w-full">
        <div className="flex flex-col lg:flex-row rounded-[18px] overflow-visible w-full p-2 gap-2 bg-[#e9e2d2] border border-[#ded5c3]">

          {/* ── Dates ── */}
          {/* Mobile: two separate buttons → full-screen modal */}
          <div className={`flex flex-1 lg:hidden ${tile}`}>
            <button onClick={() => { setShowMobileDate(true); setShowMobileGuests(false); }}
              className="flex-1 px-4 py-3 border-r border-[#d8d1c2] text-left">
              <p className={label}>Check-in</p>
              <p className={value}>{fmt(checkIn) || 'Add date'}</p>
            </button>
            <button onClick={() => { setShowMobileDate(true); setShowMobileGuests(false); }}
              className="flex-1 px-4 py-3 text-left">
              <p className={label}>Check-out</p>
              <p className={value}>{fmt(checkOut) || 'Add date'}</p>
            </button>
          </div>

          {/* Desktop: single combined date button → inline dropdown */}
          <div className={`hidden lg:block relative flex-1 ${tile}`}>
            <button onClick={() => { setShowDesktopDate(v => !v); setShowDesktopGuests(false); }}
              className="w-full h-full px-5 py-2.5 text-left flex items-center gap-3">
              <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <div>
                <p className={label}>Dates</p>
                <p className={`${value} whitespace-nowrap`}>{dateLabel}</p>
              </div>
            </button>
            {showDesktopDate && (
              <DesktopDateDropdown
                checkIn={checkIn} checkOut={checkOut}
                onConfirm={(ci, co) => { setCheckIn(ci); setCheckOut(co); setShowDesktopDate(false); }}
                onClose={() => setShowDesktopDate(false)}
              />
            )}
          </div>

          {/* ── Guests ── */}
          {/* Mobile: opens full-screen modal */}
          <div className={`flex items-center lg:hidden ${tile}`}>
            <button onClick={() => { setShowMobileGuests(true); setShowMobileDate(false); }} className="flex items-center justify-between gap-2 px-4 py-3 w-full text-left">
              <div className="min-w-0">
                <p className={label}>Guests</p>
                <p className={`${value} truncate`}>{guestLabel}</p>
              </div>
              <svg className="w-4 h-4 text-[#77796f] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>

          {/* Desktop: opens inline dropdown */}
          <div className={`hidden lg:flex items-center relative flex-shrink-0 ${tile}`}>
            <button onClick={() => { setShowDesktopGuests(v => !v); setShowDesktopDate(false); }} className="flex items-center gap-2 px-5 py-2.5 w-full text-left">
              <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <div className="flex-1">
                <p className={label}>Guests</p>
                <p className={`${value} whitespace-nowrap`}>{guestLabel}</p>
              </div>
              <svg className="w-4 h-4 text-[#77796f] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showDesktopGuests && (
              <DesktopGuestsDropdown
                adults={adults} childCount={children} rooms={rooms}
                onConfirm={(a, c, r) => { setAdults(a); setChildren(c); setRooms(r); setShowDesktopGuests(false); }}
                onClose={() => setShowDesktopGuests(false)}
              />
            )}
          </div>

          {/* Search */}
          <button onClick={handleSearch} disabled={!canSearch}
            className={`px-8 py-3.5 text-sm font-bold text-[#fff8eb] bg-[#205a3d] transition-all flex items-center justify-center flex-shrink-0 rounded-full ${
              canSearch ? 'hover:bg-[#18482f] active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'
            }`}
            title={!canSearch ? 'Please select check-in and check-out dates' : ''}>
            Search
          </button>
        </div>
      </div>

      {/* Mobile-only portals (never rendered on desktop since only mobile buttons trigger these) */}
      {showMobileDate && typeof document !== 'undefined' && createPortal(
        <DatePickerModal
          checkIn={checkIn} checkOut={checkOut}
          onConfirm={(ci, co) => { setCheckIn(ci); setCheckOut(co); setShowMobileDate(false); }}
          onClose={() => setShowMobileDate(false)}
        />,
        document.body
      )}
      {showMobileGuests && typeof document !== 'undefined' && createPortal(
        <GuestsModal
          adults={adults} childCount={children} rooms={rooms}
          onConfirm={(a, c, r, p) => { setAdults(a); setChildren(c); setRooms(r); setPets(p); setShowMobileGuests(false); }}
          onClose={() => setShowMobileGuests(false)}
        />,
        document.body
      )}
    </>
  );
}
