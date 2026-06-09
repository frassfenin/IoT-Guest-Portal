export function capitalizeFirst(str) {
  if (!str) return ''
  const trimmed = str.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function sanitizeEntityIdForHtml(entityId) {
  return entityId.replace(/\./g, '-')
}
