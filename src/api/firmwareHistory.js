import { apiManager } from './apiManager'

export async function fetchFirmwareHistory(machine) {
  const data = await apiManager.request('/history', {
    params: { machine_type: machine.machine_type },
  })
  return data[machine.name] ?? []
}
