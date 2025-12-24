;(function () {
  function createFrame(opts) {
    var iframe = document.createElement('iframe')
    iframe.src = opts.src
    iframe.style.width = opts.width || '100%'
    iframe.style.height = opts.height || '760px'
    iframe.style.border = '0'
    iframe.style.borderRadius = '24px'
    iframe.style.overflow = 'hidden'
    iframe.setAttribute('allow', 'camera; clipboard-read; clipboard-write')
    iframe.setAttribute('loading', 'lazy')
    return iframe
  }

  function resolveConfig(el) {
    var src = el.getAttribute('data-src') || ''
    var api = el.getAttribute('data-api') || ''
    var theme = el.getAttribute('data-theme') || 'dark'
    var brand = el.getAttribute('data-brand') || ''
    var logo = el.getAttribute('data-logo') || ''
    var primary = el.getAttribute('data-primary') || ''
    var accent = el.getAttribute('data-accent') || ''
    var catalog = el.getAttribute('data-catalog') || ''
    var origin = el.getAttribute('data-origin') || ''

    if (!src) {
      throw new Error('SkinSense embed: missing data-src (base site URL)')
    }

    var url = new URL(src)
    url.pathname = url.pathname.replace(/\/$/, '') + '/scan'
    url.searchParams.set('embed', '1')
    url.searchParams.set('theme', theme)

    if (api) {
      url.searchParams.set('api', api)
    }

    if (brand) url.searchParams.set('brand', brand)
    if (logo) url.searchParams.set('logo', logo)
    if (primary) url.searchParams.set('primary', primary)
    if (accent) url.searchParams.set('accent', accent)
    if (catalog) url.searchParams.set('catalog', catalog)
    if (origin) url.searchParams.set('origin', origin)

    return {
      src: url.toString(),
      width: el.getAttribute('data-width') || undefined,
      height: el.getAttribute('data-height') || undefined,
    }
  }

  function mount() {
    var nodes = document.querySelectorAll('[data-skinsense-embed]')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.__skinsenseMounted) continue
      el.__skinsenseMounted = true

      var config = resolveConfig(el)
      var iframe = createFrame(config)
      el.appendChild(iframe)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    mount()
  }
})()
