<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>拜访统计</span>
          <div class="header-actions">
            <el-select
              v-model="filters.staffId"
              placeholder="选择员工"
              size="default"
              style="width: 160px; margin-right: 10px"
              clearable
              filterable
            >
              <el-option
                v-for="s in staffList"
                :key="s.id"
                :label="s.realName || s.username"
                :value="s.id"
              />
            </el-select>
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 10px"
              value-format="YYYY-MM-DD"
            />
            <el-button @click="search">查询</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" v-loading="loading">
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="总拜访数" :value="summary.totalVisits || 0" />
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="已完成" :value="summary.completedVisits || 0" />
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="完成率" :value="summary.completionRate || 0">
              <template #suffix>
                <span style="font-size: 16px">%</span>
              </template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="平均时长(分钟)" :value="summary.avgDuration || 0" />
          </el-card>
        </el-col>
      </el-row>

      <el-card style="margin-top: 16px">
        <template #header>
          <span>员工拜访统计</span>
        </template>
        <el-table :data="statsList" stripe>
          <el-table-column prop="staffName" label="员工姓名" min-width="120" />
          <el-table-column prop="totalVisits" label="总拜访数" width="120" />
          <el-table-column prop="completedVisits" label="已完成" width="100" />
          <el-table-column label="完成率" width="120">
            <template #default="{ row }">
              {{ row.completionRate != null ? row.completionRate + '%' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="平均时长" width="120">
            <template #default="{ row }">
              {{ row.avgDuration != null ? row.avgDuration + '分钟' : '-' }}
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
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-card>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchCustomerVisitStatistics, fetchStaff } from "../api";

const loading = ref(false);
const statsList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const staffList = ref<any[]>([]);

const summary = reactive({
  totalVisits: 0,
  completedVisits: 0,
  completionRate: 0,
  avgDuration: 0
});

const filters = reactive({
  staffId: undefined as number | undefined,
  dateRange: null as [string, string] | null
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = Array.isArray(data) ? data : (data.records || []);
  } catch {
    // ignore
  }
}

async function loadStats() {
  loading.value = true;
  try {
    const params: any = {};
    if (filters.staffId) params.staffId = filters.staffId;
    if (filters.dateRange) {
      params.dateStart = filters.dateRange[0];
      params.dateEnd = filters.dateRange[1];
    }
    const data = (await fetchCustomerVisitStatistics(params)).data;
    summary.totalVisits = data.totalVisits || 0;
    summary.completedVisits = data.completedVisits || 0;
    summary.completionRate = data.completionRate || 0;
    summary.avgDuration = data.avgDuration || 0;
    const list = data.staffDetails || [];
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    statsList.value = list.slice(start, start + pageSize.value);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载拜访统计失败"));
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  loadStats();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadStats();
}

function handlePageChange(p: number) {
  page.value = p;
  loadStats();
}

onMounted(() => {
  loadStaff();
  loadStats();
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
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>