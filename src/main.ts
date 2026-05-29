import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from './plugins/i18n'
import { router } from './router'
import { ensureStorageBootstrap } from './storage/bootstrap'
import { registerGlobalErrorHandling } from './utils/error-handling'
import './style.css'
import './styles/http-method.css'
import '@shopware-ag/meteor-component-library/styles.css'
import '@shopware-ag/meteor-component-library/font.css'

const app = createApp(App)

registerGlobalErrorHandling(app)

app.use(createPinia())
app.use(i18n)
app.use(router)

ensureStorageBootstrap().finally(() => {
  app.mount('#app')
})
