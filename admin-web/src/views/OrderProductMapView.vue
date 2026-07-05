<template>
  <div class="page">
    <el-card>
      <!-- 渠道 Tab -->
      <el-tabs v-model="activeChannel" @tab-change="handleChannelChange">
        <el-tab-pane v-for="ch in channelTypes" :key="ch" :name="ch">
          <template #label>
            <span>{{ channelNames[ch] }}</span>
            <el-badge
              v-if="ch !== 'ALL'"
              :value="mockChannelStats[ch] ? mockChannelStats[ch].mapped : 0"
              class="channel-badge"
              type="primary"
            >
              <span style="margin-left: 8px; font-size: 12px; color: #9CA3AF">
                / {{ mockChannelStats[ch] ? mockChannelStats[ch].unmapped : 0 }}未映射
              </span>
            </el-badge>
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- 操作栏 -->
      <div class="action-bar">
        <div style="display: flex; gap: 8px">
          <el-button type="primary" @click="openAddDialog">新增映射</el-button>
          <el-button @click="openBatchImportDialog">批量导入</el-button>
          <el-button @click="handleBatchSync">批量同步</el-button>
        </div>
        <el-input
          v-model="keyword"
          placeholder="搜索渠道SKU编码/渠道商品名/本地商品名"
          clearable
          style="width: 320px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #append><el-button @click="handleSearch"><el-icon><Search /></el-icon></el-button></template>
        </el-input>
      </div>

      <!-- 映射列表表格 -->
      <el-table :data="filteredMaps" stripe>
        <el-table-column label="渠道" width="90">
          <template #default="{ row }">
            <el-tag :type="channelTagType(row.channelType)" size="small">{{ channelName(row.channelType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channelSkuId" label="渠道SKU编码" width="150" />
        <el-table-column prop="channelProductName" label="渠道商品名" min-width="140" />
        <el-table-column label="渠道价格" width="100">
          <template #default="{ row }">¥{{ Number(row.channelPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="localSkuId" label="本地SKU编码" width="130" />
        <el-table-column prop="localProductName" label="本地商品名" min-width="140" />
        <el-table-column label="本地价格" width="100">
          <template #default="{ row }">¥{{ Number(row.localPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="同步状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.syncStatus === 'MAPPED'" type="success">已映射</el-tag>
            <el-tag v-else-if="row.syncStatus === 'UNMAPPED'" type="warning">未映射</el-tag>
            <el-tag v-else type="danger">不匹配</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastSyncedAt" label="最后同步时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
            <el-button size="small" link type="primary" @click="handleSyncSingle(row)">同步</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredMaps.length"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 未映射商品列表 -->
    <el-card style="margin-top: 16px">
      <el-collapse v-model="unmappedCollapse">
        <el-collapse-item title="未映射商品列表" name="1">
          <template #title>
            <span style="font-weight: 600">未映射商品列表</span>
            <el-tag type="warning" size="small" style="margin-left: 8px">{{ mockUnmappedProducts.length }}条</el-tag>
          </template>
          <el-table :data="mockUnmappedProducts" stripe size="small">
            <el-table-column label="渠道" width="90">
              <template #default="{ row }">
                <el-tag :type="channelTagType(row.channelType)" size="small">{{ channelName(row.channelType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="channelSkuId" label="渠道SKU" width="160" />
            <el-table-column prop="channelProductName" label="渠道商品名" min-width="160" />
            <el-table-column prop="orderCount" label="订单数" width="100" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openQuickMap(row)">快速映射</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 新增/编辑映射弹窗 -->
    <el-dialog v-model="mapDialogVisible" :title="editingMap ? '编辑映射' : '新增映射'" width="800px" top="5vh">
      <el-form ref="formRef" :model="mapForm" :rules="rules" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="渠道" prop="channelType">
              <el-select v-model="mapForm.channelType" placeholder="请选择渠道" style="width: 100%">
                <el-option v-for="ch in channelTypes.filter(c => c !== 'ALL')" :key="ch" :label="channelNames[ch]" :value="ch" />
              </el-select>
            </el-form-item>
            <el-form-item label="渠道SKU编码">
              <el-input v-model="mapForm.channelSkuId" placeholder="请输入渠道SKU编码" />
            </el-form-item>
            <el-form-item label="渠道商品名">
              <el-input v-model="mapForm.channelProductName" placeholder="请输入渠道商品名" />
            </el-form-item>
            <el-form-item label="渠道价格">
              <el-input-number v-model="mapForm.channelPrice" :min="0" :precision="2" :step="0.01" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="本地SKU">
              <el-select
                v-model="mapForm.localSkuId"
                filterable
                remote
                reserve-keyword
                placeholder="搜索本地商品名/SKU编码"
                :remote-method="remoteSearchLocalSku"
                :loading="localSkuLoading"
                style="width: 100%"
                @change="handleLocalSkuChange"
              >
                <el-option v-for="item in localSkuOptions" :key="item.id" :label="`${item.skuCode} - ${item.productName}`" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="本地商品名">
              <el-input v-model="mapForm.localProductName" placeholder="选择本地SKU后自动填充" disabled />
            </el-form-item>
            <el-form-item label="本地价格">
              <el-input-number v-model="mapForm.localPrice" :min="0" :precision="2" :step="0.01" disabled style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="mapDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveMap">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="batchImportVisible" title="批量导入商品映射" width="700px" top="5vh">
      <el-steps :active="importStep" align-center style="margin-bottom: 24px">
        <el-step title="上传文件" />
        <el-step title="预览数据" />
        <el-step title="确认导入" />
        <el-step title="导入结果" />
      </el-steps>
      <!-- 步骤1：上传 -->
      <div v-if="importStep === 0">
        <el-upload
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls,.csv"
          :on-change="handleFileChange"
        >
          <el-icon style="font-size: 48px; color: #1677FF"><UploadFilled /></el-icon>
          <div style="margin-top: 12px; color: #4B5563">将文件拖到此处，或<em style="color: #1677FF">点击上传</em></div>
          <template #tip>
            <div style="margin-top: 8px; font-size: 12px; color: #9CA3AF">支持 .xlsx .xls .csv 格式文件</div>
          </template>
        </el-upload>
        <div style="text-align: right; margin-top: 16px">
          <el-button type="primary" @click="importStep = 1" :disabled="!uploadFile">下一步</el-button>
        </div>
      </div>
      <!-- 步骤2：预览 -->
      <div v-if="importStep === 1">
        <el-table :data="importPreviewData" border stripe max-height="360">
          <el-table-column prop="channelType" label="渠道" width="80" />
          <el-table-column prop="channelSkuId" label="渠道SKU" width="130" />
          <el-table-column prop="channelProductName" label="渠道商品名" min-width="130" />
          <el-table-column prop="channelPrice" label="渠道价格" width="100" />
          <el-table-column prop="localSkuId" label="本地SKU" width="120" />
          <el-table-column prop="localProductName" label="本地商品名" min-width="130" />
        </el-table>
        <div style="text-align: right; margin-top: 16px; display: flex; justify-content: space-between">
          <el-button @click="importStep = 0">上一步</el-button>
          <el-button type="primary" @click="importStep = 2">下一步</el-button>
        </div>
      </div>
      <!-- 步骤3：确认导入 -->
      <div v-if="importStep === 2">
        <div style="text-align: center; padding: 40px 0">
          <el-icon style="font-size: 56px; color: #1677FF"><WarningFilled /></el-icon>
          <p style="margin-top: 16px; font-size: 16px; color: #4B5563">确认导入 {{ importPreviewData.length }} 条映射数据？</p>
          <p style="color: #9CA3AF; font-size: 13px">导入后将覆盖已存在的映射关系</p>
        </div>
        <div style="text-align: right; margin-top: 16px; display: flex; justify-content: space-between">
          <el-button @click="importStep = 1">上一步</el-button>
          <el-button type="primary" @click="handleConfirmImport">确认导入</el-button>
        </div>
      </div>
      <!-- 步骤4：结果 -->
      <div v-if="importStep === 3">
        <el-alert title="导入完成" type="success" :closable="false" style="margin-bottom: 16px" />
        <el-result icon="success" title="导入成功" sub-title="成功导入 8 条，失败 1 条，重复 1 条">
          <template #extra>
            <el-button type="primary" @click="batchImportVisible = false">完成</el-button>
          </template>
        </el-result>
      </div>
    </el-dialog>

    <!-- 快速映射弹窗 -->
    <el-dialog v-model="quickMapVisible" title="快速映射" width="500px">
      <el-form :model="quickMapForm" label-width="120px">
        <el-form-item label="渠道SKU">
          <el-input :model-value="quickMapForm.channelSkuId" disabled />
        </el-form-item>
        <el-form-item label="渠道商品名">
          <el-input :model-value="quickMapForm.channelProductName" disabled />
        </el-form-item>
        <el-form-item label="本地SKU">
          <el-select
            v-model="quickMapForm.localSkuId"
            filterable
            remote
            reserve-keyword
            placeholder="搜索本地商品"
            :remote-method="remoteSearchLocalSku"
            :loading="localSkuLoading"
            style="width: 100%"
            @change="handleQuickLocalSkuChange"
          >
            <el-option v-for="item in localSkuOptions" :key="item.id" :label="`${item.skuCode} - ${item.productName}`" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickMapVisible = false">取消</el-button>
        <el-button type="primary" @click="handleQuickMapSave">确认映射</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, UploadFilled, WarningFilled } from "@element-plus/icons-vue";

// ── Mock 数据 ──
const channelTypes = ["ALL", "WECHAT", "DOUYIN", "MEITUAN", "ELEME", "JD"];
const channelNames: Record<string, string> = { ALL: "全部", WECHAT: "微信", DOUYIN: "抖音", MEITUAN: "美团", ELEME: "饿了么", JD: "京东" };

const mockChannelStats: Record<string, { mapped: number; unmapped: number }> = {
  WECHAT: { mapped: 125, unmapped: 15 },
  DOUYIN: { mapped: 80, unmapped: 8 },
  MEITUAN: { mapped: 200, unmapped: 25 },
  ELEME: { mapped: 150, unmapped: 12 },
  JD: { mapped: 90, unmapped: 5 },
};

const mockProductMaps = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  channelType: ["WECHAT", "DOUYIN", "MEITUAN", "ELEME", "JD"][i % 5] as string,
  channelSkuId: `CH-SKU-${String(i + 1).padStart(5, "0")}`,
  channelProductName: `渠道商品${i + 1}`,
  channelPrice: Math.floor(Math.random() * 200 + 50),
  localSkuId: 1000 + i,
  localProductName: `本地商品${i + 1}`,
  localPrice: Math.floor(Math.random() * 180 + 50),
  syncStatus: ["MAPPED", "UNMAPPED", "MISMATCH"][i % 3] as string,
  lastSyncedAt: `2026-07-01 ${String(i + 8).padStart(2, "0")}:00:00`,
}));

const mockUnmappedProducts = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  channelType: ["WECHAT", "MEITUAN", "ELEME"][i % 3] as string,
  channelSkuId: `UNMAPPED-${String(i + 1).padStart(5, "0")}`,
  channelProductName: `未映射商品${i + 1}`,
  orderCount: Math.floor(Math.random() * 20 + 1),
}));

