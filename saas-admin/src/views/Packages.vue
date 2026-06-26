<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px;" @change="fetchList">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="INACTIVE" />
          </el-select>
        </div>
        <el-button type="primary" @click="goCreate">新建套餐</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="planCode" label="套餐编码" width="120" />
        <el-table-column prop="planName" label="套餐名称" min-width="140">
          <template #default="{ row }">
            <el-link type="primary" @click="goEdit(row.id)">{{ row.planName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="planType" label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ planTypeLabel(row.planType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="110" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600; color: #ef4444;">¥{{ formatPrice(row.price) }}</span>
            <span v-if="row.originalPrice" style="font-size: 12px; color: var(--text-secondary); text-decoration: line-through; margin-left: 6px;">¥{{ formatPrice(row.originalPrice) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="durationDays" label="有效期" width="90">
          <template #default="{ row }">
            {{ durationLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="maxUsers" label="用户数" width="80" align="center" />
        <el-table-column prop="maxStores" label="门店数" width="80" align="center" />
        <el-table-column prop="maxProducts" label="商品数" width="80" align="center" />
        <el-table-column prop="maxCustomers" label="客户数" width="80" align="center" />
        <el-table-column label="功能模块" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="mod in (row.moduleAccess || [])"
              :key="mod"
              size="small"
              style="margin-right: 4px; margin-bottom: 2px;"
            >{{ mod }}</el-tag>
            <span v-if="!row.moduleAccess?.length" style="color: var(--text-secondary);">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
              {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goEdit(row.id)">编辑</el-button>
            <el-button
              v-if="row.status === 'ACTIVE'"
              link
              type="warning"
              size="small"
              @click="handleToggleStatus(row)"
            >停用</el-button>
            <el-button
              v-else
              link
              type="success"
              size="small"
              @click="handleToggleStatus(row)"
            >启用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getPlans, updatePlan } from "../api";

const router = useRouter();

const loading = ref(false);
const list = ref<any[]>([]);

const searchForm = reactive({
  status: ""
});

function planTypeLabel(s: string) {
  const map: Record<string, string> = { MONTHLY: "月付", YEARLY: "年付", PERMANENT: "永久" };
  return map[s] || s;
}

function formatPrice(n: number) {
  return n?.toFixed(2) || "0.00";
}

function durationLabel(row: any) {
  if (row.planType === "PERMANENT") return "永久";
  return `${row.durationDays}天`;
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getPlans({ status: searchForm.status || undefined });
    const data = res.data?.data || (res as any).data || res;
    const records = data.records || [];
    // 解析 JSON 字段
    list.value = records.map((r: any) => ({
      ...r,
      moduleAccess: typeof r.moduleAccess === "string" ? JSON.parse(r.moduleAccess || "[]") : (r.moduleAccess || []),
      features: typeof r.features === "string" ? JSON.parse(r.features || "[]") : (r.features || [])
    }));
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  router.push("/packages/create");
}

function goEdit(id: number) {
  router.push(`/packages/${id}/edit`);
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const action = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(
      `确定要${action}套餐 "${row.planName}" 吗？`,
      `${action}确认`,
      { type: "warning", confirmButtonText: `确定${action}`, cancelButtonText: "取消" }
    );
  } catch { return; }
  try {
    await updatePlan(row.id, { status: newStatus });
    ElMessage.success(`已${action}`);
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  }
}

onMounted(() => {
  fetchList();
});
</script>