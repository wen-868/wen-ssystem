<template>
  <div class="organization-page">
    <div class="org-toolbar">
      <div class="org-filters">
        <el-select v-model="filterDepartment" placeholder="全部部门" clearable style="width: 160px" @change="loadData">
          <el-option v-for="d in departmentOptions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索姓名/用户名/手机号" clearable style="width: 220px" @input="loadData" />
      </div>
      <div class="org-actions">
        <el-button @click="openDepartmentDialog">部门管理</el-button>
        <el-button @click="openPositionDialog">岗位管理</el-button>
        <el-button @click="router.push('/system/roles')">角色权限</el-button>
        <el-button type="primary" :icon="Plus" @click="openStaffDialog()">新增员工</el-button>
      </div>
    </div>

    <el-card shadow="never" class="org-card">
      <el-table :data="staffList" v-loading="loading" border stripe>
        <el-table-column prop="realName" label="姓名" width="110" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="mobile" label="手机号" width="130" />
        <el-table-column label="部门/门店" min-width="160">
          <template #default="{ row }">
            <div class="cell-lines">
              <span v-if="row.departmentName">{{ row.departmentName }}</span>
              <span v-if="row.storeName" class="muted">{{ row.storeName }}</span>
              <span v-if="!row.departmentName && !row.storeName" class="muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="positionName" label="职务" width="110">
          <template #default="{ row }">{{ row.positionName || "-" }}</template>
        </el-table-column>
        <el-table-column label="权限（角色）" min-width="150">
          <template #default="{ row }">
            <el-tag v-for="code in splitRoleCodes(row.roleCodes)" :key="code" size="small" class="role-tag">
              {{ roleLabel(code) }}
            </el-tag>
            <span v-if="!row.roleCodes" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openStaffDialog(row)">编辑</el-button>
            <el-button size="small" link type="warning" @click="openResetPassword(row)">重置密码</el-button>
            <el-button size="small" link :type="row.status === 1 ? 'danger' : 'success'" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? "停用" : "启用" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑员工 -->
    <el-dialog v-model="staffDialogVisible" :title="staffForm.id ? '编辑员工' : '新增员工'" width="560px">
      <el-form ref="staffFormRef" :model="staffForm" :rules="staffRules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="staffForm.username" placeholder="登录账号" :disabled="!!staffForm.id" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="staffForm.realName" placeholder="员工姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="staffForm.mobile" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="部门" prop="departmentId">
          <el-select v-model="staffForm.departmentId" placeholder="选择部门" clearable style="width: 100%">
            <el-option v-for="d in departmentOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="门店" prop="storeId">
          <el-select v-model="staffForm.storeId" placeholder="选择门店" clearable style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="职务" prop="positionId">
          <el-select v-model="staffForm.positionId" placeholder="选择岗位" clearable style="width: 100%">
            <el-option v-for="p in positionOptions" :key="p.id" :label="p.positionName" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色" prop="roleId">
          <el-select v-model="staffForm.roleId" placeholder="选择角色" clearable style="width: 100%" :disabled="staffForm.isBoss">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.roleName" :value="r.id" />
          </el-select>
          <div v-if="staffForm.isBoss" class="boss-tip">超级管理员为老板唯一账号，不可通过员工管理修改</div>
        </el-form-item>
        <el-form-item v-if="!staffForm.id" label="初始密码" prop="password">
          <el-input v-model="staffForm.password" placeholder="留空默认 123456" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="staffDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveStaff">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-width="90px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="resetForm.newPassword" placeholder="请输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleResetPassword">确认</el-button>
      </template>
    </el-dialog>

    <!-- 部门管理 -->
    <el-dialog v-model="departmentDialogVisible" title="部门管理" width="520px">
      <div class="mini-toolbar">
        <el-button size="small" type="primary" :icon="Plus" @click="openDepartmentEdit()">新增部门</el-button>
      </div>
      <el-table :data="departmentList" border size="small" max-height="380">
        <el-table-column prop="name" label="部门名称" min-width="120" />
        <el-table-column label="所属门店" min-width="120">
          <template #default="{ row }">{{ storeName(row.storeId) || "-" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDepartmentEdit(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDeleteDepartment(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="departmentEditVisible" :title="departmentForm.id ? '编辑部门' : '新增部门'" width="420px">
      <el-form :model="departmentForm" label-width="80px">
        <el-form-item label="部门名称">
          <el-input v-model="departmentForm.name" placeholder="部门名称" />
        </el-form-item>
        <el-form-item label="所属门店">
          <el-select v-model="departmentForm.storeId" clearable style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="departmentForm.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="departmentEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveDepartment">保存</el-button>
      </template>
    </el-dialog>

    <!-- 岗位管理 -->
    <el-dialog v-model="positionDialogVisible" title="岗位管理" width="520px">
      <div class="mini-toolbar">
        <el-button size="small" type="primary" :icon="Plus" @click="openPositionEdit()">新增岗位</el-button>
      </div>
      <el-table :data="positionList" border size="small" max-height="380">
        <el-table-column prop="positionName" label="岗位名称" min-width="120" />
        <el-table-column label="所属部门" min-width="120">
          <template #default="{ row }">{{ departmentName(row.departmentId) || "-" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openPositionEdit(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDeletePosition(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="positionEditVisible" :title="positionForm.id ? '编辑岗位' : '新增岗位'" width="420px">
      <el-form :model="positionForm" label-width="80px">
        <el-form-item label="岗位名称">
          <el-input v-model="positionForm.positionName" placeholder="岗位名称" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="positionForm.departmentId" style="width: 100%">
            <el-option v-for="d in departmentOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位级别">
          <el-select v-model="positionForm.level" style="width: 100%">
            <el-option label="初级" value="JUNIOR" />
            <el-option label="中级" value="MIDDLE" />
            <el-option label="高级" value="SENIOR" />
            <el-option label="管理" value="MANAGER" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="positionEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSavePosition">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  createStaff,
  updateStaff,
  toggleStaffStatus,
  resetEmployeePassword,
  fetchRoles,
  getDepartmentTree,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../api/system";
