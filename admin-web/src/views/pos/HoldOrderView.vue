<template>
  <div class="pos-hold-orders">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>挂单管理</span>
          <el-button size="small" type="primary" @click="loadList">刷新</el-button>
        </div>
      </template>

      <el-table :data="records" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="holdNo" label="挂单号" width="180" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column prop="customerMobile" label="手机号" width="120" />
        <el-table-column prop="amount" label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
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
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px"
        @current-change="loadList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
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
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