// ── 渠道 Tab ──
const activeChannel = ref("ALL");
const keyword = ref("");

const filteredMaps = computed(() => {
  let list = [...mockProductMaps];
  if (activeChannel.value !== "ALL") {
    list = list.filter((m) => m.channelType === activeChannel.value);
  }
  if (keyword.value) {
    const kw = keyword.value.toLowerCase();
    list = list.filter(
      (m) =>
        m.channelSkuId.toLowerCase().includes(kw) ||
        m.channelProductName.toLowerCase().includes(kw) ||
        m.localProductName.toLowerCase().includes(kw)
    );
  }
  return list;
});

// ── 分页 ──
const page = ref(1);
const pageSize = ref(10);

// ── 工具函数 ──
const channelMap: Record<string, string> = { WECHAT: "微信", MEITUAN: "美团", ELEME: "饿了么", JD: "京东", DOUYIN: "抖音" };
const channelTagMap: Record<string, string> = { WECHAT: "success", MEITUAN: "warning", ELEME: "primary", JD: "danger", DOUYIN: "" };

function channelName(type: string) { return channelMap[type] || type; }
function channelTagType(type: string) { return (channelTagMap[type] || "info") as any; }

function handleChannelChange() {
  page.value = 1;
}

function handleSearch() {
  page.value = 1;
}

