<template>
  <PageCard title="系统设置">
    <div class="config-wrapper">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">

        <!-- 公司信息（客户公司信息） -->
        <el-tab-pane label="公司信息" name="general">
          <el-form ref="formRef" :model="configs" :rules="rules" label-width="140px" class="config-form">
            <el-form-item label="公司名称" prop="company_name">
              <div class="config-field">
                <el-input v-model="configs.company_name" placeholder="请输入公司名称" style="width: 320px" />
                <span class="tip-text">用于系统头部及报表展示</span>
              </div>
            </el-form-item>
            <el-form-item label="公司Logo">
              <div class="config-field">
                <div class="logo-upload">
                  <el-upload
                    class="logo-uploader"
                    action="#"
                    :show-file-list="false"
                    :before-upload="handleLogoBeforeUpload"
                    :http-request="() => {}"
                  >
                    <img v-if="configs.company_logo" :src="configs.company_logo" class="logo-preview" />
                    <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
                  </el-upload>
                  <span class="tip-text">建议尺寸 200x200px，支持 PNG/JPG</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="负责人">
              <div class="config-field">
                <el-input v-model="configs.contact_person" placeholder="请输入负责人" style="width: 320px" />
                <span class="tip-text">企业负责人/联系人</span>
              </div>
            </el-form-item>
            <el-form-item label="联系电话">
              <div class="config-field">
                <el-input v-model="configs.contact_phone" placeholder="请输入联系电话" style="width: 320px" />
                <span class="tip-text">用于客户联系及售后热线展示</span>
              </div>
            </el-form-item>
            <el-form-item label="营业执照">
              <div class="config-field">
                <div class="license-block">
                  <el-input v-model="configs.business_license" placeholder="营业执照号（注册时自动填充）" style="width: 320px" />
                  <div class="logo-upload">
                    <el-upload
                      class="logo-uploader"
                      action="#"
                      :show-file-list="false"
                      :before-upload="handleLicenseBeforeUpload"
                      :http-request="() => {}"
                    >
                      <img v-if="configs.business_license_img" :src="configs.business_license_img" class="license-preview" />
                      <div v-else class="license-placeholder">上传营业执照图片</div>
                    </el-upload>
                  </div>
                  <span class="tip-text">注册/审核时自动填充，可手动修改；支持上传营业执照图片</span>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 门店设置 -->
        <el-tab-pane label="门店设置" name="store">
          <div class="config-list-toolbar">
            <el-button type="primary" size="small" :icon="Plus" @click="openStoreEdit()">新增门店</el-button>
          </div>
          <el-table :data="storeList" border size="small" max-height="420">
            <el-table-column prop="storeCode" label="门店编码" width="130" />
            <el-table-column prop="name" label="门店名称" min-width="140" />
            <el-table-column prop="address" label="地址" min-width="180" />
            <el-table-column prop="phone" label="联系电话" width="130" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openStoreEdit(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 仓库设置 -->
        <el-tab-pane label="仓库设置" name="warehouse">
          <div class="config-list-toolbar">
            <el-button type="primary" size="small" :icon="Plus" @click="openWarehouseEdit()">新增仓库</el-button>
          </div>
          <el-table :data="warehouseList" border size="small" max-height="420">
            <el-table-column prop="storeCode" label="仓库编码" width="130" />
            <el-table-column prop="name" label="仓库名称" min-width="140" />
            <el-table-column prop="address" label="地址" min-width="180" />
            <el-table-column prop="contact" label="联系人" width="110" />
            <el-table-column prop="phone" label="联系电话" width="130" />
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openWarehouseEdit(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleDeleteWarehouse(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 数据导入导出 -->
        <el-tab-pane label="数据导入导出" name="transfer">
          <el-form label-width="160px" class="config-form">
            <el-divider content-position="left">商品数据</el-divider>
            <el-form-item label="商品导出">
              <div class="config-field">
                <el-button :loading="transferLoading" @click="handleExportProducts">导出商品</el-button>
                <span class="tip-text">导出全部商品（SKU）为 CSV 文件</span>
              </div>
            </el-form-item>

            <el-divider content-position="left">客户资料</el-divider>
            <el-form-item label="客户导出">
              <div class="config-field">
                <el-button :loading="transferLoading" @click="handleExportCustomers">导出客户</el-button>
                <span class="tip-text">导出全部客户资料为 CSV 文件</span>
              </div>
            </el-form-item>
            <el-form-item label="客户导入">
              <div class="config-field">
                <el-upload action="#" :show-file-list="false" accept=".csv" :before-upload="handleCustomerImport">
                  <el-button :loading="transferLoading">导入客户 CSV</el-button>
                </el-upload>
                <span class="tip-text">CSV 表头：name,mobile,customerType（customerType 可选 RETAIL/WHOLESALE，可省略）</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="数据备份" name="backup">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="自动备份">
              <div class="config-field">
                <el-switch v-model="configs.backup_auto" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后系统将自动执行备份</span>
              </div>
            </el-form-item>
            <el-form-item label="备份周期">
              <div class="config-field">
                <el-select v-model="configs.backup_frequency" placeholder="请选择备份周期" style="width: 160px" :disabled="configs.backup_auto !== '1'">
                  <el-option label="每日" value="daily" />
                  <el-option label="每周" value="weekly" />
                  <el-option label="每月" value="monthly" />
                </el-select>
                <span class="tip-text">自动备份的执行频率</span>
              </div>
            </el-form-item>
            <el-form-item label="备份时间">
              <div class="config-field">
                <el-time-select v-model="configs.backup_time" :picker-options="timeSelectOptions" style="width: 140px" :disabled="configs.backup_auto !== '1'">
                  <el-option label="01:00" value="01:00" />
                  <el-option label="02:00" value="02:00" />
                  <el-option label="03:00" value="03:00" />
                  <el-option label="04:00" value="04:00" />
                  <el-option label="05:00" value="05:00" />
                  <el-option label="06:00" value="06:00" />
                  <el-option label="07:00" value="07:00" />
                  <el-option label="08:00" value="08:00" />
                  <el-option label="09:00" value="09:00" />
                  <el-option label="10:00" value="10:00" />
                  <el-option label="11:00" value="11:00" />
                  <el-option label="12:00" value="12:00" />
                  <el-option label="13:00" value="13:00" />
                  <el-option label="14:00" value="14:00" />
                  <el-option label="15:00" value="15:00" />
                  <el-option label="16:00" value="16:00" />
                  <el-option label="17:00" value="17:00" />
                  <el-option label="18:00" value="18:00" />
                  <el-option label="19:00" value="19:00" />
                  <el-option label="20:00" value="20:00" />
                  <el-option label="21:00" value="21:00" />
                  <el-option label="22:00" value="22:00" />
                  <el-option label="23:00" value="23:00" />
                  <el-option label="00:00" value="00:00" />
                </el-time-select>
                <span class="tip-text">每日执行备份的时间点</span>
              </div>
            </el-form-item>
            <el-form-item label="备份保留天数">
              <div class="config-field">
                <el-input-number v-model="configs.backup_retention_days" :min="1" :max="365" style="width: 160px" :disabled="configs.backup_auto !== '1'" />
                <span class="suffix-text">天</span>
                <span class="tip-text">超过此天数的备份将自动删除</span>
              </div>
            </el-form-item>
            <el-form-item label="备份路径">
              <div class="config-field">
                <el-input v-model="configs.backup_path" placeholder="备份文件存储路径" style="width: 400px" />
                <span class="tip-text">留空使用默认路径</span>
              </div>
            </el-form-item>
            <el-divider content-position="left">手动备份</el-divider>
            <el-form-item>
              <el-button type="primary" :loading="manualBackupLoading" @click="handleManualBackup">
                <el-icon><Download /></el-icon> 立即备份
              </el-button>
              <span class="tip-text" style="margin-left: 12px">手动执行一次数据备份</span>
            </el-form-item>
            <el-divider content-position="left">备份历史</el-divider>
            <div class="backup-history">
              <el-table :data="backupHistory" border style="width: 100%">
                <el-table-column prop="name" label="备份文件" min-width="220" />
                <el-table-column label="备份时间" width="180">
                  <template #default="{ row }">{{ formatBackupTime(row.mtime) }}</template>
                </el-table-column>
                <el-table-column label="文件大小" width="100">
                  <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="180" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" link type="primary" @click="downloadBackup(row)">下载</el-button>
                    <el-button size="small" link type="danger" @click="deleteBackup(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="action-bar">
        <el-button type="primary" :loading="saveLoading" @click="handleSave">保存</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 门店编辑弹窗 -->
    <el-dialog v-model="storeEditVisible" :title="storeForm.id ? '编辑门店' : '新增门店'" width="480px">
      <el-form :model="storeForm" label-width="90px">
        <el-form-item label="门店名称">
          <el-input v-model="storeForm.name" placeholder="门店名称" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="storeForm.address" placeholder="门店地址" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="storeForm.contact" placeholder="联系人" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="storeForm.phone" placeholder="联系电话" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="storeEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveStore">保存</el-button>
      </template>
    </el-dialog>

    <!-- 仓库编辑弹窗 -->
    <el-dialog v-model="warehouseEditVisible" :title="warehouseForm.id ? '编辑仓库' : '新增仓库'" width="480px">
      <el-form :model="warehouseForm" label-width="90px">
        <el-form-item label="仓库名称">
          <el-input v-model="warehouseForm.name" placeholder="仓库名称" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="warehouseForm.address" placeholder="仓库地址" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="warehouseForm.contact" placeholder="联系人" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="warehouseForm.phone" placeholder="联系电话" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="warehouseEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveWarehouse">保存</el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus, Share, Download } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";
import { api } from "../../api";
import { fetchStores, createStore, updateStore } from "../../api/common";
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, exportProductsData, exportCustomersData, importCustomersCsv } from "../../api/system";
import { downloadRowsCsv } from "../../utils/download";
import { useAuthStore } from "../../stores/auth";

const activeTab = ref("general");
const saveLoading = ref(false);
const saving = ref(false);
const transferLoading = ref(false);
const auth = useAuthStore();
const isDemoUser = computed(() => auth.user?.demo === true);
const manualBackupLoading = ref(false);
const formRef = ref<FormInstance>();

/* ── 门店设置 ── */
const storeList = ref<any[]>([]);
const storeEditVisible = ref(false);
const storeForm = reactive<any>({ id: 0, name: "", address: "", contact: "", phone: "" });

/* ── 仓库设置 ── */
const warehouseList = ref<any[]>([]);
const warehouseEditVisible = ref(false);
const warehouseForm = reactive<any>({ id: 0, name: "", address: "", contact: "", phone: "" });

const rules: FormRules = {
  company_name: [{ required: true, message: "请输入公司名称", trigger: "blur" }]
};

/* ── 默认配置值 ── */
const defaultConfigs: Record<string, string> = {
  // 公司信息
  system_version: "V6.0.0",
  company_name: "",
  company_logo: "",
  contact_person: "",
  contact_phone: "",
  business_license: "",
  business_license_img: "",
  // 数据备份
  backup_auto: "0",
  backup_frequency: "daily",
  backup_time: "02:00",
  backup_retention_days: "30",
  backup_path: ""
};

const configs = reactive<Record<string, string>>({ ...defaultConfigs });

/* ── 备份历史列表 ── */
interface BackupRecord {
  name: string;
  size: number;
  mtime: string;
}

// 备份历史从真实接口加载（备份目录文件列表），不再内置模拟数据
const backupHistory = ref<BackupRecord[]>([]);

/* ── 时间选择器选项 ── */
const timeSelectOptions = {
  start: "01:00",
  step: "01:00",
  end: "23:00"
};

/* ── 分组与 Tab 名映射 ── */
const tabGroupMap: Record<string, string> = {
  backup: "backup",
  general: "general",
  store: "store",
  warehouse: "warehouse"
};

/* ── 加载指定分组配置 ── */
async function loadConfigGroup(group: string) {
  try {
    const { data } = await api.get(`/admin/sys-config/${group}`);
    const items = data.data || data || [];
    const list = Array.isArray(items) ? items : (items.records || items || []);
    for (const item of list) {
      if (item.config_key && item.config_key in configs) {
        configs[item.config_key] = String(item.config_value ?? "");
      }
    }
  } catch {
    // 加载失败时使用默认值
  }
}

/* ── 加载所有分组配置 ── */
async function loadAllConfigs() {
  await Promise.all(Object.values(tabGroupMap).map((g) => loadConfigGroup(g)));
}

/* ── 加载当前租户信息（公司名称/负责人/电话/营业执照自动填充） ── */
async function loadTenantInfo() {
  try {
    const { data } = await api.get("/admin/sys-config/tenant-info");
    const t = data.data || {};
    if (t.companyName) configs.company_name = t.companyName;
    if (t.contactPerson) configs.contact_person = t.contactPerson;
    if (t.contactMobile) configs.contact_phone = t.contactMobile;
    if (t.businessLicense) configs.business_license = t.businessLicense;
  } catch {
    /* 租户信息缺失时忽略，保持可编辑 */
  }
}

/* ── Tab 切换时加载当前分组 ── */
function handleTabChange(tab: string) {
  const group = tabGroupMap[tab];
  if (group) {
    loadConfigGroup(group);
  }
}

/* ── 保存所有配置 ── */
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saveLoading.value = true;
  try {
    const payload = Object.entries(configs).map(([key, value]) => ({
      config_key: key,
      config_value: String(value)
    }));
    await api.put("/admin/sys-config/batch", payload);
    ElMessage.success("配置保存成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

/* ── 重置为默认值 ── */
function handleReset() {
  Object.assign(configs, defaultConfigs);
}

/* ── Logo 上传前处理 ── */
function handleLogoBeforeUpload(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    configs.company_logo = (e.target?.result as string) || "";
  };
  reader.readAsDataURL(file);
  return false;
}

/* ── 营业执照图片上传前处理 ── */
function handleLicenseBeforeUpload(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    configs.business_license_img = (e.target?.result as string) || "";
  };
  reader.readAsDataURL(file);
  return false;
}

/* ── 测试邮件发送 ── */
/* ── 手动备份 ── */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + "MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + "KB";
  return bytes + "B";
}

