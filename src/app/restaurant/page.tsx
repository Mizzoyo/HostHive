'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Clock3,
  Flame,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  X,
  Phone,
} from 'lucide-react';
import './restaurant.css';

type MenuItem = { name: string; price: number | null };
type MenuCategory = { name: string; items: MenuItem[] };

const categories: MenuCategory[] = [
  {
    name: 'Breakfast',
    items: [
      { name: 'Full English Breakfast Plate', price: 500 },
      { name: 'Full Traditional Breakfast Plate', price: 500 },
      { name: 'Omelette', price: 200 },
      { name: 'Liver', price: 250 },
      { name: 'Bacon', price: 200 },
      { name: 'Githeri (Nyoyo)', price: 200 },
      { name: 'Matoke', price: 200 },
      { name: 'Sausages (Pair)', price: 100 },
      { name: 'Rolex', price: 200 },
      { name: 'Pancakes', price: 200 },
      { name: 'Uji Power', price: 200 },
      { name: 'Toast with Butter', price: 200 },
      { name: 'French Toast (3pc)', price: 200 },
      { name: 'Eggs (Pair)', price: 200 },
      { name: 'Cereals', price: 150 },
      { name: 'Mandazi (5 pcs)', price: 100 },
      { name: 'Chapati (1 pc)', price: 50 },
      { name: 'Oats Porridge', price: 200 },
    ],
  },
  {
    name: 'Main Dishes',
    items: [
      { name: '¼ Traditional Chicken', price: 600 },
      { name: '1 Full Traditional Chicken', price: 2400 },
      { name: '¼ African Beef', price: 600 },
      { name: '¼ Goat Meat', price: 600 },
      { name: '¼ Pork', price: 600 },
      { name: 'Whole Tilapia', price: 800 },
      { name: 'Fish Fingers / Fish Fillet', price: 950 },
      { name: '¼ Farm Chicken (Broiler)', price: 500 },
      { name: 'Chicken Pilau', price: 700 },
      { name: 'Beef Pilau', price: 700 },
      { name: 'Kienyeji Chicken', price: 600 },
    ],
  },
  {
    name: 'Sharing Bites',
    items: [
      { name: 'BBQ Chicken Wings', price: 600 },
      { name: 'Poussin Chicken Wings', price: 600 },
      { name: 'Bhajia', price: 300 },
      { name: 'Masala Chips', price: 300 },
      { name: 'Plain Chips', price: 200 },
      { name: 'Beef Samosas (3pc)', price: 150 },
      { name: 'Kebab', price: 150 },
      { name: 'Sausages (2pc)', price: 150 },
    ],
  },
  {
    name: 'Drinks & Fruits',
    items: [
      { name: 'Fresh Juices', price: 250 },
      { name: 'Fresh Fruit Plate', price: 150 },
      { name: 'Coffee', price: 200 },
      { name: 'Mixed Fruit Salad', price: 250 },
      { name: 'Tea', price: 200 },
    ],
  },
  {
    name: 'Sides',
    items: [
      { name: 'Osuga', price: 200 },
      { name: 'Ugali Brown', price: 200 },
      { name: 'Fried Rice', price: 200 },
      { name: 'Apoth', price: 200 },
      { name: 'Sukuma', price: null },
      { name: 'Potato Wedges', price: 300 },
      { name: 'Bhajia', price: 300 },
      { name: 'Chips Masala', price: 300 },
    ],
  },
];

const categoriesNames = ['All', ...categories.map((category) => category.name)];

const popularItems = [
  { name: 'Chicken Pilau', price: 700, note: 'A hearty favourite' },
  { name: 'Kienyeji Chicken', price: 600, note: 'Traditional flavour' },
  { name: 'BBQ Chicken Wings', price: 600, note: 'Made for sharing' },
  { name: 'Whole Tilapia', price: 800, note: 'From the menu' },
];

const money = (amount: number) => `KSh ${amount.toLocaleString('en-KE')}`;
const itemKey = (name: string, category: string) => `${category}:${name}`;

