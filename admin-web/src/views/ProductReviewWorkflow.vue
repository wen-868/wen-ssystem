<template>
  <div class="page">
    <PageCard title="审核流程配置">
      <template #extra>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showCreateDialog">新建流程</el-button>
      </template>

      <div class="filter-bar">
        <el-input v-model="searchForm.keyword" placeholder="流程名称" clearable style="width: 200px" :prefix-icon="Search" />
        <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 140px; margin-left: 12px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="INACTIVE" />
        </el-select>
        <el-select v-model="searchForm.categoryId" placeholder="适用分类" clearable style="width: 180px; margin-left: 12px">
          <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.name" :value="cat.id" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="loadList">搜索</el-button>
        <el-button style="margin-left: 8px" @click="handleReset">重置</el-button>
      </div>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
      >
        <template #categoryNames="{ row }">
          <el-tag v-for="(name, idx) in row.categoryNames" :key="idx" size="small" style="margin-right: 4px; margin-bottom: 2px">
            {{ name }}
          </el-tag>
        </template>
        <template #levelCount="{ row }">
          <span>{{ row.levels?.length || 0 }}级审核</span>
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
            {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          <el-button size="small" link type="primary" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" link :type="row.status === 'ACTIVE' ? 'warning' : 'success'" @click="handleToggleStatus(row)">
            {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑审核流程' : '新建审核流程'" width="820px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="流程名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入流程名称" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="适用分类" prop="categoryIds">
          <el-select v-model="form.categoryIds" multiple placeholder="请选择适用的商品分类" style="width: 100%">
            <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="流程描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入流程描述" maxlength="200" show-word-limit />
        </el-form-item>

        <el-divider content-position="left">审核级次配置</el-divider>

        <div class="levels-config">
          <div v-for="(level, index) in form.levels" :key="index" class="level-item">
            <div class="level-header">
              <span class="level-badge">第{{ index + 1 }}级</span>
              <span class="level-title">{{ level.name || '审核节点' }}</span>
              <div class="level-actions">
                <el-button size="small" :disabled="index === 0" @click="moveLevel(index, -1)">
                  <el-icon><Top /></el-icon>
                </el-button>
                <el-button size="small" :disabled="index === form.levels.length - 1" @click="moveLevel(index, 1)">
                  <el-icon><Bottom /></el-icon>
                </el-button>
                <el-button size="small" type="danger" link :disabled="form.levels.length <= 1" @click="removeLevel(index)">删除</el-button>
              </div>
            </div>
            <div class="level-body">
              <el-form-item label="节点名称" :prop="`levels.${index}.name`">
                <el-input v-model="level.name" placeholder="如：一级审核" style="width: 180px" />
              </el-form-item>
              <el-form-item label="审核角色" :prop="`levels.${index}.role`">
                <el-select v-model="level.role" placeholder="请选择审核角色" style="width: 160px">
                  <el-option label="老板" value="BOSS" />
                  <el-option label="店长" value="MGR" />
                  <el-option label="财务" value="FIN" />
                  <el-option label="库管" value="STOCK" />
                  <el-option label="业务员" value="SALES" />
                </el-select>
              </el-form-item>
              <el-form-item label="审核人">
                <el-select v-model="level.approverId" placeholder="指定审核人(可选)" clearable filterable style="width: 160px">
                  <el-option v-for="u in userOptions" :key="u.id" :label="u.name" :value="u.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="审核时限">
                <el-input-number v-model="level.timeLimitHours" :min="1" :max="720" style="width: 120px" />
                <span style="margin-left: 6px; color: #909399">小时</span>
              </el-form-item>
            </div>
          </div>
          <el-button type="primary" plain :disabled="form.levels.length >= 5" @click="addLevel" style="width: 100%">
            + 添加审核级别（最多5级）
          </el-button>
        </div>

        <el-form-item label="状态">
          <el-switch v-model="form.status" active-value="ACTIVE" inactive-value="INACTIVE" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>

    <!-- 流程详情弹窗 -->
    <el-dialog v-model="detailVisible" title="审核流程详情" width="720px" :close-on-click-modal="false">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="流程名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detail.status === 'ACTIVE' ? 'success' : 'info'" size="small">
            {{ detail.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="适用分类" :span="2">
          <el-tag v-for="(name, idx) in detail.categoryNames" :key="idx" size="small" style="margin-right: 4px">
            {{ name }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
        <el-descriptions-item label="流程描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">审核流程图</el-divider>
      <WorkflowFlowChart :levels="detail.levels" :current-level="-1" />

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Top, Bottom } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";
import WorkflowFlowChart from "../views/components/WorkflowFlowChart.vue";

// ==================== Mock 数据 ====================
const categoryOptions = [
  { id: 1, name: "白酒" },
  { id: 2, name: "啤酒" },
  { id: 3, name: "葡萄酒" },
  { id: 4, name: "洋酒" },
  { id: 5, name: "饮料" },
  { id: 6, name: "香烟" },
  { id: 7, name: "零食" }
];

const userOptions = [
  { id: 1, name: "张经理", role: "MGR" },
  { id: 2, name: "李财务", role: "FIN" },
  { id: 3, name: "王老板", role: "BOSS" },
  { id: 4, name: "赵库管", role: "STOCK" },
  { id: 5, name: "孙业务", role: "SALES" }
];

const mockRecords = [
  {
    id: 1,
    name: "商品新增审核流程",
    categoryIds: [1, 2, 3],
    categoryNames: ["白酒", "啤酒", "葡萄酒"],
    levels: [
      { name: "一级审核", role: "MGR", approverId: 1, approverName: "张经理", timeLimitHours: 24 },
      { name: "二级审核", role: "FIN", approverId: 2, approverName: "李财务", timeLimitHours: 48 },
      { name: "三级审核", role: "BOSS", approverId: 3, approverName: "王老板", timeLimitHours: 72 }
    ],
    status: "ACTIVE",
    description: "新增商品时需要经过店长、财务、老板三级审核",
    createdAt: "2026-07-01 10:00:00",
    updatedAt: "2026-07-10 14:30:00"
  },
  {
    id: 2,
    name: "价格变更审核流程",
    categoryIds: [1, 2],
    categoryNames: ["白酒", "啤酒"],
    levels: [
      { name: "一级审核", role: "MGR", approverId: 1, approverName: "张经理", timeLimitHours: 12 },
      { name: "二级审核", role: "BOSS", approverId: 3, approverName: "王老板", timeLimitHours: 24 }
    ],
    status: "ACTIVE",
    description: "商品价格变更需要店长和老板两级审核",
    createdAt: "2026-07-02 09:00:00",
    updatedAt: "2026-07-08 16:20:00"
  },
  {
    id: 3,
    name: "商品下架审核流程",
    categoryIds: [4, 5, 6, 7],
    categoryNames: ["洋酒", "饮料", "香烟", "零食"],
    levels: [
      { name: "一级审核", role: "MGR", approverId: 1, approverName: "张经理", timeLimitHours: 6 }
    ],
    status: "INACTIVE",
    description: "商品下架只需要店长一级审核",
    createdAt: "2026-07-03 11:00:00",
    updatedAt: "2026-07-05 08:00:00"
  }
];

// ==================== 数据状态 ====================
const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const searchForm = reactive({
  keyword: "",
  status: "",
  categoryId: null as number | null
});

const columns = [
  { prop: "name", label: "流程名称", minWidth: 180 },
  { prop: "categoryNames", label: "适用分类", minWidth: 200, slot: "categoryNames" },
  { prop: "levelCount", label: "审核级数", width: 110, slot: "levelCount" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "createdAt", label: "创建时间", width: 170 },
  { prop: "updatedAt", label: "更新时间", width: 170 },
  { label: "操作", width: 220, fixed: "right", slot: "actions" }
];

// ==================== 弹窗状态 ====================
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref();
const detail = ref<any>({});

const form = reactive({
  name: "",
  categoryIds: [] as number[],
  description: "",
  levels: [
    { name: "一级审核", role: "", approverId: null as number | null, timeLimitHours: 24 }
  ],
  status: "ACTIVE"
});

const rules = {
  name: [{ required: true, message: "请输入流程名称", trigger: "blur" }],
  categoryIds: [{ required: true, message: "请选择适用分类", trigger: "change" }]
};

// ==================== 方法 ====================
function loadList() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockRecords];
    if (searchForm.keyword) {
      filtered = filtered.filter(r => r.name.includes(searchForm.keyword!));
    }
    if (searchForm.status) {
      filtered = filtered.filter(r => r.status === searchForm.status);
    }
    if (searchForm.categoryId) {
      filtered = filtered.filter(r => r.categoryIds.includes(searchForm.categoryId!));
    }
    records.value = filtered;
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.categoryId = null;
  loadList();
}

function showCreateDialog() {
  isEdit.value = false;
  editId.value = null;
  form.name = "";
  form.categoryIds = [];
  form.description = "";
  form.levels = [{ name: "一级审核", role: "", approverId: null, timeLimitHours: 24 }];
  form.status = "ACTIVE";
  dialogVisible.value = true;
}

function showEditDialog(row: any) {
  isEdit.value = true;
  editId.value = row.id;
  form.name = row.name;
  form.categoryIds = [...row.categoryIds];
  form.description = row.description || "";
  form.levels = row.levels.map((l: any) => ({
    name: l.name,
    role: l.role,
    approverId: l.approverId,
    timeLimitHours: l.timeLimitHours
  }));
  form.status = row.status;
  dialogVisible.value = true;
}

function viewDetail(row: any) {
  detail.value = row;
  detailVisible.value = true;
}

function addLevel() {
  if (form.levels.length >= 5) return;
  const idx = form.levels.length + 1;
  form.levels.push({
    name: `第${idx}级审核`,
    role: "",
    approverId: null,
    timeLimitHours: 24
  });
}

function removeLevel(index: number) {
  if (form.levels.length <= 1) return;
  form.levels.splice(index, 1);
  form.levels.forEach((l, i) => {
    if (!l.name || l.name.startsWith("第")) {
      l.name = `第${i + 1}级审核`;
    }
  });
}

function moveLevel(index: number, direction: number) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= form.levels.length) return;
  const temp = form.levels[index];
  form.levels[index] = form.levels[newIndex];
  form.levels[newIndex] = temp;
}

