<template>
  <div class="page">
    <div class="material-layout">
      <!-- 左侧分类树 -->
      <div class="material-sidebar">
        <el-card>
          <template #header>
            <div class="sidebar-header">
              <span>素材分类</span>
              <el-button size="small" type="primary" @click="addCategory">新增</el-button>
            </div>
          </template>
          <el-tree
            ref="treeRef"
            :data="categoryTree"
            :props="{ children: 'children', label: 'label' }"
            node-key="id"
            highlight-current
            default-expand-all
            @node-click="handleTreeNodeClick"
            @node-contextmenu="handleTreeContextMenu"
          >
            <template #default="{ node, data }">
              <span class="tree-node-label">{{ data.label }}</span>
            </template>
          </el-tree>
        </el-card>
      </div>

      <!-- 右键菜单 -->
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <div class="context-menu-item" @click="addSubCategory">新增子分类</div>
        <div class="context-menu-item" @click="renameCategory">重命名</div>
        <div class="context-menu-item" @click="deleteCategory">删除</div>
      </div>

      <!-- 右侧素材管理区 -->
      <div class="material-main">
        <el-card>
          <!-- 顶部操作栏 -->
          <div class="material-toolbar">
            <div class="toolbar-left">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索素材名称"
                style="width: 200px"
                clearable
                @clear="loadMaterials"
                @keyup.enter="loadMaterials"
              />
              <el-select
                v-model="typeFilter"
                placeholder="素材类型"
                style="width: 130px"
                clearable
                @change="loadMaterials"
              >
                <el-option label="图片" value="IMAGE" />
                <el-option label="视频" value="VIDEO" />
                <el-option label="文档" value="DOCUMENT" />
                <el-option label="HTML" value="HTML" />
              </el-select>
              <el-select
                v-model="sceneFilter"
                placeholder="使用场景"
                style="width: 130px"
                clearable
                @change="loadMaterials"
              >
                <el-option label="活动页" value="活动页" />
                <el-option label="商品详情" value="商品详情" />
                <el-option label="首页" value="首页" />
                <el-option label="弹窗" value="弹窗" />
              </el-select>
              <el-select
                v-model="tagFilter"
                placeholder="标签筛选"
                style="width: 130px"
                clearable
                @change="loadMaterials"
              >
                <el-option label="促销" value="促销" />
                <el-option label="618" value="618" />
                <el-option label="双11" value="双11" />
                <el-option label="新品" value="新品" />
              </el-select>
              <el-button @click="loadMaterials">搜索</el-button>
            </div>
            <div class="toolbar-right">
              <el-button-group>
                <el-button :type="viewMode === 'grid' ? 'primary' : ''" @click="viewMode = 'grid'">
                  <el-icon><Grid /></el-icon>
                </el-button>
                <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode = 'list'">
                  <el-icon><List /></el-icon>
                </el-button>
              </el-button-group>
              <el-button type="primary" @click="uploadDialogVisible = true" style="margin-left: 8px">
                <el-icon style="margin-right: 4px"><Upload /></el-icon>上传素材
              </el-button>
            </div>
          </div>

          <!-- 网格视图 -->
          <div v-if="viewMode === 'grid'">
            <el-row :gutter="16">
              <el-col
                v-for="item in materials"
                :key="item.id"
                :xs="24"
                :sm="12"
                :md="8"
                :lg="6"
                :xl="4"
                style="margin-bottom: 16px"
              >
                <div class="material-card" @click="openDetailDialog(item)">
                  <div class="material-card-image">
                    <el-image
                      :src="getMaterialThumbnail(item)"
                      fit="cover"
                      style="width: 100%; height: 150px"
                      :preview-src-list="getMaterialPreview(item)"
                    />
                    <el-tag
                      :type="statusTagType(item.status)"
                      size="small"
                      class="material-status-tag"
                    >
                      {{ statusLabel(item.status) }}
                    </el-tag>
                  </div>
                  <div class="material-card-info">
                    <div class="material-name">{{ item.materialName }}</div>
                    <div class="material-meta">
                      <el-tag size="small" type="info">{{ item.categoryName }}</el-tag>
                      <el-tag size="small" style="margin-left: 4px">{{ item.scene }}</el-tag>
                    </div>
                  </div>
                  <div class="material-card-actions">
                    <el-button
                      size="small"
                      :type="item.status === 'PUBLISHED' ? 'warning' : 'success'"
                      @click.stop="toggleStatus(item)"
                    >
                      {{ item.status === 'PUBLISHED' ? '归档' : '发布' }}
                    </el-button>
                    <el-button size="small" type="primary" @click.stop="openDetailDialog(item)">编辑</el-button>
                    <el-popconfirm title="确认删除该素材？" @confirm="deleteMaterial(item)">
                      <template #reference>
                        <el-button size="small" type="danger" @click.stop>删除</el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>
              </el-col>
            </el-row>
            <el-empty v-if="materials.length === 0" description="暂无素材" :image-size="80" />
          </div>

          <!-- 列表视图 -->
          <div v-if="viewMode === 'list'">
            <el-table :data="materials" stripe @row-click="openDetailDialog">
              <el-table-column label="缩略图" width="80">
                <template #default="{ row }">
                  <el-image
                    :src="getMaterialThumbnail(row)"
                    fit="cover"
                    style="width: 50px; height: 50px; border-radius: 4px"
                    :preview-src-list="getMaterialPreview(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="materialName" label="素材名称" min-width="140" />
              <el-table-column prop="materialType" label="类型" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="typeTagType(row.materialType)">
                    {{ row.materialType }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="categoryName" label="分类" width="100" />
              <el-table-column prop="tags" label="标签" width="80">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.tags }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="大小" width="100">
                <template #default="{ row }">
                  {{ formatFileSize(row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column prop="useCount" label="使用次数" width="90" />
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="statusTagType(row.status)" size="small">
                    {{ statusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="更新时间" width="110" />
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" link @click.stop="openDetailDialog(row)">详情</el-button>
                  <el-button
                    size="small"
                    link
                    :type="row.status === 'PUBLISHED' ? 'warning' : 'success'"
                    @click.stop="toggleStatus(row)"
                  >
                    {{ row.status === 'PUBLISHED' ? '归档' : '发布' }}
                  </el-button>
                  <el-popconfirm title="确认删除？" @confirm="deleteMaterial(row)">
                    <template #reference>
                      <el-button size="small" link type="danger" @click.stop>删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="materials.length === 0" description="暂无素材" :image-size="80" />
          </div>

          <!-- 分页 -->
          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="totalMaterials"
              :page-size="pageSize"
              :current-page="currentPage"
              @size-change="handleSizeChange"
              @current-change="handlePageChange"
            />
          </div>
        </el-card>
      </div>
    </div>

    <!-- 素材详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="素材详情"
      width="700px"
    >
      <div v-if="currentMaterial" class="detail-content">
        <div class="detail-preview">
          <el-image
            :src="getMaterialThumbnail(currentMaterial)"
            fit="contain"
            style="width: 100%; max-height: 300px"
            :preview-src-list="getMaterialPreview(currentMaterial)"
          />
        </div>
        <el-descriptions :column="2" border style="margin-top: 16px">
          <el-descriptions-item label="素材名称">{{ currentMaterial.materialName }}</el-descriptions-item>
          <el-descriptions-item label="素材编码">{{ currentMaterial.materialCode }}</el-descriptions-item>
          <el-descriptions-item label="素材类型">
            <el-tag size="small" :type="typeTagType(currentMaterial.materialType)">
              {{ currentMaterial.materialType }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件格式">{{ currentMaterial.fileFormat }}</el-descriptions-item>
          <el-descriptions-item label="文件大小">{{ formatFileSize(currentMaterial.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ currentMaterial.categoryName }}</el-descriptions-item>
          <el-descriptions-item label="标签">{{ currentMaterial.tags }}</el-descriptions-item>
          <el-descriptions-item label="使用场景">{{ currentMaterial.scene }}</el-descriptions-item>
        </el-descriptions>
        <el-descriptions :column="3" border style="margin-top: 16px">
          <el-descriptions-item label="下载次数">{{ currentMaterial.downloadCount }}</el-descriptions-item>
          <el-descriptions-item label="查看次数">{{ currentMaterial.viewCount }}</el-descriptions-item>
          <el-descriptions-item label="使用次数">{{ currentMaterial.useCount }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 16px">
          <div class="section-label">关联活动</div>
          <el-tag v-for="i in 2" :key="i" style="margin-right: 8px; margin-top: 4px">
            <el-link type="primary" :underline="false">关联活动{{ i }}</el-link>
          </el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleDownload">下载</el-button>
        <el-button
          :type="currentMaterial?.status === 'PUBLISHED' ? 'warning' : 'success'"
          @click="toggleStatusFromDetail"
        >
          {{ currentMaterial?.status === 'PUBLISHED' ? '归档' : '发布' }}
        </el-button>
        <el-button type="danger" @click="deleteFromDetail">删除</el-button>
      </template>
    </el-dialog>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="上传素材"
      width="720px"
      @close="resetUploadForm"
    >
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleUploadChange"
        :file-list="uploadFileList"
        :limit="5"
        multiple
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">拖拽文件到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="upload-tip">支持 JPG/PNG/MP4/PDF/HTML 格式，单文件不超过 50MB</div>
        </template>
      </el-upload>

      <div v-if="uploadProgress > 0 && uploadProgress < 100" style="margin-top: 16px">
        <el-progress :percentage="uploadProgress" :stroke-width="12" />
      </div>

      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px" style="margin-top: 16px">
        <el-form-item label="素材名称">
          <el-input v-model="uploadForm.materialName" placeholder="默认取文件名" />
        </el-form-item>
        <el-form-item label="素材分类">
          <el-select v-model="uploadForm.categoryId" placeholder="选择分类" style="width: 100%">
            <el-option label="海报" :value="2" />
            <el-option label="优惠券背景" :value="3" />
            <el-option label="秒杀背景" :value="4" />
            <el-option label="公众号文章" :value="5" />
            <el-option label="其他" :value="6" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <div class="tag-input-wrap">
            <el-tag
              v-for="(tag, idx) in uploadForm.tags"
              :key="idx"
              closable
              style="margin-right: 6px; margin-bottom: 4px"
              @close="removeTag(idx)"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model="tagInputValue"
              size="small"
              style="width: 80px"
              @keyup.enter="addTag"
              @blur="addTag"
            />
            <el-button v-else size="small" @click="showTagInput">+ 添加标签</el-button>
          </div>
        </el-form-item>
        <el-form-item label="使用场景">
          <el-select v-model="uploadForm.scene" placeholder="选择使用场景" style="width: 100%">
            <el-option label="活动页" value="活动页" />
            <el-option label="商品详情" value="商品详情" />
            <el-option label="首页" value="首页" />
            <el-option label="弹窗" value="弹窗" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from "vue";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { Grid, List, Upload, UploadFilled } from "@element-plus/icons-vue";

// ==================== Mock 数据 ====================
const mockCategories = [
  { id: 1, label: "全部素材", children: [] },
  { id: 2, label: "海报", children: [{ id: 21, label: "活动海报" }, { id: 22, label: "节日海报" }] },
  { id: 3, label: "优惠券背景", children: [] },
  { id: 4, label: "秒杀背景", children: [] },
  { id: 5, label: "公众号文章", children: [] },
  { id: 6, label: "其他", children: [] },
];

const mockMaterials = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  materialCode: `MT${String(i + 1).padStart(5, "0")}`,
  materialName: `素材${i + 1}`,
  materialType: ["IMAGE", "VIDEO", "DOCUMENT", "HTML"][i % 4],
  fileFormat: ["jpg", "png", "mp4", "pdf", "html"][i % 5],
  fileSize: Math.floor(Math.random() * 10000000 + 100000),
  categoryName: ["海报", "优惠券背景", "秒杀背景", "公众号文章", "其他"][i % 5],
  tags: ["促销", "618", "双11", "新品"][i % 4],
  scene: ["活动页", "商品详情", "首页", "弹窗"][i % 4],
  downloadCount: Math.floor(Math.random() * 500),
  viewCount: Math.floor(Math.random() * 2000),
  useCount: Math.floor(Math.random() * 100),
  status: ["DRAFT", "PUBLISHED", "ARCHIVED"][i % 3],
  createdAt: `2026-06-${String(Math.floor(Math.random() * 30) + 1).padStart(2, "0")}`,
}));

// ==================== 分类树 ====================
const treeRef = ref();
const categoryTree = ref(JSON.parse(JSON.stringify(mockCategories)));
const activeCategoryId = ref(1);

function handleTreeNodeClick(data: any) {
  activeCategoryId.value = data.id;
  loadMaterials();
}

// ==================== 右键菜单 ====================
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuNode = ref<any>(null);

function handleTreeContextMenu(event: MouseEvent, data: any) {
  event.preventDefault();
  contextMenuVisible.value = true;
  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuNode.value = data;
  document.addEventListener("click", closeContextMenu);
}

function closeContextMenu() {
  contextMenuVisible.value = false;
  document.removeEventListener("click", closeContextMenu);
}

function addCategory() {
  ElMessageBox.prompt("请输入分类名称", "新增分类").then(({ value }) => {
    if (value) {
      const newId = Date.now();
      categoryTree.value.push({ id: newId, label: value, children: [] });
      ElMessage.success("分类已添加");
    }
  }).catch(() => {});
}

function addSubCategory() {
  if (!contextMenuNode.value) return;
  closeContextMenu();
  ElMessageBox.prompt("请输入子分类名称", "新增子分类").then(({ value }) => {
    if (value && contextMenuNode.value) {
      const newId = Date.now();
      if (!contextMenuNode.value.children) {
        contextMenuNode.value.children = [];
      }
      contextMenuNode.value.children.push({ id: newId, label: value, children: [] });
      ElMessage.success("子分类已添加");
    }
  }).catch(() => {});
}

function renameCategory() {
  if (!contextMenuNode.value) return;
  const node = contextMenuNode.value;
  closeContextMenu();
  ElMessageBox.prompt("请输入新的分类名称", "重命名", { inputValue: node.label }).then(({ value }) => {
    if (value && node) {
      node.label = value;
      ElMessage.success("重命名成功");
    }
  }).catch(() => {});
}

function deleteCategory() {
  if (!contextMenuNode.value) return;
  const node = contextMenuNode.value;
  closeContextMenu();
  ElMessageBox.confirm(`确认删除分类 "${node.label}"？`, "确认删除", { type: "warning" }).then(() => {
    const removeFromTree = (list: any[], id: number): boolean => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list.splice(i, 1);
          return true;
        }
        if (list[i].children && removeFromTree(list[i].children, id)) {
          return true;
        }
      }
      return false;
    };
    removeFromTree(categoryTree.value, node.id);
    ElMessage.success("已删除");
  }).catch(() => {});
}

// ==================== 素材列表 ====================
const searchKeyword = ref("");
const typeFilter = ref("");
const sceneFilter = ref("");
const tagFilter = ref("");
const viewMode = ref<"grid" | "list">("grid");
const materials = ref<any[]>([...mockMaterials]);
const totalMaterials = ref(mockMaterials.length);
const currentPage = ref(1);
const pageSize = ref(12);

function loadMaterials() {
  let filtered = [...mockMaterials];
  if (searchKeyword.value) {
    filtered = filtered.filter((m) => m.materialName.includes(searchKeyword.value));
  }
  if (typeFilter.value) {
    filtered = filtered.filter((m) => m.materialType === typeFilter.value);
  }
  if (sceneFilter.value) {
    filtered = filtered.filter((m) => m.scene === sceneFilter.value);
  }
  if (tagFilter.value) {
    filtered = filtered.filter((m) => m.tags === tagFilter.value);
  }
  if (activeCategoryId.value && activeCategoryId.value !== 1) {
    const findCategoryLabel = (list: any[], id: number): string | null => {
      for (const item of list) {
        if (item.id === id) return item.label;
        if (item.children) {
          const found = findCategoryLabel(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    const label = findCategoryLabel(categoryTree.value, activeCategoryId.value);
    if (label) {
      filtered = filtered.filter((m) => m.categoryName === label);
    }
  }
  totalMaterials.value = filtered.length;
  const start = (currentPage.value - 1) * pageSize.value;
  materials.value = filtered.slice(start, start + pageSize.value);
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  loadMaterials();
}

function handlePageChange(p: number) {
  currentPage.value = p;
  loadMaterials();
}

// ==================== 素材详情 ====================
const detailDialogVisible = ref(false);
const currentMaterial = ref<any>(null);

function openDetailDialog(item: any) {
  currentMaterial.value = item;
  detailDialogVisible.value = true;
}

function toggleStatus(item: any) {
  const newStatus = item.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
  item.status = newStatus;
  ElMessage.success(newStatus === "PUBLISHED" ? "已发布" : "已归档");
  loadMaterials();
}

function toggleStatusFromDetail() {
  if (currentMaterial.value) {
    toggleStatus(currentMaterial.value);
  }
}

function deleteMaterial(item: any) {
  const idx = mockMaterials.findIndex((m) => m.id === item.id);
  if (idx > -1) mockMaterials.splice(idx, 1);
  ElMessage.success("已删除");
  loadMaterials();
}

function deleteFromDetail() {
  if (currentMaterial.value) {
    deleteMaterial(currentMaterial.value);
    detailDialogVisible.value = false;
  }
}

function handleDownload() {
  ElMessage.success("下载中...");
}

// ==================== 上传 ====================
const uploadDialogVisible = ref(false);
const uploadRef = ref();
const uploadFileList = ref<any[]>([]);
const uploadProgress = ref(0);
const tagInputVisible = ref(false);
const tagInputValue = ref("");
const tagInputRef = ref();

const uploadForm = reactive({
  materialName: "",
  categoryId: null as number | null,
  tags: [] as string[],
  scene: "",
});

const uploadFormRef = ref();
const uploadRules: FormRules = {
  materialName: [{ required: true, message: "请输入素材名称", trigger: "blur" }],
  categoryId: [{ required: true, message: "请选择素材分类", trigger: "change" }]
};

function handleUploadChange(file: any) {
  if (!uploadForm.materialName) {
    const name = file.name.replace(/\.[^/.]+$/, "");
    uploadForm.materialName = name;
  }
}

function showTagInput() {
  tagInputVisible.value = true;
  nextTick(() => {
    (tagInputRef.value as any)?.focus?.();
  });
}

function addTag() {
  if (tagInputValue.value.trim()) {
    uploadForm.tags.push(tagInputValue.value.trim());
  }
  tagInputVisible.value = false;
  tagInputValue.value = "";
}

function removeTag(idx: number) {
  uploadForm.tags.splice(idx, 1);
}

function resetUploadForm() {
  uploadForm.materialName = "";
  uploadForm.categoryId = null;
  uploadForm.tags = [];
  uploadForm.scene = "";
  uploadFileList.value = [];
  uploadProgress.value = 0;
}

async function submitUpload() {
  if (uploadFileList.value.length === 0) {
    ElMessage.warning("请选择文件");
    return;
  }
  const valid = await uploadFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  uploadProgress.value = 0;
  const timer = setInterval(() => {
    uploadProgress.value += 20;
    if (uploadProgress.value >= 100) {
      clearInterval(timer);
      uploadProgress.value = 100;
      const newMaterials = uploadFileList.value.map((f: any, i: number) => ({
        id: mockMaterials.length + i + 1,
        materialCode: `MT${String(mockMaterials.length + i + 1).padStart(5, "0")}`,
        materialName: uploadForm.materialName || f.name,
        materialType: getFileType(f.name),
        fileFormat: getFileExtension(f.name),
        fileSize: f.size || 100000,
        categoryName: uploadForm.categoryId
          ? categoryTree.value.find((c: any) => c.id === uploadForm.categoryId)?.label || "其他"
          : "其他",
        tags: uploadForm.tags.length > 0 ? uploadForm.tags[0] : "未分类",
        scene: uploadForm.scene || "活动页",
        downloadCount: 0,
        viewCount: 0,
        useCount: 0,
        status: "DRAFT",
        createdAt: new Date().toISOString().slice(0, 10),
      }));
      mockMaterials.push(...newMaterials);
      ElMessage.success(`成功上传 ${newMaterials.length} 个素材`);
      uploadDialogVisible.value = false;
      resetUploadForm();
      loadMaterials();
    }
  }, 300);
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext || "")) return "IMAGE";
  if (["mp4", "avi", "mov", "wmv", "flv"].includes(ext || "")) return "VIDEO";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext || "")) return "DOCUMENT";
  if (["html", "htm"].includes(ext || "")) return "HTML";
  return "IMAGE";
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "unknown";
}

// ==================== 辅助函数 ====================
function getMaterialThumbnail(item: any): string {
  if (item.materialType === "IMAGE") {
    return `data:image/svg+xml;base64,${btoa(
      `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#e8f4fd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#409eff" font-size="14">图片</text></svg>`
    )}`;
  }
  if (item.materialType === "VIDEO") {
    return `data:image/svg+xml;base64,${btoa(
      `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#fef0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#f56c6c" font-size="14">视频</text></svg>`
    )}`;
  }
  return `data:image/svg+xml;base64,${btoa(
    `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f5f7fa"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#909399" font-size="14">文档</text></svg>`
  )}`;
}

function getMaterialPreview(item: any): string[] {
  return [getMaterialThumbnail(item)];
}

function statusTagType(status: string): string {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "info";
  return "info";
}

function statusLabel(status: string): string {
  if (status === "PUBLISHED") return "已发布";
  if (status === "ARCHIVED") return "已归档";
  if (status === "DRAFT") return "草稿";
  return status;
}

function typeTagType(type: string): string {
  if (type === "IMAGE") return "";
  if (type === "VIDEO") return "danger";
  if (type === "DOCUMENT") return "warning";
  if (type === "HTML") return "success";
  return "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}
</script>

<style scoped>
.page {
  padding: 20px;
}

.material-layout {
  display: flex;
  gap: 16px;
}

/* 左侧分类树 */
.material-sidebar {
  width: 220px;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tree-node-label {
  font-size: 14px;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  min-width: 130px;
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
}

.context-menu-item:hover {
  background: #f5f7fa;
  color: #409eff;
}

/* 右侧素材管理 */
.material-main {
  flex: 1;
  min-width: 0;
}

/* 工具栏 */
.material-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

/* 素材卡片 */
.material-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.3s, transform 0.3s;
  cursor: pointer;
  position: relative;
}

.material-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.material-card:hover .material-card-actions {
  opacity: 1;
}

.material-card-image {
  position: relative;
}

.material-status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
}

.material-card-info {
  padding: 10px 12px;
}

.material-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-meta {
  display: flex;
  align-items: center;
}

.material-card-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  gap: 6px;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

/* 详情 */
.detail-preview {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: center;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

/* 上传 */
.upload-area {
  width: 100%;
}

.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
}

.upload-text {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}

.upload-text em {
  color: #409eff;
  font-style: normal;
}

.upload-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.tag-input-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

/* 分页 */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>