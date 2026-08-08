<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">快捷入口配置</h2>
    <p class="page-desc">首页快捷入口配置</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="openAddDialog">新增入口</el-button>
    <el-button @click="loadData">刷新</el-button>
  </div>
</div>

      

      <el-row :gutter="16">
        <!-- 左侧入口列表 -->
        <el-col :span="10">
          <div class="entry-list-panel">
            <div class="panel-title">快捷入口列表（拖拽排序）</div>
            <div class="entry-list">
              <div
                v-for="(item, index) in entries"
                :key="item.id"
                class="entry-item"
                :class="{ active: selectedId === item.id }"
                @click="selectEntry(item)"
              >
                <div class="entry-info">
                  <el-icon :size="18"><component :is="item.icon || 'HomeFilled'" /></el-icon>
                  <span class="entry-name">{{ item.name }}</span>
                  <span class="entry-route">{{ item.route }}</span>
                </div>
                <div class="entry-actions">
                  <el-button
                    :disabled="index === 0"
                    size="small"
                    :icon="ArrowUp"
                    circle
                    @click.stop="moveUp(index)"
                  />
                  <el-button
                    :disabled="index === entries.length - 1"
                    size="small"
                    :icon="ArrowDown"
                    circle
                    @click.stop="moveDown(index)"
                  />
                </div>
              </div>
              <el-empty v-if="entries.length === 0" description="暂无快捷入口" :image-size="60" />
            </div>
          </div>
        </el-col>

        <!-- 右侧编辑表单 -->
        <el-col :span="14">
          <div class="edit-panel">
            <div class="panel-title">
              {{ editingItem ? '编辑入口' : '选择一个入口进行编辑' }}
            </div>
            <template v-if="editingItem">
              <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
                <el-form-item label="名称" prop="name">
                  <el-input v-model="form.name" placeholder="入口名称" />
                </el-form-item>
                <el-form-item label="图标" prop="icon">
                  <el-select v-model="form.icon" placeholder="选择图标" style="width: 100%">
                    <el-option v-for="ic in iconOptions" :key="ic" :label="ic" :value="ic">
                      <div class="icon-option">
                        <el-icon><component :is="ic" /></el-icon>
                        <span>{{ ic }}</span>
                      </div>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="路由" prop="route">
                  <el-input v-model="form.route" placeholder="如 /sales/create" />
                </el-form-item>
                <el-form-item label="分组" prop="group">
                  <el-input v-model="form.group" placeholder="如 销售管理" />
                </el-form-item>
                <el-form-item label="启用">
                  <el-switch v-model="form.enabled" />
                </el-form-item>
                <el-form-item label="角色可见性">
                  <el-checkbox-group v-model="form.visibleRoles">
                    <el-checkbox label="BOSS" />
                    <el-checkbox label="MGR" />
                    <el-checkbox label="STAFF" />
                  </el-checkbox-group>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="saveLoading" @click="handleSave">保存</el-button>
                  <el-button type="danger" @click="handleDeleteEntry(editingItem)">删除</el-button>
                </el-form-item>
              </el-form>
            </template>
            <el-empty v-else description="请从左侧列表选择入口" :image-size="60" />
          </div>
        </el-col>
      </el-row>

      <!-- 底部操作 -->
      <div class="bottom-bar">
        <el-button type="primary" @click="handleSaveSort">保存排序</el-button>
        <el-button @click="handleResetDefaults">重置默认</el-button>
      </div>
    

    <!-- 新增入口弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增入口" width="480px">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="addForm.name" placeholder="入口名称" />
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <el-select v-model="addForm.icon" placeholder="选择图标" style="width: 100%">
            <el-option v-for="ic in iconOptions" :key="ic" :label="ic" :value="ic">
              <div class="icon-option">
                <el-icon><component :is="ic" /></el-icon>
                <span>{{ ic }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="路由" prop="route">
          <el-input v-model="addForm.route" placeholder="如 /sales/create" />
        </el-form-item>
        <el-form-item label="分组" prop="group">
          <el-input v-model="addForm.group" placeholder="如 销售管理" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="addForm.enabled" />
        </el-form-item>
        <el-form-item label="角色可见性">
          <el-checkbox-group v-model="addForm.visibleRoles">
            <el-checkbox label="BOSS" />
            <el-checkbox label="MGR" />
            <el-checkbox label="STAFF" />
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="handleAdd">保存</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormRules } from "element-plus";
import { ArrowUp, ArrowDown, HomeFilled, ShoppingCart, Document, Box, User, Goods, Shop, Coin, DataAnalysis, Setting, List, Tickets, Bell, Present, Star, Edit } from "@element-plus/icons-vue";
import axios from "axios";
const iconOptions = ["HomeFilled", "ShoppingCart", "Document", "Box", "User", "Goods", "Shop", "Coin", "DataAnalysis", "Setting", "List", "Tickets", "Bell", "Present", "Star", "Edit"];

const defaultEntries = [
  { name: "销售开单", icon: "Edit", route: "/sales/create", group: "销售管理", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "订单列表", icon: "Document", route: "/orders", group: "销售管理", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "库存查询", icon: "Box", route: "/inventory", group: "库存管理", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "客户列表", icon: "User", route: "/customers", group: "客户管理", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "商品管理", icon: "Goods", route: "/products", group: "商品中心", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "门店管理", icon: "Shop", route: "/stores", group: "系统管理", enabled: true, visibleRoles: ["BOSS"] },
  { name: "数据报表", icon: "DataAnalysis", route: "/reports", group: "数据报表", enabled: true, visibleRoles: ["BOSS", "MGR"] },
  { name: "营销中心", icon: "Present", route: "/marketing", group: "营销推广", enabled: true, visibleRoles: ["BOSS"] }
];

