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
      </el-table>
    </PageCard>

    <!-- 创建/编辑角色弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingRole ? '编辑角色' : '新增角色'" width="640px">
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
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配用户弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="分配用户" width="600px">
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
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchStaff,
  setUserRoles
} from "../api";

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

const form = reactive({
  roleName: "",
  description: "",
  permissions: [] as string[]
});

const rules = {
  roleName: [{ required: true, message: "请输入角色名称", trigger: "blur" }]
};

const assignDialogVisible = ref(false);
const assignRole = ref<any>(null);
const assignLoading = ref(false);
const staffList = ref<any[]>([]);
const selectedUserIds = ref<number[]>([]);

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

function openCreate() {
  editingRole.value = null;
  form.roleName = "";
  form.description = "";
  form.permissions = [];
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editingRole.value = row;
  form.roleName = row.roleName || "";
  form.description = row.description || "";
  form.permissions = Array.isArray(row.permissions) ? [...row.permissions] : [];
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    if (editingRole.value) {
      await updateRole(editingRole.value.id, {
        roleName: form.roleName,
        description: form.description,
        permissions: form.permissions
      });
      ElMessage.success("角色更新成功");
    } else {
      await createRole({
        roleName: form.roleName,
        description: form.description,
        permissions: form.permissions
      });
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
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px 16px;
  max-height: 400px;
  overflow-y: auto;
}

.permission-module {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #ebeef5;
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

.assign-dialog-content {
  min-height: 120px;
}
</style>