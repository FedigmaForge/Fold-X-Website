// Outline glyphs for the usual social networks, matched by the link's label
// (admin → Storefront → Footer → Social links). Unknown networks render null.
const PATHS = {
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" /></g>
  ),
  facebook: (
    <path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.1v3h2.5V21h2.9Z" />
  ),
  linkedin: (
    <path fill="currentColor" d="M6.9 8.6H3.8V20h3.1V8.6ZM5.3 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.2 13.4c0-3-1.6-4.9-4.2-4.9-1.4 0-2.4.8-2.8 1.5V8.6h-3V20h3.1v-5.9c0-1.5.6-2.6 2-2.6s1.8 1.1 1.8 2.7V20h3.1v-6.6Z" />
  ),
  youtube: (
    <path fill="currentColor" d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
  ),
}

export default function SocialIcon({ name, className = 'w-5 h-5' }) {
  const glyph = PATHS[String(name ?? '').toLowerCase()]
  if (!glyph) return null
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{glyph}</svg>
}
