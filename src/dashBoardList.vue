<script setup>
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchFirmwareHistory } from './api/firmwareHistory'
import { fetchActiveMachineFolders, fetchMachineFolders } from './api/machines'
import { fetchMetadata } from './api/metadata'
import machineInfos from './data/machineInfos.json'

dayjs.extend(utc)

// 由路由 /machines/:mac 帶入；沒有值時就是總表
const props = defineProps({
  mac: { type: String, default: '' },
})
const isSingleMachine = computed(() => Boolean(props.mac))

// 比對 mac 時忽略大小寫與分隔符號，16:23:8e:50:4f:4d、16-23-8E-50-4F-4D、16238e504f4d 都視為同一台
function normalizeMac(mac) {
  return (mac ?? '').toLowerCase().replace(/[^0-9a-f]/g, '')
}

const pageSize = ref(10)
const currentPage = ref(1)
const currentBundle = ref('none')

const machines = ref([])
const currentMachine = ref(null)
const firmwareHistory = ref([])
const metadataMap = ref([])

const isLoadingMachines = ref(true)
const isLoadingHistory = ref(false)

const titleColumns = machineInfos.title
const historyRows = computed(() =>
  firmwareHistory.value.map((record) => ({
    ...record,
    id: record.timestamp,
    modules: Array.isArray(record.modules) ? record.modules : [],
  }))
)

// 總表：folders API 的 ACTIVE 機器，依 product > stage > 機器 組成左側樹狀選單
// 單機頁：同樣用 folders API（不限 ACTIVE），依網址上的 mac 找機台
const machineTree = computed(() => {
  const products = new Map()
  for (const machine of machines.value) {
    if (!products.has(machine.product)) {
      products.set(machine.product, { key: machine.product, label: formatProduct(machine.product), stages: new Map(), count: 0 })
    }
    const product = products.get(machine.product)
    const stageKey = machine.stage ?? ''
    if (!product.stages.has(stageKey)) {
      product.stages.set(stageKey, { key: stageKey, label: machine.stage?.toUpperCase() ?? '', machines: [] })
    }
    product.stages.get(stageKey).machines.push(machine)
    product.count++
  }
  // 順序沿用 API 回傳（第一次出現的順序），由後端決定，前端不另外排序
  return [...products.values()].map((product) => ({
    ...product,
    stages: [...product.stages.values()],
  }))
})

// 收合的 product（預設全部展開）
const collapsedProducts = ref(new Set())

function toggleProduct(key) {
  const next = new Set(collapsedProducts.value)
  next.has(key) ? next.delete(key) : next.add(key)
  collapsedProducts.value = next
}

function formatProduct(product) {
  return product ? product.charAt(0).toUpperCase() + product.slice(1) : '其他'
}

function getMachineLabel(machine) {
  if (machine.name) return machine.name
  if (machine.label) return machine.label
  return [formatProduct(machine.product), machine.stage?.toUpperCase(), machine.mac].filter(Boolean).join(' / ')
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 樹狀選單已經有 product / stage 層級，label 前面重複的 "Vader.QS1 for " 拿掉，只留可辨識的部分
// 例如 Vader.QS1 for Bespin TSC → Bespin TSC、Neutrino.EB1 E-Board.7F → E-Board.7F；沒有 label 時顯示 mac
function getShortLabel(machine) {
  if (!machine.label) return machine.mac
  const prefix = [machine.product, machine.stage].filter(Boolean).map(escapeRegExp).join('\\.')
  const short = machine.label
    .replace(new RegExp(`^${prefix}`, 'i'), '')
    .replace(/^[\s.]*(for\s+)?/i, '')
    .trim()
  return short || machine.mac
}

function isCurrentMachine(machine) {
  return currentMachine.value?.machine_type === machine.machine_type
}

async function selectMachine(machine) {
  currentMachine.value = machine
  currentPage.value = 1
  isLoadingHistory.value = true
  try {
    const history = await fetchFirmwareHistory(machine.machine_type)
    // 快速切換機台時，忽略較慢回來的舊請求
    if (currentMachine.value === machine) firmwareHistory.value = history
  } catch (error) {
    console.error(`無法載入 ${getMachineLabel(machine)} 的 firmware 紀錄`, error)
    if (currentMachine.value === machine) firmwareHistory.value = []
  } finally {
    if (currentMachine.value === machine) isLoadingHistory.value = false
  }
}

// 依路由決定目前機台：單機頁找網址上的 mac，總表預設樹狀選單的第一台
function syncMachineFromRoute() {
  if (!machines.value.length) return
  if (isSingleMachine.value) {
    const machine = machines.value.find((item) => normalizeMac(item.mac) === normalizeMac(props.mac))
    if (machine) {
      selectMachine(machine)
    } else {
      currentMachine.value = null
      firmwareHistory.value = []
    }
  } else if (!currentMachine.value) {
    selectMachine(machineTree.value[0].stages[0].machines[0])
  }
}

async function loadMachines() {
  isLoadingMachines.value = true
  currentMachine.value = null
  try {
    machines.value = isSingleMachine.value ? await fetchMachineFolders() : await fetchActiveMachineFolders()
    syncMachineFromRoute()
  } catch (error) {
    console.error('無法載入機台清單', error)
    machines.value = []
  } finally {
    isLoadingMachines.value = false
  }
}

// 總表與單機頁的機台來源不同，切換時重新載入；同為單機頁只換機台
watch(isSingleMachine, loadMachines)
watch(() => props.mac, () => {
  if (isSingleMachine.value) syncMachineFromRoute()
})

onMounted(async () => {
  try {
    metadataMap.value = await fetchMetadata()
  } catch (error) {
    console.error('無法載入 bundle metadata', error)
  }
  await loadMachines()
})

const totalPages = computed(() => Math.max(1, Math.ceil(historyRows.value.length / pageSize.value)))
const visibleRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return historyRows.value.slice(start, start + pageSize.value)
})
const firstRow = computed(() => (historyRows.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0))
const lastRow = computed(() => Math.min(currentPage.value * pageSize.value, historyRows.value.length))
const selectedBundle = computed(() => metadataMap.value.find((bundle) => bundle.Name === currentBundle.value))

