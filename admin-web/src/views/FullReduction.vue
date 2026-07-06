<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <div class="toolbar-left">
          <el-select v-model="typeFilter" placeholder="活动类型" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="满减" value="REDUCTION" />
            <el-option label="满赠" value="GIFT" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="未开始" value="PENDING" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="搜索活动名称"
            clearable
            style="width: 200px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="openDialog()">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>
            新建活动
          </el-button>
          <el-button @click="loadData">
            <el-icon style="margin-right: 4px"><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <el-table :data="activities" v-loading="loading" stripe>
        <el-table-column prop="name" label="活动名称" min-width="150" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'REDUCTION'" type="primary">满减</el-tag>
            <el-tag v-else type="success">满赠</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="规则" min-width="280">
          <template #default="{ row }">
            <div class="rules-cell">
              <el-tag v-for="(rule, i) in row.rules" :key="i" size="small" style="margin-right: 6px; margin-bottom: 4px">
                {{ getRuleText(rule) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
        </el-table-column>
        <el-table-column label="适用范围" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.scope === 'ALL' ? '全部商品' : (row.scope === 'CATEGORY' ? '指定分类' : '指定商品') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="参与次数" width="80" align="center">
          <template #default="{ row }">{{ row.participantCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">未开始</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="toggleStatus(row, 'PAUSED')">停用</el-button>
            <el-button v-if="['PENDING', 'PAUSED'].includes(row.status)" size="small" link type="success" @click="toggleStatus(row, 'ACTIVE')">启用</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="handleSizeChange" @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑活动' : '新建活动'"
      width="750px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-radio-group v-model="form.type" @change="onTypeChange">
            <el-radio value="REDUCTION">满减</el-radio>
            <el-radio value="GIFT">满赠</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="有效期" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="适用范围">
          <el-radio-group v-model="form.scope">
            <el-radio value="ALL">全部商品</el-radio>
            <el-radio value="CATEGORY">指定分类</el-radio>
            <el-radio value="PRODUCT">指定商品</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 阶梯规则 -->
        <el-form-item label="阶梯规则" prop="rules">
          <div class="rules-editor">
            <div v-for="(rule, i) in form.rules" :key="i" class="rule-row">
              <span class="rule-label">满</span>
              <el-input-number
                v-model="rule.threshold"
                :min="0.01"
                :precision="2"
                style="width: 120px"
                controls-position="right"
              />
              <span class="rule-label">元</span>
              <template v-if="form.type === 'REDUCTION'">
                <span class="rule-label">减</span>
                <el-input-number
                  v-model="rule.reduction"
                  :min="0.01"
                  :precision="2"
                  style="width: 120px"
                  controls-position="right"
                />
                <span class="rule-label">元</span>
              </template>
              <template v-else>
                <span class="rule-label">赠</span>
                <el-input v-model="rule.giftName" placeholder="赠品名称" style="width: 160px" />
                <span class="rule-label">×</span>
                <el-input-number v-model="rule.giftCount" :min="1" style="width: 80px" controls-position="right" />
              </template>
              <el-button size="small" link type="danger" @click="removeRule(i)" :disabled="form.rules.length <= 1">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button size="small" type="primary" link @click="addRule">
              <el-icon style="margin-right: 4px"><Plus /></el-icon>
              添加阶梯
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="叠加规则">
          <el-checkbox-group v-model="form.stackable">
            <el-checkbox value="COUPON">可与优惠券叠加</el-checkbox>
            <el-checkbox value="MEMBER">会员折扣叠加</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="活动描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="活动描述" />
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
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh, Delete } from "@element-plus/icons-vue";

const loading = ref(false);
const activities = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const typeFilter = ref("");
const statusFilter = ref("");

// ==================== 表单 ====================
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: "",
  type: "REDUCTION",
  timeRange: [] as any[],
  scope: "ALL",
  rules: [{ threshold: 100, reduction: 10, giftName: "", giftCount: 1 }] as any[],
  stackable: [] as string[],
  description: ""
});

const formRules: FormRules = {
  name: [{ required: true, message: "请输入活动名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择活动类型", trigger: "change" }],
  timeRange: [{ required: true, message: "请选择有效期", trigger: "change" }],
  rules: [{ required: true, message: "请至少设置一条阶梯规则", trigger: "blur" }]
};

function onTypeChange() {
  form.rules = [{ threshold: 100, reduction: form.type === "REDUCTION" ? 10 : 0, giftName: "", giftCount: 1 }];
}

