<template>
  <div class="pos-sale-return">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>销售退货</span>
          <div class="filter-area">
            <el-select v-model="returnStatus" placeholder="退货状态" size="small" style="width: 120px" clearable @change="loadList">
              <el-option label="待审核" value="PENDING" />
              <el-option label="已批准" value="APPROVED" />
              <el-option label="已拒绝" value="REJECTED" />
              <el-option label="已完成" value="COMPLETED" />
            </el-select>
            <el-button size="small" type="primary" @click="loadList">刷新</el-button>
            <el-button size="small" type="success" @click="createVisible = true">新建退货</el-button>
          </div>
        </div>
      </template>

      <el-table :data="records" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="returnNo" label="退货单号" width="160" />
        <el-table-column prop="sourceBillNo" label="原销售单号" width="160" />
        <el-table-column prop="totalAmount" label="退货金额" width="100">
          <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row.returnNo)">详情</el-button>
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

    <el-dialog v-model="createVisible" title="新建退货单" width="720px">
      <el-form label-width="100px">
        <el-form-item label="原销售单号" required>
          <el-input v-model="createForm.sourceBillNo" placeholder="请输入原销售单号" />
        </el-form-item>
        <el-form-item label="退货商品">
          <div v-for="(item, idx) in createForm.items" :key="idx" class="return-item">
            <el-input v-model="item.skuName" placeholder="商品名称" style="width: 140px" />
            <el-input-number v-model="item.quantity" :min="1" placeholder="数量" style="width: 120px" />
            <el-input-number v-model="item.unitPrice" :min="0" :precision="2" placeholder="单价" style="width: 120px" />
            <el-button link type="danger" @click="createForm.items.splice(idx, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="createForm.items.push({ skuId: 0, skuName: '', quantity: 1, unitPrice: 0 })">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchStoreSaleReturns, createStoreSaleReturn } from "../../api";

const loading = ref(false);
const submitting = ref(false);
const returnStatus = ref("");
const records = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const createVisible = ref(false);
const createForm = reactive<{ sourceBillNo: string; items: any[]; remark: string }>({
  sourceBillNo: "",
  items: [],
  remark: ""
});

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "primary",
    REJECTED: "danger",
    COMPLETED: "success"
  };
  return map[status] || "info";
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已批准",
    REJECTED: "已拒绝",
    COMPLETED: "已完成"
  };
  return map[status] || status || "未知";
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchStoreSaleReturns({
      page: page.value,
      pageSize: pageSize.value,
      returnStatus: returnStatus.value || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch {
    ElMessage.error("加载退货单失败");
  } finally {
    loading.value = false;
  }
}

async function viewDetail(_returnNo: string) {
  ElMessage.info("详情功能开发中");
}

async function submitCreate() {
  if (!createForm.sourceBillNo) {
    ElMessage.warning("请输入原销售单号");
    return;
  }
  if (createForm.items.length === 0) {
    ElMessage.warning("请添加退货商品");
    return;
  }
  submitting.value = true;
  try {
    await createStoreSaleReturn({
      sourceBillNo: createForm.sourceBillNo,
      items: createForm.items.map((item) => ({
        skuId: Number(item.skuId || 0),
        skuName: item.skuName,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0)
      })),
      remark: createForm.remark
    });
    ElMessage.success("退货单已创建");
    createVisible.value = false;
    createForm.sourceBillNo = "";
    createForm.items = [];
    createForm.remark = "";
    await loadList();
  } catch {
    ElMessage.error("创建退货单失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.pos-sale-return {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-area {
  display: flex;
  gap: 8px;
}
.return-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
</style>
