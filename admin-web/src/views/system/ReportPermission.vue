<template>
  <div class="page">
    <PageCard title="报表权限">
      <template #extra>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="matrix-container" v-loading="loading">
        <el-table :data="roles" border stripe empty-text="暂无角色数据">
          <el-table-column prop="roleName" label="角色名称" width="140" fixed="left" />
          <el-table-column
            v-for="code in reportCodes"
            :key="code"
            :label="reportLabel(code)"
            :min-width="140"
            align="center"
          >
            <template #default="{ row }">
              <el-select
                :model-value="getScope(row.id, code)"
                placeholder="--"
                size="small"
                clearable
                @change="(val: string) => setScope(row.id, code, val)"
              >
                <el-option label="SELF" value="SELF" />
                <el-option label="CHILDREN" value="CHILDREN" />
                <el-option label="ALL" value="ALL" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="save-bar">
        <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
      </div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import {
  fetchRbacRoles,
  fetchReportPermissionMatrix,
  saveReportPermissionMatrix
} from "../../api";

const reportCodes = [
  "SALES_REPORT",
  "PRODUCT_REPORT",
  "CUSTOMER_REPORT",
  "FINANCE_REPORT",
  "STAFF_REPORT",
  "INVENTORY_REPORT",
  "PURCHASE_REPORT",
  "MARKETING_REPORT"
];

const reportLabels: Record<string, string> = {
  SALES_REPORT: "销售报表",
  PRODUCT_REPORT: "商品报表",
  CUSTOMER_REPORT: "客户报表",
  FINANCE_REPORT: "财务报表",
  STAFF_REPORT: "员工报表",
  INVENTORY_REPORT: "库存报表",
  PURCHASE_REPORT: "采购报表",
  MARKETING_REPORT: "营销报表"
};

function reportLabel(code: string): string {
  return reportLabels[code] || code;
}

const roles = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);

const scopeMap = reactive<Record<string, string>>({});

function key(roleId: number, code: string): string {
  return `${roleId}:${code}`;
}

function getScope(roleId: number, code: string): string {
  return scopeMap[key(roleId, code)] || "";
}

function setScope(roleId: number, code: string, val: string) {
  scopeMap[key(roleId, code)] = val;
}

async function loadData() {
  loading.value = true;
  try {
    roles.value = await fetchRbacRoles();
    const { data } = await fetchReportPermissionMatrix();
    const matrix: Array<{ role_id: number; report_code: string; store_scope: string }> = data?.data?.items || data?.data || data || [];
    // 清空旧数据
    Object.keys(scopeMap).forEach((k) => delete scopeMap[k]);
    for (const item of matrix) {
      scopeMap[key(item.role_id, item.report_code)] = item.store_scope;
    }
  } catch {
    ElMessage.error("加载数据失败");
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const payload: Array<{ role_id: number; report_code: string; store_scope: string }> = [];
    for (const role of roles.value) {
      for (const code of reportCodes) {
        const scope = getScope(role.id, code);
        if (scope) {
          payload.push({ role_id: role.id, report_code: code, store_scope: scope });
        }
      }
    }
    await saveReportPermissionMatrix(payload);
    ElMessage.success("保存成功");
  } catch {
    ElMessage.error("保存失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.matrix-container {
  overflow-x: auto;
}

.save-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-select) {
  width: 120px;
}

:deep(.el-select .el-input__inner::placeholder) {
  color: var(--gray-300);
}
</style>