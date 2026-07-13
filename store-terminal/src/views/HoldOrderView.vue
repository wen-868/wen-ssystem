<template>
  <div>
    <!-- 挂单列表 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>挂单列表</span>
          <div style="display: flex; gap: 12px">
            <el-input v-model="searchKeyword" placeholder="搜索单号或客户名" style="width: 200px" @keyup.enter="loadHoldOrders" />
            <el-button size="small" @click="loadHoldOrders">搜索</el-button>
            <el-button size="small" type="primary" @click="loadHoldOrders">刷新</el-button>
          </div>
        </div>
      </template>
      <div v-if="holdOrders.length === 0" style="text-align: center; padding: 40px; color: #999">
        {{ loading ? '加载中...' : '暂无挂单记录' }}
      </div>
      <div v-else style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px">
        <el-card
          v-for="order in holdOrders"
          :key="order.holdNo"
          style="cursor: pointer; transition: all 0.3s"
          :class="{ 'hover-card': true }"
          @click="showOrderDetail(order)"
        >
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-size: 14px; font-weight: bold">{{ order.holdNo }}</span>
              <el-tag size="small" type="warning">挂单中</el-tag>
            </div>
          </template>
          <div style="margin-bottom: 12px">
            <div style="color: #606266; font-size: 12px">客户：{{ order.customerName || '-' }}</div>
            <div style="color: #909399; font-size: 12px">商品数：{{ order.itemCount }} 件</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div>
              <div style="font-size: 18px; font-weight: bold; color: #9b1c31">{{ formatYuan(order.amount) }}</div>
              <div style="color: #909399; font-size: 12px">{{ order.createdAt }}</div>
            </div>
            <div style="display: flex; gap: 8px">
              <el-button size="small" type="primary" @click.stop="handleRestore(order)">取单</el-button>
              <el-button size="small" type="danger" @click.stop="handleDelete(order)">删除</el-button>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 挂单详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="挂单详情" width="500px">
      <div v-if="selectedOrder">
        <el-descriptions :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="挂单单号">{{ selectedOrder.holdNo }}</el-descriptions-item>
          <el-descriptions-item label="客户姓名">{{ selectedOrder.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户手机号">{{ selectedOrder.customerMobile || '-' }}</el-descriptions-item>
          <el-descriptions-item label="挂单金额">{{ formatYuan(selectedOrder.amount) }}</el-descriptions-item>
          <el-descriptions-item label="商品数量">{{ selectedOrder.itemCount }} 件</el-descriptions-item>
          <el-descriptions-item label="挂单时间">{{ selectedOrder.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ selectedOrder.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="selectedOrder.items || []" size="small">
          <el-table-column prop="skuName" label="商品名称" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column prop="subtotalAmount" label="小计" width="100">
            <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="handleRestore(selectedOrder)" v-if="selectedOrder">取单继续结算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchHoldOrders, restoreHoldOrder, deleteHoldOrder } from "../api";
import { formatYuan } from "../utils/format";

const searchKeyword = ref("");
const holdOrders = ref<any[]>([]);
const loading = ref(false);
const showDetailDialog = ref(false);
const selectedOrder = ref<any>(null);

async function loadHoldOrders() {
  loading.value = true;
  try {
    const params: any = {};
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }
    const data = await fetchHoldOrders(params);
    holdOrders.value = data?.records || [];
  } catch {
    ElMessage.warning("加载挂单失败");
  } finally {
    loading.value = false;
  }
}

function showOrderDetail(order: any) {
  selectedOrder.value = order;
  showDetailDialog.value = true;
}

async function handleRestore(order: any) {
  if (!order) return;
  try {
    await restoreHoldOrder(order.holdNo);
    ElMessage.success("取单成功，可继续结算");
    showDetailDialog.value = false;
    loadHoldOrders();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "取单失败");
  }
}

async function handleDelete(order: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除挂单 ${order.holdNo}？`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteHoldOrder(order.holdNo);
    ElMessage.success("删除成功");
    loadHoldOrders();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "删除失败");
  }
}

// 页面加载时获取挂单列表
loadHoldOrders();
</script>

<style scoped>
.hover-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px 0 rgba(64, 158, 255, 0.3);
}
</style>
