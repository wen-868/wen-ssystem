<template>
  <div class="transfer-page">
    <div class="page-header">
      <h2>多店调拨</h2>
      <p class="page-desc">管理门店间库存调拨，支持提交、审批、发货、收货全流程</p>
    </div>

    <!-- 搜索筛选区 -->
    <PageCard>
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="调拨单号">
          <el-input
            v-model="filterForm.keyword"
            placeholder="请输入调拨单号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="调出门店">
          <el-select
            v-model="filterForm.fromStoreId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="s in storeList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调入门店">
          <el-select
            v-model="filterForm.toStoreId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="s in storeList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><RefreshLeft /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <!-- 列表区 -->
    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建调拨
        </el-button>
        <el-button @click="loadTransfers">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>

      <!-- Tab 切换 -->
      <el-tabs v-model="activeTab" class="status-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane label="待审核" name="PENDING" />
        <el-tab-pane label="调拨中" name="TRANSFERRING" />
        <el-tab-pane label="已完成" name="COMPLETED" />
        <el-tab-pane label="已驳回" name="REJECTED" />
      </el-tabs>

      <DataTable
        :columns="columns"
        :data="tableData"
        :loading="loading"
        :total="pagination.total"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        @update:page="loadTransfers"
        @update:page-size="loadTransfers"
      >
        <template #status="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>

        <template #fromStore="{ row }">
          <span>{{ row.fromStoreName || '-' }}</span>
        </template>

        <template #toStore="{ row }">
          <span>{{ row.toStoreName || '-' }}</span>
        </template>

        <template #actions="{ row }">
          <el-button link type="primary" size="small" @click="handleView(row)">查看</el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="success"
            size="small"
            @click="handleSubmit(row)"
          >
            提交审核
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="warning"
            size="small"
            @click="handleEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="success"
            size="small"
            @click="handleApprove(row)"
          >
            审核通过
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="danger"
            size="small"
            @click="handleReject(row)"
          >
            驳回
          </el-button>
          <el-button
            v-if="row.status === 'APPROVED'"
            link
            type="primary"
            size="small"
            @click="handleShip(row)"
          >
            确认出库
          </el-button>
          <el-button
            v-if="row.status === 'SHIPPED'"
            link
            type="success"
            size="small"
            @click="handleReceive(row)"
          >
            确认入库
          </el-button>
          <el-button
            v-if="['DRAFT', 'PENDING'].includes(row.status)"
            link
            type="danger"
            size="small"
            @click="handleCancel(row)"
          >
            取消
          </el-button>
        </template>
      </DataTable>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { Search, Plus, Refresh, RefreshLeft } from "@element-plus/icons-vue";
import {
  fetchTransfers,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  shipTransfer,
  receiveTransfer,
  fetchStores
} from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";

const router = useRouter();

const loading = ref(false);
const tableData = ref<any[]>([]);
const storeList = ref<any[]>([]);
const activeTab = ref("all");

const filterForm = reactive({
  keyword: "",
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  dateRange: [] as string[]
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "transferNo", label: "调拨单号", width: 180 },
  { label: "调出门店", minWidth: 140, slot: "fromStore" },
  { label: "调入门店", minWidth: 140, slot: "toStore" },
  { prop: "skuCount", label: "商品种类数", width: 110, align: "center" },
  { prop: "totalQty", label: "总数量", width: 100, align: "right" },
  { prop: "status", label: "状态", width: 110, slot: "status" },
  { prop: "creatorName", label: "创建人", width: 100 },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 320, fixed: "right", slot: "actions" }
];

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: "草稿", type: "info" },
  PENDING: { text: "待审核", type: "warning" },
  APPROVED: { text: "已通过", type: "success" },
  REJECTED: { text: "已驳回", type: "danger" },
  SHIPPED: { text: "调拨中", type: "primary" },
  RECEIVED: { text: "已完成", type: "success" },
  CANCELLED: { text: "已取消", type: "info" }
};

function getStatusText(status: string) {
  return statusMap[status]?.text || status;
}

function getStatusType(status: string) {
  return (statusMap[status]?.type as any) || "info";
}

