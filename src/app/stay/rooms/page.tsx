import { Suspense } from 'react';
import { fetchAvailableProperties, fetchUniversalStaySettings } from '@/lib/stay/fetchProperties';
import RoomsListClient from '@/components/stay/rooms/RoomsListClient';
import { RoomsResultsSkeleton } from '@/components/stay/shared/StaySkeleton';
import '../stay.css';

type SearchParams = Promise<{ checkIn?: string; checkOut?: string; guests?: string; adults?: string; children?: string; rooms?: string }>;

export default async function RoomsPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const checkIn  = p.checkIn  ?? today;
  const checkOut = p.checkOut ?? tomorrow;
  const adults   = Math.max(1, Number(p.adults ?? p.guests ?? 2) || 2);
  const children = Math.max(0, Number(p.children ?? 0) || 0);
  const rooms    = Math.max(1, Number(p.rooms  ?? 1) || 1);

  const [properties, universalSettings] = await Promise.all([
    fetchAvailableProperties(checkIn, checkOut),
    fetchUniversalStaySettings(),
  ]);

  return (
    <Suspense fallback={<RoomsResultsSkeleton />}>
      <RoomsListClient
        initialProperties={properties}
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        initialAdults={adults}
        initialChildren={children}
        initialRooms={rooms}
        universalSettings={universalSettings}
      />
    </Suspense>
  );
}
