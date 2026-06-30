<template>
  <div class="page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总链接数</div>
      </div>
      <div class="stat-card paid">
        <div class="stat-value">{{ stats.paid }}</div>
        <div class="stat-label">已支付</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待支付</div>
      </div>
      <div class="stat-card expired">
        <div class="stat-value">{{ stats.expired }}</div>
        <div class="stat-label">已过期</div>
      </div>
      <div class="stat-card revoked">
        <div class="stat-value">{{ stats.revoked }}</div>
        <div class="stat-label">已撤销</div>
      </div>
    </div>

    <PageCard title="分享链接管理">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索链接号/销售单号"
          size="default"
          style="width: 220px"
          clearable
          @clear="loadList"
          @keyup.enter="loadList"
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" size="default" style="width: 120px" clearable @change="loadList">
          <el-option label="待支付" value="PENDING" />
          <el-option label="已支付" value="PAID" />
          <el-option label="已过期" value="EXPIRED" />
          <el-option label="已撤销" value="REVOKED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="showBatchDialog">批量生成</el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="records"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadList"
        @update:page-size="loadList"
      >
        <template #amount="{ row }">
          ¥{{ Number(row.amount || 0).toFixed(2) }}
        </template>
        <template #paidAmount="{ row }">
          ¥{{ Number(row.paidAmount || 0).toFixed(2) }}
        </template>
        <template #status="{ row }">
          <el-tag v-if="row.status === 'PENDING'" type="warning">待支付</el-tag>
          <el-tag v-else-if="row.status === 'PAID'" type="success">已支付</el-tag>
          <el-tag v-else-if="row.status === 'EXPIRED'" type="danger">已过期</el-tag>
          <el-tag v-else-if="row.status === 'REVOKED'" type="info">已撤销</el-tag>
          <el-tag v-else>{{ row.status }}</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" link type="primary" @click="copyLink(row)">复制链接</el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            size="small"
            link
            type="danger"
            @click="handleRevoke(row)"
          >撤销</el-button>
        </template>
      </DataTable>
    </PageCard>

    <!-- 批量生成弹窗 -->
    <el-dialog v-model="batchVisible" title="批量生成分享链接" width="550px" :close-on-click-modal="false">
      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="选择销售单">
          <el-select
            v-model="batchForm.billNos"
            multiple
            filterable
            placeholder="请选择销售单"
            style="width: 100%"
          >
            <el-option
              v-for="bill in saleBillsForSelect"
              :key="bill.billNo"
              :label="`${bill.billNo} - ${bill.customerName} (未收 ¥${Number(bill.unpaidAmount || 0).toFixed(2)})`"
              :value="bill.billNo"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分享渠道">
          <el-select v-model="batchForm.shareChannel" style="width: 100%">
            <el-option label="微信" value="WECHAT" />
            <el-option label="短信" value="SMS" />
            <el-option label="复制链接" value="COPY" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款金额">
          <el-input-number v-model="batchForm.amount" :min="0" :precision="2" style="width: 100%" placeholder="0=全额收款" />
          <span style="color: #909399; font-size: 12px; margin-left: 8px">0表示收全部未收金额</span>
        </el-form-item>
        <el-form-item label="有效期(小时)">
          <el-input-number v-model="batchForm.expireHours" :min="1" :max="720" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="handleBatchCreate">确认生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchCollectionLinks, batchCreateCollectionLinks, revokeCollectionLink, fetchCollectionStats, fetchSaleBills } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");

const stats = ref({ total: 0, paid: 0, pending: 0, expired: 0, revoked: 0 });

const batchVisible = ref(false);
const batchLoading = ref(false);
const batchForm = ref({ billNos: [] as string[], shareChannel: "WECHAT", amount: 0, expireHours: 48 });
const saleBillsForSelect = ref<any[]>([]);

const columns = [
  { prop: "linkNo", label: "链接单号", width: 180 },
  { prop: "sourceNo", label: "关联销售单", width: 180 },
  { prop: "customerName", label: "客户", minWidth: 120 },
  { prop: "amount", label: "金额", width: 110, slot: "amount" },
  { prop: "paidAmount", label: "已付", width: 110, slot: "paidAmount" },
  { prop: "status", label: "状态", width: 90, slot: "status" },
  { prop: "shareChannel", label: "渠道", width: 80 },
  { prop: "viewCount", label: "浏览次数", width: 90 },
  { prop: "expireAt", label: "过期时间", width: 160 },
  { prop: "createdAt", label: "创建时间", width: 160 },
  { label: "操作", width: 160, fixed: "right", slot: "actions" }
];

async function loadStats() {
  try {
    const data = await fetchCollectionStats();
    stats.value = data;
  } catch { /* ignore */ }
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchCollectionLinks({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      keyword: keyword.value || undefined
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadSaleBillsForSelect() {
  try {
    const data = await fetchSaleBills();
    const list = Array.isArray(data) ? data : (data.records || []);
    saleBillsForSelect.value = list.filter((b: any) => Number(b.unpaidAmount || 0) > 0);
  } catch { /* ignore */ }
}

function showBatchDialog() {
  batchForm.value = { billNos: [], shareChannel: "WECHAT", amount: 0, expireHours: 48 };
  loadSaleBillsForSelect();
  batchVisible.value = true;
}

async function handleBatchCreate() {
  if (batchForm.value.billNos.length === 0) {
    ElMessage.warning("请选择至少一张销售单");
    return;
  }
  batchLoading.value = true;
  try {
    const result = await batchCreateCollectionLinks(batchForm.value);
    const successCount = result.filter((r: any) => r.success).length;
    const failCount = result.length - successCount;
    if (failCount > 0) {
      const fails = result.filter((r: any) => !r.success).map((r: any) => `${r.billNo}: ${r.error}`).join("; ");
      ElMessage.warning(`成功 ${successCount} 条，失败 ${failCount} 条：${fails}`);
    } else {
      ElMessage.success(`成功生成 ${successCount} 条分享链接`);
    }
    batchVisible.value = false;
    loadList();
    loadStats();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "生成失败");
  } finally {
    batchLoading.value = false;
  }
}

async function handleRevoke(row: any) {
  try {
    await ElMessageBox.confirm(`确定撤销链接 ${row.linkNo} 吗？撤销后客户将无法支付。`, "确认撤销", { type: "warning" });
  } catch { return; }
  try {
    await revokeCollectionLink(row.linkNo);
    ElMessage.success("已撤销");
    loadList();
    loadStats();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "撤销失败");
  }
}

function copyLink(row: any) {
  const url = `${window.location.origin}/share/collections/${row.token}`;
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success("链接已复制到剪贴板");
  }).catch(() => {
    ElMessage.info(`链接: ${url}`);
  });
}

onMounted(() => {
  loadStats();
  loadList();
});
</script>

<style scoped>
.page { padding: 0; }
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border-left: 4px solid #409eff;
}
.stat-card.paid { border-left-color: #67c23a; }
.stat-card.pending { border-left-color: #e6a23c; }
.stat-card.expired { border-left-color: #f56c6c; }
.stat-card.revoked { border-left-color: #909399; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
</style>