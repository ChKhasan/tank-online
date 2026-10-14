<script setup lang="ts">
import { computed, ref } from 'vue'
import { TANKS } from '@tank-online/shared'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useAppStore } from '@/app/stores/app.store'
import { authService } from '@/services/auth/auth.service'

const store = useAppStore()
const nickname = ref(store.profile?.nickname ?? '')
const saved = ref('')
const winRate = computed(() => store.profile?.matches ? Math.round(store.profile.wins / store.profile.matches * 100) : 0)

async function save() {
  if (!store.profile) return
  try {
    const profile = await authService.updateProfile({ nickname: nickname.value, favoriteTank: store.selectedTank })
    store.acceptAuth(profile)
    saved.value = 'Profil saqlandi.'
  } catch (error) { saved.value = error instanceof Error ? error.message : 'Saqlanmadi.' }
}
</script>

<template>
  <section class="profile-page">
    <header class="page-heading"><div><span class="eyebrow">COMMANDER RECORD</span><h1>Shaxsiy dosye</h1></div><BaseButton variant="danger" @click="store.logout">CHIQISH</BaseButton></header>
    <div v-if="store.profile" class="profile-grid">
      <article class="commander-card"><div class="commander-card__rank">{{ store.profile.nickname.slice(0, 2).toUpperCase() }}</div><span class="eyebrow">FIELD COMMANDER</span><h2>{{ store.profile.nickname }}</h2><p>{{ store.profile.email ?? 'Guest protokoli' }}</p><div class="level-track"><span :style="{ width: `${store.profile.xp % 100}%` }" /></div><footer><b>LEVEL {{ store.profile.level }}</b><span>{{ store.profile.xp }} XP</span></footer></article>
      <article class="profile-stats"><div><strong>{{ store.profile.matches }}</strong><span>JANGLAR</span></div><div><strong>{{ store.profile.wins }}</strong><span>G‘ALABA</span></div><div><strong>{{ winRate }}%</strong><span>WIN RATE</span></div><div><strong>{{ store.profile.credits }}</strong><span>KREDIT</span></div></article>
      <article class="profile-form"><span class="eyebrow">PROFIL SOZLAMALARI</span><label>CALLSIGN<input v-model="nickname" maxlength="16" /></label><label>SEVIMLI TANK<input :value="TANKS[store.selectedTank].name" disabled /></label><BaseButton @click="save">SAQLASH</BaseButton><p class="connection-note">{{ saved }}</p></article>
      <article class="service-record"><span class="eyebrow">SERVICE RECORD</span><div class="record-line"><i /><span>Akkaunt yaratildi</span><b>ACTIVE</b></div><div class="record-line"><i /><span>Frontline ruxsati</span><b>GRANTED</b></div><div class="record-line"><i /><span>Ranked protokoli</span><b>LOCKED</b></div></article>
    </div>
  </section>
</template>
