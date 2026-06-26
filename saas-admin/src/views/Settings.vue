<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台配置</h2>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 全局参数 -->
      <el-tab-pane label="全局参数" name="general">
        <el-form :model="config" label-width="140px" style="max-width: 760px; padding: 20px;">
          <el-form-item label="平台名称">
            <el-input v-model="config.platformName" placeholder="如：OnePan 运营平台" />
          </el-form-item>
          <el-form-item label="客服电话">
            <el-input v-model="config.servicePhone" placeholder="如：400-XXX-XXXX" />
          </el-form-item>
          <el-form-item label="客服邮箱">
            <el-input v-model="config.serviceEmail" placeholder="如：support@onepan.cn" />
          </el-form-item>
          <el-form-item label="默认试用天数">
            <el-input-number v-model="config.trialDays" :min="1" :max="90" :step="1" />
          </el-form-item>
          <el-form-item label="租户默认套餐">
            <el-select v-model="config.defaultPlanId" placeholder="选择默认套餐" clearable style="width: 240px;">
              <el-option v-for="p in planOptions" :key="p.id" :label="p.planName" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="发票税率(%)">
            <el-input-number v-model="config.taxRate" :min="0" :max="100" :precision="2" :step="0.5" />
          </el-form-item>
          <el-form-item label="单次最大存储(MB)">
            <el-input-number v-model="config.maxUploadSizeMb" :min="1" :step="10" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveConfig">保存全局参数</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 公告管理 -->
      <el-tab-pane label="公告管理" name="announcements">
        <div style="padding: 20px;">
          <div style="margin-bottom: 16px;">
            <el-button type="primary" @click="showAnnounceDialog = true; editingAnnounce = null">新建公告</el-button>
          </div>
          <el-table :data="config.announcements || []" border stripe style="width: 100%;">
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.type === 'ALERT' ? 'danger' : 'info'" size="small">
                  {{ row.type === 'ALERT' ? '紧急' : '普通' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="生效时间" width="200">
              <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'" size="small">
                  {{ row.status === 'PUBLISHED' ? '已发布' : '草稿' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row, $index }">
                <el-button link type="primary" size="small" @click="editAnnounce(row, $index)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeAnnounce($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!config.announcements?.length" description="暂无公告" style="margin: 20px 0;" />
        </div>
      </el-tab-pane>

      <!-- 维护模式 -->
      <el-tab-pane label="维护模式" name="maintenance">
        <div style="max-width: 600px; padding: 20px;">
          <el-alert
            v-if="config.maintenanceMode"
            title="系统当前处于维护模式"
            type="warning"
            show-icon
            :closable="false"
            style="margin-bottom: 24px;"
          />
          <el-form :model="config" label-width="120px">
            <el-form-item label="维护模式">
              <el-switch v-model="config.maintenanceMode" active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="维护标题">
              <el-input v-model="config.maintenanceTitle" placeholder="如：系统维护中" />
            </el-form-item>
            <el-form-item label="维护说明">
              <el-input v-model="config.maintenanceMessage" type="textarea" :rows="3" placeholder="向用户展示的维护说明" />
            </el-form-item>
            <el-form-item label="允许IP白名单">
              <el-input v-model="config.maintenanceWhitelist" placeholder="多个IP用逗号分隔，如：192.168.1.1,10.0.0.1" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig">保存维护配置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 注册配置 -->
      <el-tab-pane label="注册配置" name="register">
        <div style="max-width: 600px; padding: 20px;">
          <el-form :model="config" label-width="140px">
            <el-form-item label="开放注册">
              <el-switch v-model="config.openRegister" active-text="允许" inactive-text="禁止" />
            </el-form-item>
            <el-form-item label="注册审核">
              <el-switch v-model="config.registerNeedAudit" active-text="需审核" inactive-text="自动通过" />
            </el-form-item>
            <el-form-item label="手机号必填">
              <el-switch v-model="config.registerRequireMobile" />
            </el-form-item>
            <el-form-item label="营业执照必填">
              <el-switch v-model="config.registerRequireLicense" />
            </el-form-item>
            <el-form-item label="注册协议URL">
              <el-input v-model="config.registerAgreementUrl" placeholder="https://" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig">保存注册配置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 公告编辑弹窗 -->
    <el-dialog v-model="showAnnounceDialog" :title="editingAnnounce ? '编辑公告' : '新建公告'" width="560px" :close-on-click-modal="false">
      <el-form :model="announceForm" label-width="100px">
        <el-form-item label="标题" required>
          <el-input v-model="announceForm.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="announceForm.content" type="textarea" :rows="4" placeholder="公告内容" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="announceForm.type">
            <el-radio value="NORMAL">普通</el-radio>
            <el-radio value="ALERT">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="announceForm.status">
            <el-radio value="DRAFT">草稿</el-radio>
            <el-radio value="PUBLISHED">发布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="announceForm.startTime" type="datetime" placeholder="选择时间" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="announceForm.endTime" type="datetime" placeholder="选择时间" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAnnounceDialog = false">取消</el-button>
        <el-button type="primary" @click="saveAnnounce">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { getPlatformConfig, updatePlatformConfig, getPlans } from "../api";

const activeTab = ref("general");
const saving = ref(false);
const planOptions = ref<any[]>([]);

const config = reactive<any>({
  platformName: "",
  servicePhone: "",
  serviceEmail: "",
  trialDays: 7,
  defaultPlanId: null,
  taxRate: 0,
  maxUploadSizeMb: 10,
  openRegister: true,
  registerNeedAudit: true,
  registerRequireMobile: true,
  registerRequireLicense: false,
  registerAgreementUrl: "",
  maintenanceMode: false,
  maintenanceTitle: "",
  maintenanceMessage: "",
  maintenanceWhitelist: "",
  announcements: []
});

async function fetchConfig() {
  try {
    const res = await getPlatformConfig();
    const data = res.data?.data || (res as any).data || res;
    if (data && typeof data === "object") {
      Object.assign(config, data);
    }
  } catch { /* 使用默认值 */ }
}

async function fetchPlans() {
  try {
    const res = await getPlans();
    const data = res.data?.data || (res as any).data || res;
    planOptions.value = data.records || [];
  } catch { /* ignore */ }
}

async function saveConfig() {
  saving.value = true;
  try {
    await updatePlatformConfig({ ...config });
    ElMessage.success("保存成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

// 公告管理
const showAnnounceDialog = ref(false);
const editingAnnounce = ref<any>(null);
const announceForm = reactive({
  title: "",
  content: "",
  type: "NORMAL" as string,
  startTime: "",
  endTime: "",
  status: "DRAFT" as string
});

function editAnnounce(row: any, index: number) {
  editingAnnounce.value = { ...row, index };
  Object.assign(announceForm, row);
  showAnnounceDialog.value = true;
}

function removeAnnounce(index: number) {
  config.announcements.splice(index, 1);
}

function saveAnnounce() {
  if (!announceForm.title) { ElMessage.warning("请输入公告标题"); return; }
  if (editingAnnounce.value) {
    Object.assign(config.announcements[editingAnnounce.value.index], { ...announceForm });
  } else {
    config.announcements.push({ ...announceForm });
  }
  showAnnounceDialog.value = false;
  saveConfig();
}

onMounted(() => {
  fetchConfig();
  fetchPlans();
});
</script>