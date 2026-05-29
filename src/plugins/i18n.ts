import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'en-GB',
  fallbackLocale: 'en-GB',
  messages: {
    'en-GB': {},
    'de-DE': {},
  },
})
