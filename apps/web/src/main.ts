import '@fontsource/bebas-neue/400.css'
import '@fontsource/barlow-condensed/400.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import './assets/styles/global.css'

createApp(App).use(createPinia()).mount('#app')
