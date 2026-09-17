import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Monitor, Smartphone, Upload, X, CheckCircle, Loader2 } from 'lucide-react'
import { uploadImage } from '@/services/api'
import toast from 'react-hot-toast'

function readDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.src = URL.createObjectURL(file)
  })
}

function UploadZone({ label, icon: Icon, recommended, preview, onUpload, onClear }) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (files) => {
      if (!files[0]) return
      const file = files[0]
      setUploading(true)
      try {
        const { width, height } = await readDimensions(file)
        const { url } = await uploadImage(file)
        const [rw, rh] = recommended.split('×').map((s) => parseInt(s.trim()))
        const ok = width === rw && height === rh
        onUpload?.({ url, width, height, dimensionOk: ok })
      } catch (err) {
        toast.error(err.message || 'Image upload failed')
      } finally {
        setUploading(false)
      }
    },
    [recommended, onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  })

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-400 ml-auto">Recommended: {recommended} px</span>
      </div>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={preview.url} alt={label} className="w-full h-36 object-cover" />
          <div className="absolute inset-0 bg-black/30 flex flex-col items-end justify-start p-2 gap-1">
            {preview.dimensionOk ? (
              <span className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                <CheckCircle size={10} /> Correct dimensions
              </span>
            ) : (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                ⚠ {preview.width}×{preview.height} (expected {recommended})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            <X size={12} />
          </button>
        </div>
      ) : uploading ? (
        <div className="h-36 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
          <Loader2 size={22} className="text-violet-400 animate-spin mb-2" />
          <p className="text-xs text-gray-400">Uploading…</p>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={24} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">
            {isDragActive ? 'Drop to upload' : 'Drop or click to upload'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{recommended} px recommended</p>
        </div>
      )}
    </div>
  )
}

export default function BannerUploader({ desktopImage, mobileImage, onDesktopChange, onMobileChange }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload separate images for desktop and mobile. The correct size will be shown automatically based on the visitor's device.
      </p>
      <div className="flex gap-4 flex-wrap">
        <UploadZone
          label="Desktop Banner"
          icon={Monitor}
          recommended="1920 × 720"
          preview={desktopImage}
          onUpload={onDesktopChange}
          onClear={() => onDesktopChange?.(null)}
        />
        <UploadZone
          label="Mobile Banner"
          icon={Smartphone}
          recommended="768 × 960"
          preview={mobileImage}
          onUpload={onMobileChange}
          onClear={() => onMobileChange?.(null)}
        />
      </div>
    </div>
  )
}