function formatBackupTime(iso: string): string {
  if (!iso) return "";
  return String(iso).replace("T", " ").slice(0, 19);
}

async function loadBackups() {
  try {
    const { data } = await api.get("/admin/sys-config/backups");
    backupHistory.value = data.data || [];
  } catch {
    backupHistory.value = [];
  }
}

async function handleManualBackup() {
  manualBackupLoading.value = true;
  try {
    const res = await api.post("/admin/sys-config/manual-backup");
    const r = res.data?.data || {};
    if (r.success === false) {
      ElMessage.error(r.message || "备份失败");
    } else {
      ElMessage.success(r.message || "备份成功");
    }
    await loadBackups();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "备份失败");
  } finally {
    manualBackupLoading.value = false;
  }
}

/* ── 下载备份（真实文件） ── */
async function downloadBackup(row: BackupRecord) {
  try {
    const res = await api.get(`/admin/sys-config/backups/${encodeURIComponent(row.name)}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = row.name;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "下载失败");
  }
}

/* ── 删除备份（真实删除文件） ── */
async function deleteBackup(row: BackupRecord) {
  try {
    await api.delete(`/admin/sys-config/backups/${encodeURIComponent(row.name)}`);
    backupHistory.value = backupHistory.value.filter((b) => b.name !== row.name);
    ElMessage.success("删除成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "删除失败");
  }
}

/* ── 门店设置 ── */
async function loadStores() {
  try {
    storeList.value = (await fetchStores()) || [];
  } catch {
    storeList.value = [];
  }
}

function openStoreEdit(row?: any) {
  Object.assign(storeForm, {
    id: row?.id || 0,
    name: row?.name || "",
    address: row?.address || "",
    contact: row?.contact || "",
    phone: row?.phone || "",
  });
  storeEditVisible.value = true;
}

async function handleSaveStore() {
  saving.value = true;
  try {
    if (storeForm.id) {
      await updateStore(storeForm.id, { name: storeForm.name, address: storeForm.address, phone: storeForm.phone });
    } else {
      await createStore({ name: storeForm.name, address: storeForm.address, contact: storeForm.contact, phone: storeForm.phone });
    }
    ElMessage.success("保存成功");
    storeEditVisible.value = false;
    await loadStores();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败");
  } finally {
    saving.value = false;
  }
}

/* ── 仓库设置 ── */
async function loadWarehouses() {
  try {
    warehouseList.value = (await fetchWarehouses()) || [];
  } catch {
    warehouseList.value = [];
  }
}

function openWarehouseEdit(row?: any) {
  Object.assign(warehouseForm, {
    id: row?.id || 0,
    name: row?.name || "",
    address: row?.address || "",
    contact: row?.contact || "",
    phone: row?.phone || "",
  });
  warehouseEditVisible.value = true;
}

async function handleSaveWarehouse() {
  saving.value = true;
  try {
    if (warehouseForm.id) {
      await updateWarehouse(warehouseForm.id, { name: warehouseForm.name, address: warehouseForm.address, contact: warehouseForm.contact, phone: warehouseForm.phone });
    } else {
      await createWarehouse({ name: warehouseForm.name, address: warehouseForm.address, contact: warehouseForm.contact, phone: warehouseForm.phone });
    }
    ElMessage.success("保存成功");
    warehouseEditVisible.value = false;
    await loadWarehouses();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleDeleteWarehouse(row: any) {
  try {
    await deleteWarehouse(row.id);
    warehouseList.value = warehouseList.value.filter((w) => w.id !== row.id);
    ElMessage.success("已删除");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "删除失败");
  }
}

/* ── 数据导入导出 ── */
async function handleExportProducts() {
  transferLoading.value = true;
  try {
    const rows = await exportProductsData();
    if (!rows?.length) {
      ElMessage.info("暂无商品数据可导出");
      return;
    }
    downloadRowsCsv("商品数据.csv", rows);
    ElMessage.success("导出成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "导出失败");
  } finally {
    transferLoading.value = false;
  }
}

async function handleExportCustomers() {
  transferLoading.value = true;
  try {
    const rows = await exportCustomersData();
    if (!rows?.length) {
      ElMessage.info("暂无客户数据可导出");
      return;
    }
    downloadRowsCsv("客户资料.csv", rows);
    ElMessage.success("导出成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "导出失败");
  } finally {
    transferLoading.value = false;
  }
}

function handleCustomerImport(file: File) {
  const reader = new FileReader();
  reader.onload = async () => {
    transferLoading.value = true;
    try {
      const res = await importCustomersCsv(String(reader.result || ""));
      ElMessage.success(`导入完成：成功 ${res.imported} 条，跳过 ${res.skipped} 条`);
      if (res.errors?.length) {
        ElMessage.warning(res.errors.slice(0, 3).join("；"));
      }
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || "导入失败");
    } finally {
      transferLoading.value = false;
    }
  };
  reader.readAsText(file);
  return false;
}

onMounted(() => {
  loadAllConfigs();
  loadTenantInfo();
  loadBackups();
  loadStores();
  loadWarehouses();
});
</script>

<style scoped>
.reset-wrapper {
  max-width: 720px;
}

.reset-alert {
  margin-bottom: 20px;
}

.reset-card {
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
  padding: 24px;
}

.reset-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.reset-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 18px;
}

.reset-form {
  margin-bottom: 8px;
}

.reset-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-placeholder);
}

.config-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.config-form {
  padding: 16px 0 0;
}

.config-form .el-form-item {
  margin-bottom: 22px;
}

.config-field {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tip-text {
  color: var(--gray-400);
  font-size: 13px;
  white-space: nowrap;
}

.suffix-text {
  color: var(--gray-500);
  font-size: 14px;
}

.logo-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-uploader {
  width: 200px;
  height: 200px;
  border: 1px dashed var(--gray-300);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s;
}

.logo-uploader:hover {
  border-color: var(--color-primary);
}

.logo-uploader-icon {
  font-size: 24px;
  color: var(--gray-400);
}

.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.license-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.license-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.license-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--gray-400);
  font-size: 13px;
  text-align: center;
}

.action-bar {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-normal);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.template-list,
.backup-history {
  margin-top: 12px;
}

.el-divider {
  margin: 20px 0;
}
</style>
