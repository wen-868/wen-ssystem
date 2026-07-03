<template>
  <PageCard title="部门管理">
    <div class="dept-layout">
      <div class="tree-panel">
        <div class="tree-toolbar">
          <span class="tree-title">部门结构</span>
          <div class="tree-actions">
            <el-button type="primary" size="small" @click="handleAddRoot">
              <el-icon><Plus /></el-icon> 添加根部门
            </el-button>
            <el-button size="small" @click="loadTree">
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
          highlight-current
          @node-click="handleNodeClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon class="tree-node-icon"><OfficeBuilding /></el-icon>
              <span class="tree-node-label">{{ data.name }}</span>
              <el-tag v-if="data.storeName" size="small" type="info" style="margin-left: 6px">{{ data.storeName }}</el-tag>
            </span>
          </template>
        </el-tree>
      </div>
      <div class="detail-panel">
        <template v-if="currentNode">
          <div class="detail-header">
            <span class="detail-title">部门详情</span>
            <div class="detail-actions">
              <el-button size="small" type="success" @click="handleAddChild">新增子部门</el-button>
              <el-button size="small" type="primary" @click="handleEdit">编辑</el-button>
              <el-popconfirm title="确认删除该部门及其子部门？" @confirm="handleDelete">
                <template #reference>
                  <el-button size="small" type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
          <el-form :model="detailForm" label-width="100px" disabled>
            <el-form-item label="部门名称">
              <el-input v-model="detailForm.name" />
            </el-form-item>
            <el-form-item label="上级部门">
              <el-input v-model="detailForm.parentName" />
            </el-form-item>
            <el-form-item label="所属门店">
              <el-input v-model="detailForm.storeName" />
            </el-form-item>
            <el-form-item label="排序号">
              <el-input-number v-model="detailForm.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="创建时间">
              <span>{{ formatDate(detailForm.createdAt) }}</span>
            </el-form-item>
          </el-form>
        </template>
        <el-empty v-else description="请选择左侧部门节点查看详情" :image-size="80" />
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="上级部门">
          <el-cascader
            v-model="form.parentId"
            :options="cascaderOptions"
            :props="{ checkStrictly: true, value: 'id', label: 'name', emitPath: false }"
            placeholder="不选择则为根部门"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="所属门店">
          <el-select v-model="form.storeId" placeholder="请选择门店" clearable style="width: 100%">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
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
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh, OfficeBuilding } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import {
  getDepartmentTree, createDepartment, updateDepartment, deleteDepartment, fetchStores
} from "../api";

const treeRef = ref<any>();
const treeData = ref<any[]>([]);
const currentNode = ref<any>(null);
const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const storeList = ref<any[]>([]);

const treeProps = {
  children: "children",
  label: "name"
};

const defaultForm = {
  name: "",
  parentId: null as number | null,
  storeId: null as number | null,
  sortOrder: 0
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  name: [{ required: true, message: "请输入部门名称", trigger: "blur" }]
};

const detailForm = reactive({
  name: "",
  parentName: "",
  storeName: "",
  sortOrder: 0,
  createdAt: ""
});

const dialogTitle = computed(() => {
  if (isEdit.value) return "编辑部门";
  if (form.parentId) return "新增子部门";
  return "新增根部门";
});

const cascaderOptions = computed(() => {
  const filterSelf = (nodes: any[]): any[] => {
    return nodes
      .filter((n: any) => !currentNode.value || n.id !== currentNode.value.id)
      .map((n: any) => ({
        id: n.id,
        name: n.name,
        children: filterSelf(n.children || [])
      }));
  };
  return filterSelf(treeData.value);
});

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.message || e?.message || fallback;
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

async function loadTree() {
  try {
    const data = await getDepartmentTree() as any;
    treeData.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载部门树失败"));
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data.records || []);
  } catch {
    // ignore
  }
}

function handleNodeClick(data: any) {
  currentNode.value = data;
  detailForm.name = data.name || "";
  detailForm.parentName = getParentName(data.id);
  detailForm.storeName = data.storeName || "-";
  detailForm.sortOrder = data.sortOrder || 0;
  detailForm.createdAt = data.createdAt || "";
}

function handleAddRoot() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  form.parentId = null;
  dialogVisible.value = true;
}

function handleAddChild() {
  if (!currentNode.value) {
    ElMessage.warning("请先选择上级部门");
    return;
  }
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  form.parentId = currentNode.value.id;
  dialogVisible.value = true;
}

function handleEdit() {
  if (!currentNode.value) {
    ElMessage.warning("请先选择部门");
    return;
  }
  isEdit.value = true;
  const node = currentNode.value;
  form.name = node.name;
  form.parentId = node.parentId || null;
  form.storeId = node.storeId || null;
  form.sortOrder = node.sortOrder || 0;
  dialogVisible.value = true;
}

async function handleDelete() {
  if (!currentNode.value) {
    ElMessage.warning("请先选择部门");
    return;
  }
  try {
    await deleteDepartment(currentNode.value.id);
    ElMessage.success("部门已删除");
    currentNode.value = null;
    loadTree();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = {
        name: form.name,
        parentId: form.parentId || undefined,
        storeId: form.storeId || undefined,
        sortOrder: form.sortOrder
      };
      if (isEdit.value && currentNode.value) {
        await updateDepartment(currentNode.value.id, payload);
        ElMessage.success("部门已更新");
      } else {
        await createDepartment(payload);
        ElMessage.success("部门已创建");
      }
      dialogVisible.value = false;
      currentNode.value = null;
      loadTree();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "操作失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadTree();
  loadStores();
});
</script>

<style scoped>
.dept-layout {
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
  color: #409eff;
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