import { fetchPositions, createPosition, updatePosition, deletePosition } from "../../api/pos";
import { fetchStaff, fetchStores } from "../../api";

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const keyword = ref("");
const filterDepartment = ref<number | undefined>();

const staffList = ref<any[]>([]);
const departmentOptions = ref<any[]>([]);
const storeOptions = ref<any[]>([]);
const positionOptions = ref<any[]>([]);
const roleOptions = ref<any[]>([]);
const departmentList = ref<any[]>([]);
const positionList = ref<any[]>([]);

/* 员工表单 */
const staffDialogVisible = ref(false);
const staffFormRef = ref<FormInstance>();
const staffForm = reactive<any>({ id: 0, username: "", realName: "", mobile: "", departmentId: undefined, storeId: undefined, positionId: undefined, roleId: undefined, password: "", isBoss: false });
const staffRules: FormRules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  realName: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  mobile: [{ pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确", trigger: "blur" }],
};

/* 重置密码 */
const resetVisible = ref(false);
const resetFormRef = ref<FormInstance>();
const resetForm = reactive({ id: 0, newPassword: "" });
const resetRules: FormRules = {
  newPassword: [{ required: true, min: 8, message: "密码至少8位", trigger: "blur" }],
};

/* 部门 */
const departmentDialogVisible = ref(false);
const departmentEditVisible = ref(false);
const departmentForm = reactive<any>({ id: 0, name: "", storeId: undefined, sortOrder: 0 });

/* 岗位 */
const positionDialogVisible = ref(false);
const positionEditVisible = ref(false);
const positionForm = reactive<any>({ id: 0, positionName: "", departmentId: undefined, level: "JUNIOR" });

function splitRoleCodes(codes: string | null): string[] {
  return codes ? codes.split(",").filter(Boolean) : [];
}

function roleLabel(code: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: "超级管理员",
    OPERATION_ADMIN: "运营管理员",
    STORE_MANAGER: "门店店长",
    STORE_OPERATOR: "门店操作员",
    SALES_STAFF: "销售员",
    PURCHASE_STAFF: "采购员",
    WAREHOUSE_STAFF: "仓管员",
    FINANCE_STAFF: "财务",
    CUSTOMER_SERVICE: "客服",
    READONLY: "只读观察员",
  };
  return map[code] || code;
}

