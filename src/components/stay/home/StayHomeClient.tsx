'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight,
  CircleParking, Clock3, Coffee, Flower2, House, LockKeyhole,
  ShieldCheck, Sparkles, Utensils, Wifi,
} from 'lucide-react';
import { StayFooter, StayGallery, StayTopbar, buildRoomsPath, type StaySelection } from '@/components/stay/shared/StayChrome';
import SearchWidget from '@/components/stay/SearchWidget';

type Room = { name: string; type: string; poolside: boolean; url: string; photos: string[] };

const photoBase =
  'https://hihmgvaaidqhdimauthk.supabase.co/storage/v1/object/public/property-photos/626db9cc-8f80-422a-a70b-1a68b28a833a/tmp/';

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const roomData: Room[] = [
  { name: 'R3', type: 'Studio', poolside: true, url: '/stay/rooms/r3-362f23b5-734f-4510-949d-08909d556c48', photos: ['1795078191666_awerxk66bvq.jpeg', '1795078189936_7yijtsf5dvl.jpeg', '1795078190883_dmd12owcmo9.jpeg', '1795078192449_fec9bobjfwa.jpeg', '1795078193239_ttfictwb12.jpeg'] },
  { name: 'R6', type: 'Studio', poolside: true, url: '/stay/rooms/r6-149f6e3b-3f24-4904-91b6-9ef767157bb7', photos: ['1795078753591_5ib4sziet1n.jpeg', '1795078754421_avndoitms4t.jpeg', '1795078755119_jsgyfl3zla.jpeg', '1795078755822_8gd1ttmczbb.jpeg', '1795078756549_nud8kf3nep.jpeg'] },
  { name: 'Room 14/2', type: 'Budget room', poolside: false, url: '/stay/rooms/room-142-0563b8c3-6fcb-4afa-a567-c5fa1526ab3c', photos: ['1781088163917_am27p0cs2y9.jpg', '1781088170866_7apejcye8mw.jpg', '1781088176491_qym37u5u2zq.jpg', '1781088182312_d0sfoi9livs.jpg', '1781088188582_4jg0m4y9dk.jpg'] },
  { name: 'R15', type: 'One Bedroom', poolside: true, url: '/stay/rooms/r15-1b25fae5-cd58-45c6-8428-c3c272d6114a', photos: ['1780413083441_rqy05awi89f.jpg', '1780413083441_rqy05awi89f.jpg', '1780413087213_g8h2cl5ybov.jpg', '1780413087213_g8h2cl5ybov.jpg', '1780413090229_1qwwvuazirjk.jpg'] },
  { name: 'G15', type: 'Studio', poolside: false, url: '/stay/rooms/g15-26b8a4a8-8376-4ef1-a214-ef26f7f0c8c', photos: ['1783432125027_p1ztpxw4lds.jpg', '1783432128300_m8f0tmn5m5f.jpg', '1783432130726_nfvnubp5smf.jpg', '1783432133316_ck2lquht8q.jpg', '1783432135736_v2lqxf8wzc.jpg'] },
  { name: 'Garage 16', type: 'Studio', poolside: false, url: '/stay/rooms/garage-16-86bf5984-5017-4e1b-8333-f818d917fee7', photos: ['1780389648309_51p88j4wgzs.jpg', '1780389653741_v96q1pnv5a.jpg', '1780389657774_1u76njj1vn7.jpg', '1780389661122_h0t23d2rbi.jpg', '1780389665724_w4492ocj0td.jpg'] },
  { name: 'Jokowiny', type: 'Studio', poolside: false, url: '/stay/rooms/jokowiny-33e6516e-297d-4cee-a58a-612c460e9bee', photos: ['1779734171428_3ld0pgh7kfn.jpg', '1779734172890_9y9wxv3ytvq.jpg', '1779734174000_gvqvw6z0wqk.jpg', '1779734174832_1dnqltogmys.jpg', '1779734175934_1yal19530ks.jpg'] },
  { name: 'R14', type: 'One Bedroom', poolside: true, url: '/stay/rooms/r14-0d400c75-a7f5-439a-858f-555a48465822', photos: ['1780412720430_e9nffcgq18.jpg', '1780412703332_7fx9qnulee9.jpg', '1780412706802_i6e41n3r8sc.jpg', '1780412709338_ymw2opfp40o.jpg', '1780412712513_mkkdc21yz5p.jpg'] },
  { name: 'R20', type: 'One Bedroom', poolside: true, url: '/stay/rooms/r20-ecf7b319-9bde-4bae-8040-973124b2b5ad', photos: ['1783508920481_tpopclfm1bc.jpg', '1783508922266_htbotj3edej.jpg', '1783508923522_8rk9qve8pen.jpg', '1783508925235_ztrkc623t1.jpg', '1783508926264_5djs8j6lnpf.jpg'] },
  { name: 'F13', type: 'Executive Studio', poolside: false, url: '/stay/rooms/f13-ec6556c3-2e3a-4aff-af75-f6740f234208', photos: ['1783707661667_hm284l90cd.jpg', '1783707672499_eb7rltags3.jpg', '1783707683539_eniard2ybqt.jpg', '1783707705343_ic2jpl5s0h.jpg', '1783707717335_s29klgxtkb.jpg'] },
  { name: 'Omuga', type: 'Studio', poolside: true, url: '/stay/rooms/omuga-e91b75bb-bb87-4484-89a8-e8c27cc44f48', photos: ['1780412159192_wgtzgsiwgb.jpg', '1780412140127_35bu8succt9.jpg', '1780412143452_xka47v6q3j9.jpg', '1780412145570_v5b2g8hsfz.jpg', '1780412148583_r71atobjxvd.jpg'] },
  { name: 'R12', type: 'Executive Studio', poolside: true, url: '/stay/rooms/r12-3196cf98-1998-43ac-aee5-3ac24f94a9b6', photos: ['1783522157936_2m20evy6ekf.jpg', '1783522162036_ydf35ckf1o.jpg', '1783522165484_lax7owd0lnd.jpg', '1783522169294_92om9jgu.jpg', '1783522172464_uozbg0567rn.jpg'] },
  { name: 'R17', type: 'One Bedroom', poolside: true, url: '/stay/rooms/r17-ddd1d002-a2b3-447c-bdf8-dc5bbc94d58c', photos: ['1795254048505_62tdz1vsn3x.jpeg', '1795254040404_fow7tmctkt.jpeg', '1795254041730_q1gm5bfwiu.jpeg', '1795254042877_s60v4136ky7.jpeg', '1795254043498_gnvmujjbgx.jpeg'] },
  { name: 'Cottage 16', type: 'Cottage', poolside: false, url: '/stay/rooms/cottage-16-7b28aa8b-3b6e-4020-a334-0ee7cfeebbd8', photos: ['1780390343004_ueayq35qjzh.jpg', '1780390344201_4zgr333eqdc.jpg', '1780390345428_3qijk12s2t.jpg', '1780390346200_uolbmv2xy5a.jpg', '1780390346946_mpirmc9a0fd.jpg'] },
  { name: 'Robert Ouko', type: 'One Bedroom', poolside: false, url: '/stay/rooms/robert-ouko-d2b8e034-1f82-44d0-a5c2-feeaa85867d2', photos: ['1794469193271_oa32nbas11.jpeg', '1794469186365_15385x9ranl.jpeg', '1794469187732_2xpu3ys8otu.jpeg', '1794469188742_kep205a5yf.jpeg', '1794469189732_gfvq4ao728.jpeg'] },
  { name: 'R23', type: 'One Bedroom', poolside: true, url: '/stay/rooms/r23-0490368d-7bde-4a1c-bb36-1bc3563cea66', photos: ['1795252956355_0gttsfeybym.jpeg', '1795252957659_65xhp0zebuy.jpeg', '1795252958907_4l4j020ahio.jpeg', '1795252959526_hlr247f0txc.jpeg', '1795252960204_7u53h4k3gq9.jpeg'] },
  { name: 'Front 16', type: 'Four Bedroom', poolside: false, url: '/stay/rooms/front-16-e7edfd4a-772c-4d6e-af47-2e7b6b5a83c5', photos: ['1780482735495_mawfy5gw49.jpg', '1780482737876_ea9od89hccg.jpg', '1780482739440_f7euzr5dd7g.jpg', '1780482740258_5szi7kiztw7.jpg', '1780482742943_cvnlgnjauxe.jpg'] },
];

