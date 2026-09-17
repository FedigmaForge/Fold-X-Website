export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

export const formatNumber = (num) =>
  new Intl.NumberFormat('en-IN').format(num)

export const calcDiscount = (original, current) =>
  Math.round(((original - current) / original) * 100)
