<template>
  <div class="page">
    <PageCard title="商户入驻审核">
      <template #extra>
        <el-button @click="loadApplications">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="公司名称/联系人/手机号"
          clearable
          style="width: 240px"
          @keyup.enter="loadApplications"
        />
        <el-select
          v-model="searchStatus"
          placeholder="审核状态"
          clearable
          style="width: 140px; margin-left: 12px"
          @change="loadApplications"
        >
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="loadApplications">搜索</el-button>
      </div>

      <el-table :data="applications" v-loading="loading" stripe>
        <el-table-column label="公司名称" min-width="180">
          <template #default="{ row }">{{ row.company_name || row.companyName }}</template>
        </el-table-column>
        <el-table-column label="联系人" width="120">
          <template #default="{ row }">{{ row.contact_person || row.contactPerson }}</template>
        </el-table-column>
        <el-table-column label="联系电话" width="140">
          <template #default="{ row }">{{ row.contact_mobile || row.contactMobile }}</template>
        </el-table-column>
        <el-table-column label="行业" width="120">
          <template #default="{ row }">{{ row.industry || '-' }}</template>
        </el-table-column>
        <el-table-column label="管理员账号" width="140">
          <template #default="{ row }">{{ row.admin_username || row.adminUsername || '-' }}</template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.review_status || row.reviewStatus || row.status)">
              {{ getStatusLabel(row.review_status || row.reviewStatus || row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleViewDetail(row)">详情</el-button>
            <template v-if="(row.review_status || row.reviewStatus || row.status) === 'PENDING'">
              <el-button size="small" link type="success" @click="handleApprove(row)">通过</el-button>
              <el-button size="small" link type="danger" @click="openRejectDialog(row)">驳回</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无入驻申请" :image-size="80" />
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
    </PageCard>

    <!-- 申请详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="入驻申请详情" width="640px">
      <el-descriptions :column="2" border v-loading="detailLoading">
        <el-descriptions-item label="公司名称" :span="2">
          {{ currentDetail.company_name || currentDetail.companyName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="公司简称">
          {{ currentDetail.company_short_name || currentDetail.companyShortName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="行业">
          {{ currentDetail.industry || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="联系人">
          {{ currentDetail.contact_person || currentDetail.contactPerson || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="联系电话">
          {{ currentDetail.contact_mobile || currentDetail.contactMobile || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="联系邮箱">
          {{ currentDetail.contact_email || currentDetail.contactEmail || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="公司规模">
          {{ currentDetail.company_scale || currentDetail.companyScale || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="所在地区" :span="2">
          {{ formatRegion(currentDetail) }}
        </el-descriptions-item>
        <el-descriptions-item label="详细地址" :span="2">
          {{ currentDetail.address || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="法人代表">
          {{ currentDetail.legal_person || currentDetail.legalPerson || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="营业执照号">
          {{ currentDetail.business_license || currentDetail.businessLicense || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="管理员账号">
          {{ currentDetail.admin_username || currentDetail.adminUsername || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="管理员姓名">
          {{ currentDetail.admin_real_name || currentDetail.adminRealName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="申请时间" :span="2">
          {{ formatDate(currentDetail.created_at || currentDetail.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="审核状态" :span="2">
          <el-tag :type="getStatusType(currentDetail.review_status || currentDetail.reviewStatus || currentDetail.status)">
            {{ getStatusLabel(currentDetail.review_status || currentDetail.reviewStatus || currentDetail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentDetail.review_remark || currentDetail.reviewRemark" label="审核备注" :span="2">
          {{ currentDetail.review_remark || currentDetail.reviewRemark }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentDetail.reviewed_at || currentDetail.reviewedAt" label="审核时间" :span="2">
          {{ formatDate(currentDetail.reviewed_at || currentDetail.reviewedAt) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <template v-if="(currentDetail.review_status || currentDetail.reviewStatus || currentDetail.status) === 'PENDING'">
          <el-button type="success" @click="handleApprove(currentDetail)">通过审核</el-button>
          <el-button type="danger" @click="openRejectDialog(currentDetail)">驳回申请</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 驳回原因对话框 -->
    <el-dialog v-model="rejectDialogVisible" title="驳回申请" width="480px">
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules" label-width="80px">
        <el-form-item label="驳回原因" prop="remark">
          <el-input
            v-model="rejectForm.remark"
            type="textarea"
            :rows="4"
            placeholder="请填写驳回原因，将通知申请人"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectLoading" @click="handleReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import {
  fetchTenantApplications,
  getTenantApplicationDetail,
  approveTenantApplication,
  rejectTenantApplication
} from "../api";

const loading = ref(false);
const detailLoading = ref(false);
const rejectLoading = ref(false);
const applications = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchKeyword = ref("");
const searchStatus = ref("");

const detailDialogVisible = ref(false);
const currentDetail = ref<any>({});

const rejectDialogVisible = ref(false);
const rejectFormRef = ref<FormInstance>();
const rejectingId = ref<number>(0);
const rejectForm = reactive({ remark: "" });
const rejectRules: FormRules = {
  remark: [{ required: true, message: "请填写驳回原因", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

function getStatusType(status: string): "" | "success" | "info" | "warning" | "danger" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "PENDING") return "warning";
  return "info";
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回"
  };
  return map[status] || status || "未知";
}

function formatRegion(row: any): string {
  const province = row.province || "";
  const city = row.city || "";
  const district = row.district || "";
  return [province, city, district].filter(Boolean).join(" ") || "-";
}

async function loadApplications() {
  loading.value = true;
  try {
    const data = await fetchTenantApplications({
      page: page.value,
      pageSize: pageSize.value,
      status: searchStatus.value || undefined,
      keyword: searchKeyword.value || undefined
    });
    const list = data?.records || data?.list || (Array.isArray(data) ? data : []);
    total.value = data?.total || list.length;
    applications.value = list;
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "加载入驻申请列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadApplications();
}

function handlePageChange(p: number) {
  page.value = p;
  loadApplications();
}

async function handleViewDetail(row: any) {
  detailDialogVisible.value = true;
  detailLoading.value = true;
  currentDetail.value = {};
  try {
    const id = row.id || row.applicationId;
    const data = await getTenantApplicationDetail(Number(id));
    currentDetail.value = data || row;
  } catch (e: unknown) {
    // 如果获取详情失败，直接用列表数据
    currentDetail.value = row;
  } finally {
    detailLoading.value = false;
  }
}

async function handleApprove(row: any) {
  const id = row.id || row.applicationId;
  const companyName = row.company_name || row.companyName || "该商户";
  try {
    await ElMessageBox.confirm(
      `确认通过「${companyName}」的入驻申请？通过后将自动创建租户和管理员账号。`,
      "审核确认",
      { confirmButtonText: "确认通过", cancelButtonText: "取消", type: "success" }
    );
    await approveTenantApplication(Number(id));
    ElMessage.success("入驻申请已通过，租户已创建");
    detailDialogVisible.value = false;
    loadApplications();
  } catch (e: unknown) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "审核通过失败"));
    }
  }
}

function openRejectDialog(row: any) {
  rejectingId.value = row.id || row.applicationId;
  rejectForm.remark = "";
  rejectDialogVisible.value = true;
}

async function handleReject() {
  if (!rejectFormRef.value) return;
  await rejectFormRef.value.validate(async (valid) => {
    if (!valid) return;
    rejectLoading.value = true;
    try {
      await rejectTenantApplication(Number(rejectingId.value), { remark: rejectForm.remark });
      ElMessage.success("申请已驳回");
      rejectDialogVisible.value = false;
      detailDialogVisible.value = false;
      loadApplications();
    } catch (e: unknown) {
      ElMessage.error(getErrorMessage(e, "驳回申请失败"));
    } finally {
      rejectLoading.value = false;
    }
  });
}

onMounted(() => {
  loadApplications();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
