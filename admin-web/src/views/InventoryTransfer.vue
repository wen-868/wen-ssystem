<template>
  <div class="transfer-page">
    <div class="page-header">
      <h2>库存调拨</h2>
      <p class="page-desc">管理门店间库存调拨，支持提交、审批、发货、收货</p>
    </div>

    <PageCard>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="调出门店">
          <el-select
            v-model="filterForm.fromStoreId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 180px"
            @change="loadTransfers"
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
            style="width: 180px"
            @change="loadTransfers"
          >
            <el-option
              v-for="s in storeList"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filterForm.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
            @change="loadTransfers"
          >
            <el-option label="草稿" value="DRAFT" />
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
            <el-option label="已发货" value="SHIPPED" />
            <el-option label="已收货" value="RECEIVED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="loadTransfers"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTransfers">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建调拨
        </el-button>
        <el-button @click="loadTransfers">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>

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
          <el-tag v-if="row.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
          <el-tag v-else-if="row.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
          <el-tag v-else-if="row.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
          <el-tag v-else-if="row.status === 'REJECTED'" type="danger" size="small">已驳回</el-tag>
          <el-tag v-else-if="row.status === 'SHIPPED'" type="primary" size="small">已发货</el-tag>
          <el-tag v-else-if="row.status === 'RECEIVED'" type="success" size="small">已收货</el-tag>
          <el-tag v-else-if="row.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
          <el-tag v-else size="small">{{ row.status }}</el-tag>
        </template>

        <template #actions="{ row }">
          <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="success"
            size="small"
            @click="handleSubmitTransfer(row)"
          >
            提交
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="success"
            size="small"
            @click="handleApprove(row)"
          >
            通过
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
            发货
          </el-button>
          <el-button
            v-if="row.status === 'SHIPPED'"
            link
            type="success"
            size="small"
            @click="handleReceive(row)"
          >
            收货
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT' || row.status === 'PENDING'"
            link
            type="danger"
            size="small"
            @click="handleCancelTransfer(row)"
          >
            取消
          </el-button>
        </template>
      </DataTable>
    </PageCard>

    <el-dialog
      v-model="dialogVisible"
      title="新建调拨"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="调出门店" prop="fromStoreId">
              <el-select
                v-model="form.fromStoreId"
                placeholder="请选择调出门店"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="s in storeList"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="调入门店" prop="toStoreId">
              <el-select
                v-model="form.toStoreId"
                placeholder="请选择调入门店"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="s in storeList.filter((s: any) => s.id !== form.fromStoreId)"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="调拨商品">
          <el-table :data="form.items" size="small" border>
            <el-table-column label="商品名称" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.skuName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column label="调拨数量" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="1"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" @click="removeItem($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" plain style="margin-top: 10px" @click="addItem">
            + 添加商品
          </el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSave">创建</el-button>
      </template>
    </el-dialog>

    <DetailDrawer v-model="detailVisible" title="调拨详情" width="560px">
      <template v-if="currentTransfer">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="调拨单号">{{ currentTransfer.transferNo }}</el-descriptions-item>
          <el-descriptions-item label="调出门店">{{ currentTransfer.fromStoreName || currentTransfer.fromStoreId }}</el-descriptions-item>
          <el-descriptions-item label="调入门店">{{ currentTransfer.toStoreName || currentTransfer.toStoreId }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentTransfer.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'PENDING'" type="warning" size="small">待审核</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'APPROVED'" type="success" size="small">已通过</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'REJECTED'" type="danger" size="small">已驳回</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'SHIPPED'" type="primary" size="small">已发货</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'RECEIVED'" type="success" size="small">已收货</el-tag>
            <el-tag v-else-if="currentTransfer.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
            <el-tag v-else size="small">{{ currentTransfer.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商品总数">{{ currentTransfer.totalItems || 0 }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentTransfer.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentTransfer.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">调拨明细</h4>
        <el-table :data="currentTransfer.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="quantity" label="调拨数量" width="100" />
        </el-table>
      </template>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import {
  fetchTransfers,
  createTransfer,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  shipTransfer,
  receiveTransfer,
  fetchStores
} from "../api";
import { formatDate } from "../utils/format";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";
import DetailDrawer from "../components/DetailDrawer.vue";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const storeList = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentTransfer = ref<any>(null);
const formRef = ref<FormInstance>();

const filterForm = reactive({
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  status: "",
  dateRange: [] as string[]
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "transferNo", label: "调拨单号", width: 180 },
  { prop: "fromStoreName", label: "调出门店", minWidth: 140 },
  { prop: "toStoreName", label: "调入门店", minWidth: 140 },
  { prop: "totalItems", label: "商品总数", width: 100 },
  { prop: "status", label: "状态", width: 100, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 280, fixed: "right", slot: "actions" }
];

const defaultForm = {
  fromStoreId: null as number | null,
  toStoreId: null as number | null,
  remark: "",
  items: [{ skuName: "", quantity: 1 }] as any[]
};

const form = reactive(JSON.parse(JSON.stringify(defaultForm)));

const formRules: FormRules = {
  fromStoreId: [{ required: true, message: "请选择调出门店", trigger: "change" }],
  toStoreId: [{ required: true, message: "请选择调入门店", trigger: "change" }]
};

async function loadTransfers() {
  loading.value = true;
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize };
    if (filterForm.fromStoreId) params.storeId = filterForm.fromStoreId;
    if (filterForm.status) params.status = filterForm.status;
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }
    const data = await fetchTransfers(params);
    tableData.value = data.records || [];
    pagination.total = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data.records || []);
  } catch {
    storeList.value = [];
  }
}

function resetFilter() {
  filterForm.fromStoreId = null;
  filterForm.toStoreId = null;
  filterForm.status = "";
  filterForm.dateRange = [];
  pagination.page = 1;
  loadTransfers();
}

function handleCreate() {
  Object.assign(form, JSON.parse(JSON.stringify(defaultForm)));
  dialogVisible.value = true;
}

function addItem() {
  form.items.push({ skuName: "", quantity: 1 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

function handleView(row: any) {
  currentTransfer.value = row;
  detailVisible.value = true;
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm("确定通过该调拨申请吗？", "提示", { type: "warning" });
    await approveTransfer(row.id);
    ElMessage.success("已通过");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleSubmitTransfer(row: any) {
  try {
    await ElMessageBox.confirm("确定提交该调拨单吗？", "提示", { type: "warning" });
    await submitTransfer(row.id);
    ElMessage.success("已提交");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReject(row: any) {
  try {
    await ElMessageBox.prompt("请输入驳回原因", "驳回调拨", { type: "warning" });
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
    await ElMessageBox.confirm("确定执行发货操作吗？", "提示", { type: "warning" });
    await shipTransfer(row.id);
    ElMessage.success("已发货");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleReceive(row: any) {
  try {
    await ElMessageBox.confirm("确定收货吗？", "提示", { type: "warning" });
    await receiveTransfer(row.id, {});
    ElMessage.success("已收货");
    loadTransfers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancelTransfer(row: any) {
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

async function handleSave() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    if (form.fromStoreId === form.toStoreId) {
      ElMessage.warning("调出门店和调入门店不能相同");
      return;
    }
    submitLoading.value = true;
    try {
      await createTransfer(form);
      ElMessage.success("创建成功");
      dialogVisible.value = false;
      loadTransfers();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "创建失败");
    } finally {
      submitLoading.value = false;
    }
  });
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
</style>