function storeName(id: any): string {
  return storeOptions.value.find((s) => String(s.id) === String(id))?.name || "";
}

function departmentName(id: any): string {
  return departmentOptions.value.find((d) => String(d.id) === String(id))?.name || "";
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchStaff();
    let list: any[] = data.records || [];
    if (filterDepartment.value) {
      list = list.filter((item) => String(item.departmentId) === String(filterDepartment.value));
    }
    if (keyword.value.trim()) {
      const kw = keyword.value.trim().toLowerCase();
      list = list.filter((item) =>
        [item.realName, item.username, item.mobile].some((v) => String(v || "").toLowerCase().includes(kw))
      );
    }
    staffList.value = list;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "加载员工失败");
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const [departments, stores, roles, positions] = await Promise.allSettled([
    getDepartmentTree(),
    fetchStores(),
    fetchRoles(),
    fetchPositions({ page: 1, pageSize: 100 }),
  ]);
  if (departments.status === "fulfilled") {
    departmentOptions.value = departments.value || [];
    departmentList.value = departments.value || [];
  }
  if (stores.status === "fulfilled") storeOptions.value = stores.value || [];
  if (roles.status === "fulfilled") {
    // 超级管理员为老板唯一账号，不参与员工授权
    roleOptions.value = (roles.value || []).filter((r: any) => r.roleCode !== "SUPER_ADMIN");
  }
  if (positions.status === "fulfilled") positionOptions.value = positions.value?.records || [];
}

/* 员工 */
function openStaffDialog(row?: any) {
  Object.assign(staffForm, {
    id: row?.staffId || 0,
    username: row?.username || "",
    realName: row?.realName || "",
    mobile: row?.mobile || "",
    departmentId: row?.departmentId ? Number(row.departmentId) : undefined,
    storeId: row?.storeId ? Number(row.storeId) : undefined,
    positionId: row?.positionId ? Number(row.positionId) : undefined,
    roleId: row?.roleIds ? Number(String(row.roleIds).split(",")[0]) : undefined,
    password: "",
    isBoss: row?.roleCodes ? String(row.roleCodes).includes("SUPER_ADMIN") : false,
  });
  staffDialogVisible.value = true;
}

async function handleSaveStaff() {
  if (!staffFormRef.value) return;
  await staffFormRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      const payload: any = {
        realName: staffForm.realName,
        mobile: staffForm.mobile,
        // 老板（超级管理员）角色不可通过员工管理修改
        roleId: staffForm.isBoss ? undefined : staffForm.roleId ? String(staffForm.roleId) : undefined,
        storeId: staffForm.storeId ?? undefined,
        departmentId: staffForm.departmentId ?? undefined,
        positionId: staffForm.positionId ?? undefined,
      };
      if (staffForm.id) {
        await updateStaff(staffForm.id, payload);
        ElMessage.success("员工已更新");
      } else {
        await createStaff({ ...payload, username: staffForm.username, password: staffForm.password || undefined });
        ElMessage.success("员工已创建");
      }
      staffDialogVisible.value = false;
      await loadData();
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || "保存失败");
    } finally {
      saving.value = false;
    }
  });
}

