<template>
  <div class="page">
    <PageCard title="批次追溯">
      <template #extra>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input v-model="searchForm.skuId" placeholder="商品ID" clearable style="width: 150px" />
        <el-input v-model="searchForm.batchNo" placeholder="批次号" clearable style="width: 180px; margin-left: 12px" />
        <el-select v-model="searchForm.storeId" placeholder="门店" clearable filterable style="width: 180px; margin-left: 12px">
          <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-select v-model="searchForm.expiryStatus" placeholder="效期状态" clearable style="width: 150px; margin-left: 12px">
          <el-option label="正常" value="NORMAL" />
          <el-option label="临期" value="NEAR_EXPIRY" />
          <el-option label="已过期" value="EXPIRED" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchBatches">搜索</el-button>
      </div>

      <el-table :data="batches" v-loading="loading" stripe>
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="productName" label="商品名称" min-width="160" />
        <el-table-column prop="storeName" label="门店" width="140" />
        <el-table-column prop="quantity" label="数量" width="100" align="right" />
        <el-table-column prop="productionDate" label="生产日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.productionDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="expiryDate" label="到期日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expiryDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'NORMAL'" type="success">正常</el-tag>
            <el-tag v-else-if="row.status === 'NEAR_EXPIRY'" type="warning">临期</el-tag>
            <el-tag v-else-if="row.status === 'EXPIRED'" type="danger">过期</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">追溯</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="(s: number) => { pageSize = s; searchBatches(); }"
          @current-change="(p: number) => { page = p; searchBatches(); }"
        />
      </div>
    </PageCard>

    <!-- 批次详情/追溯 -->
    <DetailDrawer v-model="detailVisible" title="批次追溯详情" width="700px">
      <template v-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="批次号">{{ detailData.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="商品名称">{{ detailData.productName }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ detailData.storeName }}</el-descriptions-item>
          <el-descriptions-item label="当前数量">{{ detailData.quantity }}</el-descriptions-item>
          <el-descriptions-item label="生产日期">{{ formatDate(detailData.productionDate) }}</el-descriptions-item>
          <el-descriptions-item label="到期日期">{{ formatDate(detailData.expiryDate) }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px; margin-bottom: 12px">追溯时间线</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(record, idx) in detailData.timeline || []"
            :key="idx"
            :timestamp="formatDate(record.time)"
            :type="record.type === 'IN' ? 'success' : record.type === 'OUT' ? 'warning' : 'info'"
          >
            <div>
              <span>{{ record.description }}</span>
              <span v-if="record.quantity" style="margin-left: 12px; color: #666">
                数量: {{ record.type === 'IN' ? '+' : '-' }}{{ record.quantity }}
              </span>
            </div>
          </el-timeline-item>
        </el-timeline>

        <h4 style="margin-top: 20px; margin-bottom: 12px">出入库记录</h4>
        <el-table :data="detailData.records || []" stripe size="small">
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === 'IN' ? 'success' : 'warning'" size="small">
                {{ row.type === 'IN' ? '入库' : '出库' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" align="right" />
          <el-table-column prop="relatedNo" label="关联单号" width="160" />
          <el-table-column prop="createdAt" label="时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" />
        </el-table>
      </template>
    </DetailDrawer>

    <!-- 效期预警配置 -->
    <PageCard title="效期预警配置">
      <template #extra>
        <el-button type="primary" @click="openExpiryConfigDialog">新增配置</el-button>
      </template>
      <el-table :data="expiryConfigs" v-loading="configLoading" stripe>
        <el-table-column prop="productName" label="商品名称" min-width="160" />
        <el-table-column prop="alertDaysBefore" label="预警天数" width="120" align="center" />
        <el-table-column prop="alertLevel" label="预警级别" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.alertLevel === 1" type="warning">一级预警</el-tag>
            <el-tag v-else-if="row.alertLevel === 2" type="danger">二级预警</el-tag>
            <el-tag v-else>{{ row.alertLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openExpiryConfigDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除该配置？" @confirm="deleteExpiryConfigItem(row.id)">
              <template #reference>
                <el-button size="small" link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </PageCard>

    <!-- 效期预警弹窗 -->
    <el-dialog v-model="configDialogVisible" :title="editingConfig ? '编辑预警配置' : '新增预警配置'" width="500px">
      <el-form ref="configFormRef" :model="configForm" :rules="configRules" label-width="100px">
        <el-form-item label="商品" prop="productId" required>
          <el-select v-model="configForm.productId" filterable placeholder="选择商品" style="width: 100%">
            <el-option v-for="p in productList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警天数" prop="alertDaysBefore">
          <el-input-number v-model="configForm.alertDaysBefore" :min="1" :max="365" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预警级别">
          <el-select v-model="configForm.alertLevel" style="width: 100%">
            <el-option label="一级预警" :value="1" />
            <el-option label="二级预警" :value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSubmitLoading" @click="handleConfigSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 效期预警列表 -->
    <PageCard title="效期预警列表">
      <el-table :data="expiryAlerts" v-loading="alertLoading" stripe>
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="productName" label="商品名称" min-width="160" />
        <el-table-column prop="storeName" label="门店" width="140" />
        <el-table-column prop="alertLevel" label="预警级别" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.alertLevel === 1" type="warning">一级</el-tag>
            <el-tag v-else-if="row.alertLevel === 2" type="danger">二级</el-tag>
            <el-tag v-else>{{ row.alertLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expiryDate" label="到期日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expiryDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="daysLeft" label="剩余天数" width="100" align="center" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待处理</el-tag>
            <el-tag v-else-if="row.status === 'HANDLED'" type="success">已处理</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" size="small" link type="primary" @click="handleAlertItem(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="alertTotal"
          :page-size="alertPageSize"
          :current-page="alertPage"
          @size-change="(s: number) => { alertPageSize = s; loadExpiryAlerts(); }"
          @current-change="(p: number) => { alertPage = p; loadExpiryAlerts(); }"
        />
      </div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import DetailDrawer from "../components/DetailDrawer.vue";
import { formatDate } from "../utils/format";
import {
  fetchInventoryBatches,
  fetchInventoryBatchDetail,
  fetchExpiryConfigs,
  createExpiryConfig,
  updateExpiryConfig,
  deleteExpiryConfig,
  fetchExpiryAlerts,
  handleExpiryAlert,
  fetchStores,
  fetchProducts
} from "../api";

const searchForm = reactive({
  skuId: "",
  batchNo: "",
  storeId: null as number | null,
  expiryStatus: ""
});

const batches = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const storeList = ref<any[]>([]);
const productList = ref<any[]>([]);

const detailVisible = ref(false);
const detailData = ref<any>(null);

const expiryConfigs = ref<any[]>([]);
const configLoading = ref(false);
const configDialogVisible = ref(false);
const editingConfig = ref<any>(null);
const configFormRef = ref();
const configSubmitLoading = ref(false);
const configRules = {
  productId: [{ required: true, message: '请选择商品', trigger: 'change' }],
  alertDaysBefore: [{ required: true, message: '请输入预警天数', trigger: 'blur' }]
};

const configForm = reactive({
  productId: null as number | null,
  alertDaysBefore: 30,
  alertLevel: 1
});

const expiryAlerts = ref<any[]>([]);
const alertLoading = ref(false);
const alertTotal = ref(0);
const alertPage = ref(1);
const alertPageSize = ref(20);

async function searchBatches() {
  loading.value = true;
  try {
    const res = await fetchInventoryBatches({
      page: page.value,
      pageSize: pageSize.value,
      storeId: searchForm.storeId || undefined,
      skuId: searchForm.skuId ? Number(searchForm.skuId) : undefined,
      expiryStatus: searchForm.expiryStatus || undefined
    });
    batches.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error("加载批次列表失败");
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: any) {
  detailVisible.value = true;
  try {
    detailData.value = await fetchInventoryBatchDetail(row.id);
  } catch {
    ElMessage.error("加载批次详情失败");
  }
}

async function loadExpiryConfigs() {
  configLoading.value = true;
  try {
    expiryConfigs.value = await fetchExpiryConfigs();
  } catch {
    ElMessage.error("加载预警配置失败");
  } finally {
    configLoading.value = false;
  }
}

function openExpiryConfigDialog(row?: any) {
  editingConfig.value = row || null;
  if (row) {
    configForm.productId = row.productId;
    configForm.alertDaysBefore = row.alertDaysBefore;
    configForm.alertLevel = row.alertLevel;
  } else {
    configForm.productId = null;
    configForm.alertDaysBefore = 30;
    configForm.alertLevel = 1;
  }
  configDialogVisible.value = true;
}

async function handleConfigSubmit() {
  const valid = await configFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  configSubmitLoading.value = true;
  try {
    if (editingConfig.value) {
      await updateExpiryConfig(editingConfig.value.id, {
        productId: configForm.productId,
        alertDaysBefore: configForm.alertDaysBefore,
        alertLevel: configForm.alertLevel
      });
      ElMessage.success("配置更新成功");
    } else {
      await createExpiryConfig({
        productId: configForm.productId,
        alertDaysBefore: configForm.alertDaysBefore,
        alertLevel: configForm.alertLevel
      });
      ElMessage.success("配置创建成功");
    }
    configDialogVisible.value = false;
    await loadExpiryConfigs();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    configSubmitLoading.value = false;
  }
}

async function deleteExpiryConfigItem(id: number) {
  try {
    await deleteExpiryConfig(id);
    ElMessage.success("删除成功");
    await loadExpiryConfigs();
  } catch {
    ElMessage.error("删除失败");
  }
}

async function loadExpiryAlerts() {
  alertLoading.value = true;
  try {
    const res = await fetchExpiryAlerts({
      page: alertPage.value,
      pageSize: alertPageSize.value
    });
    expiryAlerts.value = res?.records || res?.list || [];
    alertTotal.value = res?.total || 0;
  } catch {
    ElMessage.error("加载预警列表失败");
  } finally {
    alertLoading.value = false;
  }
}

async function handleAlertItem(row: any) {
  try {
    await handleExpiryAlert(row.id);
    ElMessage.success("已处理");
    await loadExpiryAlerts();
  } catch {
    ElMessage.error("处理失败");
  }
}

async function loadData() {
  await Promise.all([searchBatches(), loadExpiryConfigs(), loadExpiryAlerts()]);
  try {
    const [stores, products] = await Promise.all([fetchStores(), fetchProducts()]);
    storeList.value = stores?.records || stores?.list || stores || [];
    productList.value = products?.records || products?.list || products || [];
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 0;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>