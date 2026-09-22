import { apiManager } from './apiManager'

export async function fetchFirmwareHistory(machine) {
  apiManager.setIp(machine.ip)
  const data = await apiManager.request('/history')
  return data[machine.name] ?? []
}
