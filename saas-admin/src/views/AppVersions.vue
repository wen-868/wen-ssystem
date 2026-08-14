<template>
  <div>
    <h2 style="margin-bottom: 24px;">应用版本发布</h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-radio-group v-model="platform" @change="loadList">
          <el-radio-button value="admin_web">工作台 / 收银台</el-radio-button>
          <el-radio-button value="app_mobile">移动端 APP</el-radio-button>
          <el-radio-button value="print_agent">本地打印助手</el-radio-button>
        </el-radio-group>
        <el-button type="success" @click="openDialog()">发布新版本</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="versionCode" label="版本号" width="90" />
        <el-table-column prop="versionName" label="版本名" width="110" />
        <el-table-column prop="minVersionCode" label="最低版本" width="100" />
        <el-table-column label="强制更新" width="100">
          <template #default="{ row }">
            <el-tag :type="Number(row.isForce) === 1 ? 'danger' : 'info'" size="small">
              {{ Number(row.isForce) === 1 ? "强制" : "提示" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="Number(row.enabled) === 1 ? 'success' : 'warning'" size="small">
              {{ Number(row.enabled) === 1 ? "是" : "否" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateNote" label="更新说明" min-width="220" show-overflow-tooltip />
        <el-table-column prop="updateUrl" label="下载/详情地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="packageUrl" label="安装包/WGT 地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑版本' : '发布新版本'" width="640px">
      <el-form label-width="140px">
        <el-form-item label="平台">
          <el-radio-group v-model="form.platform" :disabled="!!editing">
            <el-radio value="admin_web">工作台/收银台</el-radio>
            <el-radio value="app_mobile">移动端 APP</el-radio>
            <el-radio value="print_agent">打印助手</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="版本号（整型）">
          <el-input-number v-model="form.versionCode" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="版本名">
          <el-input v-model="form.versionName" placeholder="如 1.1.0" style="width: 240px" />
        </el-form-item>
        <el-form-item label="最低兼容版本">
          <el-input-number v-model="form.minVersionCode" :min="0" style="width: 200px" />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="form.isForce" />
        </el-form-item>
        <el-form-item label="作为当前版本">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="下载/详情地址">
          <el-input v-model="form.updateUrl" placeholder="客户端弹窗后跳转的地址" />
        </el-form-item>
        <el-form-item :label="archLabels[0]">
          <el-input v-model="form.updateUrlX64" :placeholder="archPlaceholders[0]" />
        </el-form-item>
        <el-form-item :label="archLabels[2]">
          <el-input v-model="form.updateUrlArm64" :placeholder="archPlaceholders[2]" />
        </el-form-item>
        <el-form-item :label="archLabels[1]">
          <el-input v-model="form.updateUrlIa32" :placeholder="archPlaceholders[1]" />
        </el-form-item>
        <el-form-item label="安装包/WGT 地址">
          <el-input v-model="form.packageUrl" placeholder="APP 热更新包(.wgt)或安装包直链" />
        </el-form-item>
        <el-form-item label="更新说明">
          <el-input v-model="form.updateNote" type="textarea" :rows="3" placeholder="本次更新内容，客户端弹窗展示" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listAppVersions, publishAppVersion, deleteAppVersion } from "../api";

const loading = ref(false);
const saving = ref(false);
const platform = ref("admin_web");
const list = ref<any[]>([]);
const dialogVisible = ref(false);
const editing = ref<any>(null);

const form = reactive({
  platform: "admin_web",
  versionCode: 1,
  versionName: "",
  minVersionCode: 0,
  isForce: false,
  updateUrl: "",
  updateUrlX64: "",
  updateUrlIa32: "",
  updateUrlArm64: "",
  packageUrl: "",
  updateNote: "",
  enabled: true,
});

/** 下载槽位标签：手机端按平台（安卓/苹果/鸿蒙），桌面端按 CPU 架构 */
const archLabels = computed(() =>
  form.platform === "app_mobile"
    ? ["安卓 APK 下载地址", "iOS 安装包地址", "鸿蒙安装包地址"]
    : ["x64 安装包地址", "32位(x86) 安装包地址", "ARM64 安装包地址"]
);
const archPlaceholders = computed(() =>
  form.platform === "app_mobile"
    ? ["https://.../app-android.apk", "https://.../app-ios.ipa", "https://.../app-harmony.hap"]
    : ["https://.../client-x64-setup.exe", "https://.../client-ia32-setup.exe", "https://.../client-arm64-setup.exe"]
);

async function loadList() {
  loading.value = true;
  try {
    const { data } = await listAppVersions({ platform: platform.value });
    list.value = data.data || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  editing.value = row || null;
  if (row) {
    Object.assign(form, {
      platform: row.platform,
      versionCode: Number(row.versionCode),
      versionName: row.versionName || "",
      minVersionCode: Number(row.minVersionCode || 0),
      isForce: Number(row.isForce) === 1,
      updateUrl: row.updateUrl || "",
      updateUrlX64: row.updateUrlX64 || "",
      updateUrlIa32: row.updateUrlIa32 || "",
      updateUrlArm64: row.updateUrlArm64 || "",
      packageUrl: row.packageUrl || "",
      updateNote: row.updateNote || "",
      enabled: Number(row.enabled) === 1,
    });
  } else {
    Object.assign(form, {
      platform: platform.value,
      versionCode: 1,
      versionName: "",
      minVersionCode: 0,
      isForce: false,
      updateUrl: "",
      updateUrlX64: "",
      updateUrlIa32: "",
      updateUrlArm64: "",
      packageUrl: "",
      updateNote: "",
      enabled: true,
    });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.versionName.trim()) {
    ElMessage.warning("请填写版本名");
    return;
  }
  saving.value = true;
  try {
    await publishAppVersion({ ...form });
    ElMessage.success("版本已发布");
    dialogVisible.value = false;
    await loadList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "发布失败");
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除版本 ${row.platform} v${row.versionName}（${row.versionCode}）？`, "删除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await deleteAppVersion(row.id);
    ElMessage.success("已删除");
    await loadList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "删除失败");
  }
}

onMounted(loadList);
</script>
