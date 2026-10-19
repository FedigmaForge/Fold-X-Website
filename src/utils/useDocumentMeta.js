import { useEffect } from 'react'

// Sets <title> and <meta name="description"> while a page is mounted and
// restores the previous values afterwards. Pass null to leave them alone
// (e.g. while the page's data is still loading).
export default function useDocumentMeta(title, description) {
  useEffect(() => {
    if (!title) return
    const prevTitle = document.title
    let tag = document.querySelector('meta[name="description"]')
    const created = !tag
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'description')
      document.head.appendChild(tag)
    }
    const prevDescription = tag.getAttribute('content')

    document.title = title
    if (description) tag.setAttribute('content', description.replace(/\s+/g, ' ').trim().slice(0, 170))

    return () => {
      document.title = prevTitle
      if (created) tag.remove()
      else if (prevDescription !== null) tag.setAttribute('content', prevDescription)
    }
  }, [title, description])
}
