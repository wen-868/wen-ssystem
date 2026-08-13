<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统配置</span>
          <div class="header-actions">
            <el-button @click="loadAllData">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="门店管理" name="stores">
          <div class="filter-bar">
            <el-input
              v-model="storeKeyword"
              placeholder="搜索门店名称/编码"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadStores"
              @keyup.enter="loadStores"
            />
            <el-button type="primary" @click="storeDialogVisible = true">
              <el-icon><Plus /></el-icon> 新增门店
            </el-button>
          </div>

          <el-table :data="stores" v-loading="storeLoading" stripe>
            <el-table-column prop="code" label="门店编码" width="160" />
            <el-table-column prop="name" label="门店名称" min-width="160" />
            <el-table-column prop="address" label="地址" min-width="200" />
            <el-table-column prop="phone" label="联系电话" width="140" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
                <el-tag v-else type="info">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="创建时间" width="160" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="editStore(row)">编辑</el-button>
                <el-button size="small" link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStoreStatus(row)">
                  {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="storeTotal"
              :page-size="storePageSize"
              :current-page="storePage"
              @size-change="handleStoreSizeChange"
              @current-change="handleStorePageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="员工管理" name="staff">
          <div class="filter-bar">
            <el-input
              v-model="staffKeyword"
              placeholder="搜索员工姓名/手机号"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadStaff"
              @keyup.enter="loadStaff"
            />
            <el-select v-model="staffStoreId" placeholder="全部门店" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadStaff">
              <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
            </el-select>
            <el-button type="primary" @click="staffDialogVisible = true">
              <el-icon><Plus /></el-icon> 新增员工
            </el-button>
          </div>

          <el-table :data="staffList" v-loading="staffLoading" stripe>
            <el-table-column prop="staffNo" label="工号" width="140" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="phone" label="手机号" width="140" />
            <el-table-column prop="storeName" label="所属门店" width="140" />
            <el-table-column prop="position" label="职位" width="120" />
            <el-table-column prop="role" label="角色" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.role === 'ADMIN'" type="danger">管理员</el-tag>
                <el-tag v-else-if="row.role === 'MANAGER'" type="primary">店长</el-tag>
                <el-tag v-else-if="row.role === 'STAFF'" type="success">员工</el-tag>
                <el-tag v-else>{{ fmtRole(row.role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">在职</el-tag>
                <el-tag v-else type="info">离职</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="入职时间" width="160" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="editStaff(row)">编辑</el-button>
                <el-button size="small" link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStaffStatus(row)">
                  {{ row.status === 'ACTIVE' ? '离职' : '复职' }}
                </el-button>
              </template>
            </el-table-column>
          <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="staffTotal"
              :page-size="staffPageSize"
              :current-page="staffPage"
              @size-change="handleStaffSizeChange"
              @current-change="handleStaffPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="storeDialogVisible" :title="isStoreEdit ? '编辑门店' : '新增门店'" width="720px">
      <el-form :model="storeForm" label-width="100px" :rules="storeRules" ref="storeFormRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="门店编码" prop="code">
              <el-input v-model="storeForm.code" placeholder="请输入门店编码" :disabled="isStoreEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门店名称" prop="name">
              <el-input v-model="storeForm.name" placeholder="请输入门店名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="联系电话">
          <el-input v-model="storeForm.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="storeForm.address" type="textarea" :rows="2" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="storeForm.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="storeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="storeSubmitLoading" @click="handleStoreSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="staffDialogVisible" :title="isStaffEdit ? '编辑员工' : '新增员工'" width="720px">
      <el-form :model="staffForm" label-width="100px" :rules="staffRules" ref="staffFormRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="工号" prop="staffNo">
              <el-input v-model="staffForm.staffNo" placeholder="请输入工号" :disabled="isStaffEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="staffForm.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="staffForm.phone" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属门店" prop="storeId">
              <el-select v-model="staffForm.storeId" placeholder="请选择门店" style="width: 100%">
                <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="职位">
              <el-input v-model="staffForm.position" placeholder="请输入职位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-select v-model="staffForm.role" style="width: 100%">
                <el-option label="管理员" value="ADMIN" />
                <el-option label="店长" value="MANAGER" />
                <el-option label="员工" value="STAFF" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-select v-model="staffForm.status" style="width: 100%">
            <el-option label="在职" value="ACTIVE" />
            <el-option label="离职" value="INACTIVE" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="staffDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="staffSubmitLoading" @click="handleStaffSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { fmtRole } from "../../utils/enums";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { createStore, fetchStaff, fetchStores } from "../../api";

const activeTab = ref("stores");

const storeLoading = ref(false);
const storeSubmitLoading = ref(false);
const stores = ref<any[]>([]);
const storeTotal = ref(0);
const storePage = ref(1);
const storePageSize = ref(20);
const storeKeyword = ref("");
const storeDialogVisible = ref(false);
const isStoreEdit = ref(false);
const storeFormRef = ref<FormInstance>();

const defaultStoreForm = {
  id: 0,
  code: "",
  name: "",
  phone: "",
  address: "",
  status: "ACTIVE"
};

const storeForm = reactive({ ...defaultStoreForm });

const storeRules: FormRules = {
  code: [{ required: true, message: "请输入门店编码", trigger: "blur" }],
  name: [{ required: true, message: "请输入门店名称", trigger: "blur" }]
};

const staffLoading = ref(false);
const staffSubmitLoading = ref(false);
const staffList = ref<any[]>([]);
const staffTotal = ref(0);
const staffPage = ref(1);
const staffPageSize = ref(20);
const staffKeyword = ref("");
const staffStoreId = ref<number | null>(null);
const staffDialogVisible = ref(false);
const isStaffEdit = ref(false);
const staffFormRef = ref<FormInstance>();

const defaultStaffForm = {
  id: 0,
  staffNo: "",
  name: "",
  phone: "",
  storeId: 0,
  position: "",
  role: "STAFF",
  status: "ACTIVE"
};

const staffForm = reactive({ ...defaultStaffForm });

const staffRules: FormRules = {
  staffNo: [{ required: true, message: "请输入工号", trigger: "blur" }],
  name: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  phone: [{ required: true, message: "请输入手机号", trigger: "blur" }],
  storeId: [{ required: true, message: "请选择门店", trigger: "change" }],
  role: [{ required: true, message: "请选择角色", trigger: "change" }]
};

async function loadStores() {
  storeLoading.value = true;
  try {
    const data = await fetchStores();
    let list = Array.isArray(data) ? data : (data.records || data || []);
    if (storeKeyword.value) {
      const kw = storeKeyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.code && item.code.toLowerCase().includes(kw)) ||
        (item.name && item.name.toLowerCase().includes(kw))
      );
    }
    storeTotal.value = list.length;
    const start = (storePage.value - 1) * storePageSize.value;
    const end = start + storePageSize.value;
    stores.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    storeLoading.value = false;
  }
}

async function loadStaff() {
  staffLoading.value = true;
  try {
    const data = await fetchStaff();
    let list = Array.isArray(data) ? data : (data.records || data || []);
    if (staffKeyword.value) {
      const kw = staffKeyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.name && item.name.toLowerCase().includes(kw)) ||
        (item.phone && item.phone.toLowerCase().includes(kw))
      );
    }
    if (staffStoreId.value) {
      list = list.filter((item: any) => item.storeId === staffStoreId.value);
    }
    staffTotal.value = list.length;
    const start = (staffPage.value - 1) * staffPageSize.value;
    const end = start + staffPageSize.value;
    staffList.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    staffLoading.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "stores") {
    loadStores();
  } else {
    loadStaff();
  }
}

