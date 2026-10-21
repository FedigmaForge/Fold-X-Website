// Shared by prisma/seed.js (CLI: `npm run seed`) and the admin
// "Reset to Demo Data" endpoint (routes/adminData.routes.js) — both need to
// load src/data/mockData.js and upsert it into the DB the same way.
const path = require('path')
const { pathToFileURL } = require('url')
const bcrypt = require('bcryptjs')

const DEMO_PASSWORD = 'password123'
const ADMIN_EMAIL = 'admin@foldx.com'
const ADMIN_PASSWORD = 'admin123'

async function loadMockData() {
  const mockDataPath = path.resolve(__dirname, '../../src/data/mockData.js')
  return import(pathToFileURL(mockDataPath).href)
}

// Product row from a mockData entry (shared by the full seed and ensureDemoProducts)
function productData(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    categoryId: p.categoryId,
    subcategory: p.subcategory,
    material: p.material,
    price: p.price,
    originalPrice: p.originalPrice,
    discount: p.discount ?? 0,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    stock: p.stock ?? 0,
    badge: p.badge,
    colors: p.colors ?? [],
    images: p.images ?? [],
    description: p.description ?? '',
    features: p.features ?? [],
    isFeatured: p.isFeatured ?? false,
    isActive: p.isActive ?? true,
    createdAt: new Date(p.createdAt),
  }
}

async function seedAll(prisma) {
  const { categories, mockProducts, mockBanners, mockReviews, mockCustomers, mockOrders } =
    await loadMockData()

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { id: 'admin_001', name: 'Admin', email: ADMIN_EMAIL, passwordHash: adminPasswordHash, role: 'superadmin' },
  })

  // A couple of demo staff accounts at the lower roles, so the Staff page
  // and its permission differences are visible without manually creating them.
  const staffPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  await prisma.user.upsert({
    where: { email: 'manager@foldx.com' },
    update: {},
    create: { id: 'staff_manager_001', name: 'Meera Iyer', email: 'manager@foldx.com', passwordHash: staffPasswordHash, role: 'manager' },
  })
  await prisma.user.upsert({
    where: { email: 'support@foldx.com' },
    update: {},
    create: { id: 'staff_support_001', name: 'Arjun Nair', email: 'support@foldx.com', passwordHash: staffPasswordHash, role: 'support' },
  })

  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  for (const c of mockCustomers) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        email: c.email,
        passwordHash: demoPasswordHash,
        phone: c.phone,
        city: c.city,
        role: 'customer',
        isActive: c.isActive ?? true,
        createdAt: new Date(c.joinedAt),
      },
    })
  }

  for (const [i, cat] of categories.entries()) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: { id: cat.id, name: cat.name, icon: cat.icon ?? '', image: cat.image ?? '', sub: cat.sub ?? [], sortOrder: i },
    })
  }

  // Creates products the database doesn't have yet; never edits existing ones
  await ensureDemoProducts(prisma)

  for (const b of mockBanners) {
    await prisma.banner.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        title: b.title,
        label: b.label,
        link: b.link,
        desktopImage: b.desktopImage,
        mobileImage: b.mobileImage,
        isActive: b.isActive ?? true,
        order: b.order ?? 0,
      },
    })
  }

  for (const r of mockReviews) {
    await prisma.review.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        productId: r.productId,
        userId: r.userId,
        userName: r.userName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: new Date(r.date),
        isApproved: r.isApproved ?? false,
      },
    })
  }

  for (const o of mockOrders) {
    const existing = await prisma.order.findUnique({ where: { id: o.id } })
    if (existing) continue
    await prisma.order.create({
      data: {
        id: o.id,
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        subtotal: o.subtotal,
        shipping: o.shipping ?? 0,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentId: o.paymentId,
        address: o.address,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
        items: {
          create: o.items.map((item) => ({
            productId: item.product?.id,
            productSnapshot: item.product,
            quantity: item.quantity,
            variant: item.variant ?? {},
          })),
        },
        events: {
          create: { type: 'created', message: 'Order placed and payment received', actorName: o.customerName, createdAt: new Date(o.createdAt) },
        },
      },
    })
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: 'FoldX',
      tagline: 'Handcrafted Leather Goods',
      announcementBar: 'Free shipping on orders above ₹999 · Use code FOLDX10 for 10% off · Handcrafted in India',
      freeShippingThreshold: 999,
      supportEmail: 'foldx01@gmail.com',
      supportPhone: '9990537773',
      address: '42 MG Road, Bangalore, Karnataka — 560001',
      instagramHandle: '@foldx01',
      // Registered business details (GST certificate)
      gstin: '07BGJPK9798M1Z9',
      state: 'Delhi',
      legalName: 'NITIN KAPOOR',
      tradeName: 'M/s KAPSONS ENTERPRISES',
      businessType: 'Proprietorship',
      currency: 'INR',
      razorpayKeyId: '',
    },
  })

  await ensureVariantsFromColors(prisma)
  await ensureDefaultPages(prisma)
  await ensureDefaultCoupons(prisma)
  await ensureDefaultCollections(prisma)

  return { adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD, demoCustomerEmail: mockCustomers[0].email, demoPassword: DEMO_PASSWORD }
}

// Gives every product that has colours but no variants one variant per colour,
// splitting its current stock across them (remainder on the first). Idempotent,
// so it doubles as the backfill for databases created before variants existed.
async function ensureVariantsFromColors(prisma) {
  const products = await prisma.product.findMany({ include: { variants: { select: { id: true } } } })
  let created = 0
  for (const p of products) {
    const colors = Array.isArray(p.colors) ? p.colors.filter(Boolean) : []
    if (p.variants.length || colors.length === 0) continue
    const each = Math.floor(p.stock / colors.length)
    const remainder = p.stock - each * colors.length
    await prisma.productVariant.createMany({
      data: colors.map((color, i) => ({
        productId: p.id,
        color,
        stock: each + (i === 0 ? remainder : 0),
        sortOrder: i,
      })),
    })
    created += colors.length
  }
  return created
}

