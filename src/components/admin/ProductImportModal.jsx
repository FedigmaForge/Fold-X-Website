import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { importProductsCsv, downloadProductsCsv } from '@/services/api'
import toast from 'react-hot-toast'

const MAX_BYTES = 1.5 * 1024 * 1024 // stays under the API's 2 MB JSON limit

// Two steps: pick a file → the server checks every row and shows what would
// change (nothing is written) → confirm to apply. A file with any error can't
// be applied, so a half-imported catalogue is impossible.
export default function ProductImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [csv, setCsv] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const check = async (text) => {
    setBusy(true)
    try {
      setResult(await importProductsCsv(text, { dryRun: true }))
    } catch (err) {
      toast.error(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: async ([f]) => {
      if (!f) return
      if (f.size > MAX_BYTES) { toast.error('File is too large (max 1.5 MB)'); return }
      const text = await f.text()
      setFile(f)
      setCsv(text)
      check(text)
    },
  })

  const apply = async () => {
    setBusy(true)
    try {
      const done = await importProductsCsv(csv, { dryRun: false })
      if (done.errors?.length) { setResult(done); return }
      toast.success(`Imported: ${done.summary.create} created, ${done.summary.update} updated`)
      onImported()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const errors = result?.errors ?? []

  return (
    <Modal isOpen onClose={onClose} title="Import products from CSV" size="lg">
      <div className="space-y-5 text-sm">
        <p className="text-gray-500">
          Start from an <button type="button" onClick={() => downloadProductsCsv().catch((e) => toast.error(e.message))} className="text-violet-600 hover:underline">export of your products</button> so
          the columns match. One row per variant; rows with the same <span className="font-mono">handle</span> belong to one product.
          Existing products (matched by handle) are updated — blank cells leave a value unchanged.
        </p>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-400'}`}
        >
          <input {...getInputProps()} />
          <FileUp size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-600">{file ? file.name : 'Drop a .csv file here, or click to choose'}</p>
          {busy && <p className="text-xs text-gray-400 mt-1">Checking…</p>}
        </div>

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Rows', result.summary.rows],
                ['New products', result.summary.create],
                ['Updated products', result.summary.update],
                ['Variant rows', result.summary.variants],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 py-2">
                  <p className="text-lg text-gray-900">{n}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>

            {result.ignoredColumns?.length > 0 && (
              <p className="text-xs text-gray-500">Ignored unknown columns: {result.ignoredColumns.join(', ')}</p>
            )}

            {errors.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1.5 font-medium text-red-700 mb-2">
                  <AlertTriangle size={14} /> {errors.length} problem{errors.length === 1 ? '' : 's'} — fix the file and drop it again. Nothing was imported.
                </p>
                <ul className="space-y-1 max-h-48 overflow-y-auto text-red-700">
                  {errors.slice(0, 100).map((e, i) => (
                    <li key={i}>{e.line ? <span className="font-mono text-xs">Line {e.line}: </span> : null}{e.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="flex items-center gap-1.5 font-medium text-green-700 mb-2"><CheckCircle2 size={14} /> Everything checks out</p>
                <ul className="max-h-40 overflow-y-auto text-gray-600 space-y-0.5">
                  {result.preview.map((p) => (
                    <li key={p.handle}>
                      <span className={p.action === 'create' ? 'text-green-700' : 'text-gray-500'}>{p.action === 'create' ? 'New' : 'Update'}</span>
                      {' · '}{p.name ?? p.handle}{p.variants ? <span className="text-gray-400"> · {p.variants} variant row{p.variants === 1 ? '' : 's'}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={apply}
            disabled={busy || !result || errors.length > 0}
            className="px-5 py-2 rounded-xl font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
