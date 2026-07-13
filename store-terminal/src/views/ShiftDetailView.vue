<template>
  <div>
    <el-button @click="goBack" style="margin-bottom: 16px">← 返回列表</el-button>

    <el-card v-if="shift" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>交接班详情</span>
          <el-tag :type="getStatusTagType(shift.status)" size="small">
            {{ getStatusName(shift.status) }}
          </el-tag>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="交接班编号">{{ shift.shiftNo }}</el-descriptions-item>
        <el-descriptions-item label="班次类型">
          <el-tag :type="getShiftTypeTagType(shift.shiftType)" size="small">
            {{ getShiftTypeName(shift.shiftType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作员">{{ shift.operatorName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ shift.startTime || "-" }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ shift.endTime || "-" }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ shift.remark || "-" }}</el-descriptions-item>
        <el-descriptions-item label="销售额">{{ formatYuan(shift.totalSalesAmount || 0) }}</el-descriptions-item>
        <el-descriptions-item label="订单数">{{ shift.totalOrders || 0 }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 销售统计 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>班次销售统计</span>
          <el-button size="small" @click="loadSalesStats">刷新</el-button>
        </div>
      </template>
      <div v-if="salesStats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px">
        <div class="stat-card">
          <div class="stat-value">{{ formatYuan(salesStats.totalAmount || 0) }}</div>
          <div class="stat-label">销售总额</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ salesStats.cashAmount || 0 }}</div>
          <div class="stat-label">现金收款</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ salesStats.wechatAmount || 0 }}</div>
          <div class="stat-label">微信收款</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ salesStats.alipayAmount || 0 }}</div>
          <div class="stat-label">支付宝收款</div>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 20px; color: #999">暂无销售统计数据</div>
    </el-card>

    <!-- 库存盘点核对 -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>库存盘点核对</span>
          <el-button
            v-if="shift.status === 'IN_PROGRESS' && !stockCheckSubmitted"
            type="primary"
            size="small"
            @click="showStockCheckDialog = true"
          >
            提交盘点
          </el-button>
        </div>
      </template>
      <el-table :data="stockCheckItems" size="small">
        <el-table-column prop="skuName" label="商品名称" />
        <el-table-column prop="skuCode" label="商品编码" width="120" />
        <el-table-column prop="bookQty" label="账面数量" width="100" />
        <el-table-column prop="actualQty" label="实际数量" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.diffQty !== 0 ? '#e6a23c' : '#67c23a' }">
              {{ row.actualQty || "-" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="diffQty" label="差异数量" width="100">
          <template #default="{ row }">
            <span v-if="row.diffQty !== 0" :style="{ color: row.diffQty > 0 ? '#67c23a' : '#f56c6c' }">
              {{ row.diffQty > 0 ? "+" : "" }}{{ row.diffQty }}
            </span>
            <span v-else style="color: #67c23a">无差异</span>
          </template>
        </el-table-column>
        <el-table-column prop="diffReason" label="差异原因" />
        <el-table-column label="操作" width="120" v-if="shift.status === 'IN_PROGRESS' && !stockCheckSubmitted">
          <template #default="{ row }">
            <el-button size="small" @click="editStockCheckItem(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="stockCheckItems.length === 0" style="text-align: center; padding: 40px; color: #999">
        {{ stockCheckLoading ? "加载中..." : "暂无盘点数据" }}
      </div>
    </el-card>

    <!-- 库存盘点编辑弹窗 -->
    <el-dialog v-model="showStockCheckDialog" title="库存盘点核对" width="600px">
      <el-table :data="stockCheckItems" size="small">
        <el-table-column prop="skuName" label="商品名称" />
        <el-table-column prop="skuCode" label="商品编码" width="120" />
        <el-table-column prop="bookQty" label="账面数量" width="100" />
        <el-table-column label="实际数量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.actualQty" :min="0" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="差异原因" width="200">
          <template #default="{ row }">
            <el-input v-model="row.diffReason" placeholder="如有差异请填写原因" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showStockCheckDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitStockCheck">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  fetchShiftDetail,
  getShiftSalesStats,
  getShiftStockCheck,
  submitShiftStockCheck
} from "../api";
import { formatYuan } from "../utils/format";

const route = useRoute();
const router = useRouter();

const shift = ref<any>(null);
const salesStats = ref<any>(null);
const stockCheckItems = ref<any[]>([]);
const stockCheckLoading = ref(false);
const stockCheckSubmitted = ref(false);
const showStockCheckDialog = ref(false);

function goBack() {
  router.push("/shift");
}

function getShiftTypeName(type: string) {
  const map: Record<string, string> = {
    MORNING: "早班",
    AFTERNOON: "中班",
    EVENING: "晚班"
  };
  return map[type] || type;
}

function getShiftTypeTagType(type: string) {
  const map: Record<string, string> = {
    MORNING: "success",
    AFTERNOON: "warning",
    EVENING: "info"
  };
  return map[type] || "info";
}

function getStatusName(status: string) {
  const map: Record<string, string> = {
    PENDING: "待开始",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
    VOIDED: "已作废"
  };
  return map[status] || status;
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    PENDING: "info",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    VOIDED: "danger"
  };
  return map[status] || "info";
}

async function loadShiftDetail() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  try {
    const data = await fetchShiftDetail(shiftId);
    shift.value = data;
  } catch {
    ElMessage.warning("交接班详情加载失败");
  }
}

async function loadSalesStats() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  try {
    const data = await getShiftSalesStats(shiftId);
    salesStats.value = data;
  } catch {
    ElMessage.warning("销售统计加载失败");
  }
}

async function loadStockCheck() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  stockCheckLoading.value = true;
  try {
    const data = await getShiftStockCheck(shiftId);
    stockCheckItems.value = data?.items || [];
    stockCheckSubmitted.value = data?.submitted || false;
  } catch {
    ElMessage.warning("库存盘点数据加载失败");
  } finally {
    stockCheckLoading.value = false;
  }
}

function editStockCheckItem(row: any) {
  showStockCheckDialog.value = true;
}

async function handleSubmitStockCheck() {
  const shiftId = Number(route.params.id);
  if (!shiftId) return;
  const items = stockCheckItems.value.map((item) => ({
    skuId: item.skuId,
    bookQty: item.bookQty,
    actualQty: item.actualQty || 0,
    diffReason: item.diffReason || undefined
  }));
  try {
    await submitShiftStockCheck(shiftId, items);
    ElMessage.success("库存盘点提交成功");
    showStockCheckDialog.value = false;
    stockCheckSubmitted.value = true;
    loadStockCheck();
  } catch {
    ElMessage.error("提交失败");
  }
}

onMounted(() => {
  loadShiftDetail();
  loadSalesStats();
  loadStockCheck();
});
</script>

<style scoped>
.stat-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #9b1c31;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
