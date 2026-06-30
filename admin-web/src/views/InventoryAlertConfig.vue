<template>
  <div class="page">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-danger">
          <div class="stat-item">
            <div class="stat-label">低库存预警</div>
            <div class="stat-value">{{ warnStats?.lowStockCount || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-warning">
          <div class="stat-item">
            <div class="stat-label">高库存预警</div>
            <div class="stat-value">{{ warnStats?.highStockCount || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-primary">
          <div class="stat-item">
            <div class="stat-label">已配置预警</div>
            <div class="stat-value">{{ warnStats?.configuredSkus || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-item">
            <div class="stat-label">预警配置总数</div>
            <div class="stat-value">{{ configTotal }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时预警列表 -->
    <PageCard title="实时库存预警">
      <div class="search-bar">
        <el-select v-model="warnStoreId" placeholder="门店" clearable filterable style="width: 150px">
          <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="loadWarnings">刷新</el-button>
      </div>
      <el-table :data="warnings" v-loading="warnLoading" stripe>
        <el-table-column prop="productName" label="商品名称" min-width="140" />
        <el-table-column prop="skuName" label="SKU" min-width="120" />
        <el-table-column prop="storeName" label="门店" width="100" />
        <el-table-column prop="currentStock" label="当前库存" width="90" align="right" />
        <el-table-column prop="minQty" label="最低阈值" width="90" align="right" />
        <el-table-column prop="maxQty" label="最高阈值" width="90" align="right" />
        <el-table-column prop="warnLevel" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.warnLevel === 'LOW'" type="danger" size="small">库存不足</el-tag>
            <el-tag v-else-if="row.warnLevel === 'HIGH'" type="warning" size="small">库存过高</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="quickConfig(row)">快速配置</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper"
          :total="warnTotal" :page-size="warnPageSize" :current-page="warnPage"
          @size-change="(s: number) => { warnPageSize = s; loadWarnings(); }"
          @current-change="(p: number) => { warnPage = p; loadWarnings(); }" />
      </div>
    </PageCard>

    <!-- 预警配置管理 -->
    <PageCard title="预警配置">
      <template #extra>
        <el-button type="primary" @click="openConfigDialog()">新增配置</el-button>
        <el-button @click="loadConfigs">刷新</el-button>
      </template>
      <el-table :data="configs" v-loading="configLoading" stripe>
        <el-table-column prop="productName" label="商品名称" min-width="140" />
        <el-table-column prop="skuName" label="SKU" min-width="120" />
        <el-table-column prop="storeName" label="门店" width="100" />
        <el-table-column prop="currentStock" label="当前库存" width="90" align="right" />
        <el-table-column prop="minQty" label="最低阈值" width="90" align="right" />
        <el-table-column prop="maxQty" label="最高阈值" width="90" align="right" />
        <el-table-column prop="enabled" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openConfigDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="deleteConfigItem(row.id)">
              <template #reference>
                <el-button size="small" link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper"
          :total="configTotal" :page-size="configPageSize" :current-page="configPage"
          @size-change="(s: number) => { configPageSize = s; loadConfigs(); }"
          @current-change="(p: number) => { configPage = p; loadConfigs(); }" />
      </div>
    </PageCard>

    <!-- 新增/编辑配置弹窗 -->
    <el-dialog v-model="configDialogVisible" :title="editingConfig ? '编辑预警配置' : '新增预警配置'" width="500px">
      <el-form ref="configFormRef" :model="configForm" label-width="100px">
        <el-form-item label="门店" required>
          <el-select v-model="configForm.storeId" filterable placeholder="选择门店" style="width: 100%">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品" required>
          <el-select v-model="configForm.skuId" filterable placeholder="选择商品" style="width: 100%">
            <el-option v-for="p in productList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="最低库存">
          <el-input-number v-model="configForm.minQty" :min="0" :max="99999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最高库存">
          <el-input-number v-model="configForm.maxQty" :min="0" :max="99999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="configForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSubmitLoading" @click="handleConfigSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import {
  fetchStockWarningConfigs, fetchStockWarnings, createStockWarningConfig,
  updateStockWarningConfig, deleteStockWarningConfig,
  fetchStores, fetchProducts
} from "../api";

const storeList = ref<any[]>([]);
const productList = ref<any[]>([]);

const configs = ref<any[]>([]);
const configLoading = ref(false);
const configTotal = ref(0);
const configPage = ref(1);
const configPageSize = ref(20);

const warnings = ref<any[]>([]);
const warnLoading = ref(false);
const warnTotal = ref(0);
const warnPage = ref(1);
const warnPageSize = ref(20);
const warnStoreId = ref<number | null>(null);
const warnStats = ref<any>(null);

const configDialogVisible = ref(false);
const editingConfig = ref<any>(null);
const configSubmitLoading = ref(false);
const configForm = reactive({
  storeId: null as number | null,
  skuId: null as number | null,
  minQty: 10,
  maxQty: 99999,
  enabled: true
});

async function loadConfigs() {
  configLoading.value = true;
  try {
    const res = await fetchStockWarningConfigs({
      page: configPage.value, pageSize: configPageSize.value
    });
    configs.value = res?.records || [];
    configTotal.value = res?.total || 0;
  } catch {
    ElMessage.error("加载配置失败");
  } finally {
    configLoading.value = false;
  }
}

async function loadWarnings() {
  warnLoading.value = true;
  try {
    const res = await fetchStockWarnings({
      page: warnPage.value, pageSize: warnPageSize.value,
      storeId: warnStoreId.value || undefined
    });
    warnings.value = res?.records || [];
    warnTotal.value = res?.total || 0;
    warnStats.value = res?.stats || null;
  } catch {
    ElMessage.error("加载预警失败");
  } finally {
    warnLoading.value = false;
  }
}

function openConfigDialog(row?: any) {
  editingConfig.value = row || null;
  if (row) {
    configForm.storeId = row.storeId;
    configForm.skuId = row.skuId;
    configForm.minQty = row.minQty;
    configForm.maxQty = row.maxQty;
    configForm.enabled = !!row.enabled;
  } else {
    configForm.storeId = null;
    configForm.skuId = null;
    configForm.minQty = 10;
    configForm.maxQty = 99999;
    configForm.enabled = true;
  }
  configDialogVisible.value = true;
}

async function handleConfigSubmit() {
  if (!configForm.storeId || !configForm.skuId) {
    ElMessage.warning("请选择门店和商品");
    return;
  }
  configSubmitLoading.value = true;
  try {
    if (editingConfig.value) {
      await updateStockWarningConfig(editingConfig.value.id, {
        minQty: configForm.minQty, maxQty: configForm.maxQty, enabled: configForm.enabled ? 1 : 0
      });
      ElMessage.success("更新成功");
    } else {
      await createStockWarningConfig({
        storeId: configForm.storeId,
        skuIds: [configForm.skuId],
        minQty: configForm.minQty,
        maxQty: configForm.maxQty
      });
      ElMessage.success("创建成功");
    }
    configDialogVisible.value = false;
    await Promise.all([loadConfigs(), loadWarnings()]);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "保存失败");
  } finally {
    configSubmitLoading.value = false;
  }
}

async function deleteConfigItem(id: number) {
  try {
    await deleteStockWarningConfig(id);
    ElMessage.success("删除成功");
    await Promise.all([loadConfigs(), loadWarnings()]);
  } catch {
    ElMessage.error("删除失败");
  }
}

function quickConfig(row: any) {
  configForm.storeId = row.storeId || null;
  configForm.skuId = row.skuId;
  configForm.minQty = row.minQty || 10;
  configForm.maxQty = row.maxQty || 99999;
  configForm.enabled = true;
  editingConfig.value = null;
  configDialogVisible.value = true;
}

async function loadData() {
  await Promise.all([loadConfigs(), loadWarnings()]);
  try {
    const [stores, products] = await Promise.all([fetchStores(), fetchProducts()]);
    storeList.value = stores?.records || stores?.list || stores || [];
    productList.value = products?.records || products?.list || products || [];
  } catch { /* ignore */ }
}

onMounted(() => loadData());
</script>

<style scoped>
.stat-row { margin-bottom: 16px; }
.stat-card { border-radius: 8px; }
.stat-item { text-align: center; padding: 8px 0; }
.stat-label { color: #909399; font-size: 13px; margin-bottom: 8px; }
.stat-value { font-size: 26px; font-weight: 600; color: #303133; }
.stat-danger .stat-value { color: #F56C6C; }
.stat-warning .stat-value { color: #E6A23C; }
.stat-primary .stat-value { color: #409EFF; }
.search-bar { display: flex; align-items: center; margin-bottom: 16px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>