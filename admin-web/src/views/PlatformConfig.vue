<template>
  <div class="page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 全局参数设置 -->
      <el-tab-pane label="全局参数" name="params">
        <PageCard title="全局参数设置">
          <template #extra>
            <el-button type="primary" :loading="paramsSaving" @click="handleSaveParams">保存设置</el-button>
          </template>
          <el-form ref="paramsFormRef" :model="paramsForm" label-width="200px" v-loading="paramsLoading" style="max-width: 700px">
            <el-divider content-position="left">基础参数</el-divider>
            <el-form-item label="平台名称">
              <el-input v-model="paramsForm.platformName" placeholder="如：智享全链管理系统" />
            </el-form-item>
            <el-form-item label="客服电话">
              <el-input v-model="paramsForm.servicePhone" placeholder="400-xxx-xxxx" />
            </el-form-item>
            <el-form-item label="客服邮箱">
              <el-input v-model="paramsForm.serviceEmail" placeholder="service@example.com" />
            </el-form-item>
            <el-form-item label="平台Logo URL">
              <el-input v-model="paramsForm.logoUrl" placeholder="https://..." />
            </el-form-item>

            <el-divider content-position="left">租户限制</el-divider>
            <el-form-item label="免费试用天数">
              <el-input-number v-model="paramsForm.trialDays" :min="0" :max="90" style="width: 200px" />
              <span class="form-hint">新租户注册后的免费试用天数</span>
            </el-form-item>
            <el-form-item label="最大租户数">
              <el-input-number v-model="paramsForm.maxTenants" :min="1" :max="99999" style="width: 200px" />
              <span class="form-hint">平台允许的最大租户数量</span>
            </el-form-item>
            <el-form-item label="默认套餐">
              <el-select v-model="paramsForm.defaultPlanId" placeholder="选择默认套餐" style="width: 200px" clearable>
                <el-option v-for="p in planOptions" :key="p.planId || p.id" :label="p.name" :value="p.planId || p.id" />
              </el-select>
              <span class="form-hint">新租户注册后默认分配的套餐</span>
            </el-form-item>

            <el-divider content-position="left">安全设置</el-divider>
            <el-form-item label="密码过期天数">
              <el-input-number v-model="paramsForm.passwordExpireDays" :min="0" :max="365" style="width: 200px" />
              <span class="form-hint">0表示不强制更换密码</span>
            </el-form-item>
            <el-form-item label="会话超时(分钟)">
              <el-input-number v-model="paramsForm.sessionTimeout" :min="5" :max="480" style="width: 200px" />
            </el-form-item>
            <el-form-item label="登录失败锁定次数">
              <el-input-number v-model="paramsForm.loginFailLimit" :min="3" :max="20" style="width: 200px" />
              <span class="form-hint">连续登录失败此次数后锁定账号</span>
            </el-form-item>
          </el-form>
        </PageCard>
      </el-tab-pane>

      <!-- 公告管理 -->
      <el-tab-pane label="公告管理" name="announcements">
        <PageCard title="平台公告管理">
          <template #extra>
            <el-button type="primary" @click="openAnnouncementDialog()">发布公告</el-button>
            <el-button @click="loadAnnouncements">刷新</el-button>
          </template>
          <el-table :data="announcements" v-loading="announcementLoading" stripe>
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="type" label="类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getAnnouncementType(row.type)">{{ getAnnouncementTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'published' ? 'success' : 'info'">
                  {{ row.status === 'published' ? '已发布' : '草稿' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="180">
              <template #default="{ row }">{{ formatDate(row.publishedAt || row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openAnnouncementDialog(row)">编辑</el-button>
                <el-button size="small" link type="success" v-if="row.status !== 'published'" @click="handlePublishAnnouncement(row)">发布</el-button>
                <el-button size="small" link type="warning" v-else @click="handleUnpublishAnnouncement(row)">撤回</el-button>
                <el-button size="small" link type="danger" @click="handleDeleteAnnouncement(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无公告" :image-size="80" />
            </template>
          </el-table>
        </PageCard>
      </el-tab-pane>

      <!-- 维护模式 -->
      <el-tab-pane label="维护模式" name="maintenance">
        <PageCard title="维护模式">
          <el-alert
            title="开启维护模式后，所有租户将无法登录系统，仅平台管理员可访问后台。请谨慎操作！"
            type="warning"
            :closable="false"
            style="margin-bottom: 24px"
          />
          <div class="maintenance-section">
            <div class="maintenance-row">
              <div class="maintenance-info">
                <div class="maintenance-title">维护模式开关</div>
                <div class="maintenance-desc">开启后租户端将显示维护页面，无法进行任何操作</div>
              </div>
              <el-switch
                v-model="maintenanceForm.enabled"
                active-text="开启"
                inactive-text="关闭"
                :loading="maintenanceSaving"
                @change="handleToggleMaintenance"
              />
            </div>
            <el-divider />
            <el-form label-width="120px" style="max-width: 600px">
              <el-form-item label="维护标题">
                <el-input v-model="maintenanceForm.title" placeholder="如：系统升级维护中" />
              </el-form-item>
              <el-form-item label="维护内容">
                <el-input v-model="maintenanceForm.content" type="textarea" :rows="4" placeholder="向用户展示的维护说明" />
              </el-form-item>
              <el-form-item label="预计恢复时间">
                <el-date-picker
                  v-model="maintenanceForm.estimatedRecovery"
                  type="datetime"
                  placeholder="选择预计恢复时间"
                  style="width: 100%"
                  value-format="YYYY-MM-DD HH:mm:ss"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="maintenanceSaving" @click="handleSaveMaintenance">保存维护信息</el-button>
              </el-form-item>
            </el-form>
          </div>
        </PageCard>
      </el-tab-pane>
    </el-tabs>

    <!-- 公告编辑对话框 -->
    <el-dialog v-model="announcementDialogVisible" :title="editingAnnouncement ? '编辑公告' : '发布公告'" width="560px">
      <el-form ref="announcementFormRef" :model="announcementForm" :rules="announcementRules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="announcementForm.title" placeholder="请输入公告标题" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="announcementForm.type" placeholder="选择公告类型" style="width: 100%">
            <el-option label="系统通知" value="system" />
            <el-option label="版本更新" value="update" />
            <el-option label="活动公告" value="activity" />
            <el-option label="紧急通知" value="urgent" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="announcementForm.content" type="textarea" :rows="6" placeholder="请输入公告内容" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="announcementForm.status">
            <el-radio value="draft">存为草稿</el-radio>
            <el-radio value="published">直接发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announcementDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="announcementSaving" @click="handleSaveAnnouncement">保存</el-button>
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
  fetchPlatformConfig, updatePlatformConfig,
  fetchPlatformAnnouncements, createPlatformAnnouncement,
  updatePlatformAnnouncement, deletePlatformAnnouncement,
  fetchSubscriptionPlans
} from "../api";

const activeTab = ref("params");

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

// 全局参数
const paramsLoading = ref(false);
const paramsSaving = ref(false);
const paramsFormRef = ref<FormInstance>();
const planOptions = ref<any[]>([]);
const paramsForm = reactive({
  platformName: "智享全链管理系统",
  servicePhone: "",
  serviceEmail: "",
  logoUrl: "",
  trialDays: 7,
  maxTenants: 1000,
  defaultPlanId: "" as string | number,
  passwordExpireDays: 0,
  sessionTimeout: 240,
  loginFailLimit: 5
});

// 公告管理
const announcementLoading = ref(false);
const announcementSaving = ref(false);
const announcements = ref<any[]>([]);
const announcementDialogVisible = ref(false);
const announcementFormRef = ref<FormInstance>();
const editingAnnouncement = ref<any>(null);
const announcementForm = reactive({
  title: "",
  type: "system",
  content: "",
  status: "draft"
});
const announcementRules: FormRules = {
  title: [{ required: true, message: "请输入公告标题", trigger: "blur" }],
  type: [{ required: true, message: "请选择公告类型", trigger: "change" }],
  content: [{ required: true, message: "请输入公告内容", trigger: "blur" }]
};

// 维护模式
const maintenanceSaving = ref(false);
const maintenanceForm = reactive({
  enabled: false,
  title: "系统升级维护中",
  content: "系统正在进行升级维护，请稍后再试。给您带来的不便敬请谅解！",
  estimatedRecovery: ""
});

function getAnnouncementType(type: string): "" | "success" | "warning" | "info" | "danger" {
  const map: Record<string, "" | "success" | "warning" | "info" | "danger"> = {
    system: "",
    update: "success",
    activity: "warning",
    urgent: "danger"
  };
  return map[type] || "info";
}

function getAnnouncementTypeLabel(type: string): string {
  const map: Record<string, string> = {
    system: "系统通知",
    update: "版本更新",
    activity: "活动公告",
    urgent: "紧急通知"
  };
  return map[type] || type || "未知";
}

async function loadParams() {
  paramsLoading.value = true;
  try {
    const data = await fetchPlatformConfig();
    if (data) {
      Object.assign(paramsForm, data);
    }
  } catch (e: unknown) {
    // 后端可能还没有此API，静默处理
    ElMessage.info("平台参数配置API尚未就绪，当前为默认值");
  } finally {
    paramsLoading.value = false;
  }
}

async function loadPlanOptions() {
  try {
    const data = (await fetchSubscriptionPlans({ pageSize: 999 })).data;
    planOptions.value = data.records || data.list || [];
  } catch {
    // ignore
  }
}

async function handleSaveParams() {
  paramsSaving.value = true;
  try {
    await updatePlatformConfig({ ...paramsForm });
    ElMessage.success("全局参数已保存");
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "保存全局参数失败，后端API可能尚未实现"));
  } finally {
    paramsSaving.value = false;
  }
}

async function loadAnnouncements() {
  announcementLoading.value = true;
  try {
    const data = await fetchPlatformAnnouncements({ page: 1, pageSize: 50 });
    announcements.value = data?.records || data?.list || (Array.isArray(data) ? data : []);
  } catch (e: unknown) {
    ElMessage.info("平台公告API尚未就绪");
    announcements.value = [];
  } finally {
    announcementLoading.value = false;
  }
}

function openAnnouncementDialog(row?: any) {
  editingAnnouncement.value = row || null;
  if (row) {
    announcementForm.title = row.title || "";
    announcementForm.type = row.type || "system";
    announcementForm.content = row.content || "";
    announcementForm.status = row.status || "draft";
  } else {
    announcementForm.title = "";
    announcementForm.type = "system";
    announcementForm.content = "";
    announcementForm.status = "draft";
  }
  announcementDialogVisible.value = true;
}

async function handleSaveAnnouncement() {
  if (!announcementFormRef.value) return;
  await announcementFormRef.value.validate(async (valid) => {
    if (!valid) return;
    announcementSaving.value = true;
    try {
      if (editingAnnouncement.value) {
        await updatePlatformAnnouncement(editingAnnouncement.value.id, { ...announcementForm });
        ElMessage.success("公告已更新");
      } else {
        await createPlatformAnnouncement({ ...announcementForm });
        ElMessage.success("公告已创建");
      }
      announcementDialogVisible.value = false;
      loadAnnouncements();
    } catch (e: unknown) {
      ElMessage.error(getErrorMessage(e, "保存公告失败，后端API可能尚未实现"));
    } finally {
      announcementSaving.value = false;
    }
  });
}

async function handlePublishAnnouncement(row: any) {
  try {
    await updatePlatformAnnouncement(row.id, { status: "published" });
    ElMessage.success("公告已发布");
    loadAnnouncements();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "发布失败"));
  }
}

