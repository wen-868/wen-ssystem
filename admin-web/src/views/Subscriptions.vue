<template>
  <div class="page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="订阅管理" name="subscriptions">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>订阅列表</span>
              <div class="header-actions">
                <el-select
                  v-model="subStatusFilter"
                  placeholder="状态"
                  size="default"
                  style="width: 140px; margin-right: 10px"
                  clearable
                  @change="loadSubscriptions"
                >
                  <el-option label="生效中" value="ACTIVE" />
                  <el-option label="已过期" value="EXPIRED" />
                  <el-option label="已取消" value="CANCELLED" />
                </el-select>
                <el-button type="primary" @click="openCreateSubDialog">新增订阅</el-button>
              </div>
            </div>
          </template>

          <div v-if="expiringList.length > 0 || expiredList.length > 0" style="margin-bottom: 16px">
            <el-alert
              v-if="expiringList.length > 0"
              :title="`有 ${expiringList.length} 个订阅即将到期`"
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom: 8px"
            />
            <el-alert
              v-if="expiredList.length > 0"
              :title="`有 ${expiredList.length} 个订阅已过期`"
              type="error"
              show-icon
              :closable="false"
            />
          </div>

          <el-table :data="subscriptions" v-loading="subLoading" stripe>
            <el-table-column prop="tenantName" label="租户名称" min-width="140" />
            <el-table-column prop="planName" label="套餐名称" min-width="120" />
            <el-table-column label="开始日期" width="120">
              <template #default="{ row }">
                {{ formatDate(row.startDate) }}
              </template>
            </el-table-column>
            <el-table-column label="结束日期" width="120">
              <template #default="{ row }">
                {{ formatDate(row.endDate) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">生效中</el-tag>
                <el-tag v-else-if="row.status === 'EXPIRED'" type="danger">已过期</el-tag>
                <el-tag v-else-if="row.status === 'CANCELLED'" type="info">已取消</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">
                {{ formatYuan(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="success" @click="handlePay(row)" v-if="row.status === 'ACTIVE'">付款</el-button>
                <el-button size="small" link type="primary" @click="openChangePlanDialog(row)" v-if="row.status === 'ACTIVE'">变更套餐</el-button>
                <el-button size="small" link type="warning" @click="handleCancel(row)" v-if="row.status === 'ACTIVE'">取消</el-button>
                <el-button size="small" link type="success" @click="handleRenew(row)" v-if="row.status === 'EXPIRED' || row.status === 'CANCELLED'">续费</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="subTotal"
              :page-size="subPageSize"
              :current-page="subPage"
              @size-change="handleSubSizeChange"
              @current-change="handleSubPageChange"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="套餐管理" name="plans">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>套餐列表</span>
              <div class="header-actions">
                <el-button type="primary" @click="openCreatePlanDialog">新增套餐</el-button>
              </div>
            </div>
          </template>

          <el-table :data="plans" v-loading="planLoading" stripe>
            <el-table-column prop="name" label="套餐名称" min-width="140" />
            <el-table-column label="价格" width="120">
              <template #default="{ row }">
                {{ formatYuan(row.price) }}
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="时长(月)" width="100" />
            <el-table-column label="功能特性" min-width="200">
              <template #default="{ row }">
                <el-tag
                  v-for="(feat, idx) in (row.features || [])"
                  :key="idx"
                  size="small"
                  style="margin-right: 6px; margin-bottom: 4px"
                >{{ feat }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createTime) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openEditPlanDialog(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleDeletePlan(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="planTotal"
              :page-size="planPageSize"
              :current-page="planPage"
              @size-change="handlePlanSizeChange"
              @current-change="handlePlanPageChange"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑订阅 -->
    <el-dialog v-model="subDialogVisible" :title="isSubEdit ? '变更套餐' : '新增订阅'" width="480px">
      <el-form ref="subFormRef" :model="subForm" :rules="subRules" label-width="100px">
        <el-form-item label="租户" prop="tenantId" v-if="!isSubEdit">
          <el-select v-model="subForm.tenantId" placeholder="请选择租户" style="width: 100%" filterable>
            <el-option v-for="t in tenantList" :key="t.tenantId" :label="t.name" :value="t.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="套餐" prop="planId">
          <el-select v-model="subForm.planId" placeholder="请选择套餐" style="width: 100%">
            <el-option v-for="p in planList" :key="p.planId || p.id" :label="p.name" :value="p.planId || p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" prop="startDate" v-if="!isSubEdit">
          <el-date-picker v-model="subForm.startDate" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="subSubmitLoading" @click="handleSubSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑套餐 -->
    <el-dialog v-model="planDialogVisible" :title="isPlanEdit ? '编辑套餐' : '新增套餐'" width="520px">
      <el-form ref="planFormRef" :model="planForm" :rules="planRules" label-width="100px">
        <el-form-item label="套餐名称" prop="name">
          <el-input v-model="planForm.name" placeholder="请输入套餐名称" />
        </el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="planForm.price" :min="0" :precision="2" style="width: 100%" placeholder="请输入价格" />
        </el-form-item>
        <el-form-item label="时长(月)" prop="duration">
          <el-input-number v-model="planForm.duration" :min="1" :max="120" style="width: 100%" placeholder="请输入时长" />
        </el-form-item>
        <el-form-item label="功能特性" prop="features">
          <div style="display: flex; gap: 8px; margin-bottom: 8px">
            <el-input v-model="featureInput" placeholder="输入特性后回车添加" @keyup.enter="addFeature" style="flex: 1" />
            <el-button @click="addFeature">添加</el-button>
          </div>
          <el-tag
            v-for="(feat, idx) in planForm.features"
            :key="idx"
            closable
            @close="removeFeature(idx)"
            style="margin-right: 6px; margin-bottom: 4px"
          >{{ feat }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="planSubmitLoading" @click="handlePlanSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { formatDate, formatYuan } from "../utils/format";
import {
  fetchSubscriptions, fetchSubscriptionPlans,
  createSubscription, createSubscriptionPlan, updateSubscriptionPlan,
  changeSubscriptionPlan, cancelSubscription, paySubscription, renewSubscription,
  fetchExpiringSubscriptions, fetchExpiredSubscriptions,
  fetchTenants
} from "../api";

const activeTab = ref("subscriptions");

// ==================== 订阅管理 ====================
const subLoading = ref(false);
const subSubmitLoading = ref(false);
const subscriptions = ref<any[]>([]);
const subTotal = ref(0);
const subPage = ref(1);
const subPageSize = ref(20);
const subStatusFilter = ref("");
const subDialogVisible = ref(false);
const isSubEdit = ref(false);
const subFormRef = ref<FormInstance>();
const editingSubId = ref("");
const tenantList = ref<any[]>([]);
const planList = ref<any[]>([]);
const expiringList = ref<any[]>([]);
const expiredList = ref<any[]>([]);

const subForm = reactive({
  tenantId: "",
  planId: "",
  startDate: ""
});

const subRules: FormRules = {
  tenantId: [{ required: true, message: "请选择租户", trigger: "change" }],
  planId: [{ required: true, message: "请选择套餐", trigger: "change" }]
};

// ==================== 套餐管理 ====================
const planLoading = ref(false);
const planSubmitLoading = ref(false);
const plans = ref<any[]>([]);
const planTotal = ref(0);
const planPage = ref(1);
const planPageSize = ref(20);
const planDialogVisible = ref(false);
const isPlanEdit = ref(false);
const planFormRef = ref<FormInstance>();
const editingPlanId = ref("");
const featureInput = ref("");

const planForm = reactive({
  name: "",
  price: 0,
  duration: 1,
  features: [] as string[]
});

const planRules: FormRules = {
  name: [{ required: true, message: "请填写套餐名称", trigger: "blur" }],
  price: [{ required: true, message: "请填写价格", trigger: "blur" }],
  duration: [{ required: true, message: "请填写时长", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

// ==================== 订阅管理方法 ====================
async function loadSubscriptions() {
  subLoading.value = true;
  try {
    const data = (await fetchSubscriptions({
      page: subPage.value,
      pageSize: subPageSize.value,
      status: subStatusFilter.value || undefined
    })).data;
    const list = data.records || data.list || [];
    subTotal.value = data.total || list.length;
    subscriptions.value = list;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载订阅列表失败"));
  } finally {
    subLoading.value = false;
  }
}

async function loadAlerts() {
  try {
    const [expiring, expired] = (await Promise.all([
      fetchExpiringSubscriptions(),
      fetchExpiredSubscriptions()
    ])).map((r: any) => r.data);
    expiringList.value = expiring || [];
    expiredList.value = expired || [];
  } catch {
    // ignore alert errors
  }
}

async function loadTenantList() {
  try {
    const data = (await fetchTenants({ pageSize: 999 })).data;
    tenantList.value = data.records || data.list || [];
  } catch {
    // ignore
  }
}

async function loadPlanList() {
  try {
    const data = (await fetchSubscriptionPlans({ pageSize: 999 })).data;
    planList.value = data.records || data.list || [];
  } catch {
    // ignore
  }
}

function handleSubSizeChange(size: number) {
  subPageSize.value = size;
  subPage.value = 1;
  loadSubscriptions();
}

function handleSubPageChange(p: number) {
  subPage.value = p;
  loadSubscriptions();
}

function openCreateSubDialog() {
  isSubEdit.value = false;
  editingSubId.value = "";
  subForm.tenantId = "";
  subForm.planId = "";
  subForm.startDate = "";
  subDialogVisible.value = true;
}

function openChangePlanDialog(row: any) {
  isSubEdit.value = true;
  editingSubId.value = row.subscriptionId || row.id;
  subForm.planId = row.planId || "";
  subDialogVisible.value = true;
}

async function handleSubSubmit() {
  if (!subFormRef.value) return;
  await subFormRef.value.validate(async (valid) => {
    if (!valid) return;
    subSubmitLoading.value = true;
    try {
      if (isSubEdit.value) {
        await changeSubscriptionPlan(Number(editingSubId.value), { planId: subForm.planId });
        ElMessage.success("套餐已变更");
      } else {
        await createSubscription({ tenantId: subForm.tenantId, planId: subForm.planId, startDate: subForm.startDate || undefined });
        ElMessage.success("订阅已创建");
      }
      subDialogVisible.value = false;
      loadSubscriptions();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isSubEdit.value ? "变更套餐失败" : "创建订阅失败"));
    } finally {
      subSubmitLoading.value = false;
    }
  });
}

async function handlePay(row: any) {
  try {
    await ElMessageBox.confirm("确定要付款吗？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await paySubscription(row.subscriptionId || row.id);
    ElMessage.success("付款成功");
    loadSubscriptions();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "付款失败"));
    }
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确定要取消该订阅吗？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await cancelSubscription(row.subscriptionId || row.id);
    ElMessage.success("订阅已取消");
    loadSubscriptions();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "取消订阅失败"));
    }
  }
}

async function handleRenew(row: any) {
  try {
    await ElMessageBox.confirm("确定要续费该订阅吗？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    await renewSubscription(row.subscriptionId || row.id);
    ElMessage.success("续费成功");
    loadSubscriptions();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "续费失败"));
    }
  }
}

// ==================== 套餐管理方法 ====================
async function loadPlans() {
  planLoading.value = true;
  try {
    const data = (await fetchSubscriptionPlans({
      page: planPage.value,
      pageSize: planPageSize.value
    })).data;
    const list = data.records || data.list || [];
    planTotal.value = data.total || list.length;
    plans.value = list;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载套餐列表失败"));
  } finally {
    planLoading.value = false;
  }
}

function handlePlanSizeChange(size: number) {
  planPageSize.value = size;
  planPage.value = 1;
  loadPlans();
}

function handlePlanPageChange(p: number) {
  planPage.value = p;
  loadPlans();
}

function openCreatePlanDialog() {
  isPlanEdit.value = false;
  editingPlanId.value = "";
  planForm.name = "";
  planForm.price = 0;
  planForm.duration = 1;
  planForm.features = [];
  featureInput.value = "";
  planDialogVisible.value = true;
}

function openEditPlanDialog(row: any) {
  isPlanEdit.value = true;
  editingPlanId.value = row.planId || row.id;
  planForm.name = row.name || "";
  planForm.price = row.price || 0;
  planForm.duration = row.duration || 1;
  planForm.features = [...(row.features || [])];
  featureInput.value = "";
  planDialogVisible.value = true;
}

function addFeature() {
  const val = featureInput.value.trim();
  if (val && !planForm.features.includes(val)) {
    planForm.features.push(val);
  }
  featureInput.value = "";
}

function removeFeature(idx: number) {
  planForm.features.splice(idx, 1);
}

async function handlePlanSubmit() {
  if (!planFormRef.value) return;
  await planFormRef.value.validate(async (valid) => {
    if (!valid) return;
    planSubmitLoading.value = true;
    try {
      if (isPlanEdit.value) {
        await updateSubscriptionPlan(Number(editingPlanId.value), { ...planForm });
        ElMessage.success("套餐已更新");
      } else {
        await createSubscriptionPlan({ ...planForm });
        ElMessage.success("套餐已创建");
      }
      planDialogVisible.value = false;
      loadPlans();
      loadPlanList();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isPlanEdit.value ? "更新套餐失败" : "创建套餐失败"));
    } finally {
      planSubmitLoading.value = false;
    }
  });
}

async function handleDeletePlan(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除该套餐吗？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    ElMessage.success("套餐已删除");
    loadPlans();
    loadPlanList();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "删除套餐失败"));
    }
  }
}

function handleTabChange(tab: string) {
  if (tab === "subscriptions") {
    loadSubscriptions();
    loadAlerts();
  } else {
    loadPlans();
  }
}

onMounted(() => {
  loadSubscriptions();
  loadAlerts();
  loadTenantList();
  loadPlanList();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>