function RoomCard({ room, index }: { room: Room; index: number }) {
  return (
    <article className="room-card" data-testid={`card-room-${room.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <StayGallery
        photos={room.photos.map((p) => `${photoBase}${p}`)}
        alt={`${room.name} ${room.type}`}
        eager={index < 3}
        tag={room.poolside ? 'Poolside' : undefined}
        testId={index}
      />
      <div className="room-body">
        <span className="room-type">{room.type}</span>
        <h3>{room.name}</h3>
        <div className="room-card-foot">
          <span>Room details & live rates</span>
          <a className="room-link" href={room.url} target="_blank" rel="noreferrer" aria-label={`See details for ${room.name}`}>
            See details <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function StayHomeClient() {
  const [checkIn, setCheckIn] = useState(() => toInputDate(new Date()));
  const [checkOut, setCheckOut] = useState(() => toInputDate(new Date(Date.now() + 86400000)));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomCount, setRoomCount] = useState(1);
  const [filter, setFilter] = useState<'all' | 'under3k' | 'cottage' | 'poolside'>('all');
  const [, startTransition] = useTransition();
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scrollRooms = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.room-card');
    el.scrollBy({ left: dir * (card ? card.offsetWidth + 18 : el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const selection = { checkIn, checkOut, adults, children, rooms: roomCount };
  const roomsPath = buildRoomsPath(selection);
  const groupPath = `/stay/book/group?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${adults + children}`;

  useEffect(() => {
    router.prefetch(roomsPath);
  }, [router, roomsPath]);

  useEffect(() => {
    // Deferred — calling setState synchronously in an effect body is not allowed
    Promise.resolve().then(() => {
      trackRef.current?.scrollTo({ left: 0 });
      updateArrows();
    });
  }, [filter]);

  const goToRooms = () => startTransition(() => router.push(roomsPath));
  const handleSearch = (sel: StaySelection) => {
    setCheckIn(sel.checkIn); setCheckOut(sel.checkOut);
    setAdults(sel.adults); setChildren(sel.children); setRoomCount(sel.rooms);
    startTransition(() => router.push(buildRoomsPath(sel)));
  };
  const shownRooms =
    filter === 'poolside' ? roomData.filter((room) => room.poolside)
    : filter === 'under3k' ? roomData.filter((room) => room.type === 'Budget room')
    : filter === 'cottage' ? roomData.filter((room) => room.type === 'Cottage')
    : roomData;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const countText = {
    all: `${roomData.length} spaces · studios to suites`,
    under3k: `${roomData.filter((room) => room.type === 'Budget room').length} ${plural(roomData.filter((room) => room.type === 'Budget room').length, 'budget space', 'budget spaces')} · under KSh 3,000`,
    cottage: `${roomData.filter((room) => room.type === 'Cottage').length} ${plural(roomData.filter((room) => room.type === 'Cottage').length, 'space', 'spaces')} · extra privacy`,
    poolside: `${roomData.filter((room) => room.poolside).length} poolside properties`,
  }[filter];

  const amenities = [
    { icon: Sparkles, title: 'Swimming pool', note: 'Relax in our pristine outdoor pool' },
    { icon: Utensils, title: 'Restaurant', note: 'Authentic Kenyan & continental cuisine' },
    { icon: Wifi, title: 'Free WiFi', note: 'High-speed internet throughout' },
    { icon: CircleParking, title: 'Secure parking', note: 'Ample guarded parking on-site' },
    { icon: Coffee, title: 'Room service', note: 'Order meals delivered to your room' },
    { icon: Flower2, title: 'Garden lounge', note: 'Lush outdoor seating & relaxation' },
    { icon: ShieldCheck, title: '24/7 security', note: 'Manned gate with CCTV' },
    { icon: House, title: 'Daily housekeeping', note: 'Fresh linen and clean rooms every day' },
  ];

  return (
    <main className="stay-shell">
      <StayTopbar
        brandHref="#top"
        links={[
          { href: '#rooms', label: 'Stay' },
          { href: '#amenities', label: 'Our place' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
        ]}
        cta={{ href: '#booking', label: <><CalendarDays size={15} /> Plan your stay</> }}
      />

      <section className="stay-hero" id="top">
        <div className="stay-hero-copy">
          <div className="eyebrow">A private compound in Kisumu</div>
          <h1>Room to rest.<br /><em>Space to feel at home.</em></h1>
          <p>Settle into a welcoming hideaway of studios and suites, tucked within one peaceful compound. Find a space that suits your stay, then check live dates with us.</p>
          <div className="hero-links">
            <a className="button-primary" href="#booking">Find your stay <ArrowDown size={16} /></a>
            <a className="button-quiet" href="#rooms">Explore the rooms <ArrowRight size={15} /></a>
          </div>
        </div>
        <div className="hero-visual" aria-label="Kogelo Suites property">
          <div className="hero-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/hero.jpg" alt="A view of Kogelo Suites" fetchPriority="high" />
          </div>
          <div className="hero-stamp"><strong>17</strong><span>spaces to stay</span></div>
          <div className="image-caption"><strong>Your own pace, your own space</strong>Studios, suites and a private compound</div>
        </div>
      </section>

      <section className="booking-band" id="booking" aria-label="Plan your stay">
        <div className="booking-panel">
          <SearchWidget
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            initialAdults={adults}
            initialChildren={children}
            initialRooms={roomCount}
            onSearch={handleSearch}
          />
          <p className="booking-note">Your choices stay with you when you continue. Dates, space and rates are confirmed on our live booking site.</p>
        </div>
      </section>

      <div className="facts-strip" aria-label="Stay highlights">
        <div className="fact"><span className="fact-icon"><House size={17} /></span>17 studios & suites</div>
        <div className="fact"><span className="fact-icon"><Sparkles size={17} /></span>9 poolside properties</div>
        <div className="fact"><span className="fact-icon"><LockKeyhole size={17} /></span>Private compound</div>
        <div className="fact"><span className="fact-icon"><Clock3 size={17} /></span>Made for a slower stay</div>
      </div>

      <section className="rooms-section" id="rooms">
        <div className="section-head">
          <div><div className="eyebrow">Choose your space</div><h2>A place for your kind of stay</h2></div>
          <p>From easy-going studios to roomy suites, all set within one exclusive compound.</p>
        </div>
        <div className="room-controls">
          <span className="room-count" data-testid="text-room-count">{countText}</span>
          <div className="room-filters" role="group" aria-label="Filter room listings">
            <button type="button" className={`filter-button ${filter === 'all' ? 'active' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-testid="button-filter-all">All</button>
            <button type="button" className={`filter-button ${filter === 'under3k' ? 'active' : ''}`} aria-pressed={filter === 'under3k'} onClick={() => setFilter('under3k')} data-testid="button-filter-under3k">Under 3k</button>
            <button type="button" className={`filter-button ${filter === 'cottage' ? 'active' : ''}`} aria-pressed={filter === 'cottage'} onClick={() => setFilter('cottage')} data-testid="button-filter-cottage">Privacy</button>
            <button type="button" className={`filter-button ${filter === 'poolside' ? 'active' : ''}`} aria-pressed={filter === 'poolside'} onClick={() => setFilter('poolside')} data-testid="button-filter-poolside">Poolside</button>
          </div>
        </div>
        <div className="rooms-carousel-wrap">
          <div className="rooms-carousel" ref={trackRef} onScroll={updateArrows}>
            {shownRooms.map((room, i) => <RoomCard key={room.name} room={room} index={i} />)}
            {shownRooms.length === 0 && <div className="empty-rooms"><strong>No spaces found</strong>Try viewing all spaces.</div>}
          </div>
          <button type="button" className="carousel-arrow prev" disabled={!canPrev} aria-label="Previous rooms" onClick={() => scrollRooms(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="carousel-arrow next" disabled={!canNext} aria-label="More rooms" onClick={() => scrollRooms(1)}><ChevronRight size={18} /></button>
        </div>
        <div className="hero-links" style={{ justifyContent: 'center', marginTop: 30 }}>
          <button type="button" className="button-primary" onClick={goToRooms}>Browse rooms <ArrowRight size={16} /></button>
        </div>
      </section>

      <section className="group-cta" aria-label="Group stays">
        <div className="group-cta-banner">
          <div className="group-cta-copy">
            <span className="eyebrow">Travelling together?</span>
            <h3>Need space for a group?</h3>
            <p>Combine several rooms in one booking, or ask us about our larger homes.</p>
          </div>
          <Link className="button-primary" href={groupPath}>Ask about group stays <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <section className="amenities-section" id="amenities">
        <div className="amenities-inner">
          <div className="amenities-intro">
            <div className="eyebrow">Everything you need</div>
            <h2>Comfort, covered.</h2>
            <p>Settle in, slow down and enjoy the thoughtful touches around the compound and in your room.</p>
          </div>
          <div className="amenities-list">
            {amenities.map(({ icon: Icon, title, note }) => (
              <div className="amenity" key={title} title={note}><Icon size={18} /><span>{title}</span></div>
            ))}
          </div>
        </div>
      </section>

      <StayFooter
        brandHref="#top"
        links={[
          { href: '#rooms', label: 'Explore rooms' },
          { href: 'https://restaurant.kogelosuites.com/', label: 'Dining' },
          { href: '#booking', label: 'Plan your stay' },
        ]}
        note="Live rates and availability are checked on the Kogelo Suites booking site."
      />
    </main>
  );
}