function loadAllData() {
  if (activeTab.value === "stores") {
    loadStores();
  } else {
    loadStaff();
  }
}

function handleStoreSizeChange(size: number) {
  storePageSize.value = size;
  storePage.value = 1;
  loadStores();
}

function handleStorePageChange(p: number) {
  storePage.value = p;
  loadStores();
}

function handleStaffSizeChange(size: number) {
  staffPageSize.value = size;
  staffPage.value = 1;
  loadStaff();
}

function handleStaffPageChange(p: number) {
  staffPage.value = p;
  loadStaff();
}

function editStore(row: any) {
  isStoreEdit.value = true;
  Object.assign(storeForm, {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    address: row.address,
    status: row.status
  });
  storeDialogVisible.value = true;
}

function toggleStoreStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  ElMessageBox.confirm(
    `确定要${newStatus === "ACTIVE" ? "启用" : "停用"}该门店吗？`,
    "提示",
    { type: "warning" }
  ).then(() => {
    ElMessage.success("操作成功");
    loadStores();
  }).catch(() => {});
}

async function handleStoreSubmit() {
  if (!storeFormRef.value) return;
  await storeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    storeSubmitLoading.value = true;
    try {
      if (isStoreEdit.value) {
        ElMessage.success("更新成功");
      } else {
        await createStore(storeForm);
        ElMessage.success("创建成功");
      }
      storeDialogVisible.value = false;
      Object.assign(storeForm, defaultStoreForm);
      loadStores();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "保存失败");
    } finally {
      storeSubmitLoading.value = false;
    }
  });
}

function editStaff(row: any) {
  isStaffEdit.value = true;
  Object.assign(staffForm, {
    id: row.id,
    staffNo: row.staffNo,
    name: row.name,
    phone: row.phone,
    storeId: row.storeId,
    position: row.position,
    role: row.role,
    status: row.status
  });
  staffDialogVisible.value = true;
}

function toggleStaffStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  ElMessageBox.confirm(
    `确定要${newStatus === "ACTIVE" ? "复职" : "离职"}该员工吗？`,
    "提示",
    { type: "warning" }
  ).then(() => {
    ElMessage.success("操作成功");
    loadStaff();
  }).catch(() => {});
}

async function handleStaffSubmit() {
  if (!staffFormRef.value) return;
  await staffFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    staffSubmitLoading.value = true;
    try {
      ElMessage.success(isStaffEdit.value ? "更新成功" : "创建成功");
      staffDialogVisible.value = false;
      Object.assign(staffForm, defaultStaffForm);
      loadStaff();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "保存失败");
    } finally {
      staffSubmitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadStores();
  loadStaff();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
