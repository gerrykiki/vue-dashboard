import { apiManager } from './apiManager'

export async function fetchMachines() {
  const data = await apiManager.request('/machines')
  return data.machines
}
