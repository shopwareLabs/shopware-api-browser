export function formatJsonBody(body: string): string | null {
  const trimmed = body.trim()
  if (!trimmed) {
    return ''
  }

  try {
    return `${JSON.stringify(JSON.parse(trimmed), null, 2)}\n`
  } catch {
    return null
  }
}
