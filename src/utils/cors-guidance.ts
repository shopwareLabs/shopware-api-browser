export const BROWSER_MODE_TITLE = 'Browser-only mode'

export const CORS_GUIDANCE_SHORT =
  'This app sends requests directly from your browser. The Shopware instance must allow CORS from this origin.'

export const CORS_GUIDANCE_ACTIONABLE =
  'Ask your Shopware admin to allow this origin in CORS settings, or use a local development instance with permissive Access-Control-Allow-Origin headers.'

export const CORS_ERROR_DETAIL = `${CORS_GUIDANCE_SHORT} ${CORS_GUIDANCE_ACTIONABLE}`

export const SCHEMA_FETCH_CORS_HINT =
  'If the instance is reachable but schema loading fails, the server is likely blocking browser requests via CORS.'