function handleSizeChange(size: number) { pageSize.value = size; }
function handlePageChange(p: number) { page.value = p; }

// ── 新增/编辑映射 ──
const mapDialogVisible = ref(false);
const editingMap = ref<any>(null);
const formRef = ref()
const rules = {
  channelType: [{ required: true, message: '请选择渠道', trigger: 'change' }]
}
const mapForm = ref({
  channelType: "",
  channelSkuId: "",
  channelProductName: "",
  channelPrice: 0,
  localSkuId: null as number | null,
  localProductName: "",
  localPrice: 0,
});

const localSkuOptions = ref<Array<{ id: number; skuCode: string; productName: string; price: number }>>([]);
const localSkuLoading = ref(false);

function openAddDialog() {
  editingMap.value = null;
  mapForm.value = { channelType: "", channelSkuId: "", channelProductName: "", channelPrice: 0, localSkuId: null, localProductName: "", localPrice: 0 };
  mapDialogVisible.value = true;
}

function openEditDialog(row: any) {
  editingMap.value = row;
  mapForm.value = {
    channelType: row.channelType,
    channelSkuId: row.channelSkuId,
    channelProductName: row.channelProductName,
    channelPrice: row.channelPrice,
    localSkuId: row.localSkuId,
    localProductName: row.localProductName,
    localPrice: row.localPrice,
  };
  mapDialogVisible.value = true;
}

