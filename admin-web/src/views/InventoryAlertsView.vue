<template>
  <div class="inventory-alerts-view">
    <div class="header">
      <h2>库存预警</h2>
      <div class="actions">
        <el-button type="primary" @click="showSettings = true">
          <el-icon><Setting /></el-icon>
          预警设置
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-select v-model="filterStoreId" placeholder="选择门店" clearable @change="loadAlerts">
        <el-option
          v-for="store in stores"
          :key="store.id"
          :label="store.name"
          :value="store.id"
        />
      </el-select>
      <el-select v-model="filterLevel" placeholder="预警级别" clearable @change="loadAlerts">
        <el-option label="低库存" value="LOW" />
        <el-option label="紧急" value="CRITICAL" />
      </el-select>
    </div>

    <el-table :data="alerts" v-loading="loading" stripe>
      <el-table-column prop="skuName" label="商品名称" min-width="200" />
      <el-table-column prop="storeName" label="门店" width="150" />
      <el-table-column prop="currentStock" label="当前库存" width="120" align="center">
        <template #default="{ row }">
          <span :class="{ 'text-danger': row.alertLevel === 'CRITICAL' }">
            {{ row.currentStock }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="threshold" label="预警阈值" width="120" align="center" />
      <el-table-column prop="alertLevel" label="预警级别" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.alertLevel === 'CRITICAL' ? 'danger' : 'warning'">
            {{ row.alertLevel === 'CRITICAL' ? '紧急' : '低库存' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="goReplenish(row)">
            快速补货
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadAlerts"
        @current-change="loadAlerts"
      />
    </div>

    <!-- 预警设置对话框 -->
    <el-dialog v-model="showSettings" title="预警设置" width="500px">
      <el-form :model="settingsForm" label-width="120px">
        <el-form-item label="全局阈值">
          <el-input-number v-model="settingsForm.globalThreshold" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="通知方式">
          <el-checkbox-group v-model="settingsForm.notifyMethods">
            <el-checkbox label="SYSTEM">系统通知</el-checkbox>
            <el-checkbox label="EMAIL">邮件</el-checkbox>
            <el-checkbox label="SMS">短信</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import { fetchInventoryAlerts, fetchStores } from '../api'

const router = useRouter()

const loading = ref(false)
const alerts = ref<any[]>([])
const stores = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const filterStoreId = ref<number | undefined>()
const filterLevel = ref<string>('')

const showSettings = ref(false)
const settingsForm = ref({
  globalThreshold: 10,
  notifyMethods: ['SYSTEM']
})

async function loadAlerts() {
  loading.value = true
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filterStoreId.value) params.storeId = filterStoreId.value
    if (filterLevel.value) params.level = filterLevel.value

    const data = await fetchInventoryAlerts(params)
    alerts.value = data.records || []
    total.value = data.total || 0
  } catch (error) {
    ElMessage.error('加载预警列表失败')
  } finally {
    loading.value = false
  }
}

async function loadStores() {
  try {
    const data = await fetchStores()
    stores.value = data || []
  } catch (error) {
    console.error('加载门店列表失败', error)
  }
}

function goReplenish(row: any) {
  router.push({
    path: '/purchase-orders/create',
    query: {
      skuId: row.skuId,
      storeId: row.storeId,
      quantity: row.threshold - row.currentStock
    }
  })
}

async function saveSettings() {
  try {
    // TODO: 调用保存预警设置API
    ElMessage.success('保存成功')
    showSettings.value = false
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

onMounted(() => {
  loadAlerts()
  loadStores()
})
</script>

<style scoped>
.inventory-alerts-view {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.text-danger {
  color: #f56c6c;
  font-weight: 600;
}
</style>
