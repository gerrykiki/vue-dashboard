import { apiManager } from './apiManager'

// 只需要 machine_type，總表（folders API，沒有 name）與單機頁都能共用
export async function fetchFirmwareHistory(machineType) {
  const data = await apiManager.request(`/history/${encodeURIComponent(machineType)}`)
  return Array.isArray(data) ? data : []
}
