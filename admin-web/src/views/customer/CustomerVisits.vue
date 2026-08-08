<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">客户拜访记录</h2>
    <p class="page-desc">客户回访</p>
  </div>
</div>
<div class="filter-bar">
  <el-input
  v-model="keyword"
  placeholder="关键词搜索"
  size="default"
  style="width: 200px; margin-right: 10px"
  clearable
  @clear="loadVisits"
  @keyup.enter="loadVisits"
  />
  <el-select v-model="filterCustomerId" placeholder="客户名称" size="default" style="width: 160px; margin-right: 10px" clearable filterable @change="loadVisits">
  <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
  </el-select>
  <el-select v-model="filterVisitor" placeholder="拜访人" size="default" style="width: 140px; margin-right: 10px" clearable filterable @change="loadVisits">
  <el-option v-for="s in staffList" :key="s.id" :label="s.name" :value="s.name" />
  </el-select>
  <el-select v-model="filterVisitType" placeholder="拜访方式" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadVisits">
  <el-option label="上门" value="VISIT" />
  <el-option label="电话" value="PHONE" />
  <el-option label="微信" value="WECHAT" />
  </el-select>
  <el-select v-model="filterPurpose" placeholder="拜访目的" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadVisits">
  <el-option label="新客开发" value="DEVELOP" />
  <el-option label="维护关系" value="MAINTAIN" />
  <el-option label="产品推介" value="PROMOTE" />
  <el-option label="订单跟进" value="FOLLOW_UP" />
  <el-option label="售后服务" value="SERVICE" />
  <el-option label="其他" value="OTHER" />
  </el-select>
  <el-date-picker
  v-model="dateRange"
  type="daterange"
  range-separator="至"
  start-placeholder="开始日期"
  end-placeholder="结束日期"
  size="default"
  style="margin-right: 10px; width: 260px"
  value-format="YYYY-MM-DD"
  @change="loadVisits"
  />
  <el-button type="primary" @click="handleCreate">
  <el-icon><Plus /></el-icon> 新增拜访
  </el-button>
  <el-button @click="handleExport">导出</el-button>
  <el-button @click="loadVisits">刷新</el-button>
</div>


      <div class="table-card">
