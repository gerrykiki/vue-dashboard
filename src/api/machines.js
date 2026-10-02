import { apiManager } from './apiManager'

// 自動掃描到的機器資料夾（已拆好 network / product / stage / mac / label / role）
export async function fetchMachineFolders() {
  return apiManager.request('/machines/folders')
}

// 總表選單只列 ACTIVE
export async function fetchActiveMachineFolders() {
  const folders = await fetchMachineFolders()
  return folders.filter((folder) => folder.status === 'ACTIVE')
}
