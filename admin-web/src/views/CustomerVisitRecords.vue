<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>拜访记录列表</span>
          <div class="header-actions">
            <el-select
              v-model="filters.staffId"
              placeholder="选择员工"
              size="default"
              style="width: 160px; margin-right: 10px"
              clearable
              filterable
            >
              <el-option
                v-for="s in staffList"
                :key="s.id"
                :label="s.realName || s.username"
                :value="s.id"
              />
            </el-select>
            <el-select
              v-model="filters.customerId"
              placeholder="选择客户"
              size="default"
              style="width: 160px; margin-right: 10px"
              clearable
              filterable
            >
              <el-option
                v-for="c in customerList"
                :key="c.memberId"
                :label="c.name"
                :value="c.memberId"
              />
            </el-select>
            <el-select
              v-model="filters.status"
              placeholder="状态"
              size="default"
              style="width: 130px; margin-right: 10px"
              clearable
            >
              <el-option label="已计划" value="PLANNED" />
              <el-option label="已签到" value="CHECKED_IN" />
              <el-option label="已签退" value="CHECKED_OUT" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 10px"
              value-format="YYYY-MM-DD"
            />
            <el-button @click="search">搜索</el-button>
            <el-button type="primary" @click="openCreateDialog">新增拜访</el-button>
          </div>
        </div>
      </template>

      <el-table :data="visits" v-loading="loading" stripe>
        <el-table-column prop="visitNo" label="拜访编号" width="160" />
        <el-table-column prop="customerName" label="客户名称" min-width="140" />
        <el-table-column prop="staffName" label="拜访员工" width="120" />
        <el-table-column label="计划日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.planDate) }}
          </template>
        </el-table-column>
        <el-table-column label="签到时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.checkinTime) }}
          </template>
        </el-table-column>
        <el-table-column label="签退时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.checkoutTime) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PLANNED'" type="info">已计划</el-tag>
            <el-tag v-else-if="row.status === 'CHECKED_IN'" type="primary">已签到</el-tag>
            <el-tag v-else-if="row.status === 'CHECKED_OUT'" type="success">已签退</el-tag>
            <el-tag v-else-if="row.status === 'CANCELLED'" type="danger">已取消</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="拜访目的" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PLANNED'"
              size="small"
              type="success"
              @click="openCheckinDialog(row)"
            >签到</el-button>
            <el-button
              v-if="row.status === 'CHECKED_IN'"
              size="small"
              type="warning"
              @click="openCheckoutDialog(row)"
            >签退</el-button>
            <el-button
              v-if="row.status === 'PLANNED'"
              size="small"
              type="danger"
              @click="handleCancel(row)"
            >取消</el-button>
            <el-button
              size="small"
              link
              type="primary"
              @click="openDetailDialog(row)"
            >详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
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

    <!-- 新增拜访 Dialog -->
    <el-dialog v-model="createDialogVisible" title="新增拜访" width="500px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="createForm.customerId" placeholder="选择客户" style="width: 100%" filterable>
            <el-option
              v-for="c in customerList"
              :key="c.memberId"
              :label="c.name"
              :value="c.memberId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="员工" prop="staffId">
          <el-select v-model="createForm.staffId" placeholder="选择员工" style="width: 100%" filterable>
            <el-option
              v-for="s in staffList"
              :key="s.id"
              :label="s.realName || s.username"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划日期" prop="planDate">
          <el-date-picker
            v-model="createForm.planDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="拜访目的" prop="purpose">
          <el-input v-model="createForm.purpose" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="createForm.address" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreateVisit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 签到 Dialog -->
    <el-dialog v-model="checkinDialogVisible" title="签到" width="450px">
      <el-form ref="checkinFormRef" :model="checkinForm" :rules="checkinFormRules" label-width="80px">
        <el-form-item label="位置">
          <el-input v-model="checkinForm.location" placeholder="签到位置" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="checkinForm.remark" type="textarea" :rows="2" placeholder="签到备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="checkinDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCheckin">确认签到</el-button>
      </template>
    </el-dialog>

    <!-- 签退 Dialog -->
    <el-dialog v-model="checkoutDialogVisible" title="签退" width="450px">
      <el-form ref="checkoutFormRef" :model="checkoutForm" :rules="checkoutFormRules" label-width="100px">
        <el-form-item label="备注">
          <el-input v-model="checkoutForm.remark" type="textarea" :rows="2" placeholder="签退备注" />
        </el-form-item>
        <el-form-item label="下次计划">
          <el-date-picker
            v-model="checkoutForm.nextPlan"
            type="date"
            placeholder="选择下次计划日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="checkoutDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCheckout">确认签退</el-button>
      </template>
    </el-dialog>

    <!-- 详情 Dialog -->
    <el-dialog v-model="detailDialogVisible" title="拜访详情" width="550px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="拜访编号">{{ detail.visitNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="detail.status === 'PLANNED'" type="info">已计划</el-tag>
          <el-tag v-else-if="detail.status === 'CHECKED_IN'" type="primary">已签到</el-tag>
          <el-tag v-else-if="detail.status === 'CHECKED_OUT'" type="success">已签退</el-tag>
          <el-tag v-else-if="detail.status === 'CANCELLED'" type="danger">已取消</el-tag>
          <el-tag v-else>{{ detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ detail.customerName }}</el-descriptions-item>
        <el-descriptions-item label="拜访员工">{{ detail.staffName }}</el-descriptions-item>
        <el-descriptions-item label="计划日期">{{ formatDate(detail.planDate) }}</el-descriptions-item>
        <el-descriptions-item label="签到时间">{{ formatDate(detail.checkinTime) }}</el-descriptions-item>
        <el-descriptions-item label="签退时间">{{ formatDate(detail.checkoutTime) }}</el-descriptions-item>
        <el-descriptions-item label="签到位置">{{ detail.checkinLocation || '-' }}</el-descriptions-item>
        <el-descriptions-item label="拜访目的" :span="2">{{ detail.purpose }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{ detail.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签到备注" :span="2">{{ detail.checkinRemark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签退备注" :span="2">{{ detail.checkoutRemark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="下次计划" :span="2">{{ formatDate(detail.nextPlan) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import {
  fetchCustomerVisits,
  createCustomerVisit,
  checkinCustomerVisit,
  checkoutCustomerVisit,
  cancelCustomerVisit,
  fetchCustomerVisitDetail,
  fetchMembers,
  fetchStaff
} from "../api";
import { formatDate } from "../utils/format";

const loading = ref(false);
const submitLoading = ref(false);
const visits = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const staffList = ref<any[]>([]);
const customerList = ref<any[]>([]);

const filters = reactive({
  staffId: undefined as number | undefined,
  customerId: undefined as number | undefined,
  status: "" as string,
  dateRange: null as [string, string] | null
});

const createDialogVisible = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  customerId: null as number | null,
  staffId: null as number | null,
  planDate: "",
  purpose: "",
  address: ""
});

const createRules: FormRules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }],
  staffId: [{ required: true, message: "请选择员工", trigger: "change" }],
  planDate: [{ required: true, message: "请选择计划日期", trigger: "change" }],
  purpose: [{ required: true, message: "请填写拜访目的", trigger: "blur" }]
};

const checkinDialogVisible = ref(false);
const checkinFormRef = ref<FormInstance>();
const checkinTarget = ref<any>(null);
const checkinForm = reactive({
  location: "",
  remark: ""
});

const checkinFormRules: FormRules = {
  location: [{ required: true, message: "请填写签到位置", trigger: "blur" }]
};

const checkoutDialogVisible = ref(false);
const checkoutFormRef = ref<FormInstance>();
const checkoutTarget = ref<any>(null);
const checkoutForm = reactive({
  remark: "",
  nextPlan: ""
});

const checkoutFormRules: FormRules = {};

const detailDialogVisible = ref(false);
const detail = ref<any>(null);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = Array.isArray(data) ? data : (data.records || []);
  } catch {
    // ignore
  }
}