export default function RestaurantPage() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const visibleCategories = useMemo(
    () =>
      categories
        .filter((group) => category === 'All' || category === group.name)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.name.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [category, search],
  );

  const cartItems = useMemo(
    () =>
      Object.entries(cart).flatMap(([key, quantity]) => {
        const [groupName, itemName] = key.split(':');
        const found = categories
          .find((group) => group.name === groupName)
          ?.items.find((item) => item.name === itemName);
        return found ? [{ ...found, category: groupName, key, quantity }] : [];
      }),
    [cart],
  );

  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0,
  );

  const changeQuantity = (key: string, delta: number) => {
    const label = key.split(':')[1];
    setCart((current) => {
      const next = { ...current };
      const amount = (next[key] ?? 0) + delta;
      if (amount <= 0) delete next[key];
      else next[key] = amount;
      return next;
    });
    setAnnouncement(
      delta > 0 ? `${label} added to your order` : `${label} quantity updated`,
    );
  };

  useEffect(() => {
    if (!cartOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cartOpen]);

  return (
    <div className="site-shell">
      <header className="topbar">
        <a
          href="#top"
          className="brand"
          aria-label="Kogelo Restaurant home"
          data-testid="link-home"
        >
          <span className="brand-mark">K</span>
          <span>
            <span className="brand-title">Kogelo Restaurant</span>
            <span className="brand-sub">at Kogelo Suites</span>
          </span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#menu" data-testid="link-menu">
            Our menu
          </a>
          <a href="#hours" data-testid="link-hours">
            Opening hours
          </a>
          <a
            className="nav-call"
            href="tel:0726566795"
            data-testid="link-call-header"
          >
            <Phone size={15} aria-hidden="true" /> Call to order
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">A good meal, the Kenyan way</div>
            <h1 id="hero-title">
              Come hungry.
              <br />
              <em>Leave happy.</em>
            </h1>
            <p>
              From a proper morning plate to pilau made for sharing, find a
              familiar favourite at Kogelo Restaurant.
            </p>
            <div className="hero-actions">
              <a
                className="button-primary"
                href="#menu"
                data-testid="button-explore-menu"
              >
                Explore the menu <ArrowDown size={16} aria-hidden="true" />
              </a>
              <a
                className="button-quiet"
                href="tel:0726566795"
                data-testid="link-call-hero"
              >
                <Phone size={15} aria-hidden="true" /> 0726 566 795
              </a>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Kenyan pilau served with chicken and fresh accompaniments"
          >
            <div className="hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/kogelo-feast.jpg"
                alt="Kenyan pilau with chicken and fresh accompaniments"
              />
            </div>
            <div className="hero-stamp" aria-hidden="true">
              <strong>Karibu</strong>
              <span>pull up a chair</span>
            </div>
            <div className="art-caption">
              <strong>Good food, good company</strong>
              Come by for a little taste of home.
            </div>
          </div>
        </section>

        <section className="ticker" id="hours" aria-label="Restaurant details">
          <div className="ticker-inner">
            <div className="ticker-item">
              <Clock3 size={17} aria-hidden="true" /> Hours · 7 AM–10 PM
            </div>
            <div className="ticker-item">
              <Utensils size={17} aria-hidden="true" /> Breakfast, mains & more
            </div>
            <div className="ticker-item">
              <Phone size={16} aria-hidden="true" /> 0726 566 795
            </div>
            <div className="ticker-item">
              <Flame size={17} aria-hidden="true" /> Familiar Kenyan favourites
            </div>
          </div>
        </section>

        <section id="menu" className="menu-section" aria-labelledby="menu-title">
          <div className="section-head">
            <div>
              <div className="eyebrow">Made to hit the spot</div>
              <h2 id="menu-title">A menu with heart.</h2>
            </div>
            <label className="search-wrap">
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="Find a favourite..."
                aria-label="Search menu items"
                data-testid="input-search-menu"
              />
            </label>
          </div>

          <div
            className="category-row"
            role="group"
            aria-label="Filter menu by category"
          >
            {categoriesNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`category-pill${category === name ? ' active' : ''}`}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
                data-testid={`button-category-${name.toLowerCase().replaceAll(' ', '-')}`}
              >
                {name}
              </button>
            ))}
          </div>

          {category === 'All' && !search && (
            <div className="popular-band" aria-label="Popular menu picks">
              <div className="popular-intro">
                <span>From the menu</span>
                <strong>Popular right now</strong>
              </div>
              {popularItems.map((item) => (
                <button
                  key={item.name}
                  className="popular-item"
                  type="button"
                  onClick={() =>
                    changeQuantity(
                      itemKey(
                        item.name,
                        item.name === 'BBQ Chicken Wings'
                          ? 'Sharing Bites'
                          : 'Main Dishes',
                      ),
                      1,
                    )
                  }
                  aria-label={`Add ${item.name}, ${money(item.price)}`}
                  data-testid={`button-popular-${item.name.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <span>{item.name}</span>
                  <small>{item.note}</small>
                  <strong>{money(item.price)}</strong>
                </button>
              ))}
            </div>
          )}

          {visibleCategories.length === 0 ? (
            <div className="empty-results" role="status">
              <strong>No dishes found just yet.</strong>
              Try another dish name or category.
            </div>
          ) : (
            visibleCategories.map((group) => (
              <section
                className="menu-category"
                key={group.name}
                aria-labelledby={`heading-${group.name.replaceAll(' ', '-')}`}
              >
                <div className="category-heading">
                  <h3 id={`heading-${group.name.replaceAll(' ', '-')}`}>
                    {group.name}
                  </h3>
                  <span>{group.items.length} dishes</span>
                </div>
                <div className="menu-grid">
                  {group.items.map((item, index) => {
                    const key = itemKey(item.name, group.name);
                    const quantity = cart[key] ?? 0;
                    return (
                      <article
                        className="menu-item"
                        key={key}
                        style={{
                          animationDelay: `${Math.min(index * 22, 180)}ms`,
                        }}
                        data-testid={`card-menu-item-${group.name.toLowerCase().replaceAll(' ', '-')}-${index}`}
                      >
                        <div>
                          <div className="menu-name">{item.name}</div>
                          <span className="menu-price">
                            {item.price === null ? 'Free' : money(item.price)}
                          </span>
                        </div>
                        <div className="item-control">
                          {quantity > 0 && (
                            <span
                              className="qty-chip"
                              aria-label={`${quantity} in order`}
                            >
                              {quantity}
                            </span>
                          )}
                          <button
                            className="add-button"
                            type="button"
                            aria-label={`Add ${item.name} to order`}
                            onClick={() => changeQuantity(key, 1)}
                            data-testid={`button-add-${group.name.toLowerCase().replaceAll(' ', '-')}-${index}`}
                          >
                            <Plus size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          <div className="bottom-note">
            <strong>Prices are shown in KSh.</strong> For Sukuma, listed as free
            on the menu. Call the restaurant to confirm your order and any
            details.
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <a href="#top" className="brand" aria-label="Kogelo Restaurant home">
            <span className="brand-mark">K</span>
            <span>
              <span className="brand-title">Kogelo Restaurant</span>
              <span className="brand-sub">at Kogelo Suites</span>
            </span>
          </a>
          <p>
            Hours: 7 AM–10 PM <span aria-hidden="true">·</span>{' '}
            <a href="tel:0726566795" style={{ color: 'inherit' }}>
              0726 566 795
            </a>
          </p>
        </div>
      </footer>

      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {count > 0 && (
        <button
          className="cart-fab"
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`View order, ${count} ${count === 1 ? 'item' : 'items'}, ${money(total)}`}
          data-testid="button-open-cart"
        >
          <ShoppingBag size={17} aria-hidden="true" />
          <span className="mobile-cart">Your order</span>
          <span className="cart-count">{count}</span>
          <span>{money(total)}</span>
        </button>
      )}

      {cartOpen && (
        <>
          <button
            className="cart-backdrop"
            type="button"
            aria-label="Close order panel"
            onClick={() => setCartOpen(false)}
            data-testid="button-close-cart-backdrop"
          />
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="cart-header">
              <div>
                <div className="eyebrow">Your picks</div>
                <h2 id="cart-title">Your order</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close order panel"
                onClick={() => setCartOpen(false)}
                data-testid="button-close-cart"
              >
                <X size={19} />
              </button>
            </div>
            {cartItems.length === 0 ? (
              <div className="cart-empty">
                <ShoppingBag size={28} aria-hidden="true" />
                <strong>Your order is empty.</strong>
                Add something tasty from the menu to get started.
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((item) => (
                    <div className="cart-row" key={item.key}>
                      <div>
                        <div className="cart-row-name">{item.name}</div>
                        <div className="cart-row-price">
                          {item.price === null
                            ? 'Free'
                            : `${money(item.price)} each`}
                        </div>
                      </div>
                      <div className="cart-row-actions">
                        <button
                          className="quantity-button"
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => changeQuantity(item.key, -1)}
                          data-testid={`button-minus-${item.name.toLowerCase().replaceAll(' ', '-')}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span
                          className="quantity"
                          aria-label={`Quantity ${item.quantity}`}
                        >
                          {item.quantity}
                        </span>
                        <button
                          className="quantity-button"
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          onClick={() => changeQuantity(item.key, 1)}
                          data-testid={`button-plus-${item.name.toLowerCase().replaceAll(' ', '-')}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-footer">
                  <div className="total-line">
                    <span>Estimated total</span>
                    <span>{money(total)}</span>
                  </div>
                  <p className="cart-footnote">Based on listed menu prices.</p>
                  <a
                    className="call-order"
                    href="tel:0726566795"
                    data-testid="link-call-confirm-order"
                  >
                    <Phone size={16} aria-hidden="true" /> Call to confirm your
                    order
                  </a>
                  <p className="cart-tip">
                    This prepares your order list. Calling connects you with the
                    restaurant to confirm; your order is not submitted online.
                  </p>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
