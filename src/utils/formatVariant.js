// Readable labels for a cart/order line's chosen options:
// { color: 'Tan', leather: 'Pebbled Leather' } → ['Colour: Tan', 'Custom leather: Pebbled Leather']
const LABELS = { color: 'Colour', size: 'Size', leather: 'Custom leather' }

export function formatVariant(variant) {
  return Object.entries(variant ?? {})
    .filter(([, v]) => v && typeof v !== 'object')
    .map(([k, v]) => `${LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
}

// Lines where the shopper picked the free leather customisation
export function customisedItems(items) {
  return (items ?? []).filter((i) => i.variant?.leather)
}