const entries = ref<any[]>([]);
const selectedId = ref<number | null>(null);
const editingItem = ref<any>(null);

const form = reactive({
  name: "",
  icon: "",
  route: "",
  group: "",
  enabled: true,
  visibleRoles: [] as string[]
});

const formRef = ref();
const saveLoading = ref(false);

const formRules: FormRules = {
  name: [{ required: true, message: '请输入名称' }],
  route: [{ required: true, message: '请输入路由' }]
};

const dialogVisible = ref(false);
const addFormRef = ref();
const addLoading = ref(false);
const addForm = reactive({
  name: "",
  icon: "HomeFilled",
  route: "",
  group: "",
  enabled: true,
  visibleRoles: [] as string[]
});

const addFormRules: FormRules = {
  name: [{ required: true, message: '请输入名称' }],
  route: [{ required: true, message: '请输入路由' }]
};

function selectEntry(item: any) {
  selectedId.value = item.id;
  editingItem.value = item;
  form.name = item.name;
  form.icon = item.icon || "";
  form.route = item.route;
  form.group = item.group || "";
  form.enabled = item.enabled !== false;
  form.visibleRoles = Array.isArray(item.visibleRoles) ? [...item.visibleRoles] : [];
}

function moveUp(index: number) {
  if (index <= 0) return;
  const arr = entries.value;
  [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
  entries.value = [...arr];
}

function moveDown(index: number) {
  if (index >= entries.value.length - 1) return;
  const arr = entries.value;
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
  entries.value = [...arr];
}

async function loadData() {
  try {
    const { data: res } = await axios.get("/api/admin/quick-entries");
    const data = res.data || res;
    const list = Array.isArray(data) ? data : (data.records || data.list || []);
    entries.value = list;

    if (list.length === 0) {
      // 首次加载，填充默认预设
      entries.value = defaultEntries.map((e, i) => ({
        id: -(i + 1),
        ...e,
        sortNo: i + 1
      }));
    }

    if (entries.value.length > 0 && !selectedId.value) {
      selectEntry(entries.value[0]);
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!editingItem.value) return;
  saveLoading.value = true;
  try {
    const item = editingItem.value;
    if (item.id && item.id > 0) {
      await axios.put(`/api/admin/quick-entries/${item.id}`, {
        name: form.name,
        icon: form.icon,
        route: form.route,
        group: form.group,
        enabled: form.enabled,
        visibleRoles: form.visibleRoles
      });
    } else {
      await axios.post("/api/admin/quick-entries", {
        name: form.name,
        icon: form.icon,
        route: form.route,
        group: form.group,
        enabled: form.enabled,
        visibleRoles: form.visibleRoles
      });
    }
    ElMessage.success("保存成功");
    await loadData();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

async function handleDeleteEntry(item: any) {
  try {
    await ElMessageBox.confirm("确认删除该入口？", "提示", { type: "warning" });
    if (item.id && item.id > 0) {
      await axios.delete(`/api/admin/quick-entries/${item.id}`);
    }
    ElMessage.success("删除成功");
    editingItem.value = null;
    selectedId.value = null;
    await loadData();
  } catch { /* cancelled */ }
}

async function handleSaveSort() {
  try {
    const ids = entries.value.map(e => e.id);
    await axios.put("/api/admin/quick-entries/sort", { ids });
    ElMessage.success("排序已保存");
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "排序保存失败");
  }
}

async function handleResetDefaults() {
  try {
    await ElMessageBox.confirm("确认重置为默认入口？", "提示", { type: "warning" });
    entries.value = defaultEntries.map((e, i) => ({
      id: -(i + 1),
      ...e,
      sortNo: i + 1
    }));
    ElMessage.success("已重置为默认入口");
    if (entries.value.length > 0) {
      selectEntry(entries.value[0]);
    }
  } catch { /* cancelled */ }
}

function openAddDialog() {
  addForm.name = "";
  addForm.icon = "HomeFilled";
  addForm.route = "";
  addForm.group = "";
  addForm.enabled = true;
  addForm.visibleRoles = [];
  dialogVisible.value = true;
}

async function handleAdd() {
  const valid = await addFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  addLoading.value = true;
  try {
    await axios.post("/api/admin/quick-entries", {
      name: addForm.name,
      icon: addForm.icon,
      route: addForm.route,
      group: addForm.group,
      enabled: addForm.enabled,
      visibleRoles: addForm.visibleRoles
    });
    ElMessage.success("新增成功");
    dialogVisible.value = false;
    await loadData();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "新增失败");
  } finally {
    addLoading.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 0; }

.entry-list-panel,
.edit-panel {
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  min-height: 400px;
}

.panel-title {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid var(--border-normal);
  color: var(--text-primary);
}

.entry-list {
  padding: 8px;
  max-height: 500px;
  overflow-y: auto;
}

.entry-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.entry-item:hover {
  background: var(--color-primary-soft);
}
.entry-item.active {
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
}

.entry-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.entry-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
}
.entry-route {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.edit-panel {
  padding: 0;
}
.edit-panel .el-form {
  padding: 16px 16px 0;
}

.icon-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bottom-bar {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>