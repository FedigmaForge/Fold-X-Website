// GSTIN checks: 15 characters = 2-digit state code + 10-character PAN +
// entity number + "Z" + a check character (mod-36 checksum).

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

// GST state codes for the states/UTs in src/data/indianStates.js
const STATE_CODES = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', Punjab: '03', Chandigarh: '04', Uttarakhand: '05',
  Haryana: '06', Delhi: '07', Rajasthan: '08', 'Uttar Pradesh': '09', Bihar: '10', Sikkim: '11',
  'Arunachal Pradesh': '12', Nagaland: '13', Manipur: '14', Mizoram: '15', Tripura: '16', Meghalaya: '17',
  Assam: '18', 'West Bengal': '19', Jharkhand: '20', Odisha: '21', Chhattisgarh: '22', 'Madhya Pradesh': '23',
  Gujarat: '24', 'Dadra and Nagar Haveli and Daman and Diu': '26', Maharashtra: '27', Karnataka: '29',
  Goa: '30', Lakshadweep: '31', Kerala: '32', 'Tamil Nadu': '33', Puducherry: '34',
  'Andaman and Nicobar Islands': '35', Telangana: '36', 'Andhra Pradesh': '37', Ladakh: '38',
}

function checkChar(first14) {
  let total = 0
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2)
    total += Math.floor(v / 36) + (v % 36)
  }
  return CHARS[(36 - (total % 36)) % 36]
}

// Returns an error message, or null when the GSTIN is valid (blank is allowed)
function gstinProblem(gstin, state) {
  if (!gstin) return null
  if (!FORMAT.test(gstin)) return 'GSTIN must be 15 characters, like 07ABCDE1234F1Z5'
  if (checkChar(gstin.slice(0, 14)) !== gstin[14]) return 'That GSTIN fails its check digit — please re-check it against your GST certificate'
  const code = STATE_CODES[state]
  if (state && code && gstin.slice(0, 2) !== code) return `This GSTIN is registered in another state (code ${gstin.slice(0, 2)}), but the store state is ${state} (code ${code})`
  return null
}

module.exports = { gstinProblem, STATE_CODES }
