import { getSupabaseClient } from './supabaseClient'

const INVOICE_IMAGE_BUCKET = 'invoice-images'

const makeSafeFileName = (name: string) => {
  const trimmed = name.trim()
  const lastDot = trimmed.lastIndexOf('.')
  const ext =
    lastDot > -1 ? trimmed.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, '') : ''
  const base = (lastDot > -1 ? trimmed.slice(0, lastDot) : trimmed) || 'image'
  const safeBase = base
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image'
  const safeExt = ext ? `.${ext}` : ''
  return `${safeBase}${safeExt}`
}

export const uploadInvoiceImage = async (
  file: File,
  merchantId: string
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file.')
  }
  const supabase = getSupabaseClient()
  const safeName = makeSafeFileName(file.name)
  const path = `invoices/${merchantId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from(INVOICE_IMAGE_BUCKET)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
    })
  if (error) {
    throw error
  }
  const { data } = supabase.storage.from(INVOICE_IMAGE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    throw new Error('Unable to get public URL for uploaded image.')
  }
  return data.publicUrl
}

export const invoiceImageBucket = INVOICE_IMAGE_BUCKET
