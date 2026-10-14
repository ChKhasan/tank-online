<script setup lang="ts">
import { battleInput } from '../model/battle-input'
</script>

<template>
  <div class="touch-controls">
    <div class="touch-dpad">
      <button class="up" @pointerdown.prevent="battleInput.setDirection(0, -1, true)" @pointerup="battleInput.setDirection(0, -1, false)" @pointerleave="battleInput.setDirection(0, -1, false)" @pointercancel="battleInput.setDirection(0, -1, false)">▲</button>
      <button class="left" @pointerdown.prevent="battleInput.setDirection(-1, 0, true)" @pointerup="battleInput.setDirection(-1, 0, false)" @pointerleave="battleInput.setDirection(-1, 0, false)" @pointercancel="battleInput.setDirection(-1, 0, false)">◀</button>
      <button class="right" @pointerdown.prevent="battleInput.setDirection(1, 0, true)" @pointerup="battleInput.setDirection(1, 0, false)" @pointerleave="battleInput.setDirection(1, 0, false)" @pointercancel="battleInput.setDirection(1, 0, false)">▶</button>
      <button class="down" @pointerdown.prevent="battleInput.setDirection(0, 1, true)" @pointerup="battleInput.setDirection(0, 1, false)" @pointerleave="battleInput.setDirection(0, 1, false)" @pointercancel="battleInput.setDirection(0, 1, false)">▼</button>
    </div>
    <div class="touch-actions">
      <button class="fire" @pointerdown.prevent="battleInput.fire = true" @pointerup="battleInput.fire = false" @pointercancel="battleInput.fire = false" @pointerleave="battleInput.fire = false">FIRE</button>
    </div>
  </div>
</template>
