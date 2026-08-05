<template>
  <div class="page">
    <PageCard title="角色权限">
      <template #extra>
        <el-button type="primary" @click="openCreate">新增角色</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <el-table :data="roles" v-loading="loading" stripe>
        <el-table-column prop="roleName" label="角色名称" min-width="140" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="userCount" label="用户数" width="100" align="center" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link type="primary" @click="openAssignUsers(row)">分配用户</el-button>
            <el-popconfirm title="确定删除该角色？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button size="small" link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>
    </PageCard>

    <!-- 创建/编辑角色弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingRole ? '编辑角色' : '新增角色'" width="720px">
      <el-tabs v-model="activeTab">
        <!-- 功能权限 Tab -->
        <el-tab-pane label="功能权限" name="menu">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
            <el-form-item label="角色名称" prop="roleName">
              <el-input v-model="form.roleName" placeholder="请输入角色名称" />
            </el-form-item>
            <el-form-item label="描述" prop="description">
              <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入角色描述" />
            </el-form-item>
            <el-form-item label="菜单权限">
              <div class="permission-tree">
                <div v-for="module in menuModules" :key="module.key" class="permission-module">
                  <el-checkbox
                    :model-value="isModuleAllChecked(module.key)"
                    :indeterminate="isModuleIndeterminate(module.key)"
                    @change="(val: boolean) => handleModuleCheckAll(module.key, val)"
                  >
                    <b>{{ module.label }}</b>
                  </el-checkbox>
                  <div class="permission-items">
                    <el-checkbox
                      v-for="item in module.items"
                      :key="item.key"
                      :model-value="form.permissions.includes(item.key)"
                      @change="(val: boolean) => handlePermissionChange(item.key, val)"
                    >
                      {{ item.label }}
                    </el-checkbox>
                  </div>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 数据权限 Tab -->
        <el-tab-pane label="数据权限" name="data">
          <el-form :model="dataPermForm" label-width="100px">
            <el-form-item label="数据权限范围">
              <el-radio-group v-model="dataPermForm.dataScope">
                <el-radio label="ALL">全部数据</el-radio>
                <el-radio label="DEPARTMENT">按部门</el-radio>
                <el-radio label="STORE">按门店</el-radio>
                <el-radio label="CUSTOMER">按客户</el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 部门选择 -->
            <el-form-item label="可选部门" v-if="dataPermForm.dataScope === 'DEPARTMENT'">
              <div class="data-perm-select">
                <el-tree-select
                  v-model="dataPermForm.selectedDepartments"
                  :data="departmentTree"
                  :props="{ label: 'name', value: 'id', children: 'children' }"
                  multiple
                  check-strictly
                  placeholder="请选择部门"
                  style="width: 100%"
                />
              </div>
              <div class="selected-tags" v-if="dataPermForm.selectedDepartments.length > 0">
                <el-tag
                  v-for="deptId in dataPermForm.selectedDepartments"
                  :key="deptId"
                  closable
                  @close="removeDepartment(deptId)"
                >
                  {{ getDepartmentName(deptId) }}
                </el-tag>
              </div>
            </el-form-item>

            <!-- 门店选择 -->
            <el-form-item label="可选门店" v-if="dataPermForm.dataScope === 'STORE'">
              <el-select
                v-model="dataPermForm.selectedStores"
                multiple
                filterable
                placeholder="请选择门店"
                style="width: 100%"
              >
                <el-option
                  v-for="store in storeList"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
            </el-form-item>

            <!-- 客户选择 -->
            <el-form-item label="可选客户" v-if="dataPermForm.dataScope === 'CUSTOMER'">
              <el-select
                v-model="dataPermForm.selectedCustomers"
                multiple
                filterable
                placeholder="请选择客户"
                style="width: 100%"
                remote
                :remote-method="fetchCustomersRemote"
                :loading="customerLoading"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="`${customer.name} (${customer.mobile || ''})`"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>

            <!-- 数据权限说明 -->
            <el-form-item>
              <el-alert
                title="数据权限说明"
                type="info"
                :closable="false"
                show-icon
                style="font-size: 13px"
              >
                <ul style="margin: 0; padding-left: 20px">
                  <li><strong>全部数据</strong>：该角色用户可以查看所有数据，无限制</li>
                  <li><strong>按部门</strong>：该角色用户只能查看所选部门及其下属部门的数据</li>
                  <li><strong>按门店</strong>：该角色用户只能查看所选门店的数据</li>
                  <li><strong>按客户</strong>：该角色用户只能查看所选客户的数据</li>
                </ul>
              </el-alert>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配用户弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="分配用户" width="720px">
      <div class="assign-dialog-content">
        <el-select v-model="selectedUserIds" multiple filterable placeholder="选择用户" style="width: 100%">
          <el-option
            v-for="user in staffList"
            :key="user.id"
            :label="`${user.realName || user.username} (${user.mobile || ''})`"
            :value="user.id"
          />
        </el-select>
        <div style="margin-top: 12px; color: #666">
          <span v-if="assignRole">当前角色：<el-tag size="small">{{ assignRole.roleName }}</el-tag></span>
        </div>
      </div>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="assignLoading" @click="handleAssignUsers">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchStaff,
  setUserRoles,
  fetchStores,
  getDepartmentTree,
  fetchMembers,
  fetchRoleDataPermissions,
  setRoleDataPermissions
} from "../../api";

