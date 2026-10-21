// Built-in storefront content. Used until an admin saves their own version on
// the admin Storefront page (stored server-side in the SiteContent table), and
// restored by that page's "Reset to default" button.
//
// FoldX sells bags only: handbags, totes, slings, laptop bags, briefcases,
// backpacks, luggage, duffles and wallets. The homepage follows the section
// order of damilano.com.

const img = (id, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=85`

// Photos picked for showing bags without other brands' logos
const PHOTO = {
  handbags: 'photo-1560891958-68bb1fe7fb78',
  laptop: 'photo-1643033998438-38b4211fa2d5',
  luggage: 'photo-1581553680321-4fffae59fccd',
  backpacks: 'photo-1577733975197-3b950ca5cabe',
  wallets: 'photo-1627123424574-724758594e93',
  slings: 'photo-1523779105320-d1cd346ff52b',
  totes: 'photo-1624687943971-e86af76d57de',
  duffle: 'photo-1525103504173-8dc1582c7430',
  briefcase: 'photo-1603219527847-24c87f552a77',
  toteWoman: 'photo-1760624294469-550753ec203a',
  him: 'photo-1510682469697-f2953374f076',
  slingMan: 'photo-1602064493605-8c715aa4deeb',
  briefWalk: 'photo-1763598461615-610264129bea',
  walletDark: 'photo-1620109176813-e91290f6c795',
  toteTrio: 'photo-1760624294582-5341f33f9fa4',
  backpackBrown: 'photo-1622560480605-d83c853bc5c3',
  duffleFloor: 'photo-1448582649076-3981753123b5',
  crossbodyTan: 'photo-1600857062241-98e5dba7f214',
  messenger: 'photo-1517612228538-cefdbc2c01e7',
  atelier: 'photo-1727811641802-d28d9fb37e28',
  satchelBrown: 'photo-1691480150204-66dd1eb77391',
  tealBag: 'photo-1594223274512-ad4803739b7c',
  messengerStone: 'photo-1473188588951-666fce8e7c68',
  duffleMan: 'photo-1647540945262-7da3bd1a3d96',
  leatherSling: 'photo-1657603719375-8ffdacaac790',
  giftBox: 'photo-1549465220-1a8b9238cd48',
  pinkBag: 'photo-1566150905458-1bf1fc113f0d',
  cardHolder: 'photo-1601592996763-f05c9c80a7f1',
  passport: 'photo-1757074757417-277a22105bc0',
}

// The ☰ menu, in display order. A menu whose link is "/collections" and has
// no sub-links lists the live collections automatically (see Navbar).
// `featured` is optional — its image shows at the foot of the sub-menu.
export const DEFAULT_NAV_MENU = [
  {
    label: 'New In',
    href: '/products?badge=new',
    sub: [
      { label: 'New Arrivals',     href: '/products?badge=new' },
      { label: 'Best Sellers',     href: '/products?badge=best-seller' },
      { label: 'Online Exclusive', href: '/products?badge=online-exclusive' },
      { label: 'Limited Edition',  href: '/products?badge=limited-edition' },
    ],
    featured: { image: img(PHOTO.satchelBrown, 600), label: 'Just Arrived', href: '/products?badge=new' },
  },
  {
    label: 'Women',
    href: '/products?gender=women',
    sub: [
      { label: 'Handbags',      href: '/products?gender=women&type=handbags' },
      { label: 'Tote Bags',     href: '/products?gender=women&type=tote-bags' },
      { label: 'Sling Bags',    href: '/products?gender=women&type=sling-bags' },
      { label: 'Shoulder Bags', href: '/products?gender=women&type=shoulder-bags' },
      { label: 'Clutches',      href: '/products?gender=women&type=clutches' },
      { label: 'Wallets',       href: '/products?gender=women&type=wallets' },
    ],
    featured: { image: img(PHOTO.handbags, 600), label: 'Shop Women', href: '/products?gender=women' },
  },
  {
    label: 'Men',
    href: '/products?gender=men',
    sub: [
      { label: 'Laptop Bags',  href: '/products?gender=men&type=laptop-bags' },
      { label: 'Briefcases',   href: '/products?gender=men&type=briefcases' },
      { label: 'Sling Bags',   href: '/products?gender=men&type=sling-bags' },
      { label: 'Backpacks',    href: '/products?gender=men&type=backpacks' },
      { label: 'Wallets',      href: '/products?gender=men&type=wallets' },
      { label: 'Card Holders', href: '/products?gender=men&type=card-holders' },
    ],
    featured: { image: img(PHOTO.laptop, 600), label: 'Shop Men', href: '/products?gender=men' },
  },
  {
    label: 'Travel',
    href: '/products?category=travel',
    sub: [
      { label: 'Luggage & Trolleys', href: '/products?category=travel&type=luggage' },
      { label: 'Duffle Bags',        href: '/products?category=travel&type=duffle' },
      { label: 'Backpacks',          href: '/products?category=travel&type=backpacks' },
      { label: 'Passport Holders',   href: '/products?category=travel&type=passport' },
    ],
    featured: { image: img(PHOTO.duffle, 600), label: 'The Travel Edit', href: '/products?category=travel' },
  },
  {
    label: 'Collections',
    href: '/collections',
    sub: [], // filled from the live collections
    featured: { image: img(PHOTO.messenger, 600), label: 'All Collections', href: '/collections' },
  },
  {
    label: 'Gifts',
    href: '/gifts',
    sub: [
      { label: 'For Her',      href: '/gifts?for=her' },
      { label: 'For Him',      href: '/gifts?for=him' },
      { label: 'Gift Sets',    href: '/gifts?for=sets' },
      { label: 'Under ₹4,999', href: '/gifts?under=4999' },
      { label: 'Under ₹9,999', href: '/gifts?under=9999' },
    ],
    featured: { image: img(PHOTO.giftBox, 600), label: 'The Gift Store', href: '/gifts' },
  },
  {
    label: 'Free Customisation',
    href: '/customisation',
    sub: [],
    featured: { image: '', label: '', href: '' },
  },
  {
    label: 'Special Prices',
    href: '/products?sale=1',
    sub: [],
    featured: { image: '', label: '', href: '' },
  },
]

// Homepage slideshow used when the Banners list can't be loaded (API down) or
// has no active banner — the header floats over the hero, so the homepage must
// always have one. Same slides as the demo banners in mockData.
export const DEFAULT_HERO_BANNERS = [
  { id: 'default-hero-1', title: 'Made for the Journey', label: 'Travel · Duffles & Luggage', link: '/products?category=travel', desktopImage: img(PHOTO.duffle, 1920), mobileImage: img(PHOTO.duffle, 900) },
  { id: 'default-hero-2', title: 'The Work Edit', label: 'Laptop Bags & Briefcases', link: '/products?type=laptop-bags', desktopImage: img('photo-1667687038826-3d00484bce96', 1920), mobileImage: img('photo-1667687038826-3d00484bce96', 900) },
  { id: 'default-hero-3', title: 'Carry the Season', label: "Women's Handbags", link: '/products?gender=women', desktopImage: img(PHOTO.slings, 1920), mobileImage: img(PHOTO.slings, 900) },
]

// Rotating messages above the header. When the list is empty the single
// announcement from admin → Settings is shown instead.
export const DEFAULT_ANNOUNCEMENTS = [
  { text: 'Free customisation — choose your leather', href: '/customisation' },
  { text: 'A little note, a lot of love | Personalise your gift', href: '/gifts' },
  { text: 'Free shipping on orders above ₹999', href: '' },
]

// SHOP BY CATEGORY — 3 per row on desktop, 2 on phones
export const DEFAULT_HOME_TILES = [
  { label: "Women's Handbags",   sub: '', href: '/products?gender=women',          image: img(PHOTO.handbags, 900) },
  { label: 'Laptop Bags',        sub: '', href: '/products?type=laptop-bags',       image: img(PHOTO.laptop, 900) },
  { label: 'Luggage & Trolleys', sub: '', href: '/products?type=luggage',           image: img(PHOTO.luggage, 900) },
  { label: 'Backpacks',          sub: '', href: '/products?type=backpacks',         image: img(PHOTO.backpacks, 900) },
  { label: 'Tote Bags',          sub: '', href: '/products?type=tote-bags',         image: img(PHOTO.totes, 900) },
  { label: 'Wallets',            sub: '', href: '/products?type=wallets',           image: img(PHOTO.wallets, 900) },
]

// 1st = the full-width Gift Store banner; 2nd and 3rd = For Her / For Him
export const DEFAULT_HOME_GIFTING = [
  { label: 'The Gift Store', sub: 'Leather gifts, wrapped with a personal note', href: '/gifts', image: img(PHOTO.giftBox, 1800) },
  { label: 'For Her',        sub: '', href: '/gifts?for=her', image: img(PHOTO.toteWoman, 1200) },
  { label: 'For Him',        sub: '', href: '/gifts?for=him', image: img(PHOTO.him, 1200) },
]

export const DEFAULT_HOME_MOMENTS = {
  title: 'Made for Every Moment',
  items: [
    { label: "Men's Sling",  sub: '', href: '/products?type=sling-bags',  image: img(PHOTO.slingMan, 700) },
    { label: 'Work Bags',    sub: '', href: '/products?type=briefcases',  image: img(PHOTO.briefWalk, 700) },
    { label: 'Weekenders',   sub: '', href: '/products?type=duffle',      image: img(PHOTO.duffleMan, 700) },
    { label: 'Wallets',      sub: '', href: '/products?type=wallets',     image: img(PHOTO.walletDark, 700) },
  ],
}

// Featured collection: image on the left with "Shop Now", and a carousel of
// products from the button link on the right (a /collections/:id page or
// any /products?… filter)
export const DEFAULT_HOME_EDITORIAL = {
  image: img(PHOTO.messengerStone, 1400),
  eyebrow: 'The Collection',
  title: 'The Heritage Collection',
  body: '',
  ctaLabel: 'Shop Now',
  ctaHref: '/collections/heritage',
}

// TRENDING NOW — category tiles, 4 per row on desktop
export const DEFAULT_HOME_TRENDING = [
  { label: 'Work Essentials', sub: '', href: '/products?type=laptop-bags', image: img(PHOTO.briefcase, 700) },
  { label: 'Tote Bags',       sub: '', href: '/products?type=tote-bags',   image: img(PHOTO.toteTrio, 700) },
  { label: 'Duffle Bags',     sub: '', href: '/products?type=duffle',      image: img(PHOTO.duffleFloor, 700) },
  { label: 'Sling Bags',      sub: '', href: '/products?type=sling-bags',  image: img(PHOTO.crossbodyTan, 700) },
]

// YOUR NEXT STOP — full-width image with a line of text and a button
export const DEFAULT_HOME_CLOSING = {
  image: img(PHOTO.atelier, 1800),
  eyebrow: '',
  title: 'Your Next Stop',
  body: 'Visit the FoldX studio, or write to us — we will help you choose, check stock and customise your bag.',
  ctaLabel: 'Contact Us',
  ctaHref: '/contact',
}

// JOIN OUR COMMUNITY — a card per social account (from the footer's social
// links), then a strip of square photos linking to Instagram
export const DEFAULT_HOME_COMMUNITY = {
  title: 'Join Our Community',
  intro: 'Follow FoldX for new launches, leather-care tips and a look inside our workshop — and share how you carry yours.',
  handle: '@foldx01',
  href: 'https://www.instagram.com/foldx01',
  images: [
    img(PHOTO.slings, 500), img(PHOTO.backpackBrown, 500), img(PHOTO.tealBag, 500), img(PHOTO.leatherSling, 500),
    img(PHOTO.toteWoman, 500), img(PHOTO.messenger, 500), img(PHOTO.duffle, 500), img(PHOTO.satchelBrown, 500),
  ],
}

// Banners at the top of product listing pages. Each one belongs to a listing
// link; a page shows the banner whose link matches most of its filters (a bag
// type beats a category, e.g. /products?gender=women&type=tote-bags shows the
// Tote Bags banner).
const banner = (link, title, sub, photo) => ({ link, title, sub, image: img(photo, 1600) })
export const DEFAULT_CATEGORY_BANNERS = [
  banner('/products', 'All Bags', 'Every FoldX bag, handcrafted in leather', PHOTO.messenger),
  banner('/products?gender=women', 'Women', 'Handbags, totes, slings and wallets', PHOTO.handbags),
  banner('/products?gender=men', 'Men', 'Laptop bags, briefcases, slings and wallets', PHOTO.laptop),
  banner('/products?category=travel', 'Travel', 'Luggage, duffles and travel backpacks', PHOTO.duffle),
  banner('/products?category=gifts', 'Gift Sets', 'Ready to give, wrapped in leather', PHOTO.giftBox),
  banner('/products?type=handbags', 'Handbags', 'Top-handle bags for every day', PHOTO.satchelBrown),
  banner('/products?type=tote-bags', 'Tote Bags', 'Room for the whole day', PHOTO.totes),
  banner('/products?type=sling-bags', 'Sling Bags', 'Hands free, all day', PHOTO.slings),
  banner('/products?type=shoulder-bags', 'Shoulder Bags', 'Polished, structured, easy to carry', PHOTO.tealBag),
  banner('/products?type=clutches', 'Clutches', 'For evenings out', PHOTO.pinkBag),
  banner('/products?type=wallets', 'Wallets', 'Slim, sturdy, made to age well', PHOTO.wallets),
  banner('/products?type=card-holders', 'Card Holders', 'Pocket-flat essentials', PHOTO.cardHolder),
  banner('/products?type=laptop-bags', 'Laptop Bags', 'Padded, polished, office-ready', PHOTO.messengerStone),
  banner('/products?type=briefcases', 'Briefcases', 'Classic leather for the working day', PHOTO.briefcase),
  banner('/products?type=backpacks', 'Backpacks', 'Leather backpacks for work and travel', PHOTO.backpacks),
  banner('/products?type=luggage', 'Luggage & Trolleys', 'Cabin and check-in, built to travel', PHOTO.luggage),
  banner('/products?type=duffle', 'Duffle Bags', 'Weekenders for short escapes', PHOTO.duffleFloor),
  banner('/products?type=passport', 'Passport Holders', 'Documents in order, wherever you land', PHOTO.passport),
  banner('/products?badge=new', 'New In', 'The latest from our workshop', PHOTO.toteWoman),
  banner('/products?badge=best-seller', 'Best Sellers', 'The bags our customers love most', PHOTO.duffleMan),
  banner('/products?sale=1', 'Special Prices', 'Selected bags, for less', PHOTO.crossbodyTan),
]

export const DEFAULT_GIFT_STORE = {
  image: img(PHOTO.giftBox, 1800),
  eyebrow: 'The Gift Store',
  title: 'Gifts, Wrapped in Leather',
  body: 'Bags chosen to be given — and kept for years. Add gift wrap and a personal note at checkout.',
}

export const DEFAULT_FOOTER = {
  blurb: 'Handcrafted leather bags — made with full-grain hides, finished by hand, and free to customise in the leather you love.',
  shopLinks: [
    { label: 'New In',             href: '/products?badge=new' },
    { label: "Women's Bags",       href: '/products?gender=women' },
    { label: "Men's Bags",         href: '/products?gender=men' },
    { label: 'Travel & Luggage',   href: '/products?category=travel' },
    { label: 'Collections',        href: '/collections' },
    { label: 'Gift Store',         href: '/gifts' },
    { label: 'Free Customisation', href: '/customisation' },
    { label: 'Special Prices',     href: '/products?sale=1' },
  ],
  social: [
    { label: 'Instagram', handle: '@foldx01', href: 'https://www.instagram.com/foldx01' },
    { label: 'Facebook',  handle: 'foldx.co.in', href: 'https://www.facebook.com/foldx.co.in' },
    { label: 'YouTube',   handle: '@Foldx01', href: 'https://www.youtube.com/@Foldx01' },
  ],
}

export const SITE_CONTENT_DEFAULTS = {
  navMenu: DEFAULT_NAV_MENU,
  announcements: DEFAULT_ANNOUNCEMENTS,
  homeTiles: DEFAULT_HOME_TILES,
  homeGifting: DEFAULT_HOME_GIFTING,
  homeMoments: DEFAULT_HOME_MOMENTS,
  homeEditorial: DEFAULT_HOME_EDITORIAL,
  homeTrending: DEFAULT_HOME_TRENDING,
  homeClosing: DEFAULT_HOME_CLOSING,
  homeCommunity: DEFAULT_HOME_COMMUNITY,
  categoryBanners: DEFAULT_CATEGORY_BANNERS,
  giftStore: DEFAULT_GIFT_STORE,
  footer: DEFAULT_FOOTER,
}
