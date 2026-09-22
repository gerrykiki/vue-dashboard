// 集中管理 API 相關設定（目前是後端 host + 機台 ip），
// 之後要擴充其他設定（例如 protocol、timeout、auth token...）
// 只需要在 defaultConfig / buildQuery 這裡加，不用改每一支 api 檔案。

// 後端 host 由啟動時的 --mode 決定（見 .env.development / .env.production）。
// dev（`vite`/`vite --mode production` 開發伺服器）一律走相對路徑，
// 交給 vite.config.js 的 server.proxy 代理過去，避免瀏覽器端 CORS 問題；
// build 出來的正式版沒有 dev server 可以代理，才需要組完整的 host。
const defaultConfig = {
  host: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_HOST || '10.33.33.179'),
  ip: '',
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

  setIp(ip) {
    this.config.ip = ip
  }

  getIp() {
    return this.config.ip
  }

  // 依目前設定組出 query string，新增設定時記得同步加進來
  buildQuery(extraParams = {}) {
    const params = new URLSearchParams()
    if (this.config.ip) params.set('ip', this.config.ip)
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, value)
    })
    return params.toString()
  }

  buildUrl(path, extraParams = {}) {
    const base = this.config.host ? `http://${this.config.host}` : ''
    const query = this.buildQuery(extraParams)
    return query ? `${base}${path}?${query}` : `${base}${path}`
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
