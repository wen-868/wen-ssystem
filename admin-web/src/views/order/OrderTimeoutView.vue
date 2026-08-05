<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单超时</span>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="6">
          <el-statistic title="今日超时订单" :value="statistics.todayTimeout || 0" value-style="color: var(--color-danger)" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="超时规则数" :value="statistics.configCount || 0" value-style="color: var(--color-primary)" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="本周处理数" :value="statistics.weekHandled || 0" value-style="color: var(--color-success)" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="自动取消数" :value="statistics.autoCancel || 0" value-style="color: var(--color-warning)" />
        </el-col>
      </el-row>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="超时配置" name="configs">
          <div class="tab-toolbar">
            <el-button type="primary" @click="configDialogVisible = true">新增配置</el-button>
            <el-button @click="loadConfigs">刷新</el-button>
          </div>

          <el-table :data="configs" v-loading="configLoading" stripe>
            <el-table-column prop="orderType" label="订单类型" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.orderType === 'NORMAL'" type="primary">普通订单</el-tag>
                <el-tag v-else-if="row.orderType === 'GROUP_BUY'" type="success">拼团订单</el-tag>
                <el-tag v-else-if="row.orderType === 'FLASH_SALE'" type="warning">秒杀订单</el-tag>
                <el-tag v-else>{{ row.orderType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="timeoutType" label="超时类型" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.timeoutType === 'PAYMENT'" type="warning">付款超时</el-tag>
                <el-tag v-else-if="row.timeoutType === 'SHIPMENT'" type="primary">发货超时</el-tag>
                <el-tag v-else-if="row.timeoutType === 'RECEIPT'" type="info">收货超时</el-tag>
                <el-tag v-else>{{ row.timeoutType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="timeoutMinutes" label="超时时间(分钟)" width="140" />
            <el-table-column prop="action" label="超时动作" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.action === 'CANCEL'" type="danger">自动取消</el-tag>
                <el-tag v-else-if="row.action === 'REMIND'" type="warning">提醒通知</el-tag>
                <el-tag v-else-if="row.action === 'COMPLETE'" type="success">自动完成</el-tag>
                <el-tag v-else>{{ row.action }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.enabled" type="success">已启用</el-tag>
                <el-tag v-else type="info">已禁用</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="160" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="editConfig(row)">编辑</el-button>
                <el-button size="small" link :type="row.enabled ? 'warning' : 'success'" @click="toggleConfig(row)">
                  {{ row.enabled ? '禁用' : '启用' }}
                </el-button>
                <el-button size="small" link type="danger" @click="deleteConfig(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="超时日志" name="logs">
          <div class="tab-toolbar">
            <el-select v-model="logResult" placeholder="处理结果" size="default" style="width: 130px; margin-right: 10px" clearable @change="loadLogs">
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="FAILED" />
            </el-select>
            <el-date-picker
              v-model="logDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="width: 280px; margin-right: 10px"
              value-format="YYYY-MM-DD"
            />
            <el-button @click="loadLogs">搜索</el-button>
            <el-button @click="loadLogs">刷新</el-button>
          </div>

          <el-table :data="logs" v-loading="logLoading" stripe>
            <el-table-column prop="id" label="日志ID" width="80" />
            <el-table-column prop="orderNo" label="订单号" width="200" />
            <el-table-column prop="orderType" label="订单类型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.orderType === 'NORMAL'" type="primary">普通订单</el-tag>
                <el-tag v-else-if="row.orderType === 'GROUP_BUY'" type="success">拼团订单</el-tag>
                <el-tag v-else-if="row.orderType === 'FLASH_SALE'" type="warning">秒杀订单</el-tag>
                <el-tag v-else>{{ row.orderType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="timeoutType" label="超时类型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.timeoutType === 'PAYMENT'" type="warning">付款超时</el-tag>
                <el-tag v-else-if="row.timeoutType === 'SHIPMENT'" type="primary">发货超时</el-tag>
                <el-tag v-else-if="row.timeoutType === 'RECEIPT'" type="info">收货超时</el-tag>
                <el-tag v-else>{{ row.timeoutType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="action" label="执行动作" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.action === 'CANCEL'" type="danger">自动取消</el-tag>
                <el-tag v-else-if="row.action === 'REMIND'" type="warning">提醒通知</el-tag>
                <el-tag v-else-if="row.action === 'COMPLETE'" type="success">自动完成</el-tag>
                <el-tag v-else>{{ row.action }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="result" label="结果" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.result === 'SUCCESS'" type="success">成功</el-tag>
                <el-tag v-else type="danger">失败</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorMsg" label="失败原因" min-width="160" />
            <el-table-column prop="createdAt" label="执行时间" width="170" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="logTotal"
              :page-size="logPageSize"
              :current-page="logPage"
              @size-change="handleLogSizeChange"
              @current-change="handleLogPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="configDialogVisible" :title="editingConfig ? '编辑配置' : '新增配置'" width="480px">
      <el-form ref="configFormRef" :model="configForm" :rules="configRules" label-width="120px">
        <el-form-item label="订单类型" prop="orderType">
          <el-select v-model="configForm.orderType" style="width: 100%">
            <el-option label="普通订单" value="NORMAL" />
            <el-option label="拼团订单" value="GROUP_BUY" />
            <el-option label="秒杀订单" value="FLASH_SALE" />
          </el-select>
        </el-form-item>
        <el-form-item label="超时类型">
          <el-select v-model="configForm.timeoutType" style="width: 100%">
            <el-option label="付款超时" value="PAYMENT" />
            <el-option label="发货超时" value="SHIPMENT" />
            <el-option label="收货超时" value="RECEIPT" />
          </el-select>
        </el-form-item>
        <el-form-item label="超时时间(分钟)">
          <el-input-number v-model="configForm.timeoutMinutes" :min="1" :max="10080" style="width: 100%" />
        </el-form-item>
        <el-form-item label="超时动作">
          <el-select v-model="configForm.action" style="width: 100%">
            <el-option label="自动取消订单" value="CANCEL" />
            <el-option label="发送提醒通知" value="REMIND" />
            <el-option label="自动完成订单" value="COMPLETE" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="configForm.enabled" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="configForm.description" type="textarea" :rows="2" placeholder="请输入配置说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSubmitLoading" @click="submitConfig">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchOrderTimeoutConfigs,
  createOrderTimeoutConfig,
  updateOrderTimeoutConfig,
  deleteOrderTimeoutConfig,
  fetchOrderTimeoutLogs,
  fetchOrderTimeoutStatistics,
} from "../../api";

const activeTab = ref("configs");
const statistics = ref<any>({});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

function handleTabChange() {
  if (activeTab.value === "configs" && configs.value.length === 0) loadConfigs();
  if (activeTab.value === "logs" && logs.value.length === 0) loadLogs();
}

// ==================== Configs ====================
const configLoading = ref(false);
const configSubmitLoading = ref(false);
const configs = ref<any[]>([]);
const configDialogVisible = ref(false);
const configFormRef = ref();
const editingConfig = ref<any>(null);

const configForm = reactive({
  orderType: "NORMAL",
  timeoutType: "PAYMENT",
  timeoutMinutes: 30,
  action: "CANCEL",
  enabled: true,
  description: "",
});

const configRules = {
  orderType: [{ required: true, message: '请选择订单类型', trigger: 'change' }],
  timeoutType: [{ required: true, message: '请选择超时类型', trigger: 'change' }],
  timeoutMinutes: [{ required: true, message: '请输入超时时间', trigger: 'blur' }],
  action: [{ required: true, message: '请选择超时动作', trigger: 'change' }]
};

async function loadStatistics() {
  try {
    const data = await fetchOrderTimeoutStatistics();
    statistics.value = data || {};
  } catch (e) {
    // ignore
  }
}

async function loadConfigs() {
  configLoading.value = true;
  try {
    const data = await fetchOrderTimeoutConfigs();
    configs.value = data || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载超时配置失败"));
  } finally {
    configLoading.value = false;
  }
}

function editConfig(row: any) {
  editingConfig.value = row;
  configForm.orderType = row.orderType;
  configForm.timeoutType = row.timeoutType;
  configForm.timeoutMinutes = row.timeoutMinutes;
  configForm.action = row.action;
  configForm.enabled = row.enabled;
  configForm.description = row.description || "";
  configDialogVisible.value = true;
}

async function toggleConfig(row: any) {
  const action = row.enabled ? "禁用" : "启用";
  const confirmed = await ElMessageBox.confirm(
    `确认${action}此超时配置?`,
    `确认${action}`,
    { type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;
  try {
    await updateOrderTimeoutConfig(row.id, { enabled: !row.enabled });
    ElMessage.success(`${action}成功`);
    loadConfigs();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function deleteConfig(row: any) {
  const confirmed = await ElMessageBox.confirm(
    "确认删除此超时配置?",
    "确认删除",
    { type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteOrderTimeoutConfig(row.id);
    ElMessage.success("已删除");
    loadConfigs();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

async function submitConfig() {
  const valid = await configFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  configSubmitLoading.value = true;
  try {
    if (editingConfig.value) {
      await updateOrderTimeoutConfig(editingConfig.value.id, configForm);
      ElMessage.success("更新成功");
    } else {
      await createOrderTimeoutConfig(configForm);
      ElMessage.success("创建成功");
    }
    configDialogVisible.value = false;
    editingConfig.value = null;
    loadConfigs();
    loadStatistics();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "保存失败"));
  } finally {
    configSubmitLoading.value = false;
  }
}

// ==================== Logs ====================
const logLoading = ref(false);
const logs = ref<any[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const logPageSize = ref(20);
const logResult = ref("");
const logDateRange = ref<string[]>([]);

async function loadLogs() {
  logLoading.value = true;
  try {
    const params: any = {
      page: logPage.value,
      pageSize: logPageSize.value,
    };
    if (logResult.value) params.result = logResult.value;
    if (logDateRange.value && logDateRange.value.length === 2) {
      params.dateStart = logDateRange.value[0];
      params.dateEnd = logDateRange.value[1];
    }
    const data = await fetchOrderTimeoutLogs(params);
    logs.value = data.records || [];
    logTotal.value = data.total || logs.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载超时日志失败"));
  } finally {
    logLoading.value = false;
  }
}

function handleLogSizeChange(size: number) {
  logPageSize.value = size;
  logPage.value = 1;
  loadLogs();
}

function handleLogPageChange(p: number) {
  logPage.value = p;
  loadLogs();
}

onMounted(() => {
  loadStatistics();
  loadConfigs();
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
.tab-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
