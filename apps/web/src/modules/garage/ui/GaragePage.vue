<script setup lang="ts">
import { computed } from 'vue'
import { TANK_LIST, TANKS, type TankId } from '@tank-online/shared'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useAppStore } from '@/app/stores/app.store'
import TankPreview from './TankPreview.vue'

const store = useAppStore()
const selected = computed(() => TANKS[store.selectedTank])
const select = (id: TankId) => store.setTank(id)
</script>

<template>
  <section class="garage-page">
    <header class="page-heading">
      <div><span class="eyebrow">ARMORED REGIMENT / 10 VEHICLES</span><h1>Tank angari</h1></div>
      <p>Har bir mashina front sharoitiga mos oddiy qurol va o‘ziga xos taktik qobiliyat bilan jihozlangan.</p>
    </header>
    <div class="garage-layout">
      <div class="tank-roster">
        <button v-for="(tank, index) in TANK_LIST" :key="tank.id" class="tank-card" :class="{ active: tank.id === store.selectedTank }" :style="{ '--tank-accent': tank.accentCss }" @click="select(tank.id)">
          <span class="tank-card__number">{{ String(index + 1).padStart(2, '0') }}</span>
          <TankPreview :tank-id="tank.id" />
          <div class="tank-card__copy"><small>{{ tank.role }}</small><strong>{{ tank.name }}</strong><em>{{ tank.abilityName }}</em></div>
        </button>
      </div>
      <aside class="tank-inspector" :style="{ '--tank-accent': selected.accentCss }">
        <div class="tank-inspector__visual">
          <div class="blueprint-grid" />
          <TankPreview :tank-id="selected.id" />
        </div>
        <span class="eyebrow">{{ selected.role }} PLATFORM</span>
        <h2>{{ selected.name }}</h2>
        <p>{{ selected.description }}</p>
        <div class="spec-list">
          <div><span>HIMOYA</span><b>{{ selected.maxHp }}</b><i><em :style="{ width: `${selected.maxHp / 16}%` }" /></i></div>
          <div><span>TEZLIK</span><b>{{ selected.speed }}</b><i><em :style="{ width: `${selected.speed / 2.2}%` }" /></i></div>
          <div><span>ZARAR</span><b>{{ selected.damage }}</b><i><em :style="{ width: `${selected.damage / 3.5}%` }" /></i></div>
        </div>
        <article class="ability-box"><small>Q — MAXSUS QOBILIYAT</small><strong>{{ selected.abilityName }}</strong><p>{{ selected.abilityDescription }}</p><span>{{ selected.abilityCooldownMs / 1000 }}s COOLDOWN</span></article>
        <BaseButton size="lg" @click="store.view = 'home'">LOADOUTNI TASDIQLASH</BaseButton>
      </aside>
    </div>
  </section>
</template>
