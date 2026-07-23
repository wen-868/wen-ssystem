<template>
  <div class="page">
    <PageCard title="采购计划">
      <template #extra>
        <el-select v-model="statusFilter" placeholder="状态" size="default" style="width: 120px" clearable @change="loadList">
          <el-option label="草稿" value="DRAFT" />
          <el-option label="已审批" value="APPROVED" />
          <el-option label="已转换" value="CONVERTED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showCreateDialog">新建计划</el-button>
        <el-button @click="showReplenishDialog">智能补货建议</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
      >
        <template #planType="{ row }">
          <el-tag v-if="row.planType === 'AUTO_REPLENISH'" type="success" size="small">智能补货</el-tag>
          <el-tag v-else size="small">手动</el-tag>
        </template>
        <template #totalAmount="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'DRAFT'" type="warning">草稿</el-tag>
          <el-tag v-else-if="row.status === 'APPROVED'" type="success">已审批</el-tag>
          <el-tag v-else-if="row.status === 'CONVERTED'" type="primary">已转换</el-tag>
          <el-tag v-else-if="row.status === 'CANCELLED'" type="info">已取消</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="handleApprove(row)">审批</el-button>
          <el-button v-if="row.status === 'APPROVED'" size="small" link type="primary" @click="handleConvert(row)">转采购</el-button>
          <el-button v-if="row.status === 'DRAFT' || row.status === 'APPROVED'" size="small" link type="danger" @click="handleCancel(row)">取消</el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 新建计划弹窗 -->
    <el-dialog v-model="createVisible" title="新建采购计划" width="720px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="createForm" :rules="rules" label-width="100px">
        <el-form-item label="计划名称" prop="planName">
          <el-input v-model="createForm.planName" placeholder="如：6月补货计划" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-select v-model="createForm.supplierId" filterable placeholder="可选" clearable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品明细">
          <el-table :data="createForm.items" size="small" border>
            <el-table-column prop="skuName" label="商品" minWidth="130" />
            <el-table-column prop="spec" label="规格" width="80" />
            <el-table-column prop="currentStock" label="库存" width="60" />
            <el-table-column prop="safetyStock" label="安全库存" width="80" />
            <el-table-column prop="planQty" label="采购量" width="100">
              <template #default="{ row, $index }">
                <el-input-number v-model="row.planQty" :min="0" size="small" style="width: 90px" />
              </template>
            </el-table-column>
            <el-table-column prop="estimatedPrice" label="单价" width="90">
              <template #default="{ row, $index }">
                <el-input-number v-model="row.estimatedPrice" :min="0" :precision="2" size="small" style="width: 80px" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60">
              <template #default="{ $index }">
                <el-button size="small" type="danger" link @click="removeItem($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" style="margin-top: 8px" @click="addItem">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 智能补货建议弹窗 -->
    <el-dialog v-model="replenishVisible" title="智能补货建议" width="720px" :close-on-click-modal="false">
      <el-table :data="suggestions" size="small" border v-loading="suggestLoading">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="skuName" label="商品" minWidth="140" />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column prop="spec" label="规格" width="80" />
        <el-table-column prop="currentStock" label="库存" width="60" />
        <el-table-column prop="safetyStock" label="安全库存" width="80" />
        <el-table-column prop="suggestedQty" label="建议量" width="80">
          <template #default="{ row }">
            <span class="suggest-qty">{{ row.suggestedQty }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="estimatedPrice" label="预估单价" width="90">
          <template #default="{ row }">¥{{ Number(row.estimatedPrice || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="replenishVisible = false">取消</el-button>
        <el-button type="primary" :loading="replenishCreateLoading" @click="createFromReplenish">生成采购计划</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <DetailDrawer v-model="detailVisible" title="采购计划详情" width="720px">
      <template v-if="currentDetail">
        <el-descriptions :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="计划单号">{{ currentDetail.planNo }}</el-descriptions-item>
          <el-descriptions-item label="计划名称">{{ currentDetail.planName }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentDetail.supplierName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentDetail.status === 'DRAFT'" type="warning">草稿</el-tag>
            <el-tag v-else-if="currentDetail.status === 'APPROVED'" type="success">已审批</el-tag>
            <el-tag v-else-if="currentDetail.status === 'CONVERTED'" type="primary">已转换</el-tag>
            <el-tag v-else-if="currentDetail.status === 'CANCELLED'" type="info">已取消</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商品数">{{ currentDetail.itemCount }}</el-descriptions-item>
          <el-descriptions-item label="计划金额">¥{{ Number(currentDetail.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item v-if="currentDetail.convertedOrderNo" label="采购单号" :span="2">
            {{ currentDetail.convertedOrderNo }}
          </el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-bottom: 10px">商品明细</h4>
        <el-table :data="currentDetail.items || []" size="small" border>
          <el-table-column prop="skuName" label="商品" minWidth="130" />
          <el-table-column prop="spec" label="规格" width="80" />
          <el-table-column prop="currentStock" label="库存" width="60" />
          <el-table-column prop="safetyStock" label="安全库存" width="80" />
          <el-table-column prop="suggestedQty" label="建议量" width="70" />
          <el-table-column prop="planQty" label="采购量" width="70" />
          <el-table-column prop="estimatedPrice" label="单价" width="80">
            <template #default="{ row }">¥{{ Number(row.estimatedPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotalAmount" label="小计" width="90">
            <template #default="{ row }">¥{{ Number(row.subtotalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchPurchasePlans, createPurchasePlan, fetchPurchasePlanDetail,
  approvePurchasePlan, convertPurchasePlanToOrder, cancelPurchasePlan,
  fetchReplenishmentSuggestions, fetchSuppliers
} from "../../api";
import PageCard from "../../components/PageCard.vue";
import DataTable from "../../components/DataTable.vue";
import DetailDrawer from "../../components/DetailDrawer.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref("");

const suppliers = ref<any[]>([]);

const createVisible = ref(false);
const createLoading = ref(false);
const formRef = ref();
const rules = {
  planName: [{ required: true, message: "请输入计划名称", trigger: "blur" }]
};
const createForm = ref({ planName: "", supplierId: null as number | null, items: [] as any[], remark: "" });

const replenishVisible = ref(false);
const suggestLoading = ref(false);
const replenishCreateLoading = ref(false);
const suggestions = ref<any[]>([]);

const detailVisible = ref(false);
const currentDetail = ref<any>(null);

const columns = [
  { prop: "planNo", label: "计划单号", width: 180 },
  { prop: "planName", label: "计划名称", minWidth: 160 },
  { prop: "planType", label: "类型", width: 80, slot: "planType" },
  { prop: "supplierName", label: "供应商", width: 120 },
  { prop: "itemCount", label: "商品数", width: 70 },
  { prop: "totalAmount", label: "金额", width: 110, slot: "totalAmount" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 160 },
  { label: "操作", width: 200, fixed: "right", slot: "actions" }
];

async function loadSuppliers() {
  try {
    const data = await fetchSuppliers();
    suppliers.value = (Array.isArray(data) ? data : (data.records || [])).map((s: any) => ({ id: s.id, name: s.name || s.supplierName }));
  } catch { /* ignore */ }
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchPurchasePlans({ page: page.value, pageSize: pageSize.value, status: statusFilter.value || undefined });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function showCreateDialog() {
  createForm.value = { planName: "", supplierId: null, items: [], remark: "" };
  loadSuppliers();
  createVisible.value = true;
}

function addItem() {
  createForm.value.items.push({
    skuId: 0, skuName: "", categoryName: "", spec: "", unit: "个",
    currentStock: 0, safetyStock: 0, suggestedQty: 0, planQty: 0, estimatedPrice: 0
  });
}

function removeItem(index: number) {
  createForm.value.items.splice(index, 1);
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!createForm.value.planName) { ElMessage.warning("请输入计划名称"); return; }
  if (createForm.value.items.length === 0) { ElMessage.warning("请添加商品"); return; }
  createLoading.value = true;
  try {
    const supplier = createForm.value.supplierId
      ? suppliers.value.find((s: any) => s.id === createForm.value.supplierId)
      : null;
    await createPurchasePlan({
      planName: createForm.value.planName,
      supplierId: createForm.value.supplierId || undefined,
      supplierName: supplier?.name || "",
      items: createForm.value.items,
      remark: createForm.value.remark
    });
    ElMessage.success("创建成功");
    createVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "创建失败");
  } finally {
    createLoading.value = false;
  }
}

async function showReplenishDialog() {
  replenishVisible.value = true;
  suggestLoading.value = true;
  try {
    const data = await fetchReplenishmentSuggestions();
    suggestions.value = Array.isArray(data) ? data : [];
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "获取建议失败");
  } finally {
    suggestLoading.value = false;
  }
}

async function createFromReplenish() {
  replenishCreateLoading.value = true;
  try {
    const items = suggestions.value.map((s: any) => ({
      skuId: s.skuId, skuName: s.skuName, categoryName: s.categoryName, spec: s.spec, unit: s.unit || "个",
      currentStock: s.currentStock, safetyStock: s.safetyStock,
      suggestedQty: s.suggestedQty, planQty: s.suggestedQty, estimatedPrice: s.estimatedPrice
    }));
    await createPurchasePlan({
      planName: "智能补货计划",
      items,
      remark: "系统自动生成"
    });
    ElMessage.success("补货计划已生成");
    replenishVisible.value = false;
    loadList();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "生成失败");
  } finally {
    replenishCreateLoading.value = false;
  }
}

async function viewDetail(row: any) {
  try {
    const data = await fetchPurchasePlanDetail(row.id);
    currentDetail.value = data;
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  }
}

async function handleApprove(row: any) {
  try { await ElMessageBox.confirm("确认审批此采购计划？", "审批确认", { type: "warning" }); } catch { return; }
  try {
    await approvePurchasePlan(row.id);
    ElMessage.success("审批通过");
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "审批失败"); }
}

async function handleConvert(row: any) {
  try { await ElMessageBox.confirm("确认将此计划转为采购订单？", "转换确认", { type: "warning" }); } catch { return; }
  try {
    const result = await convertPurchasePlanToOrder(row.id);
    ElMessage.success(`已生成采购订单 ${result.orderNo}`);
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "转换失败"); }
}

async function handleCancel(row: any) {
  try { await ElMessageBox.confirm("确认取消此计划？", "取消确认", { type: "warning" }); } catch { return; }
  try {
    await cancelPurchasePlan(row.id);
    ElMessage.success("已取消");
    loadList();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "取消失败"); }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.page { padding: 0; }
.suggest-qty { color: #e6a23c; font-weight: 700; }
</style>
