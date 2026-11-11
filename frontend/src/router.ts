import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import ProjectDetailView from './views/ProjectDetailView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/project/:id', name: 'project', component: ProjectDetailView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
