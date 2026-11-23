type BarProps = { className?: string };

function Bar({ className = '' }: BarProps) {
  return <div className={`animate-pulse rounded-lg bg-[#e9e2d2] ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e5dfd2] bg-[#faf7ef]">
      <Bar className="h-48 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-3 w-1/2" />
        <Bar className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function StayPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#faf7ef] px-4 pb-28 pt-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-3">
          <Bar className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Bar className="h-5 w-40" />
            <Bar className="h-3 w-24" />
          </div>
        </div>
        <Bar className="mb-3 h-9 w-64 max-w-full" />
        <Bar className="mb-8 h-4 w-80 max-w-full" />
        <Bar className="mb-8 h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

export function RoomsResultsSkeleton() {
  return (
    <div className="stay-shell rooms-page" style={{ background: '#faf7ef', minHeight: '100vh' }} aria-busy="true" aria-label="Loading rooms">
      <div className="results-intro">
        <div>
          <Bar className="mb-3 h-4 w-32" />
          <Bar className="mb-3 h-12 w-72 max-w-full" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
        <Bar className="hidden h-10 w-44 rounded-full md:block" />
      </div>
      <div className="rooms-searchbar" style={{ padding: '21px 34px' }}>
        <div className="rooms-searchbar-inner">
          <Bar className="h-16 w-full rounded-2xl" />
        </div>
      </div>
      <div className="results-content">
        <div className="rooms-grid results-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card-fallback overflow-hidden rounded-[17px] border border-[#e5dfd2] bg-[#faf7ef]">
              <Bar className="h-[215px] w-full rounded-none" />
              <Bar className="mx-4 mt-3.5 h-3 w-3/5" />
              <Bar className="mx-4 mt-3 h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RoomDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8fafc]" aria-busy="true" aria-label="Loading room">
      <Bar className="h-[320px] w-full rounded-none sm:h-[420px]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Bar className="h-4 w-56" />
            <Bar className="h-8 w-72 max-w-full" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-5/6" />
            <Bar className="h-4 w-2/3" />
            <div className="grid grid-cols-2 gap-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => <Bar key={i} className="h-12 w-full" />)}
            </div>
          </div>
          <div className="space-y-4">
            <Bar className="h-72 w-full rounded-2xl" />
            <Bar className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
