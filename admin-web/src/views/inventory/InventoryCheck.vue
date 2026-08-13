<template>
<div class="page">
<div class="page-header">
      <h2>库存盘点</h2>
      <p class="page-desc">管理库存盘点任务，支持开始、完成、取消和差异处理</p>
    </div>

    <PageCard>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="门店">
          <el-select
            v-model="filterForm.storeId"
            placeholder="全部门店"
            clearable
            filterable
            style="width: 200px"
            @change="loadChecks"
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
            @change="loadChecks"
          >
            <el-option label="草稿" value="DRAFT" />
            <el-option label="进行中" value="IN_PROGRESS" />
            <el-option label="已完成" value="COMPLETED" />
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
            @change="loadChecks"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadChecks">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </PageCard>

    <PageCard>
      <template #extra>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新建盘点
        </el-button>
        <el-button @click="loadChecks">
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
        @update:page="loadChecks"
        @update:page-size="loadChecks"
      >
        <template #status="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
          <el-tag v-else-if="row.status === 'IN_PROGRESS'" type="warning" size="small">进行中</el-tag>
          <el-tag v-else-if="row.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
          <el-tag v-else-if="row.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
          <el-tag v-else size="small">{{ fmtStatus(row.status) }}</el-tag>
        </template>

        <template #actions="{ row }">
          <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
          <el-button
            v-if="row.status === 'DRAFT'"
            link
            type="success"
            size="small"
            @click="handleStart(row)"
          >
            开始
          </el-button>
          <el-button
            v-if="row.status === 'IN_PROGRESS'"
            link
            type="primary"
            size="small"
            @click="handleComplete(row)"
          >
            完成
          </el-button>
          <el-button
            v-if="row.status === 'IN_PROGRESS'"
            link
            type="warning"
            size="small"
            @click="handleDiff(row)"
          >
            差异处理
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT' || row.status === 'IN_PROGRESS'"
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

    <el-dialog
      v-model="dialogVisible"
      title="新建盘点"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="盘点门店" prop="storeId">
          <el-select
            v-model="form.storeId"
            placeholder="请选择门店"
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
        <el-form-item label="盘点商品">
          <el-table :data="form.items" size="small" border>
            <el-table-column label="商品名称" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.skuName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column label="理论库存" width="110">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.theoreticalQty"
                  :min="0"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="实际库存" width="110">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.actualQty"
                  :min="0"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="差异" width="80">
              <template #default="{ row }">
                <span :class="{ 'diff-positive': diff(row) > 0, 'diff-negative': diff(row) < 0 }">
                  {{ diff(row) > 0 ? '+' : '' }}{{ diff(row) }}
                </span>
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
        <FormFooter
          :loading="submitLoading"
          :show-save-and-add="false"
          save-text="创建"
          @cancel="dialogVisible = false"
          @save="handleSubmit"
        />
      </template>
    </el-dialog>

    <DetailDrawer v-model="detailVisible" title="盘点详情" width="720px">
      <template v-if="currentCheck">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="盘点单号">{{ currentCheck.checkNo }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ currentCheck.storeName || currentCheck.storeId }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentCheck.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
            <el-tag v-else-if="currentCheck.status === 'IN_PROGRESS'" type="warning" size="small">进行中</el-tag>
            <el-tag v-else-if="currentCheck.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
            <el-tag v-else-if="currentCheck.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
            <el-tag v-else size="small">{{ currentCheck.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商品总数">{{ currentCheck.totalItems || 0 }}</el-descriptions-item>
          <el-descriptions-item label="差异商品数">{{ currentCheck.diffItems || 0 }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentCheck.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentCheck.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">盘点明细</h4>
        <div class="table-card">
<el-table :data="currentCheck.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="theoreticalQty" label="理论库存" width="90" />
          <el-table-column prop="actualQty" label="实际库存" width="90" />
          <el-table-column label="差异" width="80">
            <template #default="{ row }">
              <span :class="{ 'diff-positive': (row.actualQty || 0) - (row.theoreticalQty || 0) > 0, 'diff-negative': (row.actualQty || 0) - (row.theoreticalQty || 0) < 0 }">
                {{ ((row.actualQty || 0) - (row.theoreticalQty || 0)) > 0 ? '+' : '' }}{{ (row.actualQty || 0) - (row.theoreticalQty || 0) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
</div>
      </template>
    </DetailDrawer>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { fmtStatus } from "../../utils/enums";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import {
  fetchStockChecks,
  createStockCheck,
  startStockCheck,
  completeStockCheck,
  cancelStockCheck,
  handleStockCheckDiff,
  fetchStores
} from "../../api";
import { formatDate } from "../../utils/format";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";
import DetailDrawer from "../../components/DetailDrawer.vue";
import FormFooter from "../../components/FormFooter.vue";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const storeList = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentCheck = ref<any>(null);
const formRef = ref<FormInstance>();

const filterForm = reactive({
  storeId: null as number | null,
  status: "",
  dateRange: [] as string[]
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const columns = [
  { prop: "checkNo", label: "盘点单号", width: 180 },
  { prop: "storeName", label: "门店", minWidth: 160 },
  { prop: "status", label: "状态", width: 100, slot: "status" },
  { prop: "totalItems", label: "商品总数", width: 100 },
  { prop: "diffItems", label: "差异数", width: 80 },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { label: "操作", width: 240, fixed: "right", slot: "actions" }
];

const defaultForm = {
  storeId: null as number | null,
  remark: "",
  items: [{ skuName: "", theoreticalQty: 0, actualQty: 0 }] as any[]
};

const form = reactive(JSON.parse(JSON.stringify(defaultForm)));

const formRules: FormRules = {
  storeId: [{ required: true, message: "请选择门店", trigger: "change" }]
};

function diff(item: any) {
  return (item.actualQty || 0) - (item.theoreticalQty || 0);
}

async function loadChecks() {
  loading.value = true;
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize };
    if (filterForm.storeId) params.storeId = filterForm.storeId;
    if (filterForm.status) params.status = filterForm.status;
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.dateStart = filterForm.dateRange[0];
      params.dateEnd = filterForm.dateRange[1];
    }
    const data = await fetchStockChecks(params);
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
  filterForm.storeId = null;
  filterForm.status = "";
  filterForm.dateRange = [];
  pagination.page = 1;
  loadChecks();
}

function handleCreate() {
  Object.assign(form, JSON.parse(JSON.stringify(defaultForm)));
  dialogVisible.value = true;
}

function addItem() {
  form.items.push({ skuName: "", theoreticalQty: 0, actualQty: 0 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

function handleView(row: any) {
  currentCheck.value = row;
  detailVisible.value = true;
}

async function handleStart(row: any) {
  try {
    await ElMessageBox.confirm("确定开始该盘点任务吗？", "提示", { type: "warning" });
    await startStockCheck(row.id);
    ElMessage.success("盘点已开始");
    loadChecks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleComplete(row: any) {
  try {
    await ElMessageBox.confirm("确定完成该盘点任务吗？完成后将不可修改。", "提示", { type: "warning" });
    await completeStockCheck(row.id);
    ElMessage.success("盘点已完成");
    loadChecks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定取消该盘点任务吗？", "提示", { type: "warning" });
    await cancelStockCheck(row.id);
    ElMessage.success("已取消");
    loadChecks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleDiff(row: any) {
  try {
    const { value: itemId } = await ElMessageBox.prompt("请输入需要处理差异的商品ID", "差异处理", {
      type: "info",
      inputType: "number"
    });
    if (!itemId) return;
    await handleStockCheckDiff(row.id, { itemId: Number(itemId) });
    ElMessage.success("差异处理完成");
    loadChecks();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "操作失败");
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createStockCheck(form);
      ElMessage.success("创建成功");
      dialogVisible.value = false;
      loadChecks();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "创建失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadChecks();
  loadStores();
});
</script>

<style scoped>
.check-page {
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
  color: var(--gray-400);
  font-size: 14px;
}

.diff-positive {
  color: var(--color-success);
  font-weight: 600;
}

.diff-negative {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
