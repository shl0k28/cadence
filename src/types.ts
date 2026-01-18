export type Role = 'merchant' | 'customer'

export type Profile = {
  id: string
  address: string
  role: Role
  seller_name: string | null
}

export type InvoiceStatus = 'open' | 'paid' | 'void' | 'expired'

export type Invoice = {
  id: string
  merchant_id: string
  status: InvoiceStatus
  amount_usd: string
  token_address: string
  token_symbol: string
  token_decimals: number
  title: string
  description: string | null
  image_url: string | null
  invoice_display_id: string | null
  customer_address: string | null
  paid_tx_hash: string | null
  paid_at: string | null
}