async function handleUnpublishAnnouncement(row: any) {
  try {
    await updatePlatformAnnouncement(row.id, { status: "draft" });
    ElMessage.success("公告已撤回");
    loadAnnouncements();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "撤回失败"));
  }
}

async function handleDeleteAnnouncement(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除该公告吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await deletePlatformAnnouncement(row.id);
    ElMessage.success("公告已删除");
    loadAnnouncements();
  } catch (e: unknown) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "删除失败"));
    }
  }
}

async function handleToggleMaintenance(val: boolean) {
  if (val) {
    try {
      await ElMessageBox.confirm(
        "确认开启维护模式？开启后所有租户将无法登录系统！",
        "危险操作确认",
        { confirmButtonText: "确认开启", cancelButtonText: "取消", type: "error" }
      );
      maintenanceSaving.value = true;
      await updatePlatformConfig({
        maintenanceMode: true,
        maintenanceTitle: maintenanceForm.title,
        maintenanceContent: maintenanceForm.content
      });
      ElMessage.warning("维护模式已开启");
    } catch (e: unknown) {
      if (e === "cancel") {
        maintenanceForm.enabled = false;
      } else {
        ElMessage.error(getErrorMessage(e, "开启维护模式失败"));
        maintenanceForm.enabled = false;
      }
    } finally {
      maintenanceSaving.value = false;
    }
  } else {
    maintenanceSaving.value = true;
    try {
      await updatePlatformConfig({ maintenanceMode: false });
      ElMessage.success("维护模式已关闭");
    } catch (e: unknown) {
      ElMessage.error(getErrorMessage(e, "关闭维护模式失败"));
      maintenanceForm.enabled = true;
    } finally {
      maintenanceSaving.value = false;
    }
  }
}

async function handleSaveMaintenance() {
  maintenanceSaving.value = true;
  try {
    await updatePlatformConfig({
      maintenanceTitle: maintenanceForm.title,
      maintenanceContent: maintenanceForm.content,
      maintenanceEstimatedRecovery: maintenanceForm.estimatedRecovery
    });
    ElMessage.success("维护信息已保存");
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "保存维护信息失败"));
  } finally {
    maintenanceSaving.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "announcements" && announcements.value.length === 0) {
    loadAnnouncements();
  }
}

onMounted(() => {
  loadParams();
  loadPlanOptions();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.form-hint {
  font-size: 12px;
  color: #999;
  display: block;
  margin-top: 4px;
  margin-left: 8px;
}
.maintenance-section {
  max-width: 700px;
}
.maintenance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.maintenance-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.maintenance-desc {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
</style>