function addRule() {
  const lastRule = form.rules[form.rules.length - 1];
  const newThreshold = (lastRule?.threshold || 0) + 50;
  form.rules.push({
    threshold: newThreshold,
    reduction: 0,
    giftName: "",
    giftCount: 1
  });
}

function removeRule(i: number) {
  form.rules.splice(i, 1);
}

function getRuleText(rule: any) {
  if (rule.type === 'REDUCTION' || (!rule.giftName && rule.reduction > 0)) {
    return `满${rule.threshold}减${rule.reduction}`;
  }
  return `满${rule.threshold}赠${rule.giftName}×${rule.giftCount || 1}`;
}

// ==================== Mock ====================
const mockActivities = Array.from({ length: 10 }, (_, i) => {
  const types = ["REDUCTION", "GIFT"];
  const statuses = ["PENDING", "ACTIVE", "ACTIVE", "ACTIVE", "PAUSED", "ENDED"];
  const type = types[i % 2];
  const rules = type === "REDUCTION"
    ? [
        { threshold: 100, reduction: 10, type: "REDUCTION" },
        { threshold: 200, reduction: 30, type: "REDUCTION" },
        { threshold: 500, reduction: 100, type: "REDUCTION" }
      ]
    : [
        { threshold: 100, giftName: "迷你酒版", giftCount: 1, type: "GIFT" },
        { threshold: 300, giftName: "开瓶器套装", giftCount: 1, type: "GIFT" },
        { threshold: 500, giftName: "定制酒杯", giftCount: 2, type: "GIFT" }
      ];
  return {
    id: i + 1,
    name: `${type === "REDUCTION" ? "满减" : "满赠"}活动-${i + 1}`,
    type,
    rules: rules.slice(0, (i % 3) + 1),
    startTime: "2026-06-01 00:00",
    endTime: "2026-08-31 23:59",
    scope: (["ALL", "CATEGORY", "PRODUCT"] as const)[i % 3],
    participantCount: Math.floor(Math.random() * 500) + 50,
    status: statuses[i % 6],
    description: ""
  };
});

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockActivities];
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(kw));
    }
    if (typeFilter.value) {
      filtered = filtered.filter(a => a.type === typeFilter.value);
    }
    if (statusFilter.value) {
      filtered = filtered.filter(a => a.status === statusFilter.value);
    }
    const start = (page.value - 1) * pageSize.value;
    activities.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleSizeChange(size: number) { pageSize.value = size; page.value = 1; loadData(); }
function handlePageChange(p: number) { page.value = p; loadData(); }

function openDialog(row?: any) {
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    form.name = row.name;
    form.type = row.type;
    form.timeRange = [row.startTime, row.endTime];
    form.scope = row.scope || "ALL";
    form.rules = JSON.parse(JSON.stringify(row.rules));
    form.stackable = [];
    form.description = row.description || "";
  } else {
    isEdit.value = false;
    editingId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.name = "";
  form.type = "REDUCTION";
  form.timeRange = [];
  form.scope = "ALL";
  form.rules = [{ threshold: 100, reduction: 10, giftName: "", giftCount: 1 }];
  form.stackable = [];
  form.description = "";
  formRef.value?.resetFields();
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  setTimeout(() => {
    const base = {
      name: form.name,
      type: form.type,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      scope: form.scope,
      rules: JSON.parse(JSON.stringify(form.rules)),
      description: form.description
    };
    if (isEdit.value && editingId.value) {
      const idx = mockActivities.findIndex(a => a.id === editingId.value);
      if (idx > -1) Object.assign(mockActivities[idx], base);
      ElMessage.success("修改成功");
    } else {
      const newId = Math.max(...mockActivities.map(a => a.id), 0) + 1;
      mockActivities.unshift({ id: newId, ...base, participantCount: 0, status: "PENDING" });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
    submitLoading.value = false;
  }, 500);
}

async function toggleStatus(row: any, newStatus: string) {
  const text = newStatus === "ACTIVE" ? "启用" : "停用";
  await ElMessageBox.confirm(`确认${text}活动「${row.name}」？`, `确认${text}`, { type: "warning" });
  row.status = newStatus;
  ElMessage.success(`已${text}`);
  loadData();
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确认删除活动「${row.name}」？`, "确认删除", { type: "warning" });
  const idx = mockActivities.findIndex(a => a.id === row.id);
  if (idx > -1) mockActivities.splice(idx, 1);
  ElMessage.success("已删除");
  loadData();
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.rules-cell { display: flex; flex-wrap: wrap; gap: 4px; }
.rules-editor { width: 100%; }
.rule-row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.rule-label { font-size: 13px; color: var(--el-text-color-secondary); white-space: nowrap; }
</style>