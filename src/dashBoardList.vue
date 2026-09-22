<script setup>
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
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
  firmwareHistory.value = await fetchFirmwareHistory(machine)
}

onMounted(async () => {
  metadataMap.value = await fetchMetadata()
  machines.value = await fetchMachines()
  if (machines.value.length) {
    await selectMachine(machines.value[0])
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

function getColumnValue(row, column) {
  if (column.key === 'timestamp') {
    return row.timestamp ? dayjs(row.timestamp).format('YYYY/MM/DD hh:mm:ss') : 'null'
  }
  return row.modules.find((module) => module.Id === column.key)?.Version || 'null'
}

function isEmptyModuleRow(row) {
  return row.modules.length === 0
}

function isVersionMismatch(row, column) {
  if (!column.bundleKey || !selectedBundle.value) return false
  const moduleVersion = row.modules.find((module) => module.Id === column.key)?.Version ?? null
  const bundleVersion = selectedBundle.value[column.bundleKey] ?? null
  if (moduleVersion === null && bundleVersion === null) return false
  return moduleVersion !== bundleVersion
}

</script>

<template>
  <div class="dashboard-list">
    <nav class="machine-bar">
      <button v-for="machine in machines" :key="machine.ip"
        :class="{ 'active': currentMachine && currentMachine.ip === machine.ip }" @click="selectMachine(machine)">
        {{ machine.name }}
      </button>
    </nav>

    <header class="list-header">
      <h1>Firmware Modules</h1>
      <div>
        <button @click="currentBundle = 'none'">X</button>
        <button v-for="bundle in metadataMap" :key="bundle.Name" :class="{ 'active': currentBundle === bundle.Name }"
          @click="currentBundle = bundle.Name">
          {{ bundle.Name }}
        </button>
      </div>
    </header>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th v-for="column in titleColumns" :key="column.key"
              :class="{ 'timestamp-column': column.key === 'timestamp' }">
              {{ column.key }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <td v-for="column in titleColumns" :key="`${row.id}-${column.key}`" :class="[
              { 'empty-cell': isEmptyModuleRow(row) },
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

h1 span {
  color: #94a3b8;
  font-size: 0.7em;
  font-weight: 500;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  padding: 8px 10px;
}

button {
  cursor: pointer;
  font-weight: 600;
}

button.active {
  background: #52a0ee;
}

/* button:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
} */

button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
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
  width: 180px;
  min-width: 180px;
}

td {
  padding: 12px;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.empty-cell {
  background: #fff1f2;
  color: #be123c;
}

.version-diff {
  color: #1e3a8a;
  font-weight: 700;
}

tbody tr:hover {
  background: #f8fafc;
}

.timestamp {
  color: #475569;
  font-weight: 600;
}

code {
  font-family: "SFMono-Regular", Consolas, monospace;
}

small {
  display: inline-block;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.status-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-ok {
  background: #d1fae5;
  color: #065f46;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.status-warn {
  background: #ffedd5;
  color: #9a3412;
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
