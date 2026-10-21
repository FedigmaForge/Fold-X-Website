// Minimal RFC 4180 CSV — quoted fields, "" escapes, commas and newlines
// inside quotes, CRLF or LF line endings, optional UTF-8 BOM.

function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  if (inQuotes) throw new Error('The file has an unclosed quote')
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  // Drop fully blank lines (e.g. a trailing newline in Excel exports)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Rows → objects keyed by the (trimmed, lower-cased) header row.
// Returns [{ line, data }] where line is the 1-based line number in the file.
function csvToObjects(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const records = rows.slice(1).map((r, i) => ({
    line: i + 2,
    data: Object.fromEntries(headers.map((h, k) => [h, unescapeFormula((r[k] ?? '').trim())])),
  }))
  return { headers, records }
}

// Text starting with = + - @ would run as a formula when opened in Excel/Sheets
// (CSV injection). Prefix it with an apostrophe; csvToObjects strips it again.
const FORMULA_START = /^[=+\-@]/
const isNumeric = (s) => /^-?\d+(\.\d+)?$/.test(s)

function cell(value) {
  let str = value === null || value === undefined ? '' : String(value)
  if (FORMULA_START.test(str) && !isNumeric(str)) str = `'${str}`
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const unescapeFormula = (s) => (s.startsWith("'") && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s)

function toCsv(headers, rows) {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

module.exports = { parseCsv, csvToObjects, toCsv }
