<template>
  <div class="page">
    <PageCard title="审核委托管理">
      <template #extra>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showCreateDialog">新建委托</el-button>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="我的委托" name="my-delegations" />
        <el-tab-pane label="代理我的" name="delegated-to-me" />
        <el-tab-pane label="历史记录" name="history" />
      </el-tabs>

      <div class="filter-bar">
        <el-input v-model="searchForm.keyword" placeholder="委托人/被委托人" clearable style="width: 200px" :prefix-icon="Search" />
        <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 140px; margin-left: 12px">
          <el-option label="生效中" value="ACTIVE" />
          <el-option label="已过期" value="EXPIRED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-date-picker
          v-model="searchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 260px; margin-left: 12px"
        />
        <el-button type="primary" style="margin-left: 12px" @click="loadList">查询</el-button>
        <el-button style="margin-left: 8px" @click="handleReset">重置</el-button>
      </div>

      <el-table :data="records" border v-loading="loading">
        <el-table-column label="委托人" width="120">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32" class="user-avatar">{{ row.delegatorName?.charAt(0) }}</el-avatar>
              <span>{{ row.delegatorName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="被委托人" width="120">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32" class="user-avatar">{{ row.delegateName?.charAt(0) }}</el-avatar>
              <span>{{ row.delegateName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="委托类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.delegateType === 'ALL' ? 'danger' : 'warning'" size="small">
              {{ row.delegateType === 'ALL' ? '全部委托' : '部分委托' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="委托范围" min-width="180">
          <template #default="{ row }">
            <template v-if="row.delegateType === 'ALL'">全部审核类型</template>
            <template v-else>
              <el-tag v-for="(t, idx) in row.delegateTypes" :key="idx" size="small" style="margin-right: 4px; margin-bottom: 2px">
                {{ getReviewTypeLabel(t) }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="委托时间" width="320">
          <template #default="{ row }">
            <div class="time-range">
              <span>{{ row.startDate }}</span>
              <span class="arrow">→</span>
              <span>{{ row.endDate }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <template v-if="activeTab === 'my-delegations' && row.status === 'ACTIVE'">
              <el-button size="small" link type="warning" @click="handleCancel(row)">取消委托</el-button>
            </template>
            <template v-if="activeTab === 'delegated-to-me' && row.status === 'ACTIVE'">
              <el-button size="small" link type="success" @click="goToReview(row)">去审核</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadList"
          @size-change="loadList"
        />
      </div>
    </PageCard>

    <!-- 新建委托弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建审核委托" width="600px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="被委托人" prop="delegateId">
          <el-select v-model="form.delegateId" placeholder="请选择被委托人" filterable style="width: 100%">
            <el-option v-for="u in userOptions" :key="u.id" :label="u.name + '（' + getRoleLabel(u.role) + '）'" :value="u.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="委托类型" prop="delegateType">
          <el-radio-group v-model="form.delegateType">
            <el-radio value="ALL">全部委托</el-radio>
            <el-radio value="PARTIAL">部分委托</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.delegateType === 'PARTIAL'" label="委托范围" prop="delegateTypes">
          <el-checkbox-group v-model="form.delegateTypes">
            <el-checkbox label="CREATE">新增商品</el-checkbox>
            <el-checkbox label="UPDATE">修改商品</el-checkbox>
            <el-checkbox label="OFFLINE">下架商品</el-checkbox>
            <el-checkbox label="PRICE_CHANGE">价格变更</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="委托时间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="委托原因">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入委托原因（选填）" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确认提交</el-button>
      </template>
    </el-dialog>

    <!-- 委托详情弹窗 -->
    <el-dialog v-model="detailVisible" title="委托详情" width="560px" :close-on-click-modal="false">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="委托人">
          <div class="user-cell">
            <el-avatar :size="28" class="user-avatar">{{ detail.delegatorName?.charAt(0) }}</el-avatar>
            <span>{{ detail.delegatorName }}</span>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="被委托人">
          <div class="user-cell">
            <el-avatar :size="28" class="user-avatar">{{ detail.delegateName?.charAt(0) }}</el-avatar>
            <span>{{ detail.delegateName }}</span>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="委托类型">
          <el-tag :type="detail.delegateType === 'ALL' ? 'danger' : 'warning'" size="small">
            {{ detail.delegateType === 'ALL' ? '全部委托' : '部分委托' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="委托范围">
          <template v-if="detail.delegateType === 'ALL'">全部审核类型</template>
          <template v-else>
            <el-tag v-for="(t, idx) in detail.delegateTypes" :key="idx" size="small" style="margin-right: 4px">
              {{ getReviewTypeLabel(t) }}
            </el-tag>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="委托时间">
          {{ detail.startDate }} 至 {{ detail.endDate }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTag(detail.status)" size="small">
            {{ getStatusLabel(detail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="委托原因">{{ detail.reason || '无' }}</el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <template v-if="activeTab === 'my-delegations' && detail.status === 'ACTIVE'">
          <el-button type="warning" @click="handleCancel(detail)">取消委托</el-button>
        </template>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";

const router = useRouter();

// ==================== Mock 数据 ====================
const userOptions = [
  { id: 1, name: "张经理", role: "MGR" },
  { id: 2, name: "李财务", role: "FIN" },
  { id: 3, name: "王老板", role: "BOSS" },
  { id: 4, name: "赵库管", role: "STOCK" },
  { id: 5, name: "孙业务", role: "SALES" },
  { id: 6, name: "周副店长", role: "MGR" }
];

const mockMyDelegations = [
  {
    id: 1,
    delegatorId: 1,
    delegatorName: "张经理",
    delegateId: 6,
    delegateName: "周副店长",
    delegateType: "ALL",
    delegateTypes: [] as string[],
    startDate: "2026-07-15",
    endDate: "2026-07-20",
    status: "ACTIVE",
    reason: "出差期间委托副店长代审",
    createdAt: "2026-07-14 18:00:00"
  },
  {
    id: 2,
    delegatorId: 1,
    delegatorName: "张经理",
    delegateId: 4,
    delegateName: "赵库管",
    delegateType: "PARTIAL",
    delegateTypes: ["OFFLINE", "UPDATE"],
    startDate: "2026-07-10",
    endDate: "2026-07-17",
    status: "ACTIVE",
    reason: "库存相关审核委托库管处理",
    createdAt: "2026-07-09 10:00:00"
  }
];

const mockDelegatedToMe = [
  {
    id: 11,
    delegatorId: 3,
    delegatorName: "王老板",
    delegateId: 1,
    delegateName: "张经理",
    delegateType: "PARTIAL",
    delegateTypes: ["CREATE", "UPDATE"],
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    status: "ACTIVE",
    reason: "日常商品新增和修改由店长先审",
    createdAt: "2026-06-30 16:00:00"
  }
];

const mockHistory = [
  {
    id: 21,
    delegatorId: 1,
    delegatorName: "张经理",
    delegateId: 2,
    delegateName: "李财务",
    delegateType: "PARTIAL",
    delegateTypes: ["PRICE_CHANGE"],
    startDate: "2026-06-01",
    endDate: "2026-06-10",
    status: "EXPIRED",
    reason: "休假期间委托",
    createdAt: "2026-05-31 09:00:00"
  },
  {
    id: 22,
    delegatorId: 1,
    delegatorName: "张经理",
    delegateId: 4,
    delegateName: "赵库管",
    delegateType: "ALL",
    delegateTypes: [],
    startDate: "2026-05-15",
    endDate: "2026-05-20",
    status: "CANCELLED",
    reason: "提前回来取消委托",
    createdAt: "2026-05-14 14:00:00"
  }
];

// ==================== 数据状态 ====================
const activeTab = ref("my-delegations");
const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const searchForm = reactive({
  keyword: "",
  status: "",
  dateRange: null as string[] | null
});

const dialogVisible = ref(false);
const detailVisible = ref(false);
const submitLoading = ref(false);
const formRef = ref();
const detail = ref<any>({});

const form = reactive({
  delegateId: null as number | null,
  delegateType: "ALL",
  delegateTypes: [] as string[],
  dateRange: null as string[] | null,
  reason: ""
});

const rules = {
  delegateId: [{ required: true, message: "请选择被委托人", trigger: "change" }],
  delegateType: [{ required: true, message: "请选择委托类型", trigger: "change" }],
  dateRange: [{ required: true, message: "请选择委托时间", trigger: "change" }]
};

// ==================== 方法 ====================
function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    BOSS: "老板",
    MGR: "店长",
    FIN: "财务",
    STOCK: "库管",
    SALES: "业务员"
  };
  return map[role] || role;
}

function getReviewTypeLabel(type: string) {
  const map: Record<string, string> = {
    CREATE: "新增商品",
    UPDATE: "修改商品",
    OFFLINE: "下架商品",
    PRICE_CHANGE: "价格变更"
  };
  return map[type] || type;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "生效中",
    EXPIRED: "已过期",
    CANCELLED: "已取消"
  };
  return map[status] || status;
}

function getStatusTag(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "success",
    EXPIRED: "info",
    CANCELLED: "danger"
  };
  return map[status] || "";
}

function handleTabChange() {
  page.value = 1;
  loadList();
}

function loadList() {
  loading.value = true;
  setTimeout(() => {
    let source: any[] = [];
    if (activeTab.value === "my-delegations") source = mockMyDelegations;
    else if (activeTab.value === "delegated-to-me") source = mockDelegatedToMe;
    else source = mockHistory;

    let filtered = [...source];
    if (searchForm.keyword) {
      const kw = searchForm.keyword.toLowerCase();
      filtered = filtered.filter(r =>
        r.delegatorName.toLowerCase().includes(kw) || r.delegateName.toLowerCase().includes(kw)
      );
    }
    if (searchForm.status) {
      filtered = filtered.filter(r => r.status === searchForm.status);
    }

    records.value = filtered;
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.dateRange = null;
  loadList();
}

function showCreateDialog() {
  form.delegateId = null;
  form.delegateType = "ALL";
  form.delegateTypes = [];
  form.dateRange = null;
  form.reason = "";
  dialogVisible.value = true;
}

function viewDetail(row: any) {
  detail.value = { ...row };
  detailVisible.value = true;
}

function handleSubmit() {
  formRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    if (form.delegateType === "PARTIAL" && form.delegateTypes.length === 0) {
      ElMessage.warning("请至少选择一种委托类型");
      return;
    }
    submitLoading.value = true;
    setTimeout(() => {
      const newId = Math.max(...mockMyDelegations.map(r => r.id), 0) + 1;
      mockMyDelegations.unshift({
        id: newId,
        delegatorId: 1,
        delegatorName: "张经理",
        delegateId: form.delegateId!,
        delegateName: userOptions.find(u => u.id === form.delegateId)?.name || "",
        delegateType: form.delegateType,
        delegateTypes: [...form.delegateTypes],
        startDate: form.dateRange![0],
        endDate: form.dateRange![1],
        status: "ACTIVE",
        reason: form.reason,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")
      });
      ElMessage.success("委托创建成功");
      submitLoading.value = false;
      dialogVisible.value = false;
      loadList();
    }, 400);
  });
}

function handleCancel(row: any) {
  ElMessageBox.confirm("确定要取消该委托吗？取消后被委托人将无法代审。", "取消委托", {
    confirmButtonText: "确认取消",
    cancelButtonText: "再想想",
    type: "warning"
  }).then(() => {
    row.status = "CANCELLED";
    ElMessage.success("委托已取消");
    detailVisible.value = false;
    loadList();
  }).catch(() => {});
}

function goToReview(_row: any) {
  router.push("/product-review-tasks");
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

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  background: #409eff;
  color: #fff;
  font-size: 14px;
}

.time-range {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.time-range .arrow {
  color: #c0c4cc;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
