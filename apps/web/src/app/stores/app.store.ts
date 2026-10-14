import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { GameMode, MapId, PublicProfile, TankId } from '@tank-online/shared'
import { authService } from '@/services/auth/auth.service'

export type AppView = 'home' | 'garage' | 'lobby' | 'profile' | 'battle'

export const useAppStore = defineStore('app', () => {
  const profile = ref<PublicProfile | null>(authService.restoreProfile())
  const view = ref<AppView>('home')
  const selectedTank = ref<TankId>((localStorage.getItem('tank_selected') as TankId) || profile.value?.favoriteTank || 'assault')
  const selectedMap = ref<MapId>((localStorage.getItem('tank_map') as MapId) || 'railworks')
  const selectedMode = ref<GameMode>((localStorage.getItem('tank_mode') as GameMode) || 'tdm')
  const authOpen = ref(!profile.value)
  const busy = ref(false)
  const error = ref('')
  const roomCode = ref('')
  const isAuthenticated = computed(() => Boolean(profile.value))

  function setTank(tankId: TankId) {
    selectedTank.value = tankId
    localStorage.setItem('tank_selected', tankId)
  }

  function setMap(mapId: MapId) {
    selectedMap.value = mapId
    localStorage.setItem('tank_map', mapId)
  }

  function setMode(mode: GameMode) {
    selectedMode.value = mode
    localStorage.setItem('tank_mode', mode)
  }

  function acceptAuth(value: PublicProfile) {
    profile.value = value
    localStorage.setItem('tank_profile', JSON.stringify(value))
    authOpen.value = false
    error.value = ''
  }

  async function logout() {
    await authService.logout()
    profile.value = null
    view.value = 'home'
    authOpen.value = true
  }

  return {
    profile, view, selectedTank, selectedMap, selectedMode, authOpen, busy, error, roomCode,
    isAuthenticated, setTank, setMap, setMode, acceptAuth, logout,
  }
})
