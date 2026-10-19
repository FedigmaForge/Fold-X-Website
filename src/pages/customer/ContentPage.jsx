import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import MarkdownLite from '@/components/ui/MarkdownLite'
import { getPage } from '@/services/api'
import useDocumentMeta from '@/utils/useDocumentMeta'
import useSettingsStore from '@/store/settingsStore'
import { formatDate } from '@/utils/formatDate'

// Storefront page for admin-editable content (About, FAQ, policies) at /pages/:slug
export default function ContentPage() {
  const { slug } = useParams()
  const storeName = useSettingsStore((s) => s.storeName)
  const [result, setResult] = useState({ slug: null, page: null })
  const loading = result.slug !== slug
  const page = loading ? null : result.page

  useEffect(() => {
    let stale = false
    getPage(slug)
      .then((p) => { if (!stale) setResult({ slug, page: p }) })
      .catch(() => { if (!stale) setResult({ slug, page: null }) })
    return () => { stale = true }
  }, [slug])

  useDocumentMeta(page ? `${page.title} | ${storeName}` : null, page?.metaDescription || null)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-4">
        <div className="h-10 w-2/3 bg-cream-dark animate-pulse" />
        <div className="h-40 bg-cream-dark animate-pulse" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="font-serif text-3xl text-brown font-light mb-4">Page not found</p>
        <Link to="/" className="btn-brand-secondary inline-block">Back to the store</Link>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-14">
      <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">
        <Link to="/" className="hover:text-brown">Home</Link> / {page.title}
      </p>
      <h1 className="font-serif text-4xl lg:text-5xl text-brown font-light mb-10">{page.title}</h1>
      <MarkdownLite source={page.body} />
      <p className="mt-14 pt-6 border-t border-border text-[11px] font-sans text-brown-mid">Last updated {formatDate(page.updatedAt)}</p>
    </article>
  )
}
