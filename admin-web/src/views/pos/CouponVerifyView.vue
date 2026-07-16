<template>
  <div class="pos-coupon-verify">
    <!-- 扫码核销区域 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div class="card-header">
          <span>扫码核销</span>
          <el-button type="primary" size="small" @click="handleScanFocus">扫码枪扫描</el-button>
        </div>
      </template>
      <div class="scan-area">
        <div class="scan-placeholder">
          <div class="scan-icon">📷</div>
          <div class="scan-text">扫码区域</div>
        </div>
        <p class="scan-tip">请使用扫码枪扫描优惠券二维码</p>
      </div>
      <div style="margin-top: 16px">
        <el-input
          ref="scanInputRef"
          v-model="scanCode"
          placeholder="扫码枪扫描后自动填入，或手动输入"
          size="small"
          @keyup.enter="handleScanVerify"
        >
          <template #append>
            <el-button type="primary" @click="handleScanVerify">确认核销</el-button>
          </template>
        </el-input>
      </div>
    </el-card>

    <!-- 手动核销区域 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span>手工核销</span>
      </template>
      <el-form :model="manualForm" label-width="100px" size="small">
        <el-form-item label="优惠券码">
          <el-input v-model="manualForm.couponCode" placeholder="请输入优惠券码" style="width: 320px" />
        </el-form-item>
        <el-form-item label="关联销售单">
          <el-input v-model="manualForm.saleBillNo" placeholder="选填，关联到销售单" style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleManualVerify" :loading="manualVerifying">手动核销</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 核销结果 -->
    <el-card
      v-if="verifyResult"
      shadow="never"
      style="margin-bottom: 16px"
      :class="{ 'verified-success': verifyResult.success, 'verified-fail': !verifyResult.success }"
    >
      <template #header>
        <div class="card-header">
          <span>核销结果</span>
          <el-tag :type="verifyResult.success ? 'success' : 'danger'" size="small">
            {{ verifyResult.success ? "核销成功" : "核销失败" }}
          </el-tag>
        </div>
      </template>
      <div v-if="verifyResult.success && verifyResult.data">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="优惠券名称">{{ verifyResult.data.couponName }}</el-descriptions-item>
          <el-descriptions-item label="优惠券码">{{ verifyResult.data.couponCode }}</el-descriptions-item>
          <el-descriptions-item label="优惠类型">{{ getCouponTypeName(verifyResult.data.couponType || "") }}</el-descriptions-item>
          <el-descriptions-item label="优惠金额">¥{{ Number(verifyResult.data.amount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="适用商品">{{ verifyResult.data.productName || "全部商品" }}</el-descriptions-item>
          <el-descriptions-item label="有效期">{{ verifyResult.data.validStart }} ~ {{ verifyResult.data.validEnd }}</el-descriptions-item>
          <el-descriptions-item label="核销时间">{{ verifyResult.data.verifiedAt }}</el-descriptions-item>
          <el-descriptions-item label="核销操作员">{{ verifyResult.data.operatorName }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <div v-else>
        <p class="fail-message">{{ verifyResult.message }}</p>
      </div>
    </el-card>

    <!-- 核销历史记录 -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>核销历史记录</span>
          <el-button size="small" @click="loadVerifyHistory">刷新</el-button>
        </div>
      </template>
      <el-table :data="verifyHistory" size="small" v-loading="historyLoading">
        <el-table-column prop="couponCode" label="优惠券码" width="140" />
        <el-table-column prop="couponName" label="优惠券名称" />
        <el-table-column prop="couponType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ getCouponTypeName(row.couponType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="优惠金额" width="100">
          <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="verifyStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.verifyStatus === 'USED' ? 'success' : row.verifyStatus === 'EXPIRED' ? 'danger' : 'warning'" size="small">
              {{ getVerifyStatusName(row.verifyStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="verifiedAt" label="核销时间" width="160" />
        <el-table-column prop="operatorName" label="操作员" width="120" />
      </el-table>
      <div v-if="verifyHistory.length === 0 && !historyLoading" class="empty-tip">暂无核销记录</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { ElInput } from "element-plus";
import {
  verifyStoreCoupon,
  manualVerifyStoreCoupon,
  fetchStoreCouponVerifyRecords
} from "../../api";
import { getErrorMessage } from "../../api";

interface VerifyResultData {
  couponName?: string;
  couponCode?: string;
  couponType?: string;
  amount?: number;
  productName?: string;
  validStart?: string;
  validEnd?: string;
  verifiedAt?: string;
  operatorName?: string;
}

interface VerifyResult {
  success: boolean;
  message: string;
  data?: VerifyResultData;
}

const scanCode = ref("");
const scanInputRef = ref<InstanceType<typeof ElInput> | null>(null);
const manualForm = ref({
  couponCode: "",
  saleBillNo: ""
});
const manualVerifying = ref(false);
const verifyResult = ref<VerifyResult | null>(null);
const verifyHistory = ref<any[]>([]);
const historyLoading = ref(false);

function getCouponTypeName(type: string) {
  const map: Record<string, string> = {
    FIXED: "固定金额",
    PERCENT: "百分比折扣",
    FULL_REDUCTION: "满减"
  };
  return map[type] || type;
}

function getVerifyStatusName(status: string) {
  const map: Record<string, string> = {
    USED: "已使用",
    UNUSED: "未使用",
    EXPIRED: "已过期",
    INVALID: "无效"
  };
  return map[status] || status;
}

function handleScanFocus() {
  scanInputRef.value?.focus();
}

async function handleScanVerify() {
  if (!scanCode.value.trim()) {
    ElMessage.warning("请输入优惠券码");
    return;
  }
  await doVerify(scanCode.value.trim());
  scanCode.value = "";
}

async function handleManualVerify() {
  if (!manualForm.value.couponCode.trim()) {
    ElMessage.warning("请输入优惠券码");
    return;
  }
  manualVerifying.value = true;
  try {
    const data = await manualVerifyStoreCoupon({
      couponCode: manualForm.value.couponCode.trim(),
      saleBillNo: manualForm.value.saleBillNo.trim() || undefined
    });
    verifyResult.value = {
      success: true,
      message: "核销成功",
      data
    };
    ElMessage.success("优惠券核销成功");
    manualForm.value = { couponCode: "", saleBillNo: "" };
    loadVerifyHistory();
  } catch (error) {
    verifyResult.value = {
      success: false,
      message: getErrorMessage(error, "核销失败")
    };
    ElMessage.error(getErrorMessage(error, "核销失败"));
  } finally {
    manualVerifying.value = false;
  }
}

async function doVerify(code: string) {
  try {
    const data = await verifyStoreCoupon(code);
    verifyResult.value = {
      success: true,
      message: "核销成功",
      data
    };
    ElMessage.success("优惠券核销成功");
    loadVerifyHistory();
  } catch (error) {
    verifyResult.value = {
      success: false,
      message: getErrorMessage(error, "核销失败")
    };
    ElMessage.error(getErrorMessage(error, "核销失败"));
  }
}

async function loadVerifyHistory() {
  historyLoading.value = true;
  try {
    const data = await fetchStoreCouponVerifyRecords({ status: "USED", page: 1, pageSize: 20 });
    verifyHistory.value = data?.records || [];
  } catch {
    ElMessage.warning("加载核销历史失败");
  } finally {
    historyLoading.value = false;
  }
}

onMounted(() => {
  loadVerifyHistory();
});
</script>

<style scoped>
.pos-coupon-verify {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.scan-area {
  text-align: center;
  padding: 32px;
}
.scan-placeholder {
  width: 240px;
  height: 240px;
  margin: 0 auto;
  background: #f5f7fa;
  border: 2px dashed #d9d9d9;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}
.scan-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.scan-tip {
  margin-top: 16px;
  color: #909399;
}
.verified-success {
  border-color: #67c23a;
}
.verified-success :deep(.el-card__header) {
  border-bottom-color: #67c23a;
}
.verified-fail {
  border-color: #f56c6c;
}
.verified-fail :deep(.el-card__header) {
  border-bottom-color: #f56c6c;
}
.fail-message {
  color: #f56c6c;
  font-size: 16px;
  text-align: center;
  padding: 20px;
}
.empty-tip {
  text-align: center;
  padding: 20px;
  color: #999;
}
</style>
