// The payment log: one PaymentTransaction per money movement. Written at the
// moment money moves (online capture at checkout, COD cash at delivery,
// refunds) so the log never has to be reconstructed later.
//
// settlementStatus:
//   pending — real money we expect to see in a Razorpay settlement / courier remittance
//   settled — matched (fees recorded)
//   na      — nothing will ever settle (mock payments, refunds paid back by hand)

const isMockPayment = (order) =>
  !order.paymentId || String(order.paymentId).startsWith('pay_mock') || String(order.razorpayOrderId ?? '').startsWith('order_mock_')

function recordCapture(tx, order, { actorName = null } = {}) {
  const cod = order.paymentMethod === 'cod'
  return tx.paymentTransaction.create({
    data: {
      orderId: order.id,
      type: 'capture',
      method: cod ? 'cod' : 'online',
      amount: order.total,
      gatewayRef: cod ? null : order.paymentId,
      // COD cash is "pending" until the courier remits it to us
      settlementStatus: !cod && isMockPayment(order) ? 'na' : 'pending',
      notes: cod ? 'Cash collected on delivery' : isMockPayment(order) ? 'Mock payment (no Razorpay keys)' : '',
      actorName,
    },
  })
}

function recordRefund(tx, order, { amount, refundRef = null, actorName = null, reason = '' }) {
  const cod = order.paymentMethod === 'cod'
  return tx.paymentTransaction.create({
    data: {
      orderId: order.id,
      type: 'refund',
      method: cod ? 'cod' : 'online',
      amount,
      gatewayRef: refundRef,
      // Real Razorpay refunds come off a future settlement; COD and mock refunds never do
      settlementStatus: refundRef ? 'pending' : 'na',
      notes: [cod ? 'Paid back manually (UPI / bank transfer)' : refundRef ? '' : 'Mock refund', reason].filter(Boolean).join(' — '),
      actorName,
    },
  })
}

// Builds the log for orders placed before it existed: captures from the
// order, refunds from the order timeline. Idempotent — skips orders that
// already have entries.
async function backfillLedger(db) {
  const orders = await db.order.findMany({
    where: { payments: { none: {} } },
    include: { events: { where: { type: 'refund' }, orderBy: { createdAt: 'asc' } } },
  })
  let created = 0
  for (const o of orders) {
    const captured = o.paymentMethod === 'cod'
      ? ['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus)
      : o.paymentStatus !== 'pending'
    if (!captured) continue
    await db.paymentTransaction.create({
      data: {
        orderId: o.id, type: 'capture', method: o.paymentMethod, amount: o.total,
        gatewayRef: o.paymentMethod === 'cod' ? null : o.paymentId,
        settlementStatus: o.paymentMethod !== 'cod' && isMockPayment(o) ? 'na' : 'pending',
        notes: 'Backfilled from order', createdAt: o.createdAt,
      },
    })
    created++
    // Refund amounts are in the timeline text ("Refunded ₹100.00 (…")
    let refundedFromEvents = 0
    for (const ev of o.events) {
      const m = ev.message.match(/Refunded ₹([\d,]+(?:\.\d+)?)/)
      if (!m) continue
      const amount = Number(m[1].replace(/,/g, ''))
      refundedFromEvents += amount
      await db.paymentTransaction.create({
        data: {
          orderId: o.id, type: 'refund', method: o.paymentMethod, amount,
          gatewayRef: ev.message.match(/Razorpay (rfnd_\w+)/)?.[1] ?? null,
          settlementStatus: /Razorpay rfnd_/.test(ev.message) ? 'pending' : 'na',
          notes: 'Backfilled from order timeline', actorName: ev.actorName, createdAt: ev.createdAt,
        },
      })
      created++
    }
    // Fully refunded orders from before refunds were itemised
    if (o.paymentStatus === 'refunded' && refundedFromEvents === 0) {
      await db.paymentTransaction.create({
        data: { orderId: o.id, type: 'refund', method: o.paymentMethod, amount: o.total, settlementStatus: 'na', notes: 'Backfilled (refunded before the payment log existed)', createdAt: o.updatedAt },
      })
      created++
    }
  }
  return created
}

module.exports = { recordCapture, recordRefund, backfillLedger, isMockPayment }