function handleSubmit() {
  formRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    submitLoading.value = true;
    setTimeout(() => {
      if (isEdit.value) {
        const idx = mockRecords.findIndex(r => r.id === editId.value);
        if (idx > -1) {
          mockRecords[idx] = {
            ...mockRecords[idx],
            name: form.name,
            categoryIds: [...form.categoryIds],
            categoryNames: form.categoryIds.map(id => categoryOptions.find(c => c.id === id)?.name || "").filter(Boolean),
            description: form.description,
            levels: form.levels.map(l => ({
              ...l,
              approverName: userOptions.find(u => u.id === l.approverId)?.name || ""
            })),
            status: form.status,
            updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
          };
        }
        ElMessage.success("更新成功");
      } else {
        const newId = Math.max(...mockRecords.map(r => r.id)) + 1;
        mockRecords.unshift({
          id: newId,
          name: form.name,
          categoryIds: [...form.categoryIds],
          categoryNames: form.categoryIds.map(id => categoryOptions.find(c => c.id === id)?.name || "").filter(Boolean),
          description: form.description,
          levels: form.levels.map(l => ({
            ...l,
            approverName: userOptions.find(u => u.id === l.approverId)?.name || ""
          })),
          status: form.status,
          createdAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
          updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
        });
        ElMessage.success("创建成功");
      }
      submitLoading.value = false;
      dialogVisible.value = false;
      loadList();
    }, 400);
  });
}

function handleToggleStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const action = newStatus === "ACTIVE" ? "启用" : "停用";
  ElMessageBox.confirm(`确定要${action}该审核流程吗？`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    row.status = newStatus;
    row.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
    ElMessage.success(`${action}成功`);
    loadList();
  }).catch(() => {});
}

function handleDelete(row: any) {
  ElMessageBox.confirm("确定要删除该审核流程吗？删除后不可恢复。", "警告", {
    confirmButtonText: "删除",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    const idx = mockRecords.findIndex(r => r.id === row.id);
    if (idx > -1) mockRecords.splice(idx, 1);
    ElMessage.success("删除成功");
    loadList();
  }).catch(() => {});
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.levels-config {
  padding: 0 8px;
}

.level-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.level-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.level-badge {
  display: inline-block;
  padding: 2px 10px;
  background: #409eff;
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 12px;
}

.level-title {
  flex: 1;
  font-weight: 500;
  color: #303133;
}

.level-actions {
  display: flex;
  gap: 4px;
}

.level-body {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
}

.level-body .el-form-item {
  margin-bottom: 0;
}
</style>