// Creates the starter content pages (About, FAQ, policies) that don't exist
// yet, as unpublished drafts — the policy texts are placeholders to review.
async function ensureDefaultPages(prisma) {
  const defaults = require('./defaultPages')
  let created = 0
  for (const [i, page] of defaults.entries()) {
    if (await prisma.page.findUnique({ where: { slug: page.slug } })) continue
    await prisma.page.create({ data: { ...page, isPublished: false, sortOrder: i } })
    created++
  }
  return created
}

// FOLDX10 is advertised in the default announcement bar, so make it real:
// 10% off, capped at ₹1,500, once per customer.
async function ensureDefaultCoupons(prisma) {
  if (await prisma.coupon.findUnique({ where: { code: 'FOLDX10' } })) return 0
  await prisma.coupon.create({
    data: { code: 'FOLDX10', description: '10% off your order', type: 'percent', value: 10, maxDiscount: 1500, perCustomerLimit: 1, targetIds: [] },
  })
  return 1
}

// Starter collections, created only when there are none yet (so an admin who
// deleted them all doesn't get them back on every seed). Products are assigned
// by id and skipped if they no longer exist.
const DEFAULT_COLLECTIONS = [
  {
    id: 'heritage', name: 'The Heritage Collection', tagline: 'Structured classics, cut from a single hide',
    description: 'Clean lines, hand-burnished edges and full-grain leather that deepens with every year of use. The Heritage pieces are designed to be carried daily — and handed down.',
    image: 'https://images.unsplash.com/photo-1778883008356-f7b3789a3073?w=1600&q=85',
    cardImage: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=800&q=85',
    productIds: ['prod_001', 'prod_004', 'prod_005', 'prod_008', 'prod_012', 'prod_016', 'prod_017', 'prod_020'],
  },
  {
    id: 'croco', name: 'The Croco Edit', tagline: 'Embossed texture, evening polish',
    description: 'Croc-embossed leather in compact silhouettes — the slings, clutches and card holders that finish an outfit.',
    image: 'https://images.unsplash.com/photo-1567744875520-cf9c27fbb53b?w=1600&q=85',
    cardImage: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=85',
    productIds: ['prod_002', 'prod_003', 'prod_007', 'prod_011', 'prod_014', 'prod_021'],
  },
  {
    id: 'voyage', name: 'Voyage', tagline: 'Leather made for the journey',
    description: 'Passport holders, long wallets and travel essentials built to keep documents, cards and currency in order from check-in to arrival.',
    image: 'https://images.unsplash.com/photo-1586441133374-ed1cb4007a47?w=1600&q=85',
    cardImage: 'https://images.unsplash.com/photo-1757074757417-277a22105bc0?w=800&q=85',
    productIds: ['prod_006', 'prod_009', 'prod_010', 'prod_022', 'prod_023', 'prod_024', 'prod_025', 'prod_026'],
  },
]

async function ensureDefaultCollections(prisma) {
  if (await prisma.collection.count()) return 0
  for (const [i, { productIds, ...c }] of DEFAULT_COLLECTIONS.entries()) {
    await prisma.collection.create({ data: { ...c, sortOrder: i } })
    await prisma.product.updateMany({ where: { id: { in: productIds }, collectionId: null }, data: { collectionId: c.id } })
  }
  return DEFAULT_COLLECTIONS.length
}

// Adds any mockData product the database doesn't have yet (by id) — so demo
// products added to mockData reach an existing database without a reset — then
// gives them colour variants and puts them in their default collection.
// Never changes products that already exist.
async function ensureDemoProducts(prisma) {
  const { mockProducts } = await loadMockData()
  const existing = new Set((await prisma.product.findMany({ select: { id: true } })).map((p) => p.id))
  const slugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug))
  const missing = mockProducts.filter((p) => !existing.has(p.id) && !slugs.has(p.slug))
  for (const p of missing) await prisma.product.create({ data: productData(p) })
  await ensureVariantsFromColors(prisma)
  const added = new Set(missing.map((p) => p.id))
  for (const c of DEFAULT_COLLECTIONS) {
    if (!(await prisma.collection.findUnique({ where: { id: c.id } }))) continue
    const ids = c.productIds.filter((id) => added.has(id))
    if (ids.length) await prisma.product.updateMany({ where: { id: { in: ids }, collectionId: null }, data: { collectionId: c.id } })
  }
  return missing.length
}

// Wipes everything the demo seeds (in FK-safe order) — used by the admin
// "Reset to Demo Data" button. Keeps any customer accounts/orders/reviews a
// real user created after seeding, EXCEPT this is a full reset so it removes
// those too by design (matches the old mock `resetToDefaults` behaviour).
async function wipeAll(prisma) {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.coupon.deleteMany()
  await prisma.review.deleteMany()
  await prisma.product.deleteMany()
  await prisma.collection.deleteMany()
  await prisma.newsletterSubscriber.deleteMany()
  await prisma.category.deleteMany()
  await prisma.banner.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.siteContent.deleteMany()
  await prisma.page.deleteMany()
  await prisma.contactMessage.deleteMany()
  await prisma.user.deleteMany()
  await prisma.settings.deleteMany()
}

module.exports = { seedAll, wipeAll, loadMockData, ensureVariantsFromColors, ensureDefaultPages, ensureDefaultCoupons, ensureDefaultCollections, ensureDemoProducts }
