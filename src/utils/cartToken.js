// A random id for the shopper's current bag, kept in their browser. Checkout
// sends it with the email so an abandoned bag can be recovered later, and
// with the order so the bag is marked recovered once bought.
const KEY = 'foldx-cart-token'
const OFFER_KEY = 'foldx-offer-code'

const fresh = () => `cart_${crypto.randomUUID()}`

export function getCartToken() {
  try {
    let token = localStorage.getItem(KEY)
    if (!/^cart_[0-9a-f-]{36}$/i.test(token ?? '')) {
      token = fresh()
      localStorage.setItem(KEY, token)
    }
    return token
  } catch {
    return fresh() // storage blocked — still works for this visit
  }
}

export function setCartToken(token) {
  try { localStorage.setItem(KEY, token) } catch { /* storage blocked */ }
}

// After an order is placed, the next bag is a new cart
export function resetCartToken() {
  try { localStorage.setItem(KEY, fresh()) } catch { /* storage blocked */ }
}

// A discount code from a reminder link, applied at checkout once
export function setOfferCode(code) {
  try { sessionStorage.setItem(OFFER_KEY, code) } catch { /* storage blocked */ }
}

// Read without removing (React may run initialisers twice in development);
// clear it separately once applied
export function peekOfferCode() {
  try { return sessionStorage.getItem(OFFER_KEY) } catch { return null }
}

// Name/email from a recovered cart, to pre-fill the checkout address
const CONTACT_KEY = 'foldx-recovered-contact'

export function setRecoveredContact(contact) {
  try { sessionStorage.setItem(CONTACT_KEY, JSON.stringify(contact)) } catch { /* storage blocked */ }
}

export function peekRecoveredContact() {
  try { return JSON.parse(sessionStorage.getItem(CONTACT_KEY) ?? 'null') } catch { return null }
}

export function clearRecoveredContact() {
  try { sessionStorage.removeItem(CONTACT_KEY) } catch { /* storage blocked */ }
}

export function clearOfferCode() {
  try { sessionStorage.removeItem(OFFER_KEY) } catch { /* storage blocked */ }
}
