import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import App from './App.vue'
import { installAdminFetch } from './admin/auth'
import '../vendor/rag-avatar/style.css'
import './admin/admin.css'
import './kanban.css'

// 可选管理口令：给 /api/admin 等管理面请求统一加 X-Admin-Token
installAdminFetch()

createApp(App).use(ArcoVue).mount('#root')
