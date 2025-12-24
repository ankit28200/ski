import type { CatalogProduct } from './catalog'
import type { AnalysisAnswers, AnalysisResponse, ChatTurn, DoctorChatResponse } from './types'

function apiBase(): string {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('api')
    if (fromUrl && fromUrl.trim().length > 0) {
      return fromUrl.replace(/\/$/, '')
    }
  }

  const fromEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '')
  }

  return '/api'
}

export async function analyzeSkin(params: {
  images: Blob[]
  answers: AnalysisAnswers
  debug?: boolean
}): Promise<AnalysisResponse> {
  const { images, answers, debug } = params

  const form = new FormData()
  images.forEach((blob, idx) => {
    const file = new File([blob], `scan-${idx + 1}.jpg`, {
      type: blob.type || 'image/jpeg',
    })
    form.append('images', file)
  })

  form.append('answers', JSON.stringify(answers))
  form.append('debug', debug ? 'true' : 'false')

  const base = apiBase()
  const url = `${base}/analyze`

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: string }
      if (data.detail) message = data.detail
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new Error(message)
  }

  return (await res.json()) as AnalysisResponse
}

export async function doctorChat(params: {
  message: string
  history?: ChatTurn[]
  analysis?: AnalysisResponse
  products?: CatalogProduct[]
  userName?: string
  image?: Blob | null
}): Promise<DoctorChatResponse> {
  const { message, history, analysis, products, userName, image } = params

  const form = new FormData()
  form.append('message', message)
  if (history && history.length > 0) {
    form.append('history', JSON.stringify(history))
  }
  if (analysis) {
    form.append('analysis', JSON.stringify(analysis))
  }
  if (products && products.length > 0) {
    form.append('products', JSON.stringify(products.slice(0, 12)))
  }
  if (userName && userName.trim().length > 0) {
    form.append('user_name', userName.trim())
  }
  if (image) {
    const file = new File([image], 'chat-image.jpg', { type: image.type || 'image/jpeg' })
    form.append('image', file)
  }

  const base = apiBase()
  const url = `${base}/chat`
  const res = await fetch(url, { method: 'POST', body: form })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: string }
      if (data.detail) message = data.detail
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = text
    }
    throw new Error(message)
  }

  return (await res.json()) as DoctorChatResponse
}
