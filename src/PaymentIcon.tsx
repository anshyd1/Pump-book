export type PaymentKind = 'udhari' | 'paytm' | 'fcard' | 'phonepe' | 'bank' | 'kharche' | 'cash' | 'other'

export default function PaymentIcon({ kind }: { kind: PaymentKind }) {
  if (kind === 'paytm') return <span className="payment-logo paytm-logo" aria-label="Paytm"><i>pay</i><b>tm</b></span>
  if (kind === 'phonepe') return <span className="payment-logo phonepe-logo" aria-label="PhonePe"><b>पे</b></span>
  return <span className={`payment-logo ${kind}-logo`} aria-hidden="true">
    {kind === 'cash' && <svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M8 9h8M9 12h6M10 15h4"/></svg>}
    {kind === 'bank' && <svg viewBox="0 0 24 24"><path d="M3 9h18L12 3 3 9Zm2 2v7m4-7v7m6-7v7m4-7v7M3 21h18"/></svg>}
    {kind === 'fcard' && <svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M3 9h18M7 15h5"/></svg>}
    {kind === 'udhari' && <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6m-6 4h6"/></svg>}
    {kind === 'kharche' && <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8m-8 4h5"/><path d="m14 15 4 4m0-4-4 4"/></svg>}
    {kind === 'other' && <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8m-4-4v8"/></svg>}
  </span>
}
