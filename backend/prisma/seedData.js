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

  for (const p of mockProducts) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
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
      },
    })
  }

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
      supportPhone: '1800-001-234',
      address: '42 MG Road, Bangalore, Karnataka — 560001',
      instagramHandle: '@foldx.in',
      currency: 'INR',
      razorpayKeyId: '',
    },
  })

  await ensureVariantsFromColors(prisma)
  await ensureDefaultPages(prisma)
  await ensureDefaultCoupons(prisma)

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
  await prisma.category.deleteMany()
  await prisma.banner.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.siteContent.deleteMany()
  await prisma.page.deleteMany()
  await prisma.contactMessage.deleteMany()
  await prisma.user.deleteMany()
  await prisma.settings.deleteMany()
}

module.exports = { seedAll, wipeAll, loadMockData, ensureVariantsFromColors, ensureDefaultPages, ensureDefaultCoupons }