function moduleIdKey(id) {
  return id?.split('/').pop() ?? id
}

function findModule(row, column) {
  return row.modules.find((module) => moduleIdKey(module.Id) === column.key)
}

function getColumnValue(row, column) {
  if (column.key === 'timestamp') {
    return row.timestamp ? dayjs.utc(row.timestamp).local().format('YYYY/MM/DD HH:mm:ss') : 'null'
  }
  return findModule(row, column)?.Version || 'null'
}

// 浮窗卡片顯示的欄位：bundle 本身除了 Name 以外的所有資訊
function getBundleFields(bundle) {
  return Object.entries(bundle)
    .filter(([key]) => key !== 'Name')
    .map(([key, value]) => ({ key, value }))
}

function getColumnLabel(column) {
  return column.label || column.key
}

function isVersionMismatch(row, column) {
  if (!column.bundleKey || !selectedBundle.value) return false
  const moduleVersion = findModule(row, column)?.Version ?? null
  const bundleVersion = selectedBundle.value[column.bundleKey] ?? null
  if (moduleVersion === null && bundleVersion === null) return false
  return moduleVersion !== bundleVersion
}

</script>

<template>
  <div class="dashboard-list" :class="{ 'with-tree': !isSingleMachine }">
    <aside v-if="!isSingleMachine" class="machine-tree" aria-label="機台選擇">
      <h2>機台</h2>
      <p v-if="isLoadingMachines" class="tree-hint">載入中…</p>
      <ul v-else>
        <li v-for="product in machineTree" :key="product.key">
          <button class="tree-product" :aria-expanded="!collapsedProducts.has(product.key)"
            @click="toggleProduct(product.key)">
            <span class="tree-caret" :class="{ collapsed: collapsedProducts.has(product.key) }"
              aria-hidden="true">▾</span>
            {{ product.label }}
            <span class="tree-count">{{ product.count }}</span>
          </button>
          <ul v-show="!collapsedProducts.has(product.key)">
            <li v-for="stage in product.stages" :key="stage.key">
              <div v-if="stage.label" class="tree-stage">{{ stage.label }}</div>
              <ul>
                <li v-for="machine in stage.machines" :key="machine.machine_type">
                  <button class="tree-machine" :class="{ active: isCurrentMachine(machine) }"
                    :aria-pressed="isCurrentMachine(machine)"
                    :title="`${getMachineLabel(machine)}\n${machine.machine_type}`" @click="selectMachine(machine)">
                    <span class="tree-machine-text">
                      <span class="tree-machine-label">{{ getShortLabel(machine) }}</span>
                      <span v-if="machine.label" class="tree-machine-mac">{{ machine.mac }}</span>
                    </span>
                    <span v-if="machine.role" class="role-badge">{{ machine.role }}</span>
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </aside>

    <section class="dashboard-main">
      <header class="list-header">
        <div class="title-block">
          <h1>NVIDIA Compute Tray Firmware Bundle</h1>
          <p v-if="currentMachine" class="machine-path">
            <template v-if="currentMachine.name">{{ currentMachine.name }}</template>
            <template v-else>
              <span class="path-product">{{ formatProduct(currentMachine.product) }}</span>
              <template v-if="currentMachine.stage">
                <span class="path-sep" aria-hidden="true">›</span>
                <span>{{ currentMachine.stage.toUpperCase() }}</span>
              </template>
              <span class="path-sep" aria-hidden="true">›</span>
              <span v-if="currentMachine.label" class="path-label">{{ getShortLabel(currentMachine) }}</span>
              <span v-if="currentMachine.role" class="role-badge">{{ currentMachine.role }}</span>
              <code class="path-mac">{{ currentMachine.mac }}</code>
              <span v-if="currentMachine.network" class="path-network">{{ currentMachine.network }}</span>
            </template>
          </p>
        </div>
        <div class="bundle-filter" aria-label="Bundle 篩選">
          <span class="filter-label">比對 Bundle</span>
          <button :class="{ 'active': currentBundle === 'none' }" :aria-pressed="currentBundle === 'none'"
            @click="currentBundle = 'none'">
            全部
          </button>
          <div v-for="(bundle, index) in metadataMap" :key="bundle.Name" class="bundle-item">
            <button :class="{ 'active': currentBundle === bundle.Name }" :aria-pressed="currentBundle === bundle.Name"
              :aria-describedby="`bundle-card-${index}`" @click="currentBundle = bundle.Name">
              {{ bundle.Name }}
              <span class="bundle-info">
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <circle cx="8" cy="4.75" r="1" fill="currentColor" />
                  <path d="M8 7v4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </span>
            </button>
            <!-- 卡片放在 button 外面：button 裡不能放 div，且點卡片內容不該觸發切換 bundle -->
            <div :id="`bundle-card-${index}`" class="bundle-card" role="tooltip">
              <h2>{{ bundle.Name }}</h2>
              <dl>
                <template v-for="field in getBundleFields(bundle)" :key="field.key">
                  <dt>{{ field.key }}</dt>
                  <dd :class="{ 'is-null': field.value === null }">{{ field.value ?? '—' }}</dd>
                </template>
              </dl>
            </div>
          </div>
        </div>
      </header>

      <ul class="legend">
        <li><span class="legend-swatch version-diff"></span>版本與所選 bundle 不符</li>
      </ul>

      <p v-if="isLoadingMachines" class="state-message">載入機台中…</p>
      <template v-else-if="!machines.length">
        <p class="state-message">查無機台資料</p>
      </template>
      <p v-else-if="isSingleMachine && !currentMachine" class="state-message">
        查無機台 {{ mac }}，<RouterLink to="/">回總表</RouterLink>
      </p>
      <template v-else>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th v-for="column in titleColumns" :key="column.key" :title="column.key"
                  :class="{ 'timestamp-column': column.key === 'timestamp' }">
                  {{ getColumnLabel(column) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoadingHistory">
                <td :colspan="titleColumns.length" class="state-message">載入 firmware 紀錄中…</td>
              </tr>
              <tr v-else-if="!visibleRows.length">
                <td :colspan="titleColumns.length" class="state-message">查無 firmware 紀錄</td>
              </tr>
              <tr v-for="row in visibleRows" v-else :key="row.id">
                <td v-for="column in titleColumns" :key="`${row.id}-${column.key}`" :class="[
                  { 'timestamp-column': column.key === 'timestamp' },
                ]">
                  <span v-if="isVersionMismatch(row, column)" class="diff-badge">{{ getColumnValue(row, column)
                  }}</span>
                  <template v-else>{{ getColumnValue(row, column) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pagination-bar">
          <span>顯示第 {{ firstRow }} - {{ lastRow }} 筆，共 {{ historyRows.length }} 筆</span>
          <div class="pagination-controls">
            <button :disabled="currentPage === 1" @click="currentPage--">上一頁</button>
            <span>第 {{ currentPage }} / {{ totalPages }} 頁</span>
            <button :disabled="currentPage === totalPages" @click="currentPage++">下一頁</button>
          </div>
        </footer>
      </template>
    </section>
  </div>
</template>

<style scoped>
.dashboard-list {
  width: min(1680px, 100%);
  margin: 0 auto;
  padding: clamp(20px, 3vw, 32px);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.dashboard-list.with-tree {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.dashboard-main {
  min-width: 0;
}

.machine-tree {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding-right: 16px;
  border-right: 1px solid #e2e8f0;
}

.machine-tree h2 {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.machine-tree ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.machine-tree>ul>li+li {
  margin-top: 6px;
}

.machine-tree li ul {
  padding-left: 12px;
}

.tree-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.machine-tree button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border-color: transparent;
  text-align: left;
}

.tree-product {
  padding: 6px 8px;
  color: #2c3e50;
}

.tree-caret {
  display: inline-block;
  width: 12px;
  color: #94a3b8;
  transition: transform 0.15s;
}

.tree-caret.collapsed {
  transform: rotate(-90deg);
}

.tree-count {
  margin-left: auto;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
}

.tree-stage {
  margin: 6px 0 2px;
  padding-left: 8px;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 700;
}

.tree-machine {
  margin: 1px 0;
  padding: 5px 8px;
  font-size: 0.82rem;
  font-weight: 500;
}

.tree-machine-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tree-machine-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-machine-mac {
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
}

.tree-machine.active .tree-machine-mac {
  color: #f87171;
}

.role-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.machine-path .role-badge {
  margin-left: 0;
}

.list-header,
.pagination-bar,
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-header {
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

h1 {
  margin: 0;
  color: #2c3e50;
  font-size: clamp(1.15rem, 2vw, 1.4rem);
}

.machine-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 600;
}

.path-product,
.path-label {
  color: #334155;
}

.path-sep {
  color: #cbd5e1;
}

.path-mac {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.path-network {
  padding: 1px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.7rem;
}

.bundle-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.filter-label {
  margin-right: 4px;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.bundle-filter button {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
}

.bundle-item {
  position: relative;
}

.bundle-item>button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bundle-info {
  display: inline-flex;
  color: #94a3b8;
  cursor: help;
}

.bundle-info:hover {
  color: #2563eb;
}

button.active .bundle-info {
  color: #f87171;
}

button.active .bundle-info:hover {
  color: #b91c1c;
}

/* 只有滑鼠移到 icon（不是整顆按鈕）或鍵盤 focus 按鈕時才顯示浮窗；移進卡片本身也保持顯示 */
.bundle-card {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  visibility: hidden;
  opacity: 0;
  /* 延遲隱藏，讓滑鼠從 icon 移到卡片的途中卡片不會消失 */
  transition: opacity 0.15s, visibility 0s 0.25s;
  width: max-content;
  max-width: min(420px, calc(100vw - 32px));
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  color: #334155;
  cursor: auto;
  text-align: left;
}

/* 補上 icon 與卡片之間的空隙，避免滑鼠移過去時卡片閃掉 */
.bundle-card::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
}

.bundle-item>button:has(.bundle-info:hover)+.bundle-card,
.bundle-item>button:focus-visible+.bundle-card,
.bundle-card:hover {
  visibility: visible;
  opacity: 1;
  transition-delay: 0s;
}

.bundle-card h2 {
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
  color: #2c3e50;
  font-size: 0.95rem;
}

.bundle-card dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0;
  font-size: 0.82rem;
}

.bundle-card dt {
  color: #64748b;
  font-weight: 600;
}

.bundle-card dd {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.bundle-card dd.is-null {
  color: #cbd5e1;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 600;
}

button.active {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

button:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

button.active:hover:not(:disabled) {
  background: #fecaca;
  border-color: #f87171;
}

button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  color: #64748b;
  font-size: 0.85rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-swatch.version-diff {
  background: #fee2e2;
}

.state-message {
  padding: 24px 12px;
  text-align: center;
  color: #64748b;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 1450px;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

th {
  padding: 12px;
  background: #f8fafc;
  color: #64748b;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.timestamp-column {
  position: sticky;
  left: 0;
  z-index: 1;
  width: 180px;
  min-width: 180px;
  background: #f8fafc;
  box-shadow: 1px 0 0 #e2e8f0;
}

td.timestamp-column {
  background: #fff;
}

tbody tr:hover td.timestamp-column {
  background: #f8fafc;
}

td {
  padding: 12px;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.diff-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  background: #fee2e2;
  color: #991b1b;
  font-weight: 700;
}

tbody tr:hover {
  background: #f8fafc;
}

.pagination-bar {
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  color: #64748b;
  font-size: 0.9rem;
}

.pagination-controls {
  gap: 10px;
}

@media (max-width: 900px) {
  .dashboard-list.with-tree {
    grid-template-columns: minmax(0, 1fr);
  }

  .machine-tree {
    position: static;
    max-height: 320px;
    padding: 0 0 16px;
    border-right: 0;
    border-bottom: 1px solid #e2e8f0;
  }
}

@media (max-width: 640px) {
  .dashboard-list {
    padding: 18px 12px;
    border-radius: 8px;
  }

  .list-header,
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