<el-table :data="visits" v-loading="loading" stripe>
        <el-table-column prop="customerName" label="客户名称" min-width="160" />
        <el-table-column prop="visitorName" label="拜访人" width="120" />
        <el-table-column prop="visitType" label="拜访方式" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.visitType === 'VISIT'" type="primary">上门</el-tag>
            <el-tag v-else-if="row.visitType === 'PHONE'" type="success">电话</el-tag>
            <el-tag v-else-if="row.visitType === 'WECHAT'" type="warning">微信</el-tag>
            <el-tag v-else>{{ row.visitType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="拜访目的" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.purpose === 'DEVELOP'" type="primary">新客开发</el-tag>
            <el-tag v-else-if="row.purpose === 'MAINTAIN'" type="success">维护关系</el-tag>
            <el-tag v-else-if="row.purpose === 'PROMOTE'" type="warning">产品推介</el-tag>
            <el-tag v-else-if="row.purpose === 'FOLLOW_UP'" type="info">订单跟进</el-tag>
            <el-tag v-else-if="row.purpose === 'SERVICE'" type="danger">售后服务</el-tag>
            <el-tag v-else-if="row.purpose === 'OTHER'">其他</el-tag>
            <el-tag v-else>{{ row.purpose }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="visitTime" label="拜访时间" width="170" />
        <el-table-column prop="duration" label="拜访时长" width="110">
          <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
        </el-table-column>
        <el-table-column prop="nextFollowUp" label="下次跟进时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
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
</div>
    

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑拜访记录' : '新增拜访记录'" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customerId">
              <el-select v-model="form.customerId" placeholder="请选择客户" style="width: 100%" filterable @change="onCustomerChange">
                <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="拜访人" prop="visitorName">
              <el-select v-model="form.visitorName" placeholder="请选择拜访人" style="width: 100%" filterable>
                <el-option v-for="s in staffList" :key="s.id" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="拜访方式" prop="visitType">
              <el-select v-model="form.visitType" style="width: 100%">
                <el-option label="上门" value="VISIT" />
                <el-option label="电话" value="PHONE" />
                <el-option label="微信" value="WECHAT" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="拜访目的" prop="purpose">
              <el-select v-model="form.purpose" style="width: 100%">
                <el-option label="新客开发" value="DEVELOP" />
                <el-option label="维护关系" value="MAINTAIN" />
                <el-option label="产品推介" value="PROMOTE" />
                <el-option label="订单跟进" value="FOLLOW_UP" />
                <el-option label="售后服务" value="SERVICE" />
                <el-option label="其他" value="OTHER" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="拜访时间" prop="visitTime">
              <el-date-picker
                v-model="form.visitTime"
                type="datetime"
                placeholder="选择拜访时间"
                style="width: 100%"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="拜访时长(分钟)" prop="duration">
              <el-input-number v-model="form.duration" :min="0" :max="1440" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="下次跟进时间" prop="nextFollowUp">
          <el-date-picker
            v-model="form.nextFollowUp"
            type="datetime"
            placeholder="选择下次跟进时间"
            style="width: 50%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="拜访内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入拜访内容" />
        </el-form-item>
        <el-form-item label="沟通结果" prop="result">
          <el-input v-model="form.result" type="textarea" :rows="3" placeholder="请输入沟通结果" />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            v-model:file-list="form.attachments"
            action="#"
            :auto-upload="false"
            multiple
            :limit="5"
          >
            <el-button size="small">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持上传最多5个附件</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-drawer v-model="detailVisible" title="拜访记录详情" size="560px">
      <template v-if="currentVisit">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="客户名称">{{ currentVisit.customerName }}</el-descriptions-item>
          <el-descriptions-item label="拜访人">{{ currentVisit.visitorName }}</el-descriptions-item>
          <el-descriptions-item label="拜访方式">
            <el-tag v-if="currentVisit.visitType === 'VISIT'" type="primary">上门</el-tag>
            <el-tag v-else-if="currentVisit.visitType === 'PHONE'" type="success">电话</el-tag>
            <el-tag v-else-if="currentVisit.visitType === 'WECHAT'" type="warning">微信</el-tag>
            <el-tag v-else>{{ currentVisit.visitType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="拜访目的">
            <el-tag v-if="currentVisit.purpose === 'DEVELOP'" type="primary">新客开发</el-tag>
            <el-tag v-else-if="currentVisit.purpose === 'MAINTAIN'" type="success">维护关系</el-tag>
            <el-tag v-else-if="currentVisit.purpose === 'PROMOTE'" type="warning">产品推介</el-tag>
            <el-tag v-else-if="currentVisit.purpose === 'FOLLOW_UP'" type="info">订单跟进</el-tag>
            <el-tag v-else-if="currentVisit.purpose === 'SERVICE'" type="danger">售后服务</el-tag>
            <el-tag v-else-if="currentVisit.purpose === 'OTHER'">其他</el-tag>
            <el-tag v-else>{{ currentVisit.purpose }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="拜访时间">{{ currentVisit.visitTime }}</el-descriptions-item>
          <el-descriptions-item label="拜访时长">{{ formatDuration(currentVisit.duration) }}</el-descriptions-item>
          <el-descriptions-item label="下次跟进时间" :span="2">{{ currentVisit.nextFollowUp || '无' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div class="detail-section">
          <h4>客户基本信息</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="客户类型">
              <el-tag v-if="currentVisit.customerType === 'RETAIL'" type="primary">零售客户</el-tag>
              <el-tag v-else-if="currentVisit.customerType === 'WHOLESALE'" type="success">批发客户</el-tag>
              <el-tag v-else>{{ currentVisit.customerType || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="客户等级">
              <el-tag v-if="currentVisit.levelCode === 'VIP'" type="danger">VIP</el-tag>
              <el-tag v-else-if="currentVisit.levelCode === 'GOLD'" type="warning">GOLD</el-tag>
              <el-tag v-else-if="currentVisit.levelCode === 'SILVER'" type="info">SILVER</el-tag>
              <el-tag v-else>{{ currentVisit.levelCode || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ currentVisit.customerMobile || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户地址">{{ currentVisit.customerAddress || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <el-divider />

        <div class="detail-section">
          <h4>拜访内容</h4>
          <div class="content-box">{{ currentVisit.content || '无' }}</div>
        </div>

        <el-divider />

        <div class="detail-section">
          <h4>沟通结果</h4>
          <div class="content-box">{{ currentVisit.result || '无' }}</div>
        </div>

        <div v-if="currentVisit.attachments?.length" class="detail-section">
          <el-divider />
          <h4>附件</h4>
          <div class="attachment-list">
            <div v-for="(f, idx) in currentVisit.attachments" :key="idx" class="attachment-item">
              <el-icon><Paperclip /></el-icon>
              <span>{{ f.name }}</span>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Paperclip } from "@element-plus/icons-vue";
import {
  createCustomerVisit,
  deleteCustomerVisit,
  fetchCustomerVisitDetail,
  fetchCustomerVisits,
  fetchMembers,
  fetchStaff,
  updateCustomerVisit,
  exportCustomerVisitsCsv
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const visits = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const filterCustomerId = ref<number | null>(null);
const filterVisitor = ref("");
const filterVisitType = ref("");
const filterPurpose = ref("");
const dateRange = ref<string[]>([]);
const customers = ref<any[]>([]);
const staffList = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentVisit = ref<any>(null);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  customerId: null as number | null,
  customerName: "",
  visitorName: "",
  visitType: "VISIT" as "VISIT" | "PHONE" | "WECHAT",
  purpose: "MAINTAIN" as "DEVELOP" | "MAINTAIN" | "PROMOTE" | "FOLLOW_UP" | "SERVICE" | "OTHER",
  visitTime: "",
  duration: 30,
  nextFollowUp: "",
  content: "",
  result: "",
  attachments: [] as any[]
};

const form = reactive({ ...defaultForm, attachments: [] });

const rules: FormRules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }],
  visitorName: [{ required: true, message: "请选择拜访人", trigger: "change" }],
  visitType: [{ required: true, message: "请选择拜访方式", trigger: "change" }],
  purpose: [{ required: true, message: "请选择拜访目的", trigger: "change" }],
  visitTime: [{ required: true, message: "请选择拜访时间", trigger: "change" }],
  content: [{ required: true, message: "请输入拜访内容", trigger: "blur" }]
};

function formatDuration(minutes: number | string | undefined): string {
  const m = Number(minutes) || 0;
  if (m < 60) return `${m}分钟`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

function onCustomerChange(val: number) {
  const c = customers.value.find(c => c.id === val);
  if (c) form.customerName = c.name;
}

async function loadVisits() {
  loading.value = true;
  try {
    const data = (await fetchCustomerVisits({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      customerId: filterCustomerId.value || undefined,
      visitorName: filterVisitor.value || undefined,
      visitType: filterVisitType.value || undefined,
      purpose: filterPurpose.value || undefined,
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined
    })).data;
    visits.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadCustomers() {
  try {
    const data = await fetchMembers({ page: 1, pageSize: 200 });
    customers.value = data.records || data || [];
  } catch (e) {
    console.error("加载客户列表失败", e);
  }
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = data.records || data || [];
  } catch (e) {
    console.error("加载员工列表失败", e);
  }
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

function handleCreate() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm, attachments: [] });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  Object.assign(form, {
    ...row,
    attachments: row.attachments || []
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (isEdit.value) {
      await updateCustomerVisit(form.id, form);
      ElMessage.success("更新成功");
    } else {
      await createCustomerVisit(form);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadVisits();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    submitLoading.value = false;
  }
}

async function viewDetail(row: any) {
  try {
    currentVisit.value = (await fetchCustomerVisitDetail(row.id)).data;
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载详情失败");
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定删除该拜访记录吗？", "提示", { type: "warning" });
    await deleteCustomerVisit(row.id);
    ElMessage.success("删除成功");
    loadVisits();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "删除失败");
    }
  }
}

async function handleExport() {
  try {
    const blob = await exportCustomerVisitsCsv({
      keyword: keyword.value || undefined,
      customerId: filterCustomerId.value || undefined,
      visitorName: filterVisitor.value || undefined,
      visitType: filterVisitType.value || undefined,
      purpose: filterPurpose.value || undefined
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `客户拜访记录_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "导出失败");
  }
}

onMounted(() => {
  loadVisits();
  loadCustomers();
  loadStaff();
});
</script>

<style scoped>
.page { padding: 0; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--gray-700);
}
.content-box {
  padding: 12px 16px;
  background: var(--bg-page);
  border-radius: 4px;
  line-height: 1.6;
  color: var(--gray-600);
  white-space: pre-wrap;
  min-height: 40px;
}
.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: 4px;
  font-size: 13px;
  color: var(--gray-600);
}
</style>