async function loadCustomers() {
  try {
    const data = await fetchMembers({ pageSize: 200 });
    customerList.value = data.records || [];
  } catch {
    // ignore
  }
}

async function loadVisits() {
  loading.value = true;
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value
    };
    if (filters.status) params.status = filters.status;
    if (filters.staffId) params.staffId = filters.staffId;
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.dateRange) {
      params.dateStart = filters.dateRange[0];
      params.dateEnd = filters.dateRange[1];
    }
    const data = (await fetchCustomerVisits(params)).data;
    visits.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载拜访记录失败"));
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  loadVisits();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadVisits();
}

function handlePageChange(p: number) {
  page.value = p;
  loadVisits();
}

function openCreateDialog() {
  createForm.customerId = null;
  createForm.staffId = null;
  createForm.planDate = "";
  createForm.purpose = "";
  createForm.address = "";
  createDialogVisible.value = true;
}

async function handleCreateVisit() {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createCustomerVisit({
        customerId: createForm.customerId!,
        staffId: createForm.staffId!,
        planDate: createForm.planDate,
        purpose: createForm.purpose,
        address: createForm.address || undefined
      });
      ElMessage.success("拜访计划已创建");
      createDialogVisible.value = false;
      loadVisits();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "创建拜访失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

function openCheckinDialog(row: any) {
  checkinTarget.value = row;
  checkinForm.location = "";
  checkinForm.remark = "";
  checkinDialogVisible.value = true;
}

async function handleCheckin() {
  const valid = await checkinFormRef.value?.validate().catch(() => false); if (!valid) return;
  submitLoading.value = true;
  try {
    await checkinCustomerVisit(checkinTarget.value.visitNo, {
      location: checkinForm.location || undefined,
      remark: checkinForm.remark || undefined
    });
    ElMessage.success("签到成功");
    checkinDialogVisible.value = false;
    loadVisits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "签到失败"));
  } finally {
    submitLoading.value = false;
  }
}

function openCheckoutDialog(row: any) {
  checkoutTarget.value = row;
  checkoutForm.remark = "";
  checkoutForm.nextPlan = "";
  checkoutDialogVisible.value = true;
}

async function handleCheckout() {
  const valid = await checkoutFormRef.value?.validate().catch(() => false); if (!valid) return;
  submitLoading.value = true;
  try {
    await checkoutCustomerVisit(checkoutTarget.value.visitNo, {
      remark: checkoutForm.remark || undefined,
      nextPlan: checkoutForm.nextPlan || undefined
    });
    ElMessage.success("签退成功");
    checkoutDialogVisible.value = false;
    loadVisits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "签退失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm("确认取消该拜访计划？", "提示", { type: "warning" });
  } catch {
    return;
  }
  try {
    await cancelCustomerVisit(row.visitNo);
    ElMessage.success("拜访已取消");
    loadVisits();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "取消拜访失败"));
  }
}

async function openDetailDialog(row: any) {
  try {
    detail.value = (await fetchCustomerVisitDetail(row.visitNo)).data;
    detailDialogVisible.value = true;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "获取拜访详情失败"));
  }
}

onMounted(() => {
  loadStaff();
  loadCustomers();
  loadVisits();
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
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>