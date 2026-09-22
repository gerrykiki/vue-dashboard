<script setup>
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { computed, onMounted, ref } from 'vue'

dayjs.extend(utc)
import { fetchFirmwareHistory } from './api/firmwareHistory'
import { fetchMachines } from './api/machines'
import { fetchMetadata } from './api/metadata'
import machineInfos from './data/machineInfos.json'

const pageSize = ref(10)
const currentPage = ref(1)
const currentBundle = ref('none')

const machines = ref([])
const currentMachine = ref(null)
const firmwareHistory = ref([])
const metadataMap = ref([])

const isLoadingMachines = ref(true)
const isLoadingHistory = ref(false)
const errorMessage = ref('')

const titleColumns = machineInfos.title
const historyRows = computed(() =>
  firmwareHistory.value.map((record) => ({
    ...record,
    id: record.timestamp,
    modules: Array.isArray(record.modules) ? record.modules : [],
  }))
)

async function selectMachine(machine) {
  currentMachine.value = machine
  currentPage.value = 1
  isLoadingHistory.value = true
  errorMessage.value = ''
  try {
    firmwareHistory.value = await fetchFirmwareHistory(machine)
  } catch (error) {
    errorMessage.value = `無法載入 ${machine.name} 的 firmware 紀錄：${error.message}`
    firmwareHistory.value = []
  } finally {
    isLoadingHistory.value = false
  }
}

onMounted(async () => {
  try {
    metadataMap.value = await fetchMetadata()
    machines.value = await fetchMachines()
    if (machines.value.length) {
      await selectMachine(machines.value[0])
    }
  } catch (error) {
    errorMessage.value = `無法載入機台清單：${error.message}`
  } finally {
    isLoadingMachines.value = false
  }
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

function isEmptyValue(row, column) {
  if (column.key === 'timestamp') return !row.timestamp
  return !findModule(row, column)?.Version
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
  <div class="dashboard-list">
    <nav class="machine-bar" aria-label="機台選擇">
      <button v-for="machine in machines" :key="machine.ip"
        :class="{ 'active': currentMachine && currentMachine.ip === machine.ip }"
        :aria-pressed="currentMachine && currentMachine.ip === machine.ip" @click="selectMachine(machine)">
        {{ machine.name }}
      </button>
    </nav>

    <p v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</p>

    <header class="list-header">
      <h1>Firmware Modules</h1>
      <div class="bundle-filter" aria-label="Bundle 篩選">
        <button :class="{ 'active': currentBundle === 'none' }" :aria-pressed="currentBundle === 'none'"
          @click="currentBundle = 'none'">
          全部
        </button>
        <button v-for="bundle in metadataMap" :key="bundle.Name" :class="{ 'active': currentBundle === bundle.Name }"
          :aria-pressed="currentBundle === bundle.Name" @click="currentBundle = bundle.Name">
          {{ bundle.Name }}
        </button>
      </div>
    </header>

    <ul class="legend">
      <li><span class="legend-swatch empty-cell"></span>無回報資料</li>
      <li><span class="legend-swatch version-diff"></span>版本與所選 bundle 不符</li>
    </ul>

    <p v-if="isLoadingMachines" class="state-message">載入機台中…</p>
    <template v-else-if="!machines.length">
      <p class="state-message">查無機台資料</p>
    </template>
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
                { 'empty-cell': isEmptyValue(row, column) },
                { 'timestamp-column': column.key === 'timestamp' },
                { 'version-diff': isVersionMismatch(row, column) },
              ]">
                {{ getColumnValue(row, column) }}
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

.machine-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.list-header,
.pagination-bar,
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

h1 {
  margin: 0;
  color: #2c3e50;
  font-size: clamp(1.15rem, 2vw, 1.55rem);
}

.bundle-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

button:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

button.active:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.error-banner {
  margin: 0 0 16px;
  padding: 10px 14px;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.9rem;
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
  background: #1e3a8a;
}

.legend-swatch.empty-cell {
  background: #be123c;
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

.empty-cell {
  color: #be123c;
}

.version-diff {
  color: #1e3a8a;
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
