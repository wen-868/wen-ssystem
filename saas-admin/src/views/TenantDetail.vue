<template>
  <div>
    <el-page-header @back="goBack" content="租户详情" style="margin-bottom: 16px;">
      <template #content>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 18px; font-weight: 600;">{{ detail?.companyName || '加载中...' }}</span>
          <el-tag v-if="detail" :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </div>
      </template>
    </el-page-header>

    <el-row :gutter="16" v-loading="loading">
      <!-- 左侧：基本信息 -->
      <el-col :span="16">
        <el-card style="margin-bottom: 16px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>基本信息</span>
              <el-button type="primary" size="small" @click="showEditDialog = true">编辑</el-button>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="租户编号">{{ detail?.tenantCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="公司名称">{{ detail?.companyName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="公司简称">{{ detail?.companyShortName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="行业">{{ detail?.industry || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ detail?.contactPerson || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail?.contactMobile || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系邮箱">{{ detail?.contactEmail || '-' }}</el-descriptions-item>
            <el-descriptions-item label="公司规模">{{ detail?.companyScale || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所在地区">{{ regionText }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ sourceLabel(detail?.source || '') }}</el-descriptions-item>
            <el-descriptions-item label="营业执照">{{ detail?.businessLicense || '-' }}</el-descriptions-item>
            <el-descriptions-item label="法人">{{ detail?.legalPerson || '-' }}</el-descriptions-item>
            <el-descriptions-item label="详细地址" :span="2">{{ detail?.address || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detail?.remark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDateTime(detail?.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDateTime(detail?.updatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="到期时间">
              <span :style="{ color: isExpired ? '#ef4444' : '' }">{{ formatDate(detail?.expireAt) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="停用原因">
              <span v-if="detail?.status === 'SUSPENDED'">{{ detail.suspendReason || '-' }}</span>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-bottom: 16px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>模块权限</span>
              <el-button type="primary" size="small" @click="showModuleDialog = true">配置权限</el-button>
            </div>
          </template>
          <el-table :data="detail?.modules || []" border size="small">
            <el-table-column prop="moduleCode" label="模块编码" width="160" />
            <el-table-column prop="moduleName" label="模块名称" width="160" />
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                  {{ row.enabled ? '已开通' : '未开通' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="grantedBy" label="授权方式" width="120">
              <template #default="{ row }">
                {{ grantedByLabel(row.grantedBy) }}
              </template>
            </el-table-column>
            <el-table-column prop="expireAt" label="到期时间" width="160">
              <template #default="{ row }">{{ formatDate(row.expireAt) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!detail?.modules?.length" description="暂无模块数据" :image-size="80" />
        </el-card>

        <el-card>
          <template #header><span>订阅记录</span></template>
          <el-table :data="subscriptions" border size="small" v-loading="subLoading">
            <el-table-column prop="subscriptionNo" label="订阅编号" width="160" />
            <el-table-column prop="planName" label="套餐" />
            <el-table-column prop="planType" label="类型" width="100">
              <template #default="{ row }">{{ planTypeLabel(row.planType) }}</template>
            </el-table-column>
            <el-table-column prop="price" label="价格" width="100">
              <template #default="{ row }">¥{{ row.price?.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="startDate" label="开始日期" width="120" />
            <el-table-column prop="endDate" label="结束日期" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="paymentStatus" label="支付状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.paymentStatus === 'PAID' ? 'success' : 'warning'" size="small">
                  {{ row.paymentStatus === 'PAID' ? '已支付' : '未支付' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!subLoading && subscriptions.length === 0" description="暂无订阅记录" :image-size="80" />
        </el-card>
      </el-col>

      <!-- 右侧：操作区 -->
      <el-col :span="8">
        <el-card style="margin-bottom: 16px;">
          <template #header><span>快捷操作</span></template>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <el-button
              v-if="detail?.status === 'ACTIVE'"
              type="warning"
              @click="handleSuspend"
            >停用租户</el-button>
            <el-button
              v-if="detail?.status === 'SUSPENDED'"
              type="success"
              @click="handleEnable"
            >启用租户</el-button>
            <el-button
              v-if="detail?.status === 'PENDING'"
              type="success"
              @click="handleApprove"
            >审核通过</el-button>
            <el-button
              v-if="detail?.status === 'PENDING'"
              type="danger"
              @click="handleReject"
            >审核拒绝</el-button>
            <el-button type="primary" plain @click="goToSubscription">查看订阅</el-button>
          </div>
        </el-card>

        <el-card>
          <template #header><span>数据概览</span></template>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">门店数</span>
              <b>-</b>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">员工数</span>
              <b>-</b>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">商品数</span>
              <b>-</b>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">客户数</span>
              <b>-</b>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑租户信息" width="640px" :close-on-click-modal="false">
      <el-form :model="editForm" ref="editFormRef" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="公司名称">
              <el-input v-model="editForm.companyName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司简称">
              <el-input v-model="editForm.companyShortName" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="editForm.contactPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="editForm.contactMobile" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系邮箱">
              <el-input v-model="editForm.contactEmail" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="行业">
              <el-input v-model="editForm.industry" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="详细地址">
          <el-input v-model="editForm.address" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="营业执照">
              <el-input v-model="editForm.businessLicense" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="法人">
              <el-input v-model="editForm.legalPerson" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 模块权限配置对话框 -->
    <el-dialog v-model="showModuleDialog" title="配置模块权限" width="560px" :close-on-click-modal="false">
      <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 13px;">
        勾选要开通的模块，取消勾选则关闭该模块访问权限。
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;">
        <div v-for="mod in moduleOptions" :key="mod.moduleCode" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <el-checkbox v-model="mod.enabled" />
          <div style="flex: 1;">
            <div style="font-weight: 500;">{{ mod.moduleName }}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">{{ mod.moduleCode }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showModuleDialog = false">取消</el-button>
        <el-button type="primary" :loading="moduleLoading" @click="handleSaveModules">保存</el-button>
      </template>
    </el-dialog>

    <!-- 停用对话框 -->
    <el-dialog v-model="showSuspendDialog" title="停用租户" width="480px">
      <p style="margin-bottom: 12px;">确定要停用租户 <b>{{ detail?.companyName }}</b> 吗？停用后该租户将无法登录系统。</p>
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
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import {
  getTenantDetail,
  updateTenant,
  changeTenantStatus,
  getTenantModules,
  updateTenantModules,
  getSubscriptions,
  type TenantDetail,
  type TenantModule
} from "../api";

const route = useRoute();
const router = useRouter();

const tenantId = computed(() => Number(route.params.id));

const loading = ref(false);
const detail = ref<TenantDetail | null>(null);
const subscriptions = ref<any[]>([]);
const subLoading = ref(false);

// 编辑
const showEditDialog = ref(false);
const editLoading = ref(false);
const editFormRef = ref<FormInstance>();
const editForm = reactive({
  companyName: "",
  companyShortName: "",
  contactPerson: "",
  contactMobile: "",
  contactEmail: "",
  industry: "",
  address: "",
  businessLicense: "",
  legalPerson: "",
  remark: ""
});

// 模块权限
const showModuleDialog = ref(false);
const moduleLoading = ref(false);
const moduleOptions = ref<Array<TenantModule & { enabled: number }>>([]);

// 停用
const showSuspendDialog = ref(false);
const suspendReason = ref("");
const actionLoading = ref(false);

function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDING: "待审核", ACTIVE: "正常", SUSPENDED: "已停用", EXPIRED: "已到期", CLOSED: "已关闭"
  };
  return map[s] || s;
}
function statusTagType(s: string) {
  const map: Record<string, string> = {
    PENDING: "warning", ACTIVE: "success", SUSPENDED: "danger", EXPIRED: "info", CLOSED: "info"
  };
  return map[s] || "info";
}
function sourceLabel(s: string) {
  const map: Record<string, string> = { MANUAL: "手动创建", SELF_REGISTER: "自助注册", INVITATION: "邀请" };
  return map[s] || s;
}
function grantedByLabel(s: string) {
  const map: Record<string, string> = { PLAN: "套餐包含", MANUAL: "手动授权", ADDON: "增值服务" };
  return map[s] || s;
}
function planTypeLabel(s: string) {
  const map: Record<string, string> = { MONTHLY: "月付", YEARLY: "年付", PERMANENT: "永久" };
  return map[s] || s;
}
function formatDate(s?: string) { return s ? s.slice(0, 10) : "-"; }
function formatDateTime(s?: string) { return s ? s.replace("T", " ").slice(0, 16) : "-"; }

const regionText = computed(() => {
  if (!detail.value) return "-";
  const parts = [detail.value.province, detail.value.city, detail.value.district].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "-";
});

const isExpired = computed(() => {
  if (!detail.value?.expireAt) return false;
  return new Date(detail.value.expireAt) < new Date();
});

async function fetchDetail() {
  loading.value = true;
  try {
    const res = await getTenantDetail(tenantId.value);
    detail.value = res.data?.data || (res as any).data || res;
    initModuleOptions();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function initModuleOptions() {
  const defaults = [
    { moduleCode: "PRODUCT", moduleName: "商品中心" },
    { moduleCode: "PURCHASE", moduleName: "采购管理" },
    { moduleCode: "INVENTORY", moduleName: "库存管理" },
    { moduleCode: "SALE", moduleName: "销售管理" },
    { moduleCode: "CUSTOMER", moduleName: "客户管理" },
    { moduleCode: "MARKETING", moduleName: "营销中心" },
    { moduleCode: "FINANCE", moduleName: "财务管理" },
    { moduleCode: "REPORT", moduleName: "经营分析" },
    { moduleCode: "SYSTEM", moduleName: "系统设置" }
  ];
  const existing = detail.value?.modules || [];
  moduleOptions.value = defaults.map(d => {
    const found = existing.find((m: any) => m.moduleCode === d.moduleCode);
    return {
      moduleCode: d.moduleCode,
      moduleName: d.moduleName,
      enabled: found ? found.enabled : 0,
      grantedBy: found?.grantedBy || "MANUAL",
      expireAt: found?.expireAt
    } as any;
  });
}

async function fetchSubscriptions() {
  subLoading.value = true;
  try {
    const res = await getSubscriptions({ tenantId: tenantId.value, pageSize: 20 });
    const data = res.data?.data || (res as any).data || res;
    subscriptions.value = data.records || [];
  } catch {
    subscriptions.value = [];
  } finally {
    subLoading.value = false;
  }
}

function goBack() {
  router.push("/tenants");
}

function goToSubscription() {
  router.push(`/subscriptions?tenantId=${tenantId.value}`);
}

function handleSuspend() {
  suspendReason.value = "";
  showSuspendDialog.value = true;
}

async function confirmSuspend() {
  actionLoading.value = true;
  try {
    await changeTenantStatus(tenantId.value, "SUSPENDED", suspendReason.value || undefined);
    ElMessage.success("已停用");
    showSuspendDialog.value = false;
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  } finally {
    actionLoading.value = false;
  }
}

async function handleEnable() {
  try {
    await ElMessageBox.confirm(
      `确定要启用租户 "${detail.value?.companyName}" 吗？`,
      "启用确认",
      { type: "warning", confirmButtonText: "确定启用", cancelButtonText: "取消" }
    );
  } catch { return; }
  try {
    await changeTenantStatus(tenantId.value, "ACTIVE");
    ElMessage.success("已启用");
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  }
}

async function handleApprove() {
  try {
    await ElMessageBox.confirm(
      `确定审核通过租户 "${detail.value?.companyName}" 吗？`,
      "审核确认",
      { type: "success", confirmButtonText: "通过", cancelButtonText: "取消" }
    );
  } catch { return; }
  try {
    await changeTenantStatus(tenantId.value, "ACTIVE");
    ElMessage.success("审核通过");
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  }
}

async function handleReject() {
  try {
    const { value: reason } = await ElMessageBox.prompt("请输入拒绝原因", "审核拒绝", {
      confirmButtonText: "确认拒绝",
      cancelButtonText: "取消",
      inputType: "textarea",
      inputPlaceholder: "请输入拒绝原因"
    });
    await changeTenantStatus(tenantId.value, "CLOSED", reason);
    ElMessage.success("已拒绝");
    fetchDetail();
  } catch { /* cancelled */ }
}

function openEditDialog() {
  if (!detail.value) return;
  Object.assign(editForm, {
    companyName: detail.value.companyName || "",
    companyShortName: detail.value.companyShortName || "",
    contactPerson: detail.value.contactPerson || "",
    contactMobile: detail.value.contactMobile || "",
    contactEmail: detail.value.contactEmail || "",
    industry: detail.value.industry || "",
    address: detail.value.address || "",
    businessLicense: detail.value.businessLicense || "",
    legalPerson: detail.value.legalPerson || "",
    remark: detail.value.remark || ""
  });
  showEditDialog.value = true;
}

watch(showEditDialog, (val) => {
  if (val) openEditDialog();
});

async function handleSaveEdit() {
  editLoading.value = true;
  try {
    await updateTenant(tenantId.value, editForm);
    ElMessage.success("保存成功");
    showEditDialog.value = false;
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleSaveModules() {
  moduleLoading.value = true;
  try {
    await updateTenantModules(tenantId.value, moduleOptions.value as any);
    ElMessage.success("保存成功");
    showModuleDialog.value = false;
    fetchDetail();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  } finally {
    moduleLoading.value = false;
  }
}

onMounted(() => {
  fetchDetail();
  fetchSubscriptions();
});
</script>