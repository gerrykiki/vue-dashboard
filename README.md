# vue-dashboard

This template should help get you started developing with Vue 3 in Vite.

## 路由

使用 vue-router（history mode），定義在 [src/router/index.js](src/router/index.js)，兩個頁面共用 [src/dashBoardList.vue](src/dashBoardList.vue)。

| 路徑 | 頁面 | 說明 |
|---|---|---|
| `/` | 總表 | 左側樹狀選單切換機台（預設第一台），依選擇的 bundle 標示版本不符的欄位 |
| `/machines/:machineType` | 單機頁 | 只顯示指定機台，不顯示左側選單；bundle 篩選與比對同總表 |
| 其他路徑 | — | 導回 `/` |

### 總表的機台選單

機台來源為 `GET /api/machines/folders`（後端自動掃描到的機器資料夾，已拆成 `network`、`product`、`stage`、`mac`），前端只保留 `status === 'ACTIVE'` 的機器，依下列層級組成左側樹狀選單：

```
Vader                    ← product（第一層，首字大寫，可點擊收合）
├─ QS1                   ← stage（轉大寫；stage 為 null 時直接列出機器）
│  ├─ Bespin BIOS  [BIOS]   ← label 去掉重複的 "Vader.QS1 for " 前綴 + role 標籤
│  │  16:23:8e:50:4f:4d     ← mac
│  └─ Bespin TSC   [TSC]
└─ TS2
   └─ ...
```

- `label`、`role` 來自後端（掃描頁面的按鈕名稱），為 null 時：沒有 label 就顯示 mac，沒有 role 就不顯示標籤。
- 專案、stage、機器的順序都沿用 API 回傳的順序（由後端決定），前端不另外排序；總表預設選第一台。
- 滑鼠移到機器上會顯示完整 label 與 `machine_type`；右側標題列顯示 product › stage › label、role、mac、network。

選單只列出 folders API 裡的機器；手動設定的機台（例如 `BESPIN`）不在其中，請用單機頁路徑開啟。

firmware 歷史紀錄統一由 `GET /api/history/:machine_type` 取得。

### 單機頁

`:machineType` 對應 `/api/machines` 回傳的 `machine_type`（來源為後端 `machines.json`），大小寫需完全一致，例如：

- `/machines/BESPIN`
- `/machines/VADER_TS2_2675F2CDF659`
- `/machines/NEUTRINO_EB1_0A576040977F`

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
