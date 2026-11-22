import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchUniversalStaySettings } from '@/lib/stay/fetchProperties';

export const metadata: Metadata = {
  title: 'House Rules & Location | Kogelo Suites',
  description: 'House rules, check-in details and location for all rooms at Kogelo Suites.',
};

const HOUSE_RULE_LABELS = [
  { key: 'noSmoking', label: 'No smoking' },
  { key: 'noParties', label: 'No parties or events' },
  { key: 'noPets', label: 'No pets' },
  { key: 'quietHours', label: 'Quiet hours 10pm–7am' },
  { key: 'adultsOnly', label: 'No unregistered guests' },
  { key: 'removeShoes', label: 'Remove shoes at entrance' },
  { key: 'sortRubbish', label: 'Sort rubbish before leaving' },
  { key: 'childrenAllowed', label: 'Children welcome' },
  { key: 'couplesOnly', label: 'Couples only' },
  { key: 'noAlcohol', label: 'No alcohol' },
];

export default async function HouseRulesPage() {
  const universalSettings = await fetchUniversalStaySettings();
  const activeRules = HOUSE_RULE_LABELS.filter(rule => universalSettings.houseRules[rule.key]);
  const customRules = universalSettings.additionalRules.split('\n').map(rule => rule.trim()).filter(Boolean);
  const defaultLocationLabel = [universalSettings.defaultPropertyLocation, universalSettings.defaultPropertyCity, universalSettings.defaultPropertyCounty].filter(Boolean).join(', ');
  const businessLocationLabel = [universalSettings.businessArea, universalSettings.businessAddress].filter(Boolean).join(' • ');

  return (
    <div className="bg-[#f8fafc] min-h-full py-10 sm:py-16 px-4 sm:px-6 pb-24 md:pb-16">
      <div className="max-w-7xl mx-auto rounded-3xl bg-white border border-gray-100 shadow-xl p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#16a34a' }}>Before You Book</p>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">House rules, check-in & location</h1>
            <p className="text-sm text-gray-500 mt-2 max-w-2xl">The same stay rules and arrival details apply across all rooms.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full px-3 py-1.5 text-xs font-bold text-green-700 border border-green-200 bg-green-50">Check-in: {universalSettings.checkInTime}</span>
            <span className="rounded-full px-3 py-1.5 text-xs font-bold text-green-700 border border-green-200 bg-green-50">Check-out: {universalSettings.checkOutTime}</span>
            <span className="rounded-full px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 capitalize">{universalSettings.checkInMethod.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">House Rules</p>
            <div className="flex flex-wrap gap-2">
              {activeRules.map(rule => (
                <span key={rule.key} className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 bg-white">
                  {rule.label}
                </span>
              ))}
              {customRules.map(rule => (
                <span key={rule} className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 bg-white">
                  {rule}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Check-in Details</p>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-semibold text-gray-900">Method:</span> <span className="capitalize">{universalSettings.checkInMethod.replace(/_/g, ' ')}</span></p>
              {universalSettings.checkInInstructions && <p>{universalSettings.checkInInstructions}</p>}
              {(universalSettings.caretakerName || universalSettings.caretakerPhone) && (
                <p>
                  <span className="font-semibold text-gray-900">Contact:</span>{' '}
                  {[universalSettings.caretakerName, universalSettings.caretakerPhone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Business / Service Location</p>
              <p className="text-sm text-gray-700">{businessLocationLabel || 'Configured in Settings'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Room Location</p>
              <p className="text-sm text-gray-700">{defaultLocationLabel || 'Configured in Settings'}</p>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <Link href="/stay/rooms" className="inline-flex items-center gap-1.5 text-sm font-bold hover:gap-3 transition-all" style={{ color: '#16a34a' }}>
            Browse rooms →
          </Link>
        </div>
      </div>
    </div>
  );
}
