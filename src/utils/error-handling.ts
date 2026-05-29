import type { App } from 'vue'

export function registerGlobalErrorHandling(app: App<Element>): void {
  app.config.errorHandler = (error, instance, info) => {
    console.error('Unhandled Vue error', { error, instance, info })
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection', event.reason)
  })
}