const menuModules = [
  {
    key: "sales",
    label: "销售管理",
    items: [
      { key: "sales:create", label: "开单" },
      { key: "sales:bills", label: "销售单据" },
      { key: "sales:returns", label: "退货管理" },
      { key: "sales:collection", label: "收款管理" }
    ]
  },
  {
    key: "orders",
    label: "订单管理",
    items: [
      { key: "orders:list", label: "订单列表" },
      { key: "orders:board", label: "订单看板" },
      { key: "orders:timeout", label: "超时配置" }
    ]
  },
  {
    key: "purchase",
    label: "采购管理",
    items: [
      { key: "purchase:orders", label: "采购订单" },
      { key: "purchase:instocks", label: "入库管理" },
      { key: "purchase:returns", label: "采购退货" },
      { key: "purchase:payments", label: "采购付款" },
      { key: "purchase:suppliers", label: "供应商管理" }
    ]
  },
  {
    key: "inventory",
    label: "库存管理",
    items: [
      { key: "inventory:list", label: "库存列表" },
      { key: "inventory:check", label: "盘点管理" },
      { key: "inventory:transfer", label: "调拨管理" },
      { key: "inventory:batch", label: "批次追溯" },
      { key: "inventory:alerts", label: "库存预警" }
    ]
  },
  {
    key: "customer",
    label: "客户管理",
    items: [
      { key: "customer:list", label: "客户列表" },
      { key: "customer:credit", label: "信用管理" }
    ]
  },
  {
    key: "product",
    label: "商品中心",
    items: [
      { key: "product:list", label: "商品列表" },
      { key: "product:categories", label: "分类管理" },
      { key: "product:prices", label: "价格管理" }
    ]
  },
  {
    key: "finance",
    label: "财务管理",
    items: [
      { key: "finance:payments", label: "支付记录" },
      { key: "finance:collection", label: "收款链接" },
      { key: "finance:statements", label: "对账单" },
      { key: "finance:profit", label: "利润报表" }
    ]
  },
  {
    key: "report",
    label: "数据报表",
    items: [
      { key: "report:overview", label: "报表总览" },
      { key: "report:products", label: "商品排行" },
      { key: "report:employees", label: "员工业绩" },
      { key: "report:stores", label: "门店对比" }
    ]
  },
  {
    key: "marketing",
    label: "营销中心",
    items: [
      { key: "marketing:overview", label: "营销概览" },
      { key: "marketing:promotion", label: "促销活动" },
      { key: "marketing:aftersale", label: "售后管理" }
    ]
  },
  {
    key: "system",
    label: "系统设置",
    items: [
      { key: "system:employees", label: "员工管理" },
      { key: "system:stores", label: "门店管理" },
      { key: "system:roles", label: "角色权限" },
      { key: "system:audit", label: "操作日志" },
      { key: "system:config", label: "系统配置" }
    ]
  }
];

const roles = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingRole = ref<any>(null);
const submitLoading = ref(false);
const formRef = ref();
const activeTab = ref("menu");

const form = reactive({
  roleName: "",
  description: "",
  permissions: [] as string[]
});

const rules = {
  roleName: [{ required: true, message: "请输入角色名称", trigger: "blur" }]
};

