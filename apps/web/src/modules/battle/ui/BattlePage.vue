<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type Phaser from 'phaser'
import { MAPS, TANKS, WORLD_SIZE, type BattleEvent, type TankId, type MapId } from '@tank-online/shared'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useAppStore } from '@/app/stores/app.store'
import { matchService } from '@/services/match/match.service'
import { createBattleGame } from '../model/create-battle-game'
import TouchControls from './TouchControls.vue'
import { battleInput } from '../model/battle-input'

const store = useAppStore()
const host = ref<HTMLElement | null>(null)
const connection = ref('connected')
const feed = ref<{ id: number; text: string }[]>([])
const now = ref(Date.now())
const zoom = ref(90)
const performanceStats = reactive({ fps: 0, ping: 0, frameP95: 0, updateMs: 0, renderMs: 0, renderer: '' })
let lastHudAt = 0
const mapId = ref<MapId>(store.selectedMap)
const mapPlayers = ref<{ id: string; x: number; y: number; team: string; local: boolean }[]>([])
const alive = ref(true)
const activeUntil = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined
const hud = reactive({ phase: 'waiting', time: 0, azure: 0, ember: 0, hp: 0, maxHp: 1, abilityReadyAt: 0, nickname: '', tankId: store.selectedTank as TankId, players: 0, captureAzure: 0, captureEmber: 0 })
let game: Phaser.Game | null = null
let eventId = 0
let unsubscribeState: (() => boolean) | undefined
let unsubscribeEvent: (() => boolean) | undefined
let unsubscribeStatus: (() => boolean) | undefined

const timeLabel = computed(() => `${String(Math.floor(hud.time / 60000)).padStart(2, '0')}:${String(Math.floor(hud.time / 1000) % 60).padStart(2, '0')}`)
const hpPercent = computed(() => Math.max(0, hud.hp / hud.maxHp * 100))
const abilityPercent = computed(() => {
  const config = TANKS[hud.tankId] ?? TANKS.assault
  return Math.min(100, Math.max(0, (1 - (hud.abilityReadyAt - now.value) / config.abilityCooldownMs) * 100))
})
const abilitySeconds = computed(() => Math.max(0, Math.ceil((hud.abilityReadyAt - now.value) / 1000)))
const phaseLabel = computed(() => hud.phase === 'waiting' ? 'O‘YINCHI KUTILMOQDA' : hud.phase === 'countdown' ? 'JANGGA TAYYORLANING' : hud.phase === 'finished' ? 'JANG TUGADI' : store.selectedMode === 'tdm' ? '40 KILLGACHA' : 'BAZANI EGALLANG')

function onEvent(event: BattleEvent) {
  const text = event.type === 'destroyed' ? 'Tank yo‘q qilindi' : event.type === 'ability' ? `${event.label} faollashdi` : event.type === 'matchEnded' ? `Jang yakuni: ${event.label}` : event.type === 'ping' ? `${event.label}!` : ''
  if (!text) return
  const id = ++eventId
  feed.value.unshift({ id, text })
  feed.value = feed.value.slice(0, 4)
  window.setTimeout(() => { feed.value = feed.value.filter((item) => item.id !== id) }, 4200)
}

async function exitBattle() {
  await matchService.leave()
  store.view = 'home'
}

onMounted(() => {
  if (!matchService.activeRoom) { store.view = 'home'; return }
  game = createBattleGame(host.value!)
  ticker = setInterval(() => {
    now.value = Date.now(); zoom.value = battleInput.zoom
    performanceStats.fps = battleInput.fps; performanceStats.frameP95 = battleInput.frameP95; performanceStats.ping = matchService.clock.rtt
    performanceStats.updateMs = battleInput.updateMs; performanceStats.renderMs = battleInput.renderMs
    performanceStats.renderer = battleInput.renderer
  }, 100)
  unsubscribeState = matchService.subscribeState((state, sessionId) => {
    const receivedAt = performance.now()
    if (receivedAt - lastHudAt < 100) return
    lastHudAt = receivedAt
    const player = state.players?.get(sessionId)
    if (MAPS[state.mapId as MapId]) mapId.value = state.mapId
    mapPlayers.value = Array.from(state.players?.entries() ?? []).filter((entry: any) => entry[1].alive).map((entry: any) => ({ id: entry[0], x: entry[1].x, y: entry[1].y, team: entry[1].team, local: entry[0] === sessionId }))
    if (player) { alive.value = player.alive; activeUntil.value = player.abilityActiveUntil }
    hud.phase = state.phase; hud.time = state.timeRemainingMs; hud.azure = state.azureScore; hud.ember = state.emberScore
    hud.players = state.players?.size ?? 0; hud.captureAzure = state.captureAzure; hud.captureEmber = state.captureEmber
    if (player) { hud.hp = player.hp; hud.maxHp = player.maxHp; hud.abilityReadyAt = player.abilityReadyAt; hud.nickname = player.nickname; hud.tankId = player.tankId }
  })
  unsubscribeEvent = matchService.subscribeEvent(onEvent)
  unsubscribeStatus = matchService.subscribeStatus((value) => { connection.value = value })
})

