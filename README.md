# vue-dashboard

This template should help get you started developing with Vue 3 in Vite.

## 路由

使用 vue-router（history mode），定義在 [src/router/index.js](src/router/index.js)，兩個頁面共用 [src/dashBoardList.vue](src/dashBoardList.vue)。

| 路徑 | 頁面 | 說明 |
|---|---|---|
| `/` | 總表 | 上方可切換機台（預設第一台），依選擇的 bundle 標示版本不符的欄位 |
| `/machines/:machineType` | 單機頁 | 只顯示指定機台，不顯示機台切換列；bundle 篩選與比對同總表 |
| 其他路徑 | — | 導回 `/` |

`:machineType` 對應 `/api/machines` 回傳的 `machine_type`（來源為後端 `machines.json`），大小寫需完全一致，例如：

- `/machines/TS2_BMC`
- `/machines/TS2_BIOS`
- `/machines/QS1_BIOS`
- `/machines/QS1_TSC`
- `/machines/BESPIN`

找不到對應機台時，頁面會顯示「查無機台」並提供回總表的連結。後端新增機台後不需修改前端，新的路徑即可使用。

### 部署注意事項

- history mode 需要伺服器把非 API 路徑都 fallback 到 `index.html`，後端 `dashboard/src/index.js` 已處理。
- [vite.config.js](vite.config.js) 的 `base` 必須是 `'/'`，改回 `'./'` 會導致在 `/machines/...` 重新整理時載不到 JS/CSS（白畫面）。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
