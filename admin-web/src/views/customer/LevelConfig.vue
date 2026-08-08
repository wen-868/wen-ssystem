<template>
  <div class="page-header">

    <div class="page-header-main">

      <h2 class="page-title">等级配置</h2>

      <p class="page-desc">会员等级配置</p>

    </div>

  </div>

    <div class="filter-bar">
      <el-button type="primary" @click="handleAddLevel">新建等级</el-button>
      <el-button @click="handleShowUpgradeRecords">升级记录</el-button>
      <el-button type="warning" @click="handleManualUpgrade">手动升级</el-button>
    </div>

    <div class="table-card">
<el-table :data="levels" v-loading="levelsLoading" stripe empty-text="暂无等级">
      <el-table-column prop="name" label="等级名称" min-width="120" />
      <el-table-column prop="minPoints" label="最低积分" width="100" />
      <el-table-column prop="maxPoints" label="最高积分" width="100" />
      <el-table-column prop="discountRate" label="折扣率" width="100">
        <template #default="{ row }">{{ row.discountRate }}%</template>
      </el-table-column>
      <el-table-column prop="benefits" label="权益描述" min-width="180" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="handleEditLevel(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="handleDeleteLevel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
</div>

    <!-- 等级弹窗 -->
    <el-dialog v-model="levelDialogVisible" :title="editingLevel ? '编辑等级' : '新建等级'" width="480px">
      <el-form ref="levelFormRef" :model="levelForm" :rules="levelRules" label-width="100px">
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="levelForm.name" />
        </el-form-item>
        <el-form-item label="最低积分" prop="minPoints">
          <el-input-number v-model="levelForm.minPoints" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最高积分" prop="maxPoints">
          <el-input-number v-model="levelForm.maxPoints" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="折扣率(%)" prop="discountRate">
          <el-input-number v-model="levelForm.discountRate" :min="0" :max="100" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="权益描述">
          <el-input v-model="levelForm.benefits" type="textarea" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="levelForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="levelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="levelSubmitLoading" @click="handleLevelSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 升级记录弹窗 -->
    <el-dialog v-model="upgradeRecordsVisible" title="升级记录" width="720px">
      <el-table :data="upgradeRecords" v-loading="upgradeRecordsLoading" stripe empty-text="暂无记录">
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="fromLevelName" label="原等级" width="120" />
        <el-table-column prop="toLevelName" label="新等级" width="120" />
        <el-table-column prop="reason" label="原因" min-width="140" />
        <el-table-column prop="createdAt" label="升级时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="upgradeRecordsTotal" :page-size="upgradeRecordsPageSize" :current-page="upgradeRecordsPage"
          @size-change="handleUpgradeRecordsSizeChange" @current-change="handleUpgradeRecordsPageChange"
        />
      </div>
    </el-dialog>

    <!-- 手动升级弹窗 -->
    <el-dialog v-model="manualUpgradeVisible" title="手动升级" width="480px">
      <el-form ref="manualUpgradeFormRef" :model="manualUpgradeForm" :rules="manualUpgradeRules" label-width="100px">
        <el-form-item label="选择客户" prop="customerId">
          <el-select v-model="manualUpgradeForm.customerId" filterable placeholder="搜索客户" style="width: 100%">
            <el-option v-for="m in members" :key="m.id" :label="m.name + ' (' + (m.mobile || '') + ')'" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标等级" prop="levelId">
          <el-select v-model="manualUpgradeForm.levelId" placeholder="选择等级" style="width: 100%">
            <el-option v-for="l in levels" :key="l.id" :label="l.name" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="manualUpgradeForm.reason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualUpgradeVisible = false">取消</el-button>
        <el-button type="primary" :loading="manualUpgradeSubmitLoading" @click="handleManualUpgradeSubmit">保存</el-button>
      </template>
    </el-dialog>
  
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { formatDate } from "../../utils/format";
import {
  fetchLevelConfigs, createLevelConfig, updateLevelConfig, deleteLevelConfig,
  fetchLevelUpgradeRecords, updateMemberLevel, fetchMembers
} from "../../api";

const levels = ref<any[]>([]);
const levelsLoading = ref(false);
const levelDialogVisible = ref(false);
const levelSubmitLoading = ref(false);
const levelFormRef = ref<FormInstance>();
const editingLevel = ref<any>(null);

const levelForm = reactive({
  name: "",
  minPoints: 0,
  maxPoints: 0,
  discountRate: 100,
  benefits: "",
  status: "active"
});

