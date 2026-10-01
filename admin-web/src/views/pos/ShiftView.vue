<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">交接班管理</h2>
    <p class="page-desc">班次交接、现金清点与交接记录</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="showCreateDialog = true">
      <el-icon><Plus /></el-icon>&nbsp;新建交接班
    </el-button>
  </div>
</div>


      <div class="filter-bar">
        <el-date-picker
          v-model="filterDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          size="small"
        />
        <el-select v-model="filterShiftType" placeholder="班次类型" size="small" style="width: 120px">
          <el-option label="早班" value="MORNING" />
          <el-option label="中班" value="AFTERNOON" />
          <el-option label="晚班" value="EVENING" />
        </el-select>
        <el-button type="primary" size="small" @click="loadShifts">查询</el-button>
        <el-button size="small" @click="resetFilter">重置</el-button>
      </div>

      <div class="table-card">
<el-table :data="shifts" size="small" style="margin-top: 12px" v-loading="loading">
        <el-table-column prop="shiftNo" label="交接班编号" width="140" />
        <el-table-column prop="shiftType" label="班次" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="getShiftTypeTagType(row.shiftType)">
              {{ getShiftTypeName(row.shiftType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作员" width="100" />
        <el-table-column prop="startTime" label="开始时间" width="160" />
        <el-table-column prop="endTime" label="结束时间" width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusTagType(row.status)">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalSalesAmount" label="销售额" width="100">
          <template #default="{ row }">¥{{ Number(row.totalSalesAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="totalOrders" label="订单数" width="80" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="goToDetail(row.shiftNo)">详情</el-button>
            <el-button
              v-if="row.status === 'OPEN'"
              size="small"
              link
              type="success"
              @click="showCompleteDialog(row)"
            >
              完成交接
            </el-button>
          </template>
        </el-table-column>
      </el-table>
</div>

      <div class="table-card-footer" v-if="total > 0">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    

    <!-- 新建交接班弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建交接班" width="480px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="班次类型" required>
          <el-radio-group v-model="createForm.shiftType">
            <el-radio value="MORNING">早班</el-radio>
            <el-radio value="AFTERNOON">中班</el-radio>
            <el-radio value="EVENING">晚班</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker
            v-model="createForm.startTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择开始时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="createForm.operatorName" placeholder="操作员姓名" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 完成交接班弹窗 -->
    <el-dialog v-model="showCompleteDialogFlag" title="完成交接班" width="480px">
      <el-form :model="completeForm" label-width="120px">
        <el-form-item label="结束时间" required>
          <el-date-picker
            v-model="completeForm.endTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择结束时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="现金金额">
          <el-input-number v-model="completeForm.actualCash" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="微信金额">
          <el-input-number v-model="completeForm.actualWechat" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付宝金额">
          <el-input-number v-model="completeForm.actualAlipay" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="completeForm.remark" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompleteDialogFlag = false">取消</el-button>
        <el-button type="primary" @click="handleComplete">确认完成</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { fetchStoreShifts, createStoreShift } from "../../api";

const router = useRouter();

const shifts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

const filterDate = ref("");
const filterShiftType = ref("");

const showCreateDialog = ref(false);
const createForm = reactive({
  shiftType: "MORNING",
  startTime: "",
  operatorName: "",
  remark: ""
});

const showCompleteDialogFlag = ref(false);
const completeForm = reactive({
  endTime: "",
  actualCash: 0,
  actualWechat: 0,
  actualAlipay: 0,
  remark: ""
});

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
    // 交接班（t_shift）真实状态：OPEN / CLOSED
    OPEN: "进行中",
    CLOSED: "已完成",
    // 下面四个为历史/其它来源状态，保留兜底展示
    PENDING: "待开始",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
    VOIDED: "已作废"
  };
  return map[status] || status;
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    // 交接班（t_shift）真实状态：OPEN / CLOSED
    OPEN: "warning",
    CLOSED: "success",
    PENDING: "info",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    VOIDED: "danger"
  };
  return map[status] || "info";
}