onBeforeUnmount(() => {
  unsubscribeState?.(); unsubscribeEvent?.(); unsubscribeStatus?.(); game?.destroy(true); game = null
  clearInterval(ticker)
})
</script>

<template>
  <section class="battle-page">
    <div ref="host" class="battle-canvas" />
    <div class="battle-vignette" />
    <header class="battle-topbar">
      <div class="battle-brand"><span class="brand__mark"><i /><i /><i /></span><strong>ARMORED FRONT</strong></div>
      <div class="battle-score azure"><span>BLUE</span><strong>{{ hud.azure }}</strong></div>
      <div class="battle-timer"><small>{{ phaseLabel }}</small><strong>{{ hud.phase === 'countdown' ? Math.ceil((matchService.activeRoom?.state?.countdownMs ?? 0) / 1000) : timeLabel }}</strong><span>{{ hud.players }}/16 ONLINE</span></div>
      <div class="battle-score ember"><strong>{{ hud.ember }}</strong><span>RED</span></div>
      <BaseButton variant="ghost" size="sm" @click="exitBattle">CHIQISH</BaseButton>
    </header>
    <div class="connection-badge" :class="connection"><span />{{ connection.toUpperCase() }} · <output aria-label="O‘yin unumdorligi" :data-renderer="performanceStats.renderer" :data-fps="performanceStats.fps" :data-p95="performanceStats.frameP95" :data-update-ms="performanceStats.updateMs" :data-render-ms="performanceStats.renderMs" :title="`${performanceStats.renderer} / frame p95: ${performanceStats.frameP95} ms / update: ${performanceStats.updateMs} ms / render CPU: ${performanceStats.renderMs} ms`">{{ performanceStats.fps }} FPS · {{ performanceStats.ping }} MS</output></div>
    <div class="room-code">ROOM <b>{{ store.roomCode }}</b></div>
    <div class="kill-feed"><TransitionGroup name="feed"><div v-for="item in feed" :key="item.id">{{ item.text }}</div></TransitionGroup></div>
    <aside class="battle-minimap">
      <svg class="tactical-map" :viewBox="`0 0 ${WORLD_SIZE} ${WORLD_SIZE}`" aria-label="Jonli jang xaritasi">
        <rect width="6144" height="6144" fill="#56543e" />
        <g v-memo="[mapId]"><rect v-for="o in MAPS[mapId].obstacles" :key="o.id" :x="o.x - o.width / 2" :y="o.y - o.height / 2" :width="o.width" :height="o.height" fill="#a29471" /></g>
        <circle :cx="MAPS[mapId].baseAzure[0]" :cy="MAPS[mapId].baseAzure[1]" r="300" fill="none" stroke="#9ec1cd" stroke-width="60" />
        <circle :cx="MAPS[mapId].baseEmber[0]" :cy="MAPS[mapId].baseEmber[1]" r="300" fill="none" stroke="#d38973" stroke-width="60" />
        <circle v-for="p in mapPlayers" :key="p.id" :cx="p.x" :cy="p.y" :r="p.local ? 130 : 90" :fill="p.local ? '#fff1b1' : p.team === 'azure' ? '#92bac9' : '#d87b64'" />
      </svg>
      <span>{{ MAPS[mapId].name }}</span>
    </aside>
    <div class="zoom-controls" role="group" aria-label="Kamera zoom">
      <button aria-label="Zoom out" @click="battleInput.zoomStep = -1">−</button><output aria-label="Zoom darajasi">{{ zoom }}%</output><button aria-label="Zoom in" @click="battleInput.zoomStep = 1">+</button>
    </div>
    <footer class="battle-hud">
      <div class="tank-status"><span class="tank-status__icon">{{ TANKS[hud.tankId].name.slice(0, 1) }}</span><div><small>{{ hud.nickname || 'COMMANDER' }} / {{ TANKS[hud.tankId].name }}</small><strong>{{ Math.ceil(hud.hp) }} <em>/ {{ hud.maxHp }} HP</em></strong><div class="hp-bar"><span :style="{ width: `${hpPercent}%` }" /></div></div></div>
      <button class="ability-status ability-trigger" :disabled="abilitySeconds > 0 || !alive || hud.phase === 'finished'" :title="TANKS[hud.tankId].abilityDescription" aria-label="Maxsus qobiliyat (Q)" @click="battleInput.pulseAbility()"><div class="ability-ring" :style="{ '--ready': `${abilityPercent * 3.6}deg` }"><span>{{ abilitySeconds > 0 ? `${abilitySeconds}s` : 'Q' }}</span></div><div><small>Q — MAXSUS QOBILIYAT</small><strong>{{ TANKS[hud.tankId].abilityName }}</strong><span>{{ activeUntil > now ? 'FAOL' : abilitySeconds === 0 ? 'TAYYOR · BOSING' : 'QAYTA ZARYAD' }}</span></div></button>
      <div class="control-hint"><span><b>WASD</b> HARAKAT</span><span><b>SCROLL</b> ZOOM</span><span><b>LMB</b> O‘Q</span></div>
    </footer>
    <TouchControls />
  </section>
</template>
