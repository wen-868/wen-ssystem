<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">商品导入</h2>
    <p class="page-desc">商品批量导入</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="resetAll">继续导入</el-button>
    <el-button @click="$router.push('/products')">查看商品列表</el-button>
  </div>
</div>

      <el-steps :active="step" align-center style="margin-bottom: 24px">
        <el-step title="上传文件" description="选择Excel/CSV文件" />
        <el-step title="字段映射" description="匹配列" />
        <el-step title="预览数据" description="确认数据" />
        <el-step title="导入完成" description="结果" />
      </el-steps>

      <!-- Step 1: 上传 -->
      <div v-if="step === 0" class="step-content">
        <el-upload
          ref="uploadRef"
          class="upload-area"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls,.csv"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
        >
          <el-icon :size="48"><Upload /></el-icon>
          <div class="upload-text">将 Excel 或 CSV 文件拖到此处，或点击上传</div>
          <template #tip>
            <div class="upload-tip">支持 .xlsx / .xls / .csv 格式，文件大小不超过 10MB</div>
          </template>
        </el-upload>
        <div class="step-actions">
          <el-button type="primary" :disabled="!uploadFile" @click="goStep(1)">下一步</el-button>
        </div>
      </div>

      <!-- Step 2: 字段映射 -->
      <div v-if="step === 1" class="step-content">
        <el-alert title="请将文件列映射到商品字段" type="info" :closable="false" style="margin-bottom: 16px" />
        <el-form ref="mappingFormRef" :model="mapping" :rules="mappingRules" label-width="120px">
          <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
            <el-select v-model="mapping[field.key]" placeholder="选择对应列" clearable style="width: 240px">
              <el-option v-for="col in fileColumns" :key="col" :label="col" :value="col" />
            </el-select>
          </el-form-item>
        </el-form>
        <div class="step-actions">
          <el-button @click="goStep(0)">上一步</el-button>
          <el-button type="primary" @click="goStep(2)">下一步</el-button>
        </div>
      </div>

      <!-- Step 3: 预览 -->
      <div v-if="step === 2" class="step-content">
        <el-alert :title="`共 ${previewRows.length} 条数据待导入`" type="info" :closable="false" style="margin-bottom: 16px" />
        <div class="table-card">
<el-table :data="previewRows.slice(0, 10)" border stripe max-height="400">
          <el-table-column type="index" width="55" label="#" />
          <el-table-column prop="name" label="商品名称" min-width="140" />
          <el-table-column prop="skuCode" label="SKU编码" width="130" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="categoryName" label="分类" width="100" />
          <el-table-column prop="brandName" label="品牌" width="100" />
          <el-table-column prop="unitName" label="单位" width="80" />
          <el-table-column prop="retailPrice" label="零售价" width="100" />
          <el-table-column prop="status" label="校验" width="80">
            <template #default="{ row }">
              <el-tag :type="row._valid ? 'success' : 'danger'" size="small">{{ row._valid ? '通过' : '异常' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
</div>
        <div class="step-actions">
          <el-button @click="goStep(1)">上一步</el-button>
          <el-button type="primary" :loading="importLoading" @click="doImport">开始导入</el-button>
        </div>
      </div>

      <!-- Step 4: 结果 -->
      <div v-if="step === 3" class="step-content">
        <el-result icon="success" title="导入完成" :sub-title="`成功 ${result.success} 条，失败 ${result.fail} 条`">
          
        </el-result>
      </div>
    
</div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import { Upload } from "@element-plus/icons-vue";
import { api } from "../../api";

const step = ref(0);
const uploadFile = ref<any>(null);
const fileColumns = ref<string[]>([]);
const previewRows = ref<any[]>([]);
const importLoading = ref(false);
const result = reactive({ success: 0, fail: 0 });

const fields = [
  { key: "name", label: "商品名称" },
  { key: "skuCode", label: "SKU编码" },
  { key: "spec", label: "规格" },
  { key: "categoryName", label: "分类" },
  { key: "brandName", label: "品牌" },
  { key: "unitName", label: "单位" },
  { key: "retailPrice", label: "零售价" },
  { key: "wholesalePrice", label: "批发价" },
  { key: "alcoholContent", label: "酒精度" },
  { key: "origin", label: "产地" }
];

const mapping = reactive<Record<string, string>>({});

const mappingFormRef = ref();
const mappingRules: FormRules = {
  name: [{ required: true, message: "请映射商品名称列", trigger: "change" }]
};

function handleFileChange(file: any) {
  uploadFile.value = file.raw || file;
  parseColumns(file.raw || file);
}

function handleFileRemove() {
  uploadFile.value = null;
  fileColumns.value = [];
}

function parseColumns(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    const lines = text.split("\n").filter(Boolean);
    if (lines.length > 0) {
      fileColumns.value = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    }
  };
  reader.readAsText(file);
}

async function goStep(n: number) {
  if (n === 2) {
    const valid = await mappingFormRef.value?.validate().catch(() => false);
    if (!valid) return;
    buildPreview();
  }
  step.value = n;
}

function buildPreview() {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: any = { _valid: true };
      fields.forEach(f => {
        const colIdx = headers.indexOf(mapping[f.key]);
        row[f.key] = colIdx >= 0 ? vals[colIdx] : "";
      });
      if (!row.name) row._valid = false;
      return row;
    });
    previewRows.value = rows;
  };
  reader.readAsText(uploadFile.value);
}

async function doImport() {
  importLoading.value = true;
  try {
    const payload = { items: previewRows.value, mapping: { ...mapping } };
    const { data } = await api.post("/admin/products/import", payload);
    const res = data.data || {};
    result.success = res.success || 0;
    result.fail = res.fail || 0;
    step.value = 3;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "导入失败");
  } finally {
    importLoading.value = false;
  }
}

function resetAll() {
  step.value = 0;
  uploadFile.value = null;
  fileColumns.value = [];
  previewRows.value = [];
  result.success = 0;
  result.fail = 0;
  Object.keys(mapping).forEach(k => delete mapping[k]);
}
</script>

<style scoped>
.step-content { min-height: 300px; }
.upload-area { width: 100%; }
.upload-text { margin-top: 12px; color: var(--gray-400); font-size: 14px; }
.upload-tip { margin-top: 8px; color: var(--gray-300); font-size: 12px; }
.step-actions { margin-top: 24px; display: flex; justify-content: center; gap: 12px; }
</style>