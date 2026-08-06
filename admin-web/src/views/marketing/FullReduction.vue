<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <div class="toolbar-left">
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
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
            <el-tag size="small">{{ row.scope === 'ALL' ? '全部商品' : (row.scope === 'CATEGORY' ? '指定分类' : (row.scope === 'BRAND' ? '指定品牌' : '指定商品')) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="参与次数" width="80" align="center">
          <template #default="{ row }">{{ row.participantCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="toggleStatus(row, 'PAUSED')">停用</el-button>
            <el-button v-if="['DRAFT', 'PAUSED'].includes(row.status)" size="small" link type="success" @click="toggleStatus(row, 'ACTIVE')">启用</el-button>
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
      width="720px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="REDUCTION">满减</el-radio>
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
            <el-radio value="SKU">指定商品</el-radio>
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
import { Plus, Refresh, Delete } from "@element-plus/icons-vue";
import {
  fetchFullReductions,
  createFullReduction,
  updateFullReduction,
  deleteFullReduction,
  activateFullReduction,
  pauseFullReduction,
  getErrorMessage
} from "../../api";

const loading = ref(false);
const activities = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
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
  return `满${rule.threshold}减${rule.reduction}`;
}

/** 后端规则 JSON（minAmount/reduceAmount）转页面展示结构 */
function mapRules(rules: any) {
  let list: any[] = [];
  if (typeof rules === "string") {
    try { list = JSON.parse(rules); } catch { list = []; }
  } else if (Array.isArray(rules)) {
    list = rules;
  }
  return list.map((r: any) => ({
    threshold: Number(r.minAmount ?? r.threshold),
    reduction: Number(r.reduceAmount ?? r.reduction ?? 0),
    type: "REDUCTION"
  }));
}

/** 页面表单规则转后端字段（minAmount/reduceAmount） */
function toBackendRules() {
  return form.rules.map((r: any) => ({
    minAmount: Number(r.threshold),
    reduceAmount: Number(r.reduction || 0)
  }));
}

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (statusFilter.value) params.status = statusFilter.value;
    const data = await fetchFullReductions(params);
    activities.value = (data.records || []).map((item: any) => ({
      ...item,
      type: "REDUCTION",
      rules: mapRules(item.rules),
      scope: item.applicableScope || "ALL",
      startTime: item.startTime,
      endTime: item.endTime,
      participantCount: 0
    }));
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载满减活动失败"));
  } finally {
    loading.value = false;
  }
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
    form.stackable = row.stackable ? ["COUPON"] : [];
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
  try {
    const payload = {
      name: form.name,
      rules: toBackendRules(),
      applicableScope: form.scope,
      applicableIds: null,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      priority: 0,
      stackable: form.stackable.length > 0,
      description: form.description
    };
    if (isEdit.value && editingId.value) {
      await updateFullReduction(editingId.value, payload);
      ElMessage.success("修改成功");
    } else {
      await createFullReduction(payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, isEdit.value ? "修改失败" : "创建失败"));
  } finally {
    submitLoading.value = false;
  }
}

async function toggleStatus(row: any, newStatus: string) {
  const text = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确认${text}活动「${row.name}」？`, `确认${text}`, { type: "warning" });
    if (newStatus === "ACTIVE") {
      await activateFullReduction(row.id);
    } else {
      await pauseFullReduction(row.id);
    }
    ElMessage.success(`已${text}`);
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${text}失败`));
    }
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」？`, "确认删除", { type: "warning" });
    await deleteFullReduction(row.id);
    ElMessage.success("已删除");
    loadData();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, "删除失败"));
    }
  }
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