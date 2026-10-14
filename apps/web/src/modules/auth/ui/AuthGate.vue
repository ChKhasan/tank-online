<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { useAppStore } from '@/app/stores/app.store'
import { authService } from '@/services/auth/auth.service'

const store = useAppStore()
const tab = ref<'guest' | 'login' | 'register'>('guest')
const nickname = ref('Commander')
const email = ref('')
const password = ref('')

async function submit() {
  store.busy = true
  store.error = ''
  try {
    const result = tab.value === 'guest'
      ? await authService.guest(nickname.value)
      : tab.value === 'login'
        ? await authService.login(email.value, password.value)
        : await authService.register(email.value, password.value, nickname.value)
    store.acceptAuth(result.profile)
  } catch (error) {
    store.error = error instanceof Error ? error.message : 'Kirish bajarilmadi.'
  } finally {
    store.busy = false
  }
}
</script>

<template>
  <div class="auth-backdrop">
    <section class="auth-card" aria-modal="true" role="dialog">
      <div class="auth-card__visual">
        <div class="radar"><span /><span /><span /><i /></div>
        <p>FIELD ENLISTMENT</p>
        <h1>FRONT<br><em>SIZNI KUTMOQDA</em></h1>
        <div class="auth-card__facts">
          <span>16 REAL CREWS</span><span>NO BOTS</span><span>20HZ COMMAND</span>
        </div>
      </div>
      <div class="auth-card__form">
        <button v-if="store.profile" class="auth-close" aria-label="Yopish" @click="store.authOpen = false">×</button>
        <span class="eyebrow">FIELD PERSONNEL OFFICE</span>
        <h2>Ekipajga qo‘shiling</h2>
        <p class="muted">Guest sifatida tez kiring yoki progress uchun akkaunt yarating.</p>
        <div class="segmented">
          <button :class="{ active: tab === 'guest' }" @click="tab = 'guest'">Guest</button>
          <button :class="{ active: tab === 'login' }" @click="tab = 'login'">Login</button>
          <button :class="{ active: tab === 'register' }" @click="tab = 'register'">Ro‘yxat</button>
        </div>
        <form @submit.prevent="submit">
          <label v-if="tab !== 'login'">CALLSIGN<input v-model="nickname" minlength="3" maxlength="16" autocomplete="nickname" required /></label>
          <label v-if="tab !== 'guest'">EMAIL<input v-model="email" type="email" autocomplete="email" required /></label>
          <label v-if="tab !== 'guest'">PAROL<input v-model="password" type="password" minlength="8" :autocomplete="tab === 'login' ? 'current-password' : 'new-password'" required /></label>
          <p v-if="store.error" class="form-error">{{ store.error }}</p>
          <BaseButton type="submit" size="lg" :disabled="store.busy">{{ store.busy ? 'ULANMOQDA...' : tab === 'guest' ? 'GUEST SIFATIDA KIRISH' : tab === 'login' ? 'LOGIN' : 'AKKAUNT YARATISH' }}</BaseButton>
        </form>
        <small class="auth-note">Davom etish bilan server qoidalariga rozilik bildirasiz.</small>
      </div>
    </section>
  </div>
</template>
