<template>
  <div class="pos-hold-orders">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">挂单管理</h2>
        <p class="page-desc">暂存挂单的取单与删除</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="loadList">
          <el-icon><Refresh /></el-icon>&nbsp;刷新
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-card">
      <el-table :data="records" v-loading="loading" stripe>
        <el-table-column prop="holdNo" label="挂单号" width="180" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="customerMobile" label="手机号" width="120" />
        <el-table-column prop="amount" label="金额" width="100">
          <template #default="{ row }"><span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column prop="itemCount" label="商品数" width="80" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column prop="createdAt" label="挂单时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleRestore(row.holdNo)">取单</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row.holdNo)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无挂单" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          v-if="total > 0"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadList"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { fetchStoreHoldOrders, restoreStoreHoldOrder, deleteStoreHoldOrder } from "../../api";

const router = useRouter();
const loading = ref(false);
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(30);
const total = ref(0);

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchStoreHoldOrders({ page: page.value, pageSize: pageSize.value });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载挂单失败");
  } finally {
    loading.value = false;
  }
}

async function handleRestore(holdNo: string) {
  try {
    await ElMessageBox.confirm("取单将跳转到收银台，确认？", "提示", { type: "warning" });
    await restoreStoreHoldOrder(holdNo);
    ElMessage.success("取单成功，已加载到收银台");
    router.push("/pos/cashier");
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("取单失败");
    }
  }
}

async function handleDelete(holdNo: string) {
  try {
    await ElMessageBox.confirm("确认删除该挂单？", "提示", { type: "warning" });
    await deleteStoreHoldOrder(holdNo);
    ElMessage.success("已删除");
    await loadList();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-hold-orders {
  padding: 0;
}
.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