async function handleToggleStatus(row: any) {
  const next = row.status === 1 ? 0 : 1;
  try {
    await toggleStaffStatus(row.staffId, next);
    row.status = next;
    ElMessage.success(next === 1 ? "已启用" : "已停用");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "操作失败");
  }
}

function openResetPassword(row: any) {
  resetForm.id = row.staffId;
  resetForm.newPassword = "";
  resetVisible.value = true;
}

async function handleResetPassword() {
  if (!resetFormRef.value) return;
  await resetFormRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await resetEmployeePassword(resetForm.id, { newPassword: resetForm.newPassword });
      ElMessage.success("密码已重置");
      resetVisible.value = false;
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || "重置失败");
    } finally {
      saving.value = false;
    }
  });
}

/* 部门 */
function openDepartmentDialog() {
  loadDepartments();
  departmentDialogVisible.value = true;
}

async function loadDepartments() {
  const data = await getDepartmentTree();
  departmentList.value = data || [];
}

function openDepartmentEdit(row?: any) {
  Object.assign(departmentForm, { id: row?.id || 0, name: row?.name || "", storeId: row?.storeId ?? undefined, sortOrder: row?.sortOrder ?? 0 });
  departmentEditVisible.value = true;
}

async function handleSaveDepartment() {
  saving.value = true;
  try {
    if (departmentForm.id) {
      await updateDepartment(departmentForm.id, { name: departmentForm.name, storeId: departmentForm.storeId, sortOrder: departmentForm.sortOrder });
    } else {
      await createDepartment({ name: departmentForm.name, storeId: departmentForm.storeId, sortOrder: departmentForm.sortOrder });
    }
    ElMessage.success("保存成功");
    departmentEditVisible.value = false;
    await Promise.all([loadDepartments(), loadOptions()]);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleDeleteDepartment(row: any) {
  await ElMessageBox.confirm(`确定删除部门「${row.name}」？`, "提示", { type: "warning" });
  await deleteDepartment(row.id);
  ElMessage.success("已删除");
  await Promise.all([loadDepartments(), loadOptions()]);
}

/* 岗位 */
function openPositionDialog() {
  loadPositions();
  positionDialogVisible.value = true;
}

async function loadPositions() {
  const data = await fetchPositions({ page: 1, pageSize: 100 });
  positionList.value = data?.records || [];
}

function openPositionEdit(row?: any) {
  Object.assign(positionForm, {
    id: row?.id || 0,
    positionName: row?.positionName || "",
    departmentId: row?.departmentId ?? undefined,
    level: row?.level || "JUNIOR",
  });
  positionEditVisible.value = true;
}

async function handleSavePosition() {
  saving.value = true;
  try {
    if (positionForm.id) {
      await updatePosition(positionForm.id, { name: positionForm.positionName, departmentId: positionForm.departmentId, level: positionForm.level });
    } else {
      await createPosition({ name: positionForm.positionName, departmentId: positionForm.departmentId, level: positionForm.level });
    }
    ElMessage.success("保存成功");
    positionEditVisible.value = false;
    await Promise.all([loadPositions(), loadOptions()]);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleDeletePosition(row: any) {
  await ElMessageBox.confirm(`确定删除岗位「${row.positionName}」？`, "提示", { type: "warning" });
  await deletePosition(row.id);
  ElMessage.success("已删除");
  await Promise.all([loadPositions(), loadOptions()]);
}

onMounted(() => {
  loadData();
  loadOptions();
});
</script>

<style scoped>
.organization-page {
  padding: 16px;
}
.org-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.org-filters,
.org-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.org-card :deep(.el-card__body) {
  padding: 0;
}
.cell-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cell-lines .muted {
  font-size: 12px;
  color: var(--text-muted);
}
.muted {
  color: var(--text-muted);
}
.role-tag {
  margin-right: 4px;
}
.boss-tip {
  font-size: 12px;
  color: var(--color-warning);
  margin-top: 4px;
}
.mini-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
</style>