async function loadShifts() {
  loading.value = true;
  try {
    const data = await fetchStoreShifts({
      page: page.value,
      pageSize: pageSize.value,
      date: filterDate.value || undefined,
      shiftType: filterShiftType.value || undefined
    });
    // S3-145：交接班列表已与详情/统计/盘点同源 —— GET /store/shifts（shift.service.ts getShiftList）
    // 返回 { records, total }，字段为 t_shift 的 shiftNo/shiftType/operatorName/startTime/
    // endTime/status(opening/closing)/openingCash + 本班次销售额/订单数。
    const raw = data as any;
    const rows: any[] = Array.isArray(raw) ? raw : raw?.records ?? raw?.list ?? [];
    shifts.value = rows.map((r: any) => ({
      shiftNo: r.shiftNo ?? r.shift_no ?? "",
      shiftType: r.shiftType ?? r.shift_type ?? "",
      operatorName: r.operatorName ?? r.operator_name ?? "",
      startTime: r.startTime ?? r.start_time ?? "",
      endTime: r.endTime ?? r.end_time ?? "",
      status: r.status ?? "",
      totalSalesAmount: Number(r.totalSalesAmount ?? r.totalSales ?? r.total_sales ?? 0),
      totalOrders: r.totalOrders ?? 0
    }));
    total.value = Array.isArray(raw) ? shifts.value.length : raw?.total ?? shifts.value.length;
  } catch {
    ElMessage.warning("交接班记录加载失败");
  } finally {
    loading.value = false;
  }
}

function handlePageChange(newPage: number) {
  page.value = newPage;
  loadShifts();
}

function handleSizeChange(newSize: number) {
  pageSize.value = newSize;
  page.value = 1;
  loadShifts();
}

function resetFilter() {
  filterDate.value = "";
  filterShiftType.value = "";
  page.value = 1;
  loadShifts();
}

// 详情路由在 router/index.ts 中定义为 `pos/shift/:id`（参数承载交接班编号 shiftNo），
// 原实现跳 `/pos/shifts/:id` 与定义不匹配（落 404）。
function goToDetail(shiftNo: string) {
  if (!shiftNo) return;
  router.push(`/pos/shift/${shiftNo}`);
}

function showCompleteDialog(row: any) {
  completeForm.endTime = new Date().toISOString().slice(0, 16).replace("T", " ");
  completeForm.actualCash = 0;
  completeForm.actualWechat = 0;
  completeForm.actualAlipay = 0;
  completeForm.remark = "";
  showCompleteDialogFlag.value = true;
}

async function handleCreate() {
  if (!createForm.shiftType || !createForm.startTime) {
    ElMessage.warning("请填写必填项");
    return;
  }
  try {
    await createStoreShift({
      shiftType: createForm.shiftType,
      startTime: createForm.startTime,
      operatorName: createForm.operatorName || undefined,
      remark: createForm.remark || undefined
    });
    ElMessage.success("交接班记录创建成功");
    showCreateDialog.value = false;
    createForm.shiftType = "MORNING";
    createForm.startTime = "";
    createForm.operatorName = "";
    createForm.remark = "";
    loadShifts();
  } catch {
    ElMessage.error("创建失败");
  }
}

async function handleComplete() {
  if (!completeForm.endTime) {
    ElMessage.warning("请填写结束时间");
    return;
  }
  // S3-145：真正"完成交接"需要关闭 t_shift 记录（UPDATE t_shift SET status='CLOSED', end_time=?），
  // 属**新增端点**，超出本单授权（凌舟附注1：只允许新增 1 个只读列表端点 GET /store/shifts）。
  // 原实现回落到班结端点 POST /store/shift/settle：它只写 t_daily_settlement、**不关闭 t_shift**，
  // 会给出"交接班完成"的假成功（列表里该条仍是"进行中"）——故这里不写库，改为如实提示，
  // 并把"交接班关闭能力"作为申请裁定项上报（见回传卡「申请裁定项」）。
  ElMessage.info("完成交接需后端支持关闭交接班记录（已上报 S3-145 申请裁定）");
  showCompleteDialogFlag.value = false;
}

onMounted(() => {
  loadShifts();
});
</script>

<style scoped>
.pos-shift {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
