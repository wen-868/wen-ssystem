<template>
  <div>
    <el-page-header @back="$router.push('/subscriptions')" content="订阅详情" style="margin-bottom: 24px;" />

    <el-card v-loading="loading" v-if="detail">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>订阅编号：{{ detail.subscriptionNo }}</span>
          <div style="display: flex; gap: 8px;">
            <el-button v-if="detail.status === 'ACTIVE'" type="success" size="small" @click="handleRenew">续费</el-button>
            <el-button v-if="detail.status === 'ACTIVE'" type="warning" size="small" @click="handleChangePlan">变更套餐</el-button>
            <el-button v-if="detail.paymentStatus === 'UNPAID'" type="primary" size="small" @click="handlePay">确认支付</el-button>
            <el-button v-if="detail.status === 'ACTIVE'" type="danger" size="small" @click="handleCancel">取消订阅</el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="租户">{{ detail.tenantName }}</el-descriptions-item>
        <el-descriptions-item label="套餐">{{ detail.planName }}</el-descriptions-item>
        <el-descriptions-item label="金额">
          <span style="font-weight: 600; color: #ef4444;">¥{{ formatPrice(detail.amount) }}</span>
          <span v-if="detail.originalAmount" style="font-size: 12px; color: var(--text-secondary); text-decoration: line-through; margin-left: 6px;">¥{{ formatPrice(detail.originalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="订阅状态">
          <el-tag :type="subStatusType(detail.status)" size="small">{{ subStatusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="支付状态">
          <el-tag :type="payStatusType(detail.paymentStatus)" size="small">{{ payStatusLabel(detail.paymentStatus) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="支付方式">{{ detail.paymentMethod || "-" }}</el-descriptions-item>
        <el-descriptions-item label="开始日期">{{ detail.startDate }}</el-descriptions-item>
        <el-descriptions-item label="结束日期">{{ detail.endDate }}</el-descriptions-item>
        <el-descriptions-item label="自动续费">
          <el-tag :type="detail.autoRenew ? 'success' : 'info'" size="small">{{ detail.autoRenew ? '是' : '否' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || "-" }}</el-descriptions-item>
      </el-descriptions>

      <!-- 变更记录 -->
      <el-divider content-position="left">变更记录</el-divider>
      <el-table :data="detail.logs || []" border stripe style="width: 100%;">
        <el-table-column prop="action" label="操作" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="200" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column prop="remark" label="备注" width="150" />
      </el-table>
      <el-empty v-if="!detail.logs?.length" description="暂无变更记录" style="margin: 20px 0;" />
    </el-card>

    <el-empty v-if="!loading && !detail" description="暂无订阅数据" />

    <!-- 续费 -->
    <el-dialog v-model="showRenewDialog" title="续费" width="480px" :close-on-click-modal="false">
      <el-form :model="renewForm" label-width="120px">
        <el-form-item label="当前套餐">{{ detail?.planName }}</el-form-item>
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
      <el-form :model="changeForm" label-width="120px">
        <el-form-item label="当前套餐">{{ detail?.planName }}</el-form-item>
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
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getSubscriptionDetail, renewSubscription, changeSubscriptionPlan, cancelSubscription, paySubscription, getPlans } from "../api";

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);

const loading = ref(false);
const detail = ref<any>(null);

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
function actionLabel(s: string) {
  const map: Record<string, string> = { CREATE: "创建", RENEW: "续费", CHANGE_PLAN: "变更套餐", CANCEL: "取消", PAY: "支付" };
  return map[s] || s;
}
function formatPrice(n: number) {
  return n?.toFixed(2) || "0.00";
}

async function fetchDetail() {
  loading.value = true;
  try {
    const res = await getSubscriptionDetail(id);
    detail.value = res.data?.data || (res as any).data || res;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

// 续费
const showRenewDialog = ref(false);
const renewLoading = ref(false);
const renewForm = reactive({ amount: 0, endDate: "" });

function handleRenew() {
  renewForm.amount = detail.value?.amount || 0;
  renewForm.endDate = "";
  showRenewDialog.value = true;
}

async function doRenew() {
  if (!renewForm.endDate) { ElMessage.warning("请选择续至日期"); return; }
  renewLoading.value = true;
  try {
    await renewSubscription(id, { amount: renewForm.amount, endDate: renewForm.endDate });
    ElMessage.success("续费成功");
    showRenewDialog.value = false;
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "续费失败");
  } finally {
    renewLoading.value = false;
  }
}

// 变更套餐
const showChangeDialog = ref(false);
const changeLoading = ref(false);
const planOptions = ref<any[]>([]);
const changeForm = reactive({ newPlanId: null as number | null, amount: 0 });

async function handleChangePlan() {
  try {
    const pRes = await getPlans();
    const pData = pRes.data?.data || (pRes as any).data || pRes;
    planOptions.value = pData.records || [];
  } catch { /* ignore */ }
  changeForm.newPlanId = null;
  changeForm.amount = 0;
  showChangeDialog.value = true;
}

async function doChangePlan() {
  if (!changeForm.newPlanId) { ElMessage.warning("请选择新套餐"); return; }
  changeLoading.value = true;
  try {
    await changeSubscriptionPlan(id, { newPlanId: changeForm.newPlanId, amount: changeForm.amount || 0 });
    ElMessage.success("套餐变更成功");
    showChangeDialog.value = false;
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "变更失败");
  } finally {
    changeLoading.value = false;
  }
}

// 取消
async function handleCancel() {
  try {
    const { value } = await ElMessageBox.prompt(
      `确定要取消订阅 "${detail.value?.subscriptionNo}" 吗？`,
      "取消确认",
      { confirmButtonText: "确定取消", cancelButtonText: "返回", inputPlaceholder: "取消原因（选填）" }
    ).catch(() => ({ value: undefined }));
    if (value === undefined) return;
    await cancelSubscription(id, value || undefined);
    ElMessage.success("已取消");
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "取消失败");
  }
}

// 支付
async function handlePay() {
  try {
    await ElMessageBox.confirm(
      `确认收到订阅 "${detail.value?.subscriptionNo}" 的支付款项？`,
      "支付确认",
      { confirmButtonText: "确认已支付", cancelButtonText: "取消", type: "warning" }
    );
  } catch { return; }
  try {
    await paySubscription(id, { paymentMethod: "MANUAL" });
    ElMessage.success("支付确认成功");
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "支付确认失败");
  }
}

onMounted(() => {
  fetchDetail();
});
</script>