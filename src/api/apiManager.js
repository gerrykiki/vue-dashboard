// 集中管理 API 相關設定（目前是後端 host），
// 之後要擴充其他設定（例如 protocol、timeout、auth token...）
// 只需要在 defaultConfig / buildQuery 這裡加，不用改每一支 api 檔案。

// 前端 dist 由後端一起提供，頁面與 API 同來源，預設不指定 host：
// - dev：走 /api，交給 vite.config.js 的 server.proxy 代理到後端
// - 正式版：走同網域的 /api（例如 http://nv-bundle.thbsms.com/api），
//   不寫死內網 IP，從網域或直接用 IP 開啟都能用
// 需要指定其他後端時可用 setHost('ip:port')。
const defaultConfig = {
  host: '',
}

class ApiManager {
  constructor(config = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  setConfig(partialConfig) {
    this.config = { ...this.config, ...partialConfig }
  }

  getConfig() {
    return { ...this.config }
  }

  setHost(host) {
    this.config.host = host
  }

  getHost() {
    return this.config.host
  }

  // 依目前設定組出 query string，新增設定時記得同步加進來
  buildQuery(extraParams = {}) {
    const params = new URLSearchParams()
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, value)
    })
    return params.toString()
  }

  buildUrl(path, extraParams = {}) {
    const base = this.config.host ? `http://${this.config.host}` : ''
    const query = this.buildQuery(extraParams)
    const url = `${base}/api${path}`
    return query ? `${url}?${query}` : url
  }

  async request(path, { params = {}, ...options } = {}) {
    const res = await fetch(this.buildUrl(path, params), options)
    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }
}

export const apiManager = new ApiManager()
export default ApiManager