// 数据权限表单
const dataPermForm = reactive({
  dataScope: "ALL" as "ALL" | "DEPARTMENT" | "STORE" | "CUSTOMER",
  selectedDepartments: [] as number[],
  selectedStores: [] as number[],
  selectedCustomers: [] as number[]
});

// 数据权限相关数据
const departmentTree = ref<any[]>([]);
const storeList = ref<any[]>([]);
const customerList = ref<any[]>([]);
const customerLoading = ref(false);

const assignDialogVisible = ref(false);
const assignRole = ref<any>(null);
const assignLoading = ref(false);
const staffList = ref<any[]>([]);
const selectedUserIds = ref<number[]>([]);

// ==================== 功能权限方法 ====================

function getModuleItems(moduleKey: string): string[] {
  const module = menuModules.find((m) => m.key === moduleKey);
  return module ? module.items.map((i) => i.key) : [];
}

function isModuleAllChecked(moduleKey: string): boolean {
  const items = getModuleItems(moduleKey);
  return items.length > 0 && items.every((k) => form.permissions.includes(k));
}

function isModuleIndeterminate(moduleKey: string): boolean {
  const items = getModuleItems(moduleKey);
  const checked = items.filter((k) => form.permissions.includes(k)).length;
  return checked > 0 && checked < items.length;
}

function handleModuleCheckAll(moduleKey: string, val: boolean) {
  const items = getModuleItems(moduleKey);
  if (val) {
    items.forEach((k) => {
      if (!form.permissions.includes(k)) form.permissions.push(k);
    });
  } else {
    form.permissions = form.permissions.filter((k) => !items.includes(k));
  }
}

function handlePermissionChange(key: string, val: boolean) {
  if (val) {
    if (!form.permissions.includes(key)) form.permissions.push(key);
  } else {
    form.permissions = form.permissions.filter((k) => k !== key);
  }
}

// ==================== 数据权限方法 ====================

async function loadDepartmentTree() {
  try {
    departmentTree.value = await getDepartmentTree();
  } catch {
    ElMessage.error("加载部门树失败");
  }
}

async function loadStoreList() {
  try {
    storeList.value = await fetchStores();
  } catch {
    ElMessage.error("加载门店列表失败");
  }
}

async function fetchCustomersRemote(query: string) {
  if (!query) {
    customerList.value = [];
    return;
  }
  customerLoading.value = true;
  try {
    const data = await fetchMembers({ keyword: query, pageSize: 20 });
    customerList.value = Array.isArray(data) ? data : (data?.records || []);
  } catch {
    ElMessage.error("加载客户列表失败");
  } finally {
    customerLoading.value = false;
  }
}

function getDepartmentName(deptId: number): string {
  const findName = (nodes: any[], id: number): string => {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      if (node.children) {
        const found = findName(node.children, id);
        if (found) return found;
      }
    }
    return "";
  };
  return findName(departmentTree.value, deptId);
}

function removeDepartment(deptId: number) {
  const index = dataPermForm.selectedDepartments.indexOf(deptId);
  if (index > -1) {
    dataPermForm.selectedDepartments.splice(index, 1);
  }
}

function buildDataPermissions(): any[] {
  const permissions: any[] = [];
  
  switch (dataPermForm.dataScope) {
    case "DEPARTMENT":
      if (dataPermForm.selectedDepartments.length > 0) {
        permissions.push({
          tableName: "sys_department",
          fieldName: "id",
          filterType: "IN",
          filterValue: dataPermForm.selectedDepartments.join(",")
        });
      }
      break;
    case "STORE":
      if (dataPermForm.selectedStores.length > 0) {
        permissions.push({
          tableName: "t_store",
          fieldName: "id",
          filterType: "IN",
          filterValue: dataPermForm.selectedStores.join(",")
        });
      }
      break;
    case "CUSTOMER":
      if (dataPermForm.selectedCustomers.length > 0) {
        permissions.push({
          tableName: "t_member",
          fieldName: "id",
          filterType: "IN",
          filterValue: dataPermForm.selectedCustomers.join(",")
        });
      }
      break;
    case "ALL":
    default:
      // 全部数据权限，不需要添加过滤条件
      break;
  }
  
  return permissions;
}

