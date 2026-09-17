import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { journalPosts } from '@/data/journalData'
import { formatDate } from '@/utils/formatDate'

export default function JournalPostPage() {
  const { slug } = useParams()
  const index = journalPosts.findIndex((p) => p.slug === slug)
  const post = journalPosts[index]
  const next = journalPosts[(index + 1) % journalPosts.length]

  if (!post) {
    return (
      <div className="text-center py-24">
        <p className="text-brown-mid font-sans font-light">Story not found</p>
        <Link to="/journal" className="text-brown border-b border-brown pb-0.5 text-[11px] tracking-luxury font-sans uppercase mt-4 inline-block hover:text-brown-mid hover:border-brown-mid transition-colors">
          Back to the Journal
        </Link>
      </div>
    )
  }

  return (
    <article className="max-w-screen-md mx-auto px-6 py-16">
      <Link to="/journal" className="inline-flex items-center gap-1.5 text-[10px] tracking-luxury font-sans uppercase text-brown-mid hover:text-brown transition-colors mb-10">
        <ArrowLeft size={13} /> The Journal
      </Link>

      <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">
        {formatDate(post.date)} · {post.readTime}
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-brown font-light leading-tight mb-8">
        {post.title}
      </h1>

      <div className="overflow-hidden mb-10" style={{ aspectRatio: '16/9' }}>
        <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
      </div>

      <div className="space-y-5 max-w-2xl mx-auto">
        {post.body.map((para, i) => (
          <p key={i} className="font-sans font-light text-brown-mid leading-relaxed text-[15px]">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
        <Link
          to="/products"
          className="text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 hover:text-brown-mid hover:border-brown-mid transition-colors"
        >
          Shop the Collection
        </Link>
        <Link
          to={`/journal/${next.slug}`}
          className="group flex items-center gap-2 text-right"
        >
          <span>
            <span className="block text-[9px] tracking-luxury font-sans uppercase text-brown-mid">Next Story</span>
            <span className="block text-sm font-serif text-brown group-hover:text-brown-mid transition-colors">{next.title}</span>
          </span>
          <ArrowRight size={16} className="text-brown shrink-0" />
        </Link>
      </div>
    </article>
  )
}
