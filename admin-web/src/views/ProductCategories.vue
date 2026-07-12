<template>
  <div class="category-page">
    <div class="page-header">
      <h2>商品分类管理</h2>
      <p class="page-desc">管理商品分类树结构，支持拖拽排序</p>
    </div>

    <PageCard>
      <div class="category-layout">
        <div class="tree-panel">
          <div class="tree-toolbar">
            <span class="tree-title">分类树</span>
            <div class="tree-actions">
              <el-button type="primary" size="small" @click="handleAddRoot">
                <el-icon><Plus /></el-icon> 添加根分类
              </el-button>
              <el-button size="small" @click="loadCategories">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </div>
          <el-tree
            ref="treeRef"
            :data="treeData"
            :props="treeProps"
            node-key="id"
            default-expand-all
            draggable
            highlight-current
            :allow-drag="allowDrag"
            :allow-drop="allowDrop"
            @node-click="handleNodeClick"
            @node-drop="handleNodeDrop"
          >
            <template #default="{ node, data }">
              <span class="tree-node">
                <span v-if="data.icon" class="tree-node-icon">{{ data.icon }}</span>
                <span class="tree-node-label">{{ data.name }}</span>
                <el-tag v-if="data.allowOnlineSale === 0" type="warning" size="small" style="margin-left: 6px">仅线下</el-tag>
                <el-tag v-if="data.status === 0" type="info" size="small" style="margin-left: 6px">禁用</el-tag>
              </span>
            </template>
          </el-tree>
        </div>
        <div class="detail-panel">
          <template v-if="currentNode">
            <div class="detail-header">
              <span class="detail-title">分类详情</span>
              <div class="detail-actions">
                <el-button size="small" type="primary" @click="handleEdit">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDelete">删除</el-button>
              </div>
            </div>
            <el-form :model="detailForm" label-width="100px" disabled>
              <el-form-item label="分类名称">
                <el-input v-model="detailForm.name" />
              </el-form-item>
              <el-form-item label="分类编码">
                <el-input v-model="detailForm.code" />
              </el-form-item>
              <el-form-item label="分类图标">
                <el-input v-model="detailForm.icon" />
              </el-form-item>
              <el-form-item label="排序号">
                <el-input-number v-model="detailForm.sortOrder" :min="0" style="width: 100%" />
              </el-form-item>
              <el-form-item label="父级分类">
                <el-input v-model="detailForm.parentName" />
              </el-form-item>
              <el-form-item label="状态">
                <el-tag v-if="detailForm.status === 1" type="success">启用</el-tag>
                <el-tag v-else type="info">禁用</el-tag>
              </el-form-item>
              <el-form-item label="线上销售">
                <el-tag v-if="detailForm.allowOnlineSale === 1" type="success">允许</el-tag>
                <el-tag v-else type="warning">仅线下</el-tag>
              </el-form-item>
              <el-form-item label="创建时间">
                <span>{{ formatDate(detailForm.createdAt) }}</span>
              </el-form-item>
            </el-form>
          </template>
          <el-empty v-else description="请选择左侧分类节点查看详情" :image-size="80" />
        </div>
      </div>
    </PageCard>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="分类编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入分类编码" />
        </el-form-item>
        <el-form-item label="分类图标">
          <el-input v-model="form.icon" placeholder="请输入图标名称或URL" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeData"
            :props="treeProps"
            check-strictly
            placeholder="不选择则为根分类"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="允许线上销售">
          <el-switch v-model="form.allowOnlineSale" :active-value="1" :inactive-value="0" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px">关闭后该分类商品仅限线下销售</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { api } from "../api";
import { formatDate } from "../utils/format";
import PageCard from "../components/PageCard.vue";

const treeRef = ref<any>();
const treeData = ref<any[]>([]);
const currentNode = ref<any>(null);
const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const treeProps = {
  children: "children",
  label: "name"
};

const parentTreeData = computed(() => {
  const filterNode = (nodes: any[]): any[] => {
    return nodes
      .filter((n: any) => !currentNode.value || n.id !== currentNode.value.id)
      .map((n: any) => ({
        ...n,
        children: filterNode(n.children || [])
      }));
  };
  return filterNode(treeData.value);
});

const defaultForm = {
  name: "",
  code: "",
  icon: "",
  sortOrder: 0,
  parentId: null as number | null,
  status: 1,
  allowOnlineSale: 1
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  name: [{ required: true, message: "请输入分类名称", trigger: "blur" }],
  code: [{ required: true, message: "请输入分类编码", trigger: "blur" }]
};

const detailForm = reactive({
  name: "",
  code: "",
  icon: "",
  sortOrder: 0,
  parentName: "",
  status: 1,
  allowOnlineSale: 1,
  createdAt: ""
});

const dialogTitle = computed(() => (isEdit.value ? "编辑分类" : "新增分类"));

/** 字段映射：后端返回下划线格式，前端使用驼峰格式 */
function mapCategoryFields(item: any): any {
  return {
    ...item,
    parentId: item.parent_id ?? item.parentId ?? null,
    sortOrder: item.sort_no ?? item.sortOrder ?? 0,
    allowOnlineSale: item.allow_online_sale ?? item.allowOnlineSale ?? 1,
    createdAt: item.created_at ?? item.createdAt ?? "",
    updatedAt: item.updated_at ?? item.updatedAt ?? "",
  };
}

