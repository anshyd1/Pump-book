export type PaymentKind = 'udhari' | 'paytm' | 'fcard' | 'phonepe' | 'bank' | 'kharche' | 'cash' | 'other'

const labels: Record<PaymentKind, string> = {
  udhari: 'Udhari ledger', paytm: 'Paytm', fcard: 'F-Card', phonepe: 'PhonePe',
  bank: 'Bank transfer', kharche: 'Expenses', cash: 'Cash', other: 'Other adjustment'
}

export default function PaymentIcon({ kind }: { kind: PaymentKind }) {
  return <span className={`payment-logo ${kind}-logo`}>
    <img src={`${import.meta.env.BASE_URL}payment-icons/${kind}.svg`} alt={labels[kind]} />
  </span>
}
