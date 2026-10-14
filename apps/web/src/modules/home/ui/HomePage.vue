<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAPS, TANKS } from '@tank-online/shared'
import BaseButton from '@/shared/ui/BaseButton.vue'
import StatPill from '@/shared/ui/StatPill.vue'
import { useAppStore } from '@/app/stores/app.store'
import { matchService } from '@/services/match/match.service'

const store = useAppStore()
const status = ref('')
const tank = computed(() => TANKS[store.selectedTank])
const map = computed(() => MAPS[store.selectedMap])

async function deploy() {
  if (!store.profile) {
    store.authOpen = true
    return
  }
  store.busy = true
  status.value = 'Eng yaxshi jang qidirilmoqda...'
  try {
    await matchService.quickMatch(store.selectedTank, store.selectedMap, store.selectedMode)
    store.roomCode = matchService.activeRoom?.roomId ?? ''
    store.view = 'battle'
  } catch (error) {
    status.value = error instanceof Error ? error.message : 'Serverga ulanib bo‘lmadi.'
  } finally {
    store.busy = false
  }
}
</script>

<template>
  <section class="home-page">
    <div class="home-page__grid">
      <article class="command-hero">
        <div class="command-hero__topline"><span>FIELD DISPATCH</span><b>SECTOR 07 / 06:40</b></div>
        <div class="command-hero__copy">
          <span class="eyebrow">OPERATION // STEEL THUNDER</span>
          <h1>FRONTGA<br><em>CHIQING.</em></h1>
          <p>Loy, tutun va zang orasidagi katta jang maydoni. Ekipajingizni tanlang — bu yerda har bir tankni haqiqiy odam boshqaradi.</p>
          <div class="hero-actions">
            <BaseButton size="lg" :disabled="store.busy" @click="deploy">{{ store.busy ? 'QIDIRILMOQDA...' : 'TEZKOR JANG' }}</BaseButton>
            <BaseButton variant="secondary" size="lg" @click="store.view = 'lobby'">XONA TANLASH</BaseButton>
          </div>
          <p v-if="status" class="connection-note">{{ status }}</p>
        </div>
        <div class="hero-tank" :style="{ '--tank-accent': tank.accentCss }">
          <div class="hero-tank__rings"><i /><i /><i /></div>
          <div class="hero-tank__shadow" />
          <div class="hero-tank__tracks"><i /><i /></div>
          <div class="hero-tank__body"><span /></div>
          <div class="hero-tank__turret"><i /></div>
          <div class="hero-tank__tag"><small>ACTIVE CREW</small><strong>{{ tank.name }}</strong><span>{{ tank.role }}</span></div>
        </div>
        <div class="command-hero__bottom">
          <StatPill label="ARENA" :value="map.name" />
          <StatPill label="MODE" :value="store.selectedMode === 'tdm' ? 'TEAM DEATHMATCH' : 'BASE CAPTURE'" />
          <StatPill label="CAPACITY" value="8 VS 8" accent />
        </div>
      </article>

      <aside class="mission-rail">
        <div class="section-label"><span>DEPLOYMENT</span><b>01</b></div>
        <article class="loadout-card" @click="store.view = 'garage'">
          <span class="loadout-card__index">T–{{ String(Object.keys(TANKS).indexOf(store.selectedTank) + 1).padStart(2, '0') }}</span>
          <small>TANLANGAN TANK</small>
          <h2>{{ tank.name }}</h2>
          <p>{{ tank.description }}</p>
          <div class="meter"><span :style="{ width: `${tank.maxHp / 16}%` }" /></div>
          <footer><b>{{ tank.maxHp }} HP</b><b>{{ tank.speed }} SPD</b><b>{{ tank.damage }} DMG</b></footer>
        </article>
        <article class="intel-card">
          <div><span class="live-dot" /> FRONT INTEL</div>
          <h3>Faqat haqiqiy ekipajlar.</h3>
          <p>Jang boshlanishi uchun kamida ikki real komandir kerak. Yolg‘iz bo‘lsangiz safarbarlik hududi ochiq qoladi.</p>
        </article>
        <div class="mini-stats">
          <div><strong>06K</strong><span>KENG FRONT</span></div>
          <div><strong>10</strong><span>MAXSUS TANK</span></div>
          <div><strong>20</strong><span>SERVER TICK</span></div>
        </div>
      </aside>
    </div>
  </section>
</template>
