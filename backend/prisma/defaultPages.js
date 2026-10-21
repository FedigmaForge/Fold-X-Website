// Starter content pages, created as UNPUBLISHED drafts. About and FAQ have
// [placeholders] to adapt; the full policy texts live in policyPages.js.
// Not legal advice — review before publishing.

const REVIEW = '> **Draft — replace the bracketed parts and review before publishing.**\n\n'

module.exports = [
  {
    slug: 'about',
    title: 'About FoldX',
    showInFooter: true,
    metaDescription: 'Handcrafted leather goods made in India from full-grain hides.',
    body: `${REVIEW}# Our story

FoldX makes leather goods to be carried every day and kept for decades. Every piece is cut from full-grain hide, stitched by hand and finished in our workshop in [city].

## How we make it

- **Full-grain leather** — the strongest layer of the hide, which develops a patina over time.
- **Hand-finished edges** — burnished and sealed with natural wax.
- **Small batches** — so every piece is checked before it leaves us.

Questions? [Get in touch](/contact).`,
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    showInFooter: true,
    metaDescription: 'Answers about orders, delivery, returns and leather care.',
    body: `${REVIEW}## How long does delivery take?

Orders are dispatched within [1–2] working days. Delivery usually takes [3–7] working days depending on your pincode.

## Can I change or cancel my order?

Yes, until it has been dispatched. [Contact us](/contact) with your order number.

## How do I care for my leather?

Wipe with a soft dry cloth, keep away from prolonged moisture and direct heat, and condition every [6] months.

## Do you ship outside India?

[Not yet / Yes, to …]`,
  },
  // Shipping, Returns & Refunds, Privacy and Terms
  ...require('./policyPages'),
]