function remoteSearchLocalSku(query: string) {
  localSkuLoading.value = true;
  setTimeout(() => {
    localSkuOptions.value = Array.from({ length: 8 }, (_, i) => ({
      id: 2000 + i,
      skuCode: `SKU-${String(2000 + i).padStart(5, "0")}`,
      productName: `${query || "本地商品"}${i + 1}`,
      price: Math.floor(Math.random() * 180 + 50),
    }));
    localSkuLoading.value = false;
  }, 300);
}

function handleLocalSkuChange(val: number | null) {
  if (val) {
    const found = localSkuOptions.value.find((o) => o.id === val);
    if (found) {
      mapForm.value.localProductName = found.productName;
      mapForm.value.localPrice = found.price;
    }
  }
}

async function handleSaveMap() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return;
  ElMessage.success(editingMap.value ? "映射已更新" : "映射已创建");
  mapDialogVisible.value = false;
}

function handleDelete(row: any) {
  ElMessageBox.confirm("确认删除此映射关系？", "确认", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" })
    .then(() => {
      ElMessage.success("映射已删除");
    })
    .catch(() => {});
}

function handleSyncSingle(row: any) {
  ElMessage.success(`渠道 ${channelName(row.channelType)} SKU ${row.channelSkuId} 同步成功`);
}

function handleBatchSync() {
  ElMessage.success("批量同步已完成");
}

// ── 批量导入 ──
const batchImportVisible = ref(false);
const importStep = ref(0);
const uploadFile = ref<any>(null);

const importPreviewData = ref([
  { channelType: "微信", channelSkuId: "CH-SKU-00100", channelProductName: "新品A", channelPrice: "¥88.00", localSkuId: "SKU-03000", localProductName: "本地商品A" },
  { channelType: "美团", channelSkuId: "CH-SKU-00101", channelProductName: "新品B", channelPrice: "¥128.00", localSkuId: "", localProductName: "" },
  { channelType: "饿了么", channelSkuId: "CH-SKU-00102", channelProductName: "新品C", channelPrice: "¥55.00", localSkuId: "SKU-03002", localProductName: "本地商品C" },
]);

function openBatchImportDialog() {
  batchImportVisible.value = true;
  importStep.value = 0;
  uploadFile.value = null;
}

function handleFileChange(file: any) {
  uploadFile.value = file;
}

function handleConfirmImport() {
  importStep.value = 3;
}

// ── 快速映射 ──
const quickMapVisible = ref(false);
const quickMapForm = ref({ channelSkuId: "", channelProductName: "", localSkuId: null as number | null });

function openQuickMap(row: any) {
  quickMapForm.value = { channelSkuId: row.channelSkuId, channelProductName: row.channelProductName, localSkuId: null };
  quickMapVisible.value = true;
}

function handleQuickLocalSkuChange(val: number | null) {
  // 快速映射选中本地SKU时的处理
}

function handleQuickMapSave() {
  ElMessage.success("快速映射成功");
  quickMapVisible.value = false;
}

// ── 未映射折叠 ──
const unmappedCollapse = ref<string[]>([]);

onMounted(() => {
  // 初始化
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.channel-badge {
  margin-left: 4px;
}
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>