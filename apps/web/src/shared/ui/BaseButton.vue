<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'primary', size: 'md', type: 'button' })

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button class="base-button" :class="[`is-${variant}`, `is-${size}`]" :type="type" :disabled="disabled" @click="$emit('click', $event)">
    <span class="base-button__glint" />
    <slot />
  </button>
</template>
