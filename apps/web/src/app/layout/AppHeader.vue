<script setup lang="ts">
import { useAppStore, type AppView } from '../stores/app.store'

const store = useAppStore()
const nav: { id: AppView; label: string; short: string }[] = [
  { id: 'home', label: 'Shtab', short: '01' },
  { id: 'garage', label: 'Angar', short: '02' },
  { id: 'lobby', label: 'Janglar', short: '03' },
  { id: 'profile', label: 'Dosye', short: '04' },
]
</script>

<template>
  <header class="app-header">
    <button class="brand" @click="store.view = 'home'">
      <span class="brand__mark"><i /><i /><i /></span>
      <span><strong>TANK</strong><small>ARMORED FRONT / 1944</small></span>
    </button>
    <nav class="primary-nav" aria-label="Asosiy navigatsiya">
      <button v-for="item in nav" :key="item.id" :class="{ active: store.view === item.id }" @click="store.view = item.id">
        <em>{{ item.short }}</em><span>{{ item.label }}</span>
      </button>
    </nav>
    <button v-if="store.profile" class="profile-chip" @click="store.view = 'profile'">
      <span class="profile-chip__avatar">{{ store.profile.nickname.slice(0, 2).toUpperCase() }}</span>
      <span><strong>{{ store.profile.nickname }}</strong><small>LVL {{ store.profile.level }} · {{ store.profile.credits }} CR</small></span>
    </button>
    <button v-else class="profile-chip" @click="store.authOpen = true">KIRISH</button>
  </header>
</template>
