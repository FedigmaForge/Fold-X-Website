import { Link } from 'react-router-dom'
import { journalPosts } from '@/data/journalData'
import { formatDate } from '@/utils/formatDate'

export default function JournalPage() {
  return (
    <div className="max-w-screen-lg mx-auto px-6 py-16">
      <div className="text-center mb-14">
        <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">Stories</p>
        <h1 className="font-serif text-4xl lg:text-5xl text-brown font-light">The Journal</h1>
        <p className="mt-4 text-sm font-sans font-light text-brown-mid max-w-md mx-auto">
          Craft, materials, and care — notes from the FoldX atelier.
        </p>
      </div>

      <div className="space-y-16">
        {journalPosts.map((post) => (
          <Link key={post.id} to={`/journal/${post.slug}`} className="group grid sm:grid-cols-2 gap-6 sm:gap-10 items-center">
            <div className="overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div>
              <p className="text-[10px] tracking-luxury font-sans uppercase text-brown-mid mb-3">
                {formatDate(post.date)} · {post.readTime}
              </p>
              <h2 className="font-serif text-2xl lg:text-3xl text-brown font-light leading-snug group-hover:text-brown-mid transition-colors">
                {post.title}
              </h2>
              <p className="mt-3 text-sm font-sans font-light text-brown-mid leading-relaxed">
                {post.excerpt}
              </p>
              <span className="inline-block mt-5 text-[10px] tracking-luxury font-sans uppercase text-brown border-b border-brown pb-0.5 group-hover:text-brown-mid group-hover:border-brown-mid transition-colors">
                Read the Story
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
