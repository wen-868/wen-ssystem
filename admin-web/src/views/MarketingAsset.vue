<template>
  <PageCard title="营销素材">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="图片" name="image" />
      <el-tab-pane label="视频" name="video" />
      <el-tab-pane label="文案" name="text" />
    </el-tabs>

    <div class="search-bar">
      <el-input v-model="searchKeyword" placeholder="搜索素材名称" clearable style="width: 200px" @keyup.enter="loadAssets" />
      <el-select v-model="searchCategory" placeholder="分类" clearable style="width: 150px">
        <el-option label="促销" value="promotion" />
        <el-option label="新品" value="new_product" />
        <el-option label="品牌" value="brand" />
        <el-option label="活动" value="campaign" />
      </el-select>
      <el-button @click="loadAssets">搜索</el-button>
      <el-button type="primary" @click="handleAddAsset">新增素材</el-button>
    </div>

    <el-row :gutter="16" v-loading="loading">
      <el-col
        v-for="asset in assets"
        :key="asset.id"
        :xs="24" :sm="12" :md="8" :lg="6"
        style="margin-bottom: 16px"
      >
        <el-card class="asset-card" shadow="hover" :body-style="{ padding: '0' }">
          <!-- 图片类型 -->
          <template v-if="asset.type === 'image'">
            <div class="asset-image-wrap">
              <el-image
                :src="asset.url || asset.thumbnail"
                fit="cover"
                style="width: 100%; height: 160px"
                :preview-src-list="[asset.url || asset.thumbnail]"
              />
            </div>
          </template>
          <!-- 视频类型 -->
          <template v-else-if="asset.type === 'video'">
            <div class="asset-video-wrap">
              <div class="video-placeholder">
                <el-icon :size="40"><VideoPlay /></el-icon>
                <span>{{ asset.name }}</span>
              </div>
            </div>
          </template>
          <!-- 文案类型 -->
          <template v-else>
            <div class="asset-text-wrap">
              <div class="text-preview">{{ asset.content || asset.description || '暂无内容预览' }}</div>
            </div>
          </template>
          <div class="asset-body">
            <div class="asset-name">{{ asset.name }}</div>
            <div class="asset-meta">
              <el-tag size="small" type="info">{{ asset.category || '未分类' }}</el-tag>
              <span v-if="asset.type === 'video'" class="asset-duration">{{ asset.duration || '--' }}</span>
            </div>
            <div v-if="asset.tags" class="asset-tags">
              <el-tag
                v-for="(tag, idx) in parseTags(asset.tags)"
                :key="idx"
                size="small"
                class="tag-item"
              >{{ tag }}</el-tag>
            </div>
          </div>
          <div class="asset-actions">
            <el-button size="small" type="primary" @click="handleEditAsset(asset)">编辑</el-button>
            <el-popconfirm title="确认删除该素材？" @confirm="handleDeleteAsset(asset)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && assets.length === 0" description="暂无素材" />

    <div class="pagination">
      <el-pagination
        background layout="total, sizes, prev, pager, next, jumper"
        :total="total" :page-size="pageSize" :current-page="page"
        @size-change="handleSizeChange" @current-change="handlePageChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingAsset ? '编辑素材' : '新增素材'" width="550px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="素材名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入素材名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择素材类型" style="width: 100%">
            <el-option label="图片" value="image" />
            <el-option label="视频" value="video" />
            <el-option label="文案" value="text" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="请选择分类" clearable style="width: 100%">
            <el-option label="促销" value="promotion" />
            <el-option label="新品" value="new_product" />
            <el-option label="品牌" value="brand" />
            <el-option label="活动" value="campaign" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item v-if="form.type === 'image' || form.type === 'video'" label="文件URL">
          <el-input v-model="form.url" placeholder="请输入文件URL" />
        </el-form-item>
        <el-form-item v-if="form.type === 'video'" label="时长">
          <el-input v-model="form.duration" placeholder="如 00:30" />
        </el-form-item>
        <el-form-item v-if="form.type === 'text'" label="文案内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入文案内容" />
        </el-form-item>
        <el-form-item label="缩略图">
          <el-input v-model="form.thumbnail" placeholder="请输入缩略图URL" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { VideoPlay } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import {
  getMarketingAssets, createMarketingAsset, updateMarketingAsset, deleteMarketingAsset
} from "../api";

const activeTab = ref("all");
const searchKeyword = ref("");
const searchCategory = ref("");

const assets = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const dialogVisible = ref(false);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();
const editingAsset = ref<any>(null);

const form = reactive({
  name: "",
  type: "image",
  category: "",
  tags: "",
  url: "",
  duration: "",
  content: "",
  thumbnail: ""
});

const formRules: FormRules = {
  name: [{ required: true, message: "请输入素材名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择素材类型", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.message || e?.message || fallback;
}

function parseTags(tags: string | string[]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(",").map((t: string) => t.trim()).filter(Boolean);
}

async function loadAssets() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (activeTab.value !== "all") params.type = activeTab.value;
    if (searchCategory.value) params.category = searchCategory.value;
    const data = await getMarketingAssets(params);
    assets.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载素材列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadAssets();
}

function handlePageChange(p: number) {
  page.value = p;
  loadAssets();
}

function handleTabChange() {
  page.value = 1;
  loadAssets();
}

function handleAddAsset() {
  editingAsset.value = null;
  form.name = "";
  form.type = "image";
  form.category = "";
  form.tags = "";
  form.url = "";
  form.duration = "";
  form.content = "";
  form.thumbnail = "";
  dialogVisible.value = true;
}

function handleEditAsset(row: any) {
  editingAsset.value = row;
  form.name = row.name;
  form.type = row.type;
  form.category = row.category || "";
  form.tags = Array.isArray(row.tags) ? row.tags.join(",") : (row.tags || "");
  form.url = row.url || "";
  form.duration = row.duration || "";
  form.content = row.content || "";
  form.thumbnail = row.thumbnail || "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        category: form.category,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        url: form.url,
        thumbnail: form.thumbnail
      };
      if (form.type === "video") payload.duration = form.duration;
      if (form.type === "text") payload.content = form.content;
      if (editingAsset.value) {
        await updateMarketingAsset(editingAsset.value.id, payload);
        ElMessage.success("素材已更新");
      } else {
        await createMarketingAsset(payload);
        ElMessage.success("素材已创建");
      }
      dialogVisible.value = false;
      loadAssets();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "操作失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleDeleteAsset(row: any) {
  try {
    await deleteMarketingAsset(row.id);
    ElMessage.success("素材已删除");
    loadAssets();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

onMounted(() => {
  loadAssets();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.asset-card {
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}
.asset-card:hover {
  transform: translateY(-2px);
}
.asset-card:hover .asset-actions {
  opacity: 1;
}

.asset-image-wrap {
  height: 160px;
  overflow: hidden;
}

.asset-video-wrap {
  height: 160px;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 13px;
}

.asset-text-wrap {
  height: 160px;
  padding: 16px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
}

.text-preview {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.asset-body {
  padding: 12px;
}

.asset-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.asset-duration {
  font-size: 12px;
  color: #909399;
}

.asset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-item {
  margin: 0;
}

.asset-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  opacity: 0;
  transition: opacity 0.3s;
}
</style>