const levelRules: FormRules = {
  name: [{ required: true, message: "请输入等级名称", trigger: "blur" }],
  minPoints: [{ required: true, message: "请输入最低积分", trigger: "blur" }],
  maxPoints: [{ required: true, message: "请输入最高积分", trigger: "blur" }],
  discountRate: [{ required: true, message: "请输入折扣率", trigger: "blur" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.msg || e?.message || fallback;
}

async function loadLevels() {
  levelsLoading.value = true;
  try {
    const data = await fetchLevelConfigs();
    levels.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载等级配置失败"));
  } finally {
    levelsLoading.value = false;
  }
}

function handleAddLevel() {
  editingLevel.value = null;
  levelForm.name = "";
  levelForm.minPoints = 0;
  levelForm.maxPoints = 0;
  levelForm.discountRate = 100;
  levelForm.benefits = "";
  levelForm.status = "active";
  levelDialogVisible.value = true;
}

function handleEditLevel(row: any) {
  editingLevel.value = row;
  levelForm.name = row.name;
  levelForm.minPoints = row.minPoints;
  levelForm.maxPoints = row.maxPoints;
  levelForm.discountRate = row.discountRate;
  levelForm.benefits = row.benefits;
  levelForm.status = row.status;
  levelDialogVisible.value = true;
}

async function handleLevelSubmit() {
  if (!levelFormRef.value) return;
  await levelFormRef.value.validate(async (valid) => {
    if (!valid) return;
    levelSubmitLoading.value = true;
    try {
      if (editingLevel.value) {
        await updateLevelConfig(editingLevel.value.id, levelForm);
        ElMessage.success("等级已更新");
      } else {
        await createLevelConfig(levelForm);
        ElMessage.success("等级已创建");
      }
      levelDialogVisible.value = false;
      loadLevels();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "操作失败"));
    } finally {
      levelSubmitLoading.value = false;
    }
  });
}

async function handleDeleteLevel(row: any) {
  try {
    await deleteLevelConfig(row.id);
    ElMessage.success("等级已删除");
    loadLevels();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ── 升级记录 ──
const upgradeRecordsVisible = ref(false);
const upgradeRecords = ref<any[]>([]);
const upgradeRecordsLoading = ref(false);
const upgradeRecordsTotal = ref(0);
const upgradeRecordsPage = ref(1);
const upgradeRecordsPageSize = ref(20);

async function handleShowUpgradeRecords() {
  upgradeRecordsVisible.value = true;
  upgradeRecordsPage.value = 1;
  await loadUpgradeRecords();
}

async function loadUpgradeRecords() {
  upgradeRecordsLoading.value = true;
  try {
    const data = await fetchLevelUpgradeRecords({
      page: upgradeRecordsPage.value,
      pageSize: upgradeRecordsPageSize.value
    });
    upgradeRecords.value = data.records || [];
    upgradeRecordsTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载升级记录失败"));
  } finally {
    upgradeRecordsLoading.value = false;
  }
}

function handleUpgradeRecordsSizeChange(size: number) {
  upgradeRecordsPageSize.value = size;
  upgradeRecordsPage.value = 1;
  loadUpgradeRecords();
}

function handleUpgradeRecordsPageChange(p: number) {
  upgradeRecordsPage.value = p;
  loadUpgradeRecords();
}

// ── 手动升级 ──
const manualUpgradeVisible = ref(false);
const manualUpgradeSubmitLoading = ref(false);
const manualUpgradeFormRef = ref<FormInstance>();
const members = ref<any[]>([]);

const manualUpgradeForm = reactive({
  customerId: "",
  levelId: "",
  reason: ""
});

const manualUpgradeRules: FormRules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }],
  levelId: [{ required: true, message: "请选择目标等级", trigger: "change" }],
  reason: [{ required: true, message: "请输入升级原因", trigger: "blur" }]
};

async function handleManualUpgrade() {
  manualUpgradeVisible.value = true;
  manualUpgradeForm.customerId = "";
  manualUpgradeForm.levelId = "";
  manualUpgradeForm.reason = "";
  try {
    const data = await fetchMembers({});
    members.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户列表失败"));
  }
}

async function handleManualUpgradeSubmit() {
  if (!manualUpgradeFormRef.value) return;
  await manualUpgradeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    manualUpgradeSubmitLoading.value = true;
    try {
      await updateMemberLevel(Number(manualUpgradeForm.customerId), { levelId: Number(manualUpgradeForm.levelId), reason: manualUpgradeForm.reason });
      ElMessage.success("会员等级已更新");
      manualUpgradeVisible.value = false;
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "升级失败"));
    } finally {
      manualUpgradeSubmitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadLevels();
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
</style>