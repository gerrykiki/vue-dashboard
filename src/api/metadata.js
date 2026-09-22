import { apiManager } from './apiManager'

export async function fetchMetadata() {
  const data = await apiManager.request('/metadata')
  return data.bundle
}
