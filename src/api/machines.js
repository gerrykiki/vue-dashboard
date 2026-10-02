import { apiManager } from './apiManager'

export async function fetchMachines() {
  const data = await apiManager.request('/machines')
  return data.machines
}

// 自動掃描到的機器資料夾（已拆好 network / product / stage / mac），只保留 ACTIVE
export async function fetchActiveMachineFolders() {
  const folders = await apiManager.request('/machines/folders')
  return folders.filter((folder) => folder.status === 'ACTIVE')
}
