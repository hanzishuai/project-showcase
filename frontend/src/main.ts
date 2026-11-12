import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import App from './App.vue'
import '../vendor/rag-avatar/style.css'
import './admin/admin.css'
import './kanban.css'

createApp(App).use(ArcoVue).mount('#root')
