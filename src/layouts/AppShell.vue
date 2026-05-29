<script setup lang="ts">
import { MtButton, MtSnackbar, MtThemeProvider, MtText } from '@shopware-ag/meteor-component-library'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() =>
  route.name === 'api-browser' ? 'Shopware API Browser' : 'Shopware Instances',
)
</script>

<template>
  <MtThemeProvider>
    <div class="app-shell">
      <header class="app-shell__header">
        <div>
          <MtText
            as="p"
            size="xs"
            class="app-shell__eyebrow"
          >
            Shopware API Client Tool
          </MtText>
          <h1>{{ title }}</h1>
        </div>

        <nav class="app-shell__nav">
          <RouterLink to="/">
            <MtButton
              size="small"
              variant="secondary"
            >
              Instances
            </MtButton>
          </RouterLink>
        </nav>
      </header>

      <main class="app-shell__main">
        <RouterView />
      </main>

      <MtSnackbar />
    </div>
  </MtThemeProvider>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.app-shell__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #d5dde7;
  background-color: #fff;
}

.app-shell__eyebrow {
  margin: 0 0 0.25rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #52667a;
}

h1 {
  margin: 0.25rem 0 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.app-shell__nav a {
  text-decoration: none;
}

.app-shell__main {
  padding: 1.5rem 2rem 2rem;
}
</style>
