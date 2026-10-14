<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useAppStore } from './stores/app.store'
import AppHeader from './layout/AppHeader.vue'
import AuthGate from '@/modules/auth/ui/AuthGate.vue'
import HomePage from '@/modules/home/ui/HomePage.vue'
import GaragePage from '@/modules/garage/ui/GaragePage.vue'
import LobbyPage from '@/modules/lobby/ui/LobbyPage.vue'
import ProfilePage from '@/modules/profile/ui/ProfilePage.vue'

const BattlePage = defineAsyncComponent(() => import('@/modules/battle/ui/BattlePage.vue'))

const store = useAppStore()
const currentPage = computed(() => ({
  home: HomePage,
  garage: GaragePage,
  lobby: LobbyPage,
  profile: ProfilePage,
  battle: BattlePage,
}[store.view]))
</script>

<template>
  <div class="app-shell" :class="{ 'is-battle': store.view === 'battle' }">
    <div class="noise-layer" />
    <AppHeader v-if="store.view !== 'battle'" />
    <main class="app-main">
      <Transition name="page" mode="out-in">
        <component :is="currentPage" :key="store.view" />
      </Transition>
    </main>
    <Transition name="modal">
      <AuthGate v-if="store.authOpen" />
    </Transition>
  </div>
</template>
