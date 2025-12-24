import type { BrandConfig } from './brand'

export type EmbedEventName =
  | 'ready'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'product_clicked'

export function postEmbedEvent(
  name: EmbedEventName,
  payload: Record<string, unknown> | null,
  cfg: BrandConfig,
) {
  if (typeof window === 'undefined') return
  if (!window.parent || window.parent === window) return

  const message = {
    type: 'skinsense:event',
    name,
    payload: payload ?? {},
  }

  const origin = cfg.targetOrigin ?? '*'
  window.parent.postMessage(message, origin)
}
