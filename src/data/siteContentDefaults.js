// Built-in storefront content. Used until an admin saves their own version on
// the admin Storefront page (stored server-side in the SiteContent table), and
// restored by that page's "Reset to default" button.

export const DEFAULT_NAV_MENU = [
  {
    label: 'Women',
    href: '/products?gender=women',
    sub: [
      { label: 'Tote Bags',     href: '/products?gender=women&type=tote-bags' },
      { label: 'Sling Bags',    href: '/products?gender=women&type=sling-bags' },
      { label: 'Clutches',      href: '/products?gender=women&type=clutches' },
      { label: 'Shoulder Bags', href: '/products?gender=women&type=shoulder-bags' },
      { label: 'Wallets',       href: '/products?gender=women&type=wallets' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=85',
      label: 'New Arrivals',
      href: '/products?gender=women&badge=new',
    },
  },
  {
    label: 'Men',
    href: '/products?gender=men',
    sub: [
      { label: 'Wallets',       href: '/products?gender=men&type=wallets' },
      { label: 'Card Holders',  href: '/products?gender=men&type=card-holders' },
      { label: 'Laptop Bags',   href: '/products?gender=men&type=laptop-bags' },
      { label: 'Briefcases',    href: '/products?gender=men&type=briefcases' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=85',
      label: 'Best Sellers',
      href: '/products?gender=men&badge=best-seller',
    },
  },
  {
    label: 'Travel',
    href: '/products?category=travel',
    sub: [
      { label: 'Passport Holders', href: '/products?category=travel&type=passport' },
      { label: 'Duffle Bags',      href: '/products?category=travel&type=duffle' },
      { label: 'Luggage Tags',     href: '/products?category=travel&type=luggage-tags' },
      { label: 'Travel Kits',      href: '/products?category=travel&type=travel-kits' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400&q=85',
      label: 'Travel Edit',
      href: '/products?category=travel',
    },
  },
  {
    label: 'Collections',
    href: '/products?category=collections',
    sub: [
      { label: 'New Arrivals',      href: '/products?badge=new' },
      { label: 'Best Sellers',      href: '/products?badge=best-seller' },
      { label: 'Online Exclusive',  href: '/products?badge=online-exclusive' },
      { label: 'Limited Edition',   href: '/products?badge=limited-edition' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=85',
      label: 'Explore All',
      href: '/products',
    },
  },
  {
    label: 'Gifts',
    href: '/products?category=gifts',
    sub: [
      { label: 'Gift Sets',    href: '/products?category=gifts&type=gift-sets' },
      { label: 'Under ₹2,999', href: '/products?category=gifts&maxPrice=2999' },
      { label: 'Under ₹4,999', href: '/products?category=gifts&maxPrice=4999' },
      { label: 'Gift Cards',   href: '/products?category=gifts&type=gift-cards' },
    ],
    featured: {
      image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&q=85',
      label: 'Gift Guide',
      href: '/products?category=gifts',
    },
  },
]

export const DEFAULT_HOME_TILES = [
  { label: 'Women',  sub: 'Bags & Wallets',    href: '/products?gender=women',    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=85' },
  { label: 'Men',    sub: 'Wallets & Bags',    href: '/products?gender=men',      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=85' },
  { label: 'Travel', sub: 'Passport & Duffle', href: '/products?category=travel', image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=600&q=85' },
  { label: 'Gifts',  sub: 'Curated Sets',      href: '/products?category=gifts',  image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&q=85' },
]

export const DEFAULT_HOME_EDITORIAL = {
  image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=85',
  eyebrow: 'New Collection · 2024',
  title: 'The Heritage\nEdit', // line breaks are kept on the homepage
  body: 'Rooted in old-world craft and finished for the modern wardrobe. Each piece is cut from a single hide, stitched by hand, and designed to outlast trends by decades.',
  ctaLabel: 'Explore the Collection',
  ctaHref: '/products?badge=new',
}

export const DEFAULT_FOOTER = {
  blurb: 'Handcrafted leather goods made with full-grain hides and time-honoured techniques. Designed to age beautifully and last a lifetime.',
  shopLinks: [
    { label: 'Women',       href: '/products?gender=women' },
    { label: 'Men',         href: '/products?gender=men' },
    { label: 'Travel',      href: '/products?category=travel' },
    { label: 'Accessories', href: '/products?category=accessories' },
    { label: 'Gift Sets',   href: '/products?category=gifts' },
    { label: 'New Arrivals', href: '/products?badge=new' },
    { label: 'The Journal', href: '/journal' },
  ],
  social: [
    { label: 'Instagram', handle: '@foldx.in', href: '' },
    { label: 'Pinterest', handle: '@foldx', href: '' },
    { label: 'Facebook',  handle: 'FoldX', href: '' },
  ],
}

export const SITE_CONTENT_DEFAULTS = {
  navMenu: DEFAULT_NAV_MENU,
  homeTiles: DEFAULT_HOME_TILES,
  homeEditorial: DEFAULT_HOME_EDITORIAL,
  footer: DEFAULT_FOOTER,
}
