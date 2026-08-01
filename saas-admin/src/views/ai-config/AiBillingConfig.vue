<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.tenantId"
          placeholder="按租户 ID 过滤"
          clearable
          style="width: 240px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <div style="font-size: 12px; color: var(--text-muted); margin-left: auto;">
          套餐类型：按量后付 / 包月 / 预付费；月上限为 0 表示不限
        </div>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="tenantId" label="租户 ID" min-width="140" show-overflow-tooltip />
        <el-table-column label="套餐类型" width="110">
          <template #default="{ row }">
            <el-tag :type="planTypeTag(row.planType)" size="small">{{ planTypeLabel(row.planType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="freeChatCount" label="免费对话次数" width="110" align="right" />
        <el-table-column prop="freeTokenLimit" label="免费Token额度" width="120" align="right">
          <template #default="{ row }"><span class="mono">{{ formatNumber(row.freeTokenLimit) }}</span></template>
        </el-table-column>
        <el-table-column label="超额单价(元/千Token)" width="140" align="right">
          <template #default="{ row }"><span class="mono">{{ Number(row.overagePrice ?? 0).toFixed(6) }}</span></template>
        </el-table-column>
        <el-table-column prop="monthlyChatLimit" label="月对话上限" width="100" align="right" />
        <el-table-column prop="monthlyTokenLimit" label="月Token上限" width="110" align="right">
          <template #default="{ row }"><span class="mono">{{ formatNumber(row.monthlyTokenLimit) }}</span></template>
        </el-table-column>
        <el-table-column label="月费(元)" width="100" align="right">
          <template #default="{ row }"><span class="mono">{{ Number(row.monthlyPrice ?? 0).toFixed(2) }}</span></template>
        </el-table-column>
        <el-table-column label="启用状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">{{ row.enabled === 1 ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无计费套餐配置" />

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchList"
        />
      </div>
    </el-card>

    <!-- 编辑计费套餐 -->
    <el-dialog v-model="showEditDialog" :title="`编辑计费套餐 - ${editTarget?.tenantId ?? ''}`" width="560px" :close-on-click-modal="false">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="150px">
        <el-form-item label="套餐类型" prop="planType">
          <el-select v-model="editForm.planType" placeholder="请选择套餐类型" style="width: 100%;">
            <el-option label="按量后付" value="pay_as_you_go" />
            <el-option label="包月" value="monthly" />
            <el-option label="预付费" value="prepaid" />
          </el-select>
        </el-form-item>
        <el-form-item label="免费对话次数" prop="freeChatCount">
          <el-input-number v-model="editForm.freeChatCount" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="免费 Token 额度" prop="freeTokenLimit">
          <el-input-number v-model="editForm.freeTokenLimit" :min="0" :step="10000" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="超额单价(元/千Token)" prop="overagePrice">
          <el-input-number v-model="editForm.overagePrice" :min="0" :step="0.001" :precision="6" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="月对话上限(0=不限)" prop="monthlyChatLimit">
          <el-input-number v-model="editForm.monthlyChatLimit" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="月 Token 上限(0=不限)" prop="monthlyTokenLimit">
          <el-input-number v-model="editForm.monthlyTokenLimit" :min="0" :step="100000" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="月费(元)" prop="monthlyPrice">
          <el-input-number v-model="editForm.monthlyPrice" :min="0" :precision="2" :step="10" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="启用计费套餐">
          <el-switch v-model="editForm.enabled" active-value="1" inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  listAiBillings,
  updateTenantAiBilling,
  type TenantBillingItem,
  type UpdateTenantBillingPayload,
} from "../../api/ai-config";

/** 套餐类型标签映射 */
const PLAN_TYPE_MAP: Record<string, { label: string; tag: "success" | "info" | "warning" }> = {
  pay_as_you_go: { label: "按量后付", tag: "info" },
  monthly: { label: "包月", tag: "success" },
  prepaid: { label: "预付费", tag: "warning" },
};

function planTypeLabel(type: string): string {
  return PLAN_TYPE_MAP[type]?.label ?? (type || "-");
}

function planTypeTag(type: string): "success" | "info" | "warning" {
  return PLAN_TYPE_MAP[type]?.tag ?? "info";
}

function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString();
}

const loading = ref(false);
const saving = ref(false);
const list = ref<TenantBillingItem[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const searchForm = reactive({ tenantId: "" });

async function fetchList() {
  loading.value = true;
  try {
    const res = await listAiBillings({
      tenantId: searchForm.tenantId || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

// ==================== 编辑弹窗 ====================
const showEditDialog = ref(false);
const editFormRef = ref<FormInstance>();
const editTarget = ref<TenantBillingItem | null>(null);

/** 编辑弹窗表单模型（enabled 用字符串匹配 el-switch 的 active-value/inactive-value） */
interface BillingEditForm {
  planType: string;
  freeChatCount: number;
  freeTokenLimit: number;
  overagePrice: number;
  monthlyChatLimit: number;
  monthlyTokenLimit: number;
  monthlyPrice: number;
  enabled: "1" | "0";
}

const editForm = reactive<BillingEditForm>({
  planType: "pay_as_you_go",
  freeChatCount: 100,
  freeTokenLimit: 100000,
  overagePrice: 0.001,
  monthlyChatLimit: 0,
  monthlyTokenLimit: 0,
  monthlyPrice: 0,
  enabled: "1",
});

const editRules: FormRules = {
  planType: [{ required: true, message: "请选择套餐类型", trigger: "change" }],
};

function openEdit(row: TenantBillingItem) {
  editTarget.value = row;
  editForm.planType = row.planType;
  editForm.freeChatCount = Number(row.freeChatCount ?? 0);
  editForm.freeTokenLimit = Number(row.freeTokenLimit ?? 0);
  editForm.overagePrice = Number(row.overagePrice ?? 0);
  editForm.monthlyChatLimit = Number(row.monthlyChatLimit ?? 0);
  editForm.monthlyTokenLimit = Number(row.monthlyTokenLimit ?? 0);
  editForm.monthlyPrice = Number(row.monthlyPrice ?? 0);
  editForm.enabled = row.enabled === 1 ? "1" : "0";
  showEditDialog.value = true;
}

async function handleSave() {
  try {
    await editFormRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const payload: UpdateTenantBillingPayload = {
      planType: editForm.planType,
      freeChatCount: editForm.freeChatCount,
      freeTokenLimit: editForm.freeTokenLimit,
      overagePrice: editForm.overagePrice,
      monthlyChatLimit: editForm.monthlyChatLimit,
      monthlyTokenLimit: editForm.monthlyTokenLimit,
      monthlyPrice: editForm.monthlyPrice,
      enabled: editForm.enabled === "1" ? 1 : 0,
    };
    const saved = await updateTenantAiBilling(editTarget.value!.tenantId, payload);
    ElMessage.success("计费套餐已保存");
    showEditDialog.value = false;
    const idx = list.value.findIndex((r) => r.tenantId === saved.tenantId);
    if (idx >= 0) list.value[idx] = saved;
    else await fetchList();
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    saving.value = false;
  }
}

onMounted(fetchList);
</script>
