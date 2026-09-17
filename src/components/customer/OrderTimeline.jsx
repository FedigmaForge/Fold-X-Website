import { Fragment } from 'react'
import { Check, X, Clock, Package, Truck, Home } from 'lucide-react'

const STEPS = [
  { key: 'pending',    label: 'Order Placed', icon: Clock },
  { key: 'processing', label: 'Processing',   icon: Package },
  { key: 'shipped',    label: 'Shipped',      icon: Truck },
  { key: 'delivered',  label: 'Delivered',    icon: Home },
]

export default function OrderTimeline({ status, compact = false }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-sm font-sans text-red-500">
        <X size={16} /> This order was cancelled
      </div>
    )
  }

  const currentIndex = STEPS.findIndex((s) => s.key === status)
  const activeIndex = currentIndex === -1 ? 0 : currentIndex
  // "Delivered" is both a step and the terminal state — once reached, every
  // step (including this one) is complete, not merely "in progress".
  const isFullyDelivered = status === 'delivered'
  const circleSize = compact ? 'w-6 h-6' : 'w-9 h-9'

  return (
    <div>
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < activeIndex || (isFullyDelivered && i === activeIndex)
          const current = i === activeIndex && !done
          const Icon = step.icon
          return (
            <Fragment key={step.key}>
              <div
                className={`flex items-center justify-center rounded-full border shrink-0 ${circleSize} ${
                  done ? 'bg-brown border-brown text-cream'
                  : current ? 'border-brown text-brown'
                  : 'border-border text-brown-mid/40'
                }`}
              >
                {done ? <Check size={compact ? 12 : 15} /> : <Icon size={compact ? 12 : 15} />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < activeIndex ? 'bg-brown' : 'bg-border'}`} />
              )}
            </Fragment>
          )
        })}
      </div>
      {!compact && (
        <div className="grid mt-2" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
          {STEPS.map((step, i) => (
            <span
              key={step.key}
              className={`text-[10px] tracking-wide font-sans uppercase ${i === 0 ? 'text-left' : i === STEPS.length - 1 ? 'text-right' : 'text-center'} ${
                i === activeIndex ? 'text-brown' : i < activeIndex ? 'text-brown-mid' : 'text-brown-mid/40'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
