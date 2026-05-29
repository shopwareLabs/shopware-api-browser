export interface ConnectionTestResult {
  ok: boolean
  message: string
}

const CONNECTION_TEST_TIMEOUT_MS = 8000

export async function testInstanceConnection(baseUrl: string): Promise<ConnectionTestResult> {
  const timeoutController = new AbortController()
  const timeout = window.setTimeout(() => {
    timeoutController.abort()
  }, CONNECTION_TEST_TIMEOUT_MS)

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/api/_info/openapi3.json`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: timeoutController.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        message: `Failed with status ${response.status}. Check URL, credentials, and CORS.`,
      }
    }

    return {
      ok: true,
      message: 'Connection successful.',
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        message: 'Connection timed out. Check network and instance availability.',
      }
    }

    return {
      ok: false,
      message: 'Connection failed. Check CORS and network reachability.',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}
