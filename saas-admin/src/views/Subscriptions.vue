<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <el-select v-model="searchForm.status" placeholder="订阅状态" clearable style="width: 140px;" @change="fetchList">
            <el-option label="生效中" value="ACTIVE" />
            <el-option label="已到期" value="EXPIRED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
          <el-select v-model="searchForm.paymentStatus" placeholder="支付状态" clearable style="width: 140px;" @change="fetchList">
            <el-option label="已支付" value="PAID" />
            <el-option label="待支付" value="UNPAID" />
            <el-option label="已退款" value="REFUNDED" />
          </el-select>
        </div>
        <el-button type="primary" @click="showCreateDialog = true">新建订阅</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="subscriptionNo" label="订阅编号" width="160" />
        <el-table-column prop="tenantName" label="租户" min-width="140" />
        <el-table-column prop="planName" label="套餐" width="120" />
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600; color: #ef4444;">¥{{ formatPrice(row.amount) }}</span>
            <span v-if="row.originalAmount" style="font-size: 12px; color: var(--text-secondary); text-decoration: line-through; margin-left: 6px;">¥{{ formatPrice(row.originalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="periodLabel" label="周期" width="100" />
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">
            <div style="font-size: 12px;">{{ row.startDate }} ~ {{ row.endDate }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="订阅状态" width="100">
          <template #default="{ row }">
            <el-tag :type="subStatusType(row.status)" size="small">{{ subStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paymentStatus" label="支付状态" width="100">
          <template #default="{ row }">
            <el-tag :type="payStatusType(row.paymentStatus)" size="small">{{ payStatusLabel(row.paymentStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="success" size="small" @click="handleRenew(row)">续费</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="warning" size="small" @click="handleChangePlan(row)">变更套餐</el-button>
            <el-button v-if="row.paymentStatus === 'UNPAID'" link type="primary" size="small" @click="handlePay(row)">支付</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="danger" size="small" @click="handleCancel(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无订阅数据" />

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchList"
        />
      </div>
    </el-card>

    <!-- 新建订阅 -->
    <el-dialog v-model="showCreateDialog" title="新建订阅" width="560px" :close-on-click-modal="false">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="120px">
        <el-form-item label="租户" prop="tenantId">
          <el-select v-model="createForm.tenantId" placeholder="请选择租户" filterable style="width: 100%;">
            <el-option v-for="t in tenantOptions" :key="t.id" :label="t.companyName" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="套餐" prop="planId">
          <el-select v-model="createForm.planId" placeholder="请选择套餐" style="width: 100%;" @change="onPlanChange">
            <el-option v-for="p in planOptions" :key="p.id" :label="`${p.planName} (¥${p.price})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="createForm.amount" :min="0" :precision="2" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="开始日期" prop="startDate">
          <el-date-picker v-model="createForm.startDate" type="date" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="结束日期" prop="endDate">
          <el-date-picker v-model="createForm.endDate" type="date" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">确认新建</el-button>
      </template>
    </el-dialog>

    <!-- 续费 -->
    <el-dialog v-model="showRenewDialog" title="续费" width="480px" :close-on-click-modal="false">
      <el-form :model="renewForm" ref="renewFormRef" label-width="120px">
        <el-form-item label="当前套餐">{{ renewTarget?.planName }}</el-form-item>
        <el-form-item label="续费金额" prop="amount">
          <el-input-number v-model="renewForm.amount" :min="0" :precision="2" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="续至日期" prop="endDate">
          <el-date-picker v-model="renewForm.endDate" type="date" placeholder="选择日期" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenewDialog = false">取消</el-button>
        <el-button type="primary" :loading="renewLoading" @click="doRenew">确认续费</el-button>
      </template>
    </el-dialog>

    <!-- 变更套餐 -->
    <el-dialog v-model="showChangeDialog" title="变更套餐" width="480px" :close-on-click-modal="false">
      <el-form :model="changeForm" ref="changeFormRef" label-width="120px">
        <el-form-item label="当前套餐">{{ changeTarget?.planName }}</el-form-item>
        <el-form-item label="新套餐" prop="newPlanId">
          <el-select v-model="changeForm.newPlanId" placeholder="请选择新套餐" style="width: 100%;">
            <el-option v-for="p in planOptions" :key="p.id" :label="`${p.planName} (¥${p.price})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="补差金额" prop="amount">
          <el-input-number v-model="changeForm.amount" :min="0" :precision="2" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangeDialog = false">取消</el-button>
        <el-button type="primary" :loading="changeLoading" @click="doChangePlan">确认变更</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { getSubscriptions, createSubscription, renewSubscription, changeSubscriptionPlan, cancelSubscription, paySubscription, getPlans, getTenants } from "../api";

const router = useRouter();

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const searchForm = reactive({ status: "", paymentStatus: "" });

function subStatusLabel(s: string) {
  const map: Record<string, string> = { ACTIVE: "生效中", EXPIRED: "已到期", CANCELLED: "已取消" };
  return map[s] || s;
}
function subStatusType(s: string) {
  const map: Record<string, string> = { ACTIVE: "success", EXPIRED: "danger", CANCELLED: "info" };
  return map[s] || "info";
}
function payStatusLabel(s: string) {
  const map: Record<string, string> = { PAID: "已支付", UNPAID: "待支付", REFUNDED: "已退款" };
  return map[s] || s;
}
function payStatusType(s: string) {
  const map: Record<string, string> = { PAID: "success", UNPAID: "warning", REFUNDED: "info" };
  return map[s] || "info";
}
function formatPrice(n: number) {
  return n?.toFixed(2) || "0.00";
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getSubscriptions({
      status: searchForm.status || undefined,
      paymentStatus: searchForm.paymentStatus || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = (data.records || []).map((r: any) => ({
      ...r,
      periodLabel: r.planType === "PERMANENT" ? "永久" : `${r.periodMonths || 0}个月`
    }));
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function goDetail(id: number) {
  router.push(`/subscriptions/${id}`);
}

// ==================== 新建订阅 ====================
const showCreateDialog = ref(false);
const createLoading = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  tenantId: null as number | null,
  planId: null as number | null,
  amount: 0,
  startDate: "",
  endDate: "",
  remark: ""
});
const createRules: FormRules = {
  tenantId: [{ required: true, message: "请选择租户", trigger: "change" }],
  planId: [{ required: true, message: "请选择套餐", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  startDate: [{ required: true, message: "请选择开始日期", trigger: "change" }],
  endDate: [{ required: true, message: "请选择结束日期", trigger: "change" }]
};
const tenantOptions = ref<any[]>([]);
const planOptions = ref<any[]>([]);

async function loadOptions() {
  try {
    const [tRes, pRes] = await Promise.all([
      getTenants({ pageSize: 999 }),
      getPlans()
    ]);
    tenantOptions.value = (tRes.data?.data?.records || []);
    const pData = pRes.data?.data || (pRes as any).data || pRes;
    planOptions.value = (pData.records || []);
  } catch { /* ignore */ }
}

function onPlanChange(planId: number | null) {
  const plan = planOptions.value.find((p: any) => p.id === planId);
  if (plan) {
    createForm.amount = plan.price || 0;
    if (plan.durationDays && createForm.startDate) {
      const start = new Date(createForm.startDate);
      const end = new Date(start.getTime() + plan.durationDays * 86400000);
      createForm.endDate = end.toISOString().split("T")[0];
    }
  }
}

async function handleCreate() {
  try {
    await createFormRef.value?.validate();
  } catch { return; }
  createLoading.value = true;
  try {
    await createSubscription(createForm);
    ElMessage.success("订阅创建成功");
    showCreateDialog.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "创建失败");
  } finally {
    createLoading.value = false;
  }
}

// ==================== 续费 ====================
const showRenewDialog = ref(false);
const renewLoading = ref(false);
const renewTarget = ref<any>(null);
const renewForm = reactive({ amount: 0, endDate: "" });

function handleRenew(row: any) {
  renewTarget.value = row;
  renewForm.amount = row.amount || 0;
  renewForm.endDate = "";
  showRenewDialog.value = true;
}

async function doRenew() {
  if (!renewForm.endDate) { ElMessage.warning("请选择续至日期"); return; }
  renewLoading.value = true;
  try {
    await renewSubscription(renewTarget.value.id, {
      amount: renewForm.amount,
      endDate: renewForm.endDate
    });
    ElMessage.success("续费成功");
    showRenewDialog.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "续费失败");
  } finally {
    renewLoading.value = false;
  }
}

// ==================== 变更套餐 ====================
const showChangeDialog = ref(false);
const changeLoading = ref(false);
const changeTarget = ref<any>(null);
const changeForm = reactive({ newPlanId: null as number | null, amount: 0 });

function handleChangePlan(row: any) {
  changeTarget.value = row;
  changeForm.newPlanId = null;
  changeForm.amount = 0;
  showChangeDialog.value = true;
}

async function doChangePlan() {
  if (!changeForm.newPlanId) { ElMessage.warning("请选择新套餐"); return; }
  changeLoading.value = true;
  try {
    await changeSubscriptionPlan(changeTarget.value.id, {
      newPlanId: changeForm.newPlanId,
      amount: changeForm.amount || 0
    });
    ElMessage.success("套餐变更成功");
    showChangeDialog.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "变更失败");
  } finally {
    changeLoading.value = false;
  }
}

// ==================== 取消 ====================
async function handleCancel(row: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      `确定要取消订阅 "${row.subscriptionNo}" 吗？`,
      "取消确认",
      { confirmButtonText: "确定取消", cancelButtonText: "返回", inputPlaceholder: "取消原因（选填）" }
    ).catch(() => ({ value: undefined }));
    if (value === undefined) return;
    await cancelSubscription(row.id, value || undefined);
    ElMessage.success("已取消");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "取消失败");
  }
}

// ==================== 支付 ====================
async function handlePay(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认收到订阅 "${row.subscriptionNo}" 的支付款项 ¥${formatPrice(row.amount)}？`,
      "支付确认",
      { confirmButtonText: "确认已支付", cancelButtonText: "取消", type: "warning" }
    );
  } catch { return; }
  try {
    await paySubscription(row.id, { paymentMethod: "MANUAL" });
    ElMessage.success("支付确认成功");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "支付确认失败");
  }
}

onMounted(() => {
  fetchList();
  loadOptions();
});
</script>