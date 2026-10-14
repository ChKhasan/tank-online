<script setup lang="ts">
defineProps<{ label: string; value: string | number; accent?: boolean }>()
</script>

<template>
  <div class="stat-pill" :class="{ 'is-accent': accent }">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
  </div>
</template>
