import { Link } from 'react-router-dom'

// A deliberately small markdown subset for content pages, rendered as React
// elements (never raw HTML, so page text can't inject scripts):
//   # / ## / ### headings · - or * bullet lists · 1. numbered lists
//   > callout · blank line = new paragraph · **bold** · *italic* · [text](link)
// Links may be internal ("/contact") or https / mailto / tel.

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g

function safeHref(href) {
  if (href.startsWith('/') && !href.startsWith('//')) return { internal: true, href }
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { internal: false, href }
  return null
}

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key} className="font-normal text-brown">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const target = safeHref(link[2])
      if (!target) return link[1]
      const cls = 'text-brown underline underline-offset-2 decoration-brown-mid/50 hover:decoration-brown'
      return target.internal
        ? <Link key={key} to={target.href} className={cls}>{link[1]}</Link>
        : <a key={key} href={target.href} className={cls} {...(/^https?:/i.test(target.href) && { target: '_blank', rel: 'noopener noreferrer' })}>{link[1]}</a>
    }
    return part
  })
}

function parseBlocks(source) {
  const blocks = []
  let para = []
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = [] } }

  for (const raw of String(source ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    let m
    if (!line) { flush(); continue }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); blocks.push({ type: `h${m[1].length}`, text: m[2] }); continue }
    if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flush()
      const type = /^\d/.test(line) ? 'ol' : 'ul'
      const last = blocks[blocks.length - 1]
      if (last?.type === type) last.items.push(m[1])
      else blocks.push({ type, items: [m[1]] })
      continue
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flush()
      const last = blocks[blocks.length - 1]
      if (last?.type === 'quote') last.text += ` ${m[1]}`
      else blocks.push({ type: 'quote', text: m[1] })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

export default function MarkdownLite({ source }) {
  return (
    <div className="space-y-5 font-sans font-light text-[15px] leading-relaxed text-brown-mid">
      {parseBlocks(source).map((b, i) => {
        const key = `b${i}`
        switch (b.type) {
          case 'h1': return <h2 key={key} className="font-serif text-3xl text-brown font-light pt-2">{inline(b.text, key)}</h2>
          case 'h2': return <h3 key={key} className="font-serif text-2xl text-brown font-light pt-2">{inline(b.text, key)}</h3>
          case 'h3': return <h4 key={key} className="font-sans text-[11px] tracking-luxury uppercase text-brown pt-2">{inline(b.text, key)}</h4>
          case 'ul': return <ul key={key} className="list-disc pl-5 space-y-1.5 marker:text-gold">{b.items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ul>
          case 'ol': return <ol key={key} className="list-decimal pl-5 space-y-1.5 marker:text-brown-mid">{b.items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ol>
          case 'quote': return <blockquote key={key} className="border-l-2 border-gold pl-4 py-1 bg-cream-dark/50">{inline(b.text, key)}</blockquote>
          default: return <p key={key}>{inline(b.text, key)}</p>
        }
      })}
    </div>
  )
}
