<script setup lang="ts">
import { MtCard, MtText } from '@shopware-ag/meteor-component-library'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const instanceId = computed(() => route.params.instanceId?.toString() ?? '')
</script>

<template>
  <section class="api-browser">
    <MtCard
      class="api-browser__card"
      title="API Browser Placeholder"
    >
      <template #default>
        <MtText as="p">
          This route is wired for Iteration 0 and ready for endpoint discovery in Iteration 2.
        </MtText>
        <MtText
          as="p"
          class="api-browser__instance"
        >
          Active instance id: <code>{{ instanceId || 'n/a' }}</code>
        </MtText>
      </template>
    </MtCard>
  </section>
</template>

<style scoped>
.api-browser__card {
  max-width: 920px;
}

.api-browser__instance {
  margin-top: 0.75rem;
}

code {
  background-color: #eef3ff;
  border-radius: 4px;
  padding: 0.125rem 0.25rem;
}
</style>
