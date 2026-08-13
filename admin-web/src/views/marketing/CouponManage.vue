<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">优惠券管理</h2>
      <p class="page-desc">满减券/折扣券创建与发放</p>
    </div>
  </div>
<el-card>
      <div class="filter-bar">
        <div class="filter-bar">
          <el-select v-model="typeFilter" placeholder="优惠券类型" clearable style="width: 140px; margin-right: 12px" @change="loadData">
            <el-option label="满减券" value="FIXED" />
            <el-option label="折扣券" value="PERCENT" />
            <el-option label="免邮券" value="SHIPPING" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="搜索优惠券名称"
            clearable
            style="width: 200px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="openDialog()">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>
            新建优惠券
          </el-button>
          <el-button @click="loadData">
            <el-icon style="margin-right: 4px"><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div class="table-card">
<el-table :data="coupons" v-loading="loading" stripe>
        <el-table-column prop="name" label="优惠券名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'FIXED'" type="primary">满减券</el-tag>
            <el-tag v-else-if="row.type === 'PERCENT'" type="success">折扣券</el-tag>
            <el-tag v-else-if="row.type === 'SHIPPING'" type="warning">免邮券</el-tag>
            <el-tag v-else type="info">买赠券</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="面额/折扣" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.type === 'PERCENT'">{{ row.value }}%</span>
            <span v-else>¥{{ row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用门槛" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.minAmount > 0">满¥{{ row.minAmount }}</span>
            <span v-else>无门槛</span>
          </template>
        </el-table-column>
        <el-table-column label="发放量" width="130" align="center">
          <template #default="{ row }">{{ row.claimedCount }} / {{ row.totalCount }}</template>
        </el-table-column>
        <el-table-column label="使用量" width="80" align="center">
          <template #default="{ row }">{{ row.usedCount }}</template>
        </el-table-column>
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="primary" @click="viewDetail(row)">发放记录</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="toggleStatus(row, 'PAUSED')">停用</el-button>
            <el-button v-if="['DRAFT', 'PAUSED'].includes(row.status)" size="small" link type="success" @click="toggleStatus(row, 'ACTIVE')">启用</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="handleSizeChange" @current-change="handlePageChange"
        />
      </div>
</div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑优惠券' : '新建优惠券'"
      width="720px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入优惠券名称" />
        </el-form-item>
        <el-form-item label="优惠券类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="FIXED">满减券</el-radio>
            <el-radio value="PERCENT">折扣券</el-radio>
            <el-radio value="SHIPPING">免邮券</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="面额/折扣" prop="value">
          <el-input-number v-model="form.value" :min="0.01" :precision="2" style="width: 200px" />
          <span class="form-hint">{{ form.type === 'PERCENT' ? '%（折扣率，如10=9折）' : '元' }}</span>
        </el-form-item>
        <el-form-item label="使用门槛" prop="minAmount">
          <el-input-number v-model="form.minAmount" :min="0" :precision="2" style="width: 200px" />
          <span class="form-hint">元（0表示无门槛）</span>
        </el-form-item>
        <el-form-item label="有效期" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="发放总量" prop="totalCount">
          <el-input-number v-model="form.totalCount" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="适用商品">
          <el-radio-group v-model="form.scope">
            <el-radio value="ALL">全部商品</el-radio>
            <el-radio value="CATEGORY">指定分类</el-radio>
            <el-radio value="SKU">指定商品</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="使用说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="优惠券使用说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 发放记录对话框 -->
    <el-dialog v-model="recordVisible" title="发放记录" width="900px">
      <el-table :data="issueRecords" size="small" max-height="400">
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="templateName" label="优惠券" min-width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'UNUSED'" type="primary" size="small">未使用</el-tag>
            <el-tag v-else-if="row.status === 'USED'" type="success" size="small">已使用</el-tag>
            <el-tag v-else-if="row.status === 'EXPIRED'" type="info" size="small">已过期</el-tag>
            <el-tag v-else-if="row.status === 'LOCKED'" type="warning" size="small">已锁定</el-tag>
            <el-tag v-else type="info" size="small">{{ fmtStatus(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="claimedAt" label="领取时间" width="160" />
        <el-table-column prop="usedAt" label="使用时间" width="160" />
      </el-table>
      <template #footer>
        <el-button @click="recordVisible = false">关闭</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { fmtStatus } from "../../utils/enums";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import {
  fetchCouponTemplates,
  createCouponTemplate,
  updateCouponTemplate,
  deleteCouponTemplate,
  activateCouponTemplate,
  pauseCouponTemplate,
  fetchUserCoupons,
  getErrorMessage
} from "../../api";

const loading = ref(false);
const coupons = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const typeFilter = ref("");
const statusFilter = ref("");

// ==================== 表单 ====================
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: "",
  type: "FIXED",
  value: 0,
  minAmount: 0,
  timeRange: [] as any[],
  totalCount: 1000,
  scope: "ALL",
  description: ""
});

const formRules: FormRules = {
  name: [{ required: true, message: "请输入优惠券名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择优惠券类型", trigger: "change" }],
  value: [{ required: true, message: "请输入面额/折扣", trigger: "blur" }],
  timeRange: [{ required: true, message: "请选择有效期", trigger: "change" }],
  totalCount: [{ required: true, message: "请输入发放总量", trigger: "blur" }]
};

// ==================== 发放记录 ====================
const recordVisible = ref(false);
const issueRecords = ref<any[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (keyword.value) params.keyword = keyword.value;
    if (typeFilter.value) params.type = typeFilter.value;
    if (statusFilter.value) params.status = statusFilter.value;
    const data = await fetchCouponTemplates(params);
    coupons.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载优惠券失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) { pageSize.value = size; page.value = 1; loadData(); }
function handlePageChange(p: number) { page.value = p; loadData(); }

function openDialog(row?: any) {
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    form.name = row.name;
    form.type = row.type;
    form.value = row.value;
    form.minAmount = row.minAmount;
    form.timeRange = [row.startTime, row.endTime];
    form.totalCount = row.totalCount;
    form.scope = row.scope || "ALL";
    form.description = row.description || "";
  } else {
    isEdit.value = false;
    editingId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.name = "";
  form.type = "FIXED";
  form.value = 0;
  form.minAmount = 0;
  form.timeRange = [];
  form.totalCount = 1000;
  form.scope = "ALL";
  form.description = "";
  formRef.value?.resetFields();
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    const payload = {
      name: form.name,
      type: form.type,
      value: form.value,
      minAmount: form.minAmount,
      maxDiscount: null,
      applicableScope: form.scope,
      applicableIds: null,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      totalCount: form.totalCount,
      description: form.description
    };
    if (isEdit.value && editingId.value) {
      await updateCouponTemplate(editingId.value, payload);
      ElMessage.success("修改成功");
    } else {
      await createCouponTemplate(payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, isEdit.value ? "修改失败" : "创建失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function viewDetail(row: any) {
  try {
    const data = await fetchUserCoupons({ templateId: row.id, page: 1, pageSize: 50 });
    issueRecords.value = data.records || [];
    recordVisible.value = true;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载发放记录失败"));
  }
}

async function toggleStatus(row: any, newStatus: string) {
  const text = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确认${text}优惠券「${row.name}」？`, `确认${text}`, { type: "warning" });
    if (newStatus === "ACTIVE") {
      await activateCouponTemplate(row.id);
    } else {
      await pauseCouponTemplate(row.id);
    }
    ElMessage.success(`已${text}`);
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${text}失败`));
    }
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除优惠券「${row.name}」？`, "确认删除", { type: "warning" });
    await deleteCouponTemplate(row.id);
    ElMessage.success("已删除");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "删除失败"));
    }
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.form-hint { margin-left: 8px; font-size: 12px; color: var(--gray-400); }
</style>