<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { TankId } from '@tank-online/shared'
import { paintTank } from '@/services/tanks/tank-art'
const props = defineProps<{ tankId: TankId }>()
const canvas = ref<HTMLCanvasElement>()
function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, 400, 240)
  ctx.save(); ctx.translate(160, 120); ctx.scale(2, 2); ctx.rotate(-0.25)
  ctx.shadowColor = '#15150eaa'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8
  paintTank(ctx, props.tankId, 'body'); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  paintTank(ctx, props.tankId, 'turret'); ctx.restore()
}
onMounted(draw)
watch(() => props.tankId, draw)
</script>
<template><canvas ref="canvas" width="400" height="240" class="tank-portrait" role="img" :aria-label="`${tankId} tanki`" /></template>
