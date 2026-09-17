import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ImagePlus, X, Link as LinkIcon, Loader2 } from 'lucide-react'
import { uploadImage } from '@/services/api'
import toast from 'react-hot-toast'

export default function ImageUploader({ images = [], onChange, maxFiles = 6 }) {
  const [urlInput, setUrlInput] = useState('')
  const [urlMode, setUrlMode] = useState(false)
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setUploading(true)
      try {
        const uploaded = await Promise.all(acceptedFiles.map((f) => uploadImage(f)))
        const next = [...images, ...uploaded.map((u) => u.url)].slice(0, maxFiles)
        onChange?.(next)
      } catch (err) {
        toast.error(err.message || 'Image upload failed')
      } finally {
        setUploading(false)
      }
    },
    [images, maxFiles, onChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: maxFiles - images.length,
    disabled: images.length >= maxFiles || uploading,
  })

  const addUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    if (images.length >= maxFiles) return
    onChange?.([...images, url])
    setUrlInput('')
    setUrlMode(false)
  }

  const remove = (index) => {
    onChange?.(images.filter((_, i) => i !== index))
  }

  const getImgSrc = (img) => (typeof img === 'string' ? img : img?.preview || img?.url || '')

  return (
    <div className="space-y-3">
      {/* Previews */}
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            <img
              src={getImgSrc(img)}
              alt={`product-${i}`}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No image</text></svg>' }}
            />
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-violet-600 text-white py-0.5">
                Main
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {images.length < maxFiles && (
          <div
            {...getRootProps()}
            className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-violet-500 bg-violet-50'
                : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 size={20} className="text-violet-400 animate-spin" />
            ) : (
              <>
                <ImagePlus size={22} className="text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-400 text-center px-1">
                  {isDragActive ? 'Drop here' : 'Upload'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {images.length}/{maxFiles} images · First image is the main product photo
      </p>

      {/* URL input toggle */}
      {images.length < maxFiles && (
        <div>
          {urlMode ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } if (e.key === 'Escape') { setUrlMode(false); setUrlInput('') } }}
                placeholder="https://example.com/image.jpg"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-violet-400"
              />
              <button type="button" onClick={addUrl} className="px-3 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 text-xs font-medium transition-colors">
                Add
              </button>
              <button type="button" onClick={() => { setUrlMode(false); setUrlInput('') }} className="px-3 border border-gray-200 rounded-xl text-xs text-gray-400 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setUrlMode(true)}
              className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors"
            >
              <LinkIcon size={12} /> Add image via URL instead
            </button>
          )}
        </div>
      )}
    </div>
  )
}
