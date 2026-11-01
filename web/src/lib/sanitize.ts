import DOMPurify from 'dompurify'

// Article HTML comes from third-party sites: the server extracts it with Readability,
// and the browser sanitizes it again here before showing it.
const purify = DOMPurify(window)

purify.addHook('uponSanitizeAttribute', (node, data) => {
  // Plain http images would be blocked as mixed content anyway.
  if (node.tagName === 'IMG' && data.attrName === 'src' && !data.attrValue.startsWith('https://')) {
    data.keepAttr = false
  }
})

purify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }

  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy')
})

export const sanitizeArticle = (html: string) =>
  purify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'video', 'audio', 'svg'],
    FORBID_ATTR: ['style', 'class', 'id', 'width', 'height', 'srcset', 'sizes']
  })
