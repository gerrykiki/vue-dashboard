import { createRouter, createWebHistory } from 'vue-router'
import DashboardList from '../dashBoardList.vue'

// history mode 需要後端把非 API 路徑都 fallback 到 index.html（dashboard/src/index.js 已處理）
const routes = [
  // 總表：上方可切換機台
  { path: '/', name: 'overview', component: DashboardList },
  // 單機頁：鎖定網址上的 mac address，不顯示機台選單
  { path: '/machines/:mac', name: 'machine', component: DashboardList, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
