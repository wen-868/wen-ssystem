<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售配送</span>
          <div class="header-actions">
            <el-input
              v-model="orderNoFilter"
              placeholder="搜索订单号"
              size="default"
              style="width: 200px; margin-right: 8px"
              clearable
              @clear="loadData"
              @keyup.enter="loadData"
            />
            <el-select v-model="deliveryStatus" placeholder="配送状态" size="default" style="width: 130px; margin-right: 8px" clearable @change="loadData">
              <el-option label="待分配" value="PENDING" />
              <el-option label="已分配" value="ASSIGNED" />
              <el-option label="取货中" value="PICKING" />
              <el-option label="配送中" value="DELIVERING" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 8px"
              value-format="YYYY-MM-DD"
              @change="loadData"
            />
            <el-button @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="deliveries" v-loading="loading" stripe>
        <el-table-column prop="deliveryNo" label="配送单号" width="200" />
        <el-table-column prop="orderNo" label="关联订单号" width="200" />
        <el-table-column prop="customer" label="客户" min-width="120" />
        <el-table-column prop="address" label="配送地址" min-width="180" />
        <el-table-column prop="deliveryStatus" label="配送状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.deliveryStatus === 'PENDING'" type="info">待分配</el-tag>
            <el-tag v-else-if="row.deliveryStatus === 'ASSIGNED'" type="primary">已分配</el-tag>
            <el-tag v-else-if="row.deliveryStatus === 'PICKING'" type="warning">取货中</el-tag>
            <el-tag v-else-if="row.deliveryStatus === 'DELIVERING'" type="">配送中</el-tag>
            <el-tag v-else-if="row.deliveryStatus === 'COMPLETED'" type="success">已完成</el-tag>
            <el-tag v-else-if="row.deliveryStatus === 'CANCELLED'" type="danger">已取消</el-tag>
            <el-tag v-else>{{ row.deliveryStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rider" label="骑手" width="100">
          <template #default="{ row }">
            <span v-if="row.rider">{{ row.rider }}</span>
            <span v-else class="muted">未分配</span>
          </template>
        </el-table-column>
        <el-table-column prop="estimatedTime" label="预计送达" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.deliveryStatus === 'PENDING'" size="small" link type="primary" @click="openAssignDialog(row)">分配骑手</el-button>
            <el-button v-if="row.deliveryStatus === 'ASSIGNED'" size="small" link type="success" @click="updateStatus(row, 'PICKING')">开始取货</el-button>
            <el-button v-if="row.deliveryStatus === 'PICKING'" size="small" link type="warning" @click="updateStatus(row, 'DELIVERING')">开始配送</el-button>
            <el-button v-if="row.deliveryStatus === 'DELIVERING'" size="small" link type="success" @click="updateStatus(row, 'COMPLETED')">完成配送</el-button>
            <el-button v-if="row.deliveryStatus === 'PENDING' || row.deliveryStatus === 'ASSIGNED'" size="small" link type="danger" @click="updateStatus(row, 'CANCELLED')">取消</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无配送记录" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="assignDialogVisible" title="分配骑手" width="480px">
      <el-form ref="assignFormRef" :model="assignForm" :rules="assignRules" label-width="100px">
        <el-form-item label="骑手ID" prop="riderId">
          <el-input-number v-model="assignForm.riderId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="骑手姓名" prop="riderName">
          <el-input v-model="assignForm.riderName" placeholder="请输入骑手姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="assignLoading" @click="handleAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { assignDelivery, fetchInstantDeliveries, updateDeliveryStatus } from "../../api";

const loading = ref(false);
const assignLoading = ref(false);
const deliveries = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const orderNoFilter = ref("");
const deliveryStatus = ref("");
const dateRange = ref<[string, string] | null>(null);

const assignDialogVisible = ref(false);
const assignFormRef = ref<FormInstance>();
const assigningDeliveryId = ref<number | null>(null);

const assignForm = reactive({
  riderId: 0,
  riderName: ""
});

const assignRules: FormRules = {
  riderId: [{ required: true, message: "请填写骑手ID", trigger: "blur" }],
  riderName: [{ required: true, message: "请填写骑手姓名", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchInstantDeliveries({
      orderNo: orderNoFilter.value || undefined,
      deliveryStatus: deliveryStatus.value || undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
      page: page.value,
      pageSize: pageSize.value
    });
    deliveries.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载配送列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

function openAssignDialog(row: any) {
  assigningDeliveryId.value = row.id;
  assignForm.riderId = 0;
  assignForm.riderName = "";
  assignDialogVisible.value = true;
}

async function handleAssign() {
  if (!assignFormRef.value || !assigningDeliveryId.value) return;
  await assignFormRef.value.validate(async (valid) => {
    if (!valid) return;
    assignLoading.value = true;
    try {
      await assignDelivery(assigningDeliveryId.value!, {
        riderId: assignForm.riderId,
        riderName: assignForm.riderName
      });
      ElMessage.success("骑手已分配");
      assignDialogVisible.value = false;
      loadData();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "分配骑手失败"));
    } finally {
      assignLoading.value = false;
    }
  });
}

async function updateStatus(row: any, status: string) {
  const statusMap: Record<string, string> = {
    PICKING: "开始取货",
    DELIVERING: "开始配送",
    COMPLETED: "完成配送",
    CANCELLED: "取消配送"
  };
  const actionLabel = statusMap[status] || status;
  try {
    await ElMessageBox.confirm(`确定要「${actionLabel}」吗？`, "确认操作", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await updateDeliveryStatus(row.id, { status });
    ElMessage.success(`${actionLabel}成功`);
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${actionLabel}失败`));
    }
  }
}

onMounted(() => {
  loadData();
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
.muted {
  color: var(--gray-400);
  font-size: 13px;
}
</style>