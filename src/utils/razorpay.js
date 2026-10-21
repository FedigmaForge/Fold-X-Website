// Dynamically load Razorpay SDK
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Initiate Razorpay payment.
 *
 * BACKEND REQUIREMENT: Before calling this, your backend must create a
 * Razorpay Order via POST /api/orders/create-razorpay-order and return
 * { razorpayOrderId }. Pass that as `razorpayOrderId` below.
 */
export async function initiatePayment({ amount, razorpayOrderId, customerName, customerEmail, customerPhone, onSuccess, onFailure }) {
  const loaded = await loadRazorpayScript()
  if (!loaded) {
    onFailure?.('Failed to load payment gateway. Please try again.')
    return
  }

  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxx',
    amount: amount * 100, // paise
    currency: 'INR',
    name: 'FoldX',
    description: 'Order Payment',
    image: '/icon-192.png', // FoldX emblem in the payment window
    order_id: razorpayOrderId,
    handler: (response) => {
      // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      // BACKEND REQUIREMENT: verify signature at POST /api/orders/verify-payment
      onSuccess?.(response)
    },
    prefill: {
      name: customerName,
      email: customerEmail,
      contact: customerPhone,
    },
    theme: { color: '#7C3AED' },
    modal: {
      ondismiss: () => onFailure?.('Payment cancelled'),
    },
  }

  const rzp = new window.Razorpay(options)
  rzp.on('payment.failed', (res) => onFailure?.(res.error.description))
  rzp.open()
}