/** 递归获取子分类（后端不传 pid 时只返回根分类） */
async function fetchSubCategories(parentId: number, allList: any[]): Promise<void> {
  try {
    const { data } = await api.get(`/admin/products/categories?pid=${parentId}`);
    const children = data.data || [];
    if (children.length > 0) {
      allList.push(...children);
      for (const child of children) {
        await fetchSubCategories(child.id, allList);
      }
    }
  } catch {
    // 忽略子分类获取失败
  }
}

async function loadCategories() {
  try {
    const { data } = await api.get("/admin/products/categories");
    const rootList = data.data || [];
    const allList = [...rootList];
    // 递归获取子分类
    for (const root of rootList) {
      await fetchSubCategories(root.id, allList);
    }
    treeData.value = buildTree(allList.map(mapCategoryFields));
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载分类失败");
    treeData.value = [];
  }
}

function buildTree(list: any[]): any[] {
  if (!list || list.length === 0) return [];
  const map = new Map<number, any>();
  const roots: any[] = [];
  list.forEach((item: any) => {
    map.set(item.id, { ...item, children: [] });
  });
  list.forEach((item: any) => {
    const node = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function findNodeById(data: any[], id: number): any | null {
  for (const node of data) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getParentName(nodeId: number): string {
  for (const node of treeData.value) {
    if (node.children?.length) {
      const found = node.children.find((c: any) => c.id === nodeId);
      if (found) return node.name;
    }
  }
  return "-";
}

function handleNodeClick(data: any) {
  currentNode.value = data;
  detailForm.name = data.name || "";
  detailForm.code = data.code || "";
  detailForm.icon = data.icon || "";
  detailForm.sortOrder = data.sortOrder || 0;
  detailForm.parentName = getParentName(data.id);
  detailForm.status = data.status ?? 1;
  detailForm.allowOnlineSale = data.allowOnlineSale ?? 1;
  detailForm.createdAt = data.createdAt || "";
}

function handleAddRoot() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  form.parentId = null;
  dialogVisible.value = true;
}

function handleEdit() {
  if (!currentNode.value) {
    ElMessage.warning("请先选择分类");
    return;
  }
  isEdit.value = true;
  const node = currentNode.value;
  Object.assign(form, {
    name: node.name,
    code: node.code,
    icon: node.icon || "",
    sortOrder: node.sortOrder || 0,
    parentId: node.parentId || null,
    status: node.status ?? 1,
    allowOnlineSale: node.allowOnlineSale ?? 1
  });
  dialogVisible.value = true;
}

async function handleDelete() {
  if (!currentNode.value) {
    ElMessage.warning("请先选择分类");
    return;
  }
  const node = currentNode.value;
  if (node.children && node.children.length > 0) {
    ElMessage.warning("该分类下有子分类，请先删除子分类");
    return;
  }
  try {
    await ElMessageBox.confirm("确定删除该分类吗？", "提示", { type: "warning" });
    await api.delete(`/admin/products/categories/${node.id}`);
    ElMessage.success("删除成功");
    currentNode.value = null;
    loadCategories();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "删除失败");
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload = { ...form, sortNo: form.sortOrder };
      if (isEdit.value && currentNode.value) {
        await api.put(`/admin/products/categories/${currentNode.value.id}`, payload);
        ElMessage.success("更新成功");
      } else {
        await api.post("/admin/products/categories", payload);
        ElMessage.success("创建成功");
      }
      dialogVisible.value = false;
      currentNode.value = null;
      loadCategories();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "保存失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

function allowDrag(draggingNode: any) {
  return true;
}

function allowDrop(draggingNode: any, dropNode: any, type: string) {
  if (type === "inner") {
    return dropNode.level < 3;
  }
  return true;
}

async function handleNodeDrop(draggingNode: any, dropNode: any, dropType: string) {
  const dragId = draggingNode.data.id;
  let parentId: number | null = null;
  let sortOrder = 0;

  if (dropType === "inner") {
    parentId = dropNode.data.id;
    sortOrder = (dropNode.data.children?.length || 0);
  } else {
    parentId = dropNode.data.parentId || null;
    sortOrder = dropNode.data.sortOrder || 0;
  }

  try {
    await api.put(`/admin/products/categories/${dragId}/sort`, { parentId, sortOrder });
    ElMessage.success("排序已更新");
    loadCategories();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "排序更新失败");
  }
}

onMounted(() => {
  loadCategories();
});
</script>

<style scoped>
.category-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.category-layout {
  display: flex;
  gap: 20px;
  min-height: 500px;
}

.tree-panel {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  padding-right: 20px;
}

.tree-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tree-title {
  font-weight: 600;
  font-size: 15px;
}

.tree-actions {
  display: flex;
  gap: 6px;
}

.tree-node {
  display: flex;
  align-items: center;
  flex: 1;
}

.tree-node-icon {
  margin-right: 4px;
  font-size: 16px;
}

.tree-node-label {
  font-size: 14px;
}

.detail-panel {
  flex: 1;
  padding-left: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-title {
  font-weight: 600;
  font-size: 15px;
}

.detail-actions {
  display: flex;
  gap: 8px;
}
</style>