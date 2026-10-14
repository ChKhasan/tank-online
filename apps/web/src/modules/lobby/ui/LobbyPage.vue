<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MAP_LIST, type GameMode, type MapId, type RoomSummary } from '@tank-online/shared'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useAppStore } from '@/app/stores/app.store'
import { matchService } from '@/services/match/match.service'
import { SessionExpiredError } from '@/services/auth/auth.service'

const store = useAppStore()
const rooms = ref<RoomSummary[]>([])
const code = ref('')
const message = ref('')

async function refresh() {
  try { rooms.value = await matchService.listRooms() }
  catch { message.value = 'Server offline yoki xona ro‘yxati olinmadi.' }
}

async function enter(action: 'quick' | 'private' | 'code', roomId?: string) {
  if (!store.profile) return (store.authOpen = true)
  store.busy = true
  message.value = 'Serverga ulanmoqda...'
  try {
    if (roomId) await matchService.joinByCode(roomId, store.selectedTank, store.selectedMap, store.selectedMode)
    else if (action === 'private') await matchService.createPrivate(store.selectedTank, store.selectedMap, store.selectedMode)
    else if (action === 'code') await matchService.joinByCode(code.value, store.selectedTank, store.selectedMap, store.selectedMode)
    else await matchService.quickMatch(store.selectedTank, store.selectedMap, store.selectedMode)
    store.roomCode = matchService.activeRoom?.roomId ?? ''
    store.view = 'battle'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Ulanish xatosi.'
    if (error instanceof SessionExpiredError) store.authOpen = true
  } finally { store.busy = false }
}

onMounted(refresh)
</script>

<template>
  <section class="lobby-page">
    <header class="page-heading">
      <div><span class="eyebrow">FIELD OPERATIONS DESK</span><h1>Front xaritasi</h1></div>
      <BaseButton variant="ghost" @click="refresh">RO‘YXATNI YANGILASH</BaseButton>
    </header>
    <div class="lobby-layout">
      <aside class="mission-config">
        <span class="section-label"><span>JANG BUYRUG‘I</span><b>A</b></span>
        <label>REJIM<select :value="store.selectedMode" @change="store.setMode(($event.target as HTMLSelectElement).value as GameMode)"><option value="tdm">Team Deathmatch</option><option value="base_capture">Base Capture</option></select></label>
        <label>XARITA<select :value="store.selectedMap" @change="store.setMap(($event.target as HTMLSelectElement).value as MapId)"><option v-for="map in MAP_LIST" :key="map.id" :value="map.id">{{ map.name }}</option></select></label>
        <div class="room-actions">
          <BaseButton size="lg" :disabled="store.busy" @click="enter('quick')">GLOBAL MATCH</BaseButton>
          <BaseButton variant="secondary" @click="enter('private')">PRIVATE XONA YARATISH</BaseButton>
        </div>
        <div class="code-entry"><label>XONA KODI<input v-model="code" maxlength="6" placeholder="A7K9QX" /></label><BaseButton variant="ghost" @click="enter('code')">KIRISH</BaseButton></div>
        <p v-if="message" class="connection-note">{{ message }}</p>
      </aside>
      <div class="room-browser">
        <div class="room-browser__head"><span>OCHIQ OPERATSIYALAR</span><span>{{ rooms.length }} SIGNAL</span></div>
        <div v-if="rooms.length" class="room-list">
          <article v-for="room in rooms" :key="room.roomId" class="room-row">
            <span class="status-beacon" /><div><small>{{ room.roomId }}</small><strong>{{ room.mapId.replace('_', ' ') }}</strong></div><span>{{ room.mode === 'tdm' ? 'TDM' : 'CAPTURE' }}</span><span>{{ room.clients }}/{{ room.maxClients }}</span><span>{{ room.phase }}</span><BaseButton size="sm" @click="enter('quick', room.roomId)">JOIN</BaseButton>
          </article>
        </div>
        <div v-else class="empty-radar"><div class="radar"><span /><span /><span /><i /></div><h3>Ochiq xona topilmadi</h3><p>Birinchi jangni siz boshlashingiz mumkin.</p></div>
      </div>
    </div>
  </section>
</template>
