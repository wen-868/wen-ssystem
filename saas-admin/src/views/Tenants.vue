<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.keyword"
            placeholder="公司/联系人/手机号"
            clearable
            style="width: 240px;"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px;">
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="showCreateDialog = true">新建租户</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="60" align="center" />
        <el-table-column prop="tenantCode" label="租户编号" width="130" />
        <el-table-column prop="companyName" label="公司名称" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="goDetail(row.id)">{{ row.companyName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="contactPerson" label="联系人" width="100" />
        <el-table-column prop="contactMobile" label="联系电话" width="130" />
        <el-table-column label="行业" prop="industry" width="100" />
        <el-table-column label="来源" prop="source" width="110">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.source)" size="small">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" prop="expireAt" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expireAt) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button
              v-if="row.status === 'ACTIVE'"
              link
              type="warning"
              size="small"
              @click="handleSuspend(row)"
            >停用</el-button>
            <el-button
              v-if="row.status === 'SUSPENDED'"
              link
              type="success"
              size="small"
              @click="handleEnable(row)"
            >启用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无租户数据" />

      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <!-- 新建租户对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建租户" width="640px" :close-on-click-modal="false">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="公司名称" prop="companyName">
              <el-input v-model="createForm.companyName" placeholder="请输入公司全称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司简称" prop="companyShortName">
              <el-input v-model="createForm.companyShortName" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系人" prop="contactPerson">
              <el-input v-model="createForm.contactPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="contactMobile">
              <el-input v-model="createForm.contactMobile" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系邮箱" prop="contactEmail">
              <el-input v-model="createForm.contactEmail" placeholder="选填" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="行业" prop="industry">
              <el-input v-model="createForm.industry" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="省份" prop="province">
              <el-input v-model="createForm.province" placeholder="选填" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市" prop="city">
              <el-input v-model="createForm.city" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="详细地址" prop="address">
          <el-input v-model="createForm.address" placeholder="选填" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="营业执照" prop="businessLicense">
              <el-input v-model="createForm.businessLicense" placeholder="选填" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人" prop="legalPerson">
              <el-input v-model="createForm.legalPerson" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="来源" prop="source">
              <el-select v-model="createForm.source" style="width: 100%;">
                <el-option label="手动创建" value="MANUAL" />
                <el-option label="自助注册" value="SELF_REGISTER" />
                <el-option label="邀请" value="INVITATION" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司规模" prop="companyScale">
              <el-input v-model="createForm.companyScale" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 停用对话框 -->
    <el-dialog v-model="showSuspendDialog" title="停用租户" width="480px">
      <p style="margin-bottom: 12px;">确定要停用租户 <b>{{ currentRow?.companyName }}</b> 吗？停用后该租户将无法登录系统。</p>
      <el-form label-width="80px">
        <el-form-item label="停用原因">
          <el-input v-model="suspendReason" type="textarea" :rows="3" placeholder="请输入停用原因（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSuspendDialog = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading" @click="confirmSuspend">确定停用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import {
  getTenants,
  createTenant,
  changeTenantStatus,
  type TenantItem
} from "../api";

const router = useRouter();

const loading = ref(false);
const list = ref<TenantItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const searchForm = reactive({
  keyword: "",
  status: ""
});

const statusOptions = [
  { label: "待审核", value: "PENDING" },
  { label: "正常", value: "ACTIVE" },
  { label: "已停用", value: "SUSPENDED" },
  { label: "已到期", value: "EXPIRED" },
  { label: "已关闭", value: "CLOSED" }
];

function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDING: "待审核",
    ACTIVE: "正常",
    SUSPENDED: "已停用",
    EXPIRED: "已到期",
    CLOSED: "已关闭"
  };
  return map[s] || s;
}

function statusTagType(s: string) {
  const map: Record<string, string> = {
    PENDING: "warning",
    ACTIVE: "success",
    SUSPENDED: "danger",
    EXPIRED: "info",
    CLOSED: "info"
  };
  return map[s] || "info";
}

function sourceLabel(s: string) {
  const map: Record<string, string> = {
    MANUAL: "手动创建",
    SELF_REGISTER: "自助注册",
    INVITATION: "邀请"
  };
  return map[s] || s;
}

function sourceTagType(s: string) {
  const map: Record<string, string> = {
    MANUAL: "",
    SELF_REGISTER: "success",
    INVITATION: "warning"
  };
  return map[s] || "";
}

function formatDate(s?: string) {
  if (!s) return "-";
  return s.slice(0, 10);
}

function formatDateTime(s?: string) {
  if (!s) return "-";
  return s.replace("T", " ").slice(0, 16);
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getTenants({
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.status = "";
  page.value = 1;
  fetchList();
}

function goDetail(id: number) {
  router.push(`/tenants/${id}`);
}

// ====== 新建租户 ======
const showCreateDialog = ref(false);
const createLoading = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  companyName: "",
  companyShortName: "",
  contactPerson: "",
  contactMobile: "",
  contactEmail: "",
  industry: "",
  province: "",
  city: "",
  district: "",
  address: "",
  businessLicense: "",
  legalPerson: "",
  source: "MANUAL",
  companyScale: "",
  remark: ""
});

const createRules: FormRules = {
  companyName: [{ required: true, message: "请输入公司名称", trigger: "blur" }],
  contactPerson: [{ required: true, message: "请输入联系人", trigger: "blur" }],
  contactMobile: [
    { required: true, message: "请输入联系电话", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号", trigger: "blur" }
  ]
};

async function handleCreate() {
  try {
    await createFormRef.value?.validate();
  } catch {
    return;
  }
  createLoading.value = true;
  try {
    await createTenant(createForm);
    ElMessage.success("创建成功");
    showCreateDialog.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "创建失败");
  } finally {
    createLoading.value = false;
  }
}

// ====== 停用/启用 ======
const currentRow = ref<TenantItem | null>(null);
const showSuspendDialog = ref(false);
const suspendReason = ref("");
const actionLoading = ref(false);

function handleSuspend(row: TenantItem) {
  currentRow.value = row;
  suspendReason.value = "";
  showSuspendDialog.value = true;
}

async function confirmSuspend() {
  if (!currentRow.value) return;
  actionLoading.value = true;
  try {
    await changeTenantStatus(currentRow.value.id, "SUSPENDED", suspendReason.value || undefined);
    ElMessage.success("已停用");
    showSuspendDialog.value = false;
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  } finally {
    actionLoading.value = false;
  }
}

async function handleEnable(row: TenantItem) {
  try {
    await ElMessageBox.confirm(
      `确定要启用租户 "${row.companyName}" 吗？`,
      "启用确认",
      { type: "warning", confirmButtonText: "确定启用", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    await changeTenantStatus(row.id, "ACTIVE");
    ElMessage.success("已启用");
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  }
}

onMounted(() => {
  fetchList();
});
</script>