async function loadRoleDataPermissions(roleId: number) {
  try {
    const dataPermissions = await fetchRoleDataPermissions(roleId);
    if (Array.isArray(dataPermissions) && dataPermissions.length > 0) {
      const dp = dataPermissions[0];
      switch (dp.tableName) {
        case "sys_department":
          dataPermForm.dataScope = "DEPARTMENT";
          dataPermForm.selectedDepartments = dp.filterValue.split(",").map(Number);
          break;
        case "t_store":
          dataPermForm.dataScope = "STORE";
          dataPermForm.selectedStores = dp.filterValue.split(",").map(Number);
          break;
        case "t_member":
          dataPermForm.dataScope = "CUSTOMER";
          dataPermForm.selectedCustomers = dp.filterValue.split(",").map(Number);
          break;
        default:
          dataPermForm.dataScope = "ALL";
          break;
      }
    } else {
      dataPermForm.dataScope = "ALL";
    }
  } catch {
    dataPermForm.dataScope = "ALL";
  }
}

// ==================== 通用方法 ====================

async function loadData() {
  loading.value = true;
  try {
    roles.value = await fetchRoles();
  } catch {
    ElMessage.error("加载角色列表失败");
  } finally {
    loading.value = false;
  }
}

function resetDataPermForm() {
  dataPermForm.dataScope = "ALL";
  dataPermForm.selectedDepartments = [];
  dataPermForm.selectedStores = [];
  dataPermForm.selectedCustomers = [];
}

function openCreate() {
  editingRole.value = null;
  form.roleName = "";
  form.description = "";
  form.permissions = [];
  resetDataPermForm();
  activeTab.value = "menu";
  dialogVisible.value = true;
  nextTick(() => {
    loadDepartmentTree();
    loadStoreList();
  });
}

async function openEdit(row: any) {
  editingRole.value = row;
  form.roleName = row.roleName || "";
  form.description = row.description || "";
  form.permissions = Array.isArray(row.permissions) ? [...row.permissions] : [];
  resetDataPermForm();
  activeTab.value = "menu";
  dialogVisible.value = true;
  
  await nextTick();
  loadDepartmentTree();
  loadStoreList();
  
  if (row.id) {
    await loadRoleDataPermissions(row.id);
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    if (editingRole.value) {
      // 更新角色
      await updateRole(editingRole.value.id, {
        roleName: form.roleName,
        description: form.description,
        permissions: form.permissions
      });
      // 更新数据权限
      const dataPermissions = buildDataPermissions();
      await setRoleDataPermissions(editingRole.value.id, dataPermissions);
      ElMessage.success("角色更新成功");
    } else {
      // 创建角色
      const newRole = await createRole({
        roleName: form.roleName,
        description: form.description,
        permissions: form.permissions
      });
      // 设置数据权限
      if (newRole.id) {
        const dataPermissions = buildDataPermissions();
        await setRoleDataPermissions(newRole.id, dataPermissions);
      }
      ElMessage.success("角色创建成功");
    }
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    submitLoading.value = false;
  }
}

async function handleDelete(id: number) {
  try {
    await deleteRole(id);
    ElMessage.success("删除成功");
    await loadData();
  } catch {
    ElMessage.error("删除失败");
  }
}

async function openAssignUsers(row: any) {
  assignRole.value = row;
  selectedUserIds.value = [];
  assignDialogVisible.value = true;
  try {
    staffList.value = await fetchStaff();
  } catch {
    ElMessage.error("加载员工列表失败");
  }
}

async function handleAssignUsers() {
  if (selectedUserIds.value.length === 0) {
    ElMessage.warning("请选择至少一个用户");
    return;
  }
  assignLoading.value = true;
  try {
    for (const userId of selectedUserIds.value) {
      await setUserRoles(userId, [assignRole.value.id]);
    }
    ElMessage.success("用户角色分配成功");
    assignDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("分配失败");
  } finally {
    assignLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.permission-tree {
  border: 1px solid var(--gray-200);
  border-radius: 4px;
  padding: 12px 16px;
  max-height: 400px;
  overflow-y: auto;
}

.permission-module {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border-light);
}

.permission-module:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.permission-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  margin-left: 0;
}

.data-perm-select {
  margin-bottom: 8px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.assign-dialog-content {
  min-height: 120px;
}
</style>