async function loadTransfers() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (filterForm.keyword) params.keyword = filterForm.keyword;
    if (filterForm.fromStoreId) params.fromStoreId = filterForm.fromStoreId;
    if (filterForm.toStoreId) params.toStoreId = filterForm.toStoreId;
    if (activeTab.value !== "all") {
      if (activeTab.value === "TRANSFERRING") {
        params.status = "APPROVED,SHIPPED";
      } else if (activeTab.value === "COMPLETED") {
        params.status = "RECEIVED";
      } else {
        params.status = activeTab.value;
      }
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }

    const data = await fetchTransfers(params);
    const records = data.records || data.list || [];
    tableData.value = records.map((item: any) => ({
      ...item,
      skuCount: item.items?.length || item.skuCount || 0,
      totalQty: item.totalQty || item.items?.reduce((sum: number, it: any) => sum + (it.quantity || it.totalBottleQty || 0), 0) || 0
    }));
    pagination.total = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
    // 使用 mock 数据（前端独立开发）
    tableData.value = generateMockData();
    pagination.total = tableData.value.length;
  } finally {
    loading.value = false;
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data.records || data.list || []);
  } catch {
    // mock 门店数据
    storeList.value = [
      { id: 1, name: "总店" },
      { id: 2, name: "朝阳门店" },
      { id: 3, name: "海淀门店" },
      { id: 4, name: "丰台门店" }
    ];
  }
}

function generateMockData() {
  const statuses = ["DRAFT", "PENDING", "APPROVED", "SHIPPED", "RECEIVED", "REJECTED", "CANCELLED"];
  const fromStores = ["总店", "朝阳门店", "海淀门店"];
  const toStores = ["朝阳门店", "海淀门店", "丰台门店"];
  const creators = ["张三", "李四", "王五", "赵六"];
  const data: any[] = [];
  for (let i = 1; i <= 25; i++) {
    const status = statuses[i % statuses.length];
    data.push({
      id: i,
      transferNo: `DB202607${String(i).padStart(4, "0")}`,
      fromStoreId: (i % 3) + 1,
      fromStoreName: fromStores[i % fromStores.length],
      toStoreId: ((i + 1) % 3) + 2,
      toStoreName: toStores[i % toStores.length],
      skuCount: Math.floor(Math.random() * 10) + 1,
      totalQty: Math.floor(Math.random() * 100) + 10,
      status,
      creatorName: creators[i % creators.length],
      createdAt: `2026-07-${String(15 - (i % 10)).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:${String(i * 3 % 60).padStart(2, "0")}:00`,
      items: [
        { skuId: 1, skuName: "飞天茅台53度500ml", quantity: 10, unit: "瓶" },
        { skuId: 2, skuName: "五粮液普五52度500ml", quantity: 20, unit: "瓶" }
      ],
      remark: "常规补货调拨"
    });
  }
  return data;
}

function handleSearch() {
  pagination.page = 1;
  loadTransfers();
}

function handleReset() {
  filterForm.keyword = "";
  filterForm.fromStoreId = null;
  filterForm.toStoreId = null;
  filterForm.dateRange = [];
  activeTab.value = "all";
  pagination.page = 1;
  loadTransfers();
}

function handleTabChange() {
  pagination.page = 1;
  loadTransfers();
}

function handleCreate() {
  router.push("/inventory-transfer/create");
}

function handleEdit(row: any) {
  router.push(`/inventory-transfer/edit/${row.id}`);
}

function handleView(row: any) {
  router.push(`/inventory-transfer/${row.id}`);
}

async function handleSubmit(row: any) {
  try {
    await ElMessageBox.confirm("确定提交该调拨单审核吗？", "提示", { type: "warning" });
    await submitTransfer(row.id);
    ElMessage.success("提交成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm("确定通过该调拨申请吗？", "审核通过", { type: "warning" });
    await approveTransfer(row.id);
    ElMessage.success("审核通过");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReject(row: any) {
  try {
    const { value } = await ElMessageBox.prompt("请输入驳回原因", "驳回调拨", {
      type: "warning",
      inputPlaceholder: "请输入驳回原因",
      confirmButtonText: "确定驳回"
    });
    await rejectTransfer(row.id);
    ElMessage.success("已驳回");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleShip(row: any) {
  try {
    await ElMessageBox.confirm("确定执行出库操作吗？出库后库存将从调出门店扣减。", "确认出库", { type: "warning" });
    await shipTransfer(row.id);
    ElMessage.success("出库成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReceive(row: any) {
  try {
    await ElMessageBox.confirm("确定执行入库操作吗？入库后库存将增加到调入门店。", "确认入库", { type: "warning" });
    await receiveTransfer(row.id, {});
    ElMessage.success("入库成功");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该调拨单吗？", "提示", { type: "warning" });
    await cancelTransfer(row.id);
    ElMessage.success("已取消");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

onMounted(() => {
  loadTransfers();
  loadStores();
});
</script>

<style scoped>
.transfer-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-form {
  margin: 0;
}

.status-tabs {
  margin-bottom: 16px;
}

.status-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
</style>
