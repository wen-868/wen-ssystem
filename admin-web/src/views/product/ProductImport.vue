<template>
  <div class="page">
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">商品导入</h2>
        <p class="page-desc">使用行业通用模板批量导入商品，兼容管家婆/用友/金蝶等导出的商品文件</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="downloadTemplate">下载模板</el-button>
        <el-button type="primary" @click="resetAll">继续导入</el-button>
        <el-button @click="$router.push('/products')">查看商品列表</el-button>
      </div>
    </div>

    <div v-if="!done" class="step-content">
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".csv"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <el-icon :size="48"><Upload /></el-icon>
        <div class="upload-text">将 CSV 文件拖到此处，或点击上传</div>
        <template #tip>
          <div class="upload-tip">支持 .csv 格式（Excel 编辑后另存为 CSV），文件大小不超过 10MB</div>
        </template>
      </el-upload>

      <div class="template-tip">
        表头：商品编码, 条码, 商品名称, 规格型号, 单位, 分类, 品牌, 进价, 售价, 批发价, 库存数量, 预警值
        <br />
        也兼容 商品编号/货号、条形码、成本价、零售价、安全库存 等同行常用叫法；商品编码或条码任一可识别重复商品。
      </div>

      <div class="step-actions">
        <el-button type="primary" :disabled="!uploadFile" :loading="importLoading" @click="doImport">
          开始导入
        </el-button>
      </div>
    </div>

    <div v-else class="step-content">
      <el-result
        icon="success"
        title="导入完成"
        :sub-title="`新增 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`"
      />
      <div v-if="result.errors.length" class="error-list">
        <div v-for="(err, i) in result.errors" :key="i" class="error-item">{{ err }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";
import { Upload } from "@element-plus/icons-vue";
import { api } from "../../api";
import { downloadTextFile } from "../../utils/download";

const uploadFile = ref<any>(null);
const importLoading = ref(false);
const done = ref(false);
const result = reactive({ imported: 0, updated: 0, skipped: 0, errors: [] as string[] });

function handleFileChange(file: any) {
  uploadFile.value = file.raw || file;
}

function handleFileRemove() {
  uploadFile.value = null;
}

async function downloadTemplate() {
  try {
    const { data } = await api.get("/admin/data-transfer/templates/products", { responseType: "text" });
    downloadTextFile("商品导入模板.csv", data);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "模板下载失败");
  }
}

async function doImport() {
  const file = uploadFile.value;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    importLoading.value = true;
    try {
      const { data } = await api.post("/admin/data-transfer/import/products", {
        csv: String(reader.result || ""),
      });
      const res = data.data || {};
      result.imported = res.imported || 0;
      result.updated = res.updated || 0;
      result.skipped = res.skipped || 0;
      result.errors = res.errors || [];
      done.value = true;
      if (result.errors.length) {
        ElMessage.warning(result.errors.slice(0, 3).join("；"));
      } else {
        ElMessage.success("导入完成");
      }
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || "导入失败");
    } finally {
      importLoading.value = false;
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  uploadFile.value = null;
  done.value = false;
  result.imported = 0;
  result.updated = 0;
  result.skipped = 0;
  result.errors = [];
}
</script>

<style scoped>
.step-content { min-height: 320px; }
.upload-area { width: 100%; }
.upload-text { margin-top: 12px; color: var(--gray-400); font-size: 14px; }
.upload-tip { margin-top: 8px; color: var(--gray-300); font-size: 12px; }
.template-tip { margin: 16px auto; max-width: 760px; padding: 12px 16px; border-radius: 8px; background: var(--bg-muted, #f5f7fa); color: var(--gray-500); font-size: 13px; line-height: 1.8; }
.step-actions { margin-top: 24px; display: flex; justify-content: center; gap: 12px; }
.error-list { max-width: 760px; margin: 0 auto; padding: 12px 16px; border-radius: 8px; background: #fef0f0; }
.error-item { color: #f56c6c; font-size: 13px; line-height: 1.8; }
</style>
