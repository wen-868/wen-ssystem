<template>
  <PageCard title="会话管理">
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="28"><User /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">当前在线人数</div>
          <div class="stat-value">{{ onlineCount }}</div>
        </div>
      </div>
    </div>

    <div class="search-bar">
      <el-input v-model="searchKeyword" placeholder="搜索用户" clearable style="width: 200px" @keyup.enter="loadSessions" />
      <el-button @click="loadSessions">搜索</el-button>
      <el-button @click="loadStats">刷新统计</el-button>
    </div>

    <el-table :data="sessions" v-loading="loading" stripe empty-text="暂无会话">
      <el-table-column label="用户" min-width="140">
        <template #default="{ row }">
          {{ row.userName || row.username || row.userId }}
        </template>
      </el-table-column>
      <el-table-column prop="deviceType" label="设备类型" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.deviceType === 'mobile'" type="success" size="small">手机</el-tag>
          <el-tag v-else-if="row.deviceType === 'pc'" type="primary" size="small">电脑</el-tag>
          <el-tag v-else-if="row.deviceType === 'tablet'" type="warning" size="small">平板</el-tag>
          <el-tag v-else type="info" size="small">{{ row.deviceType || '未知' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="deviceInfo" label="设备信息" min-width="160" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP地址" width="140" />
      <el-table-column label="最后活跃时间" width="170">
        <template #default="{ row }">{{ formatDate(row.lastActiveTime || row.lastActiveAt) }}</template>
      </el-table-column>
      <el-table-column label="过期时间" width="170">
        <template #default="{ row }">{{ formatDate(row.expireTime || row.expiresAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-popconfirm title="确认强制下线该用户？" @confirm="handleRevoke(row)">
            <template #reference>
              <el-button size="small" link type="danger">强制下线</el-button>
            </template>
          </el-popconfirm>
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
  </PageCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { User } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { getUserSessions, revokeSession, getOnlineStats } from "../api";

const onlineCount = ref(0);
const searchKeyword = ref("");

const sessions = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.msg || e?.message || fallback;
}

async function loadStats() {
  try {
    const data = await getOnlineStats() as any;
    onlineCount.value = data?.onlineCount ?? data?.total ?? 0;
  } catch {
    // ignore
  }
}

async function loadSessions() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    const data = await getUserSessions(params) as any;
    sessions.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载会话列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadSessions();
}

function handlePageChange(p: number) {
  page.value = p;
  loadSessions();
}

async function handleRevoke(row: any) {
  try {
    await revokeSession(row.id);
    ElMessage.success("已强制下线");
    loadSessions();
    loadStats();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

onMounted(() => {
  loadStats();
  loadSessions();
});
</script>

<style scoped>
.stat-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  max-width: 280px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  color: #fff;
}

.stat-card.stat-primary {
  background: linear-gradient(135deg, #409eff, #337ecc);
}

.stat-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

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