<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">收款链接</h2>
    <p class="page-desc">分享收款链接创建与管理</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="openCreate">创建链接</el-button>
    <el-button @click="loadData">刷新</el-button>
  </div>
</div>

      

      <div class="table-card">
<el-table :data="links" v-loading="loading" stripe>
        <el-table-column prop="linkNo" label="链接编号" width="180" />
        <el-table-column prop="customerName" label="客户名称" min-width="140" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.channel === 'WECHAT'" type="success">微信</el-tag>
            <el-tag v-else-if="row.channel === 'ALIPAY'" type="primary">支付宝</el-tag>
            <el-tag v-else>{{ fmtChannel(row.channel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">待支付</el-tag>
            <el-tag v-else-if="row.status === 'PAID'" type="success">已支付</el-tag>
            <el-tag v-else-if="row.status === 'REVOKED'" type="warning">已撤销</el-tag>
            <el-tag v-else-if="row.status === 'EXPIRED'" type="danger">已过期</el-tag>
            <el-tag v-else>{{ fmtStatus(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expireAt" label="到期时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.expireAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="copyLink(row)">复制链接</el-button>
            <el-button size="small" link type="success" @click="viewPaymentStatus(row)">支付状态</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="revokeLink(row)">撤销</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="(s: number) => { pageSize = s; loadData(); }"
          @current-change="(p: number) => { page = p; loadData(); }"
        />
      </div>
</div>
    

    <!-- 创建收款链接弹窗 -->
    <el-dialog v-model="dialogVisible" title="创建收款链接" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="关联单据" prop="billNo">
          <el-select v-model="form.billNo" filterable placeholder="选择销售单据" style="width: 100%">
            <el-option v-for="b in billList" :key="b.billNo" :label="`${b.billNo} - ${formatYuan(b.amount)}`" :value="b.billNo" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款渠道" prop="shareChannel">
          <el-select v-model="form.shareChannel" style="width: 100%">
            <el-option label="微信" value="WECHAT" />
            <el-option label="支付宝" value="ALIPAY" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期(小时)" prop="expireHours">
          <el-input-number v-model="form.expireHours" :min="1" :max="72" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 支付状态弹窗 -->
    <el-dialog v-model="statusDialogVisible" title="支付状态" width="480px">
      <el-descriptions v-if="statusDetail" :column="1" border>
        <el-descriptions-item label="链接编号">{{ statusDetail.linkNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="statusDetail.status === 'PAID'" type="success">已支付</el-tag>
          <el-tag v-else-if="statusDetail.status === 'PENDING'" type="info">待支付</el-tag>
          <el-tag v-else>{{ statusDetail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="金额">{{ formatYuan(statusDetail.amount) }}</el-descriptions-item>
        <el-descriptions-item v-if="statusDetail.paidAt" label="支付时间">{{ formatDate(statusDetail.paidAt) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="statusDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { fmtStatus, fmtChannel } from "../../utils/enums";
import { ElMessage } from "element-plus";
import { formatDate, formatYuan } from "../../utils/format";
import { fetchCollectionLinks, createCollectionLink, fetchSaleBills } from "../../api";

const links = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const dialogVisible = ref(false);
const formRef = ref();
const submitLoading = ref(false);
const form = reactive({
  billNo: "",
  amount: 0,
  shareChannel: "WECHAT",
  expireHours: 24
});

const rules = {
  billNo: [{ required: true, message: "请选择单据", trigger: "change" }],
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }]
};

const billList = ref<any[]>([]);

const statusDialogVisible = ref(false);
const statusDetail = ref<any>(null);

async function loadData() {
  loading.value = true;
  try {
    const res = await fetchCollectionLinks();
    links.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error("加载收款链接失败");
  } finally {
    loading.value = false;
  }
}

async function openCreate() {
  form.billNo = "";
  form.amount = 0;
  form.shareChannel = "WECHAT";
  form.expireHours = 24;
  dialogVisible.value = true;
  try {
    const res = await fetchSaleBills();
    billList.value = res?.records || res?.list || [];
  } catch {
    billList.value = [];
  }
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  try {
    await createCollectionLink(form.billNo, {
      amount: form.amount,
      shareChannel: form.shareChannel,
      expireHours: form.expireHours
    });
    ElMessage.success("收款链接创建成功");
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("创建失败");
  } finally {
    submitLoading.value = false;
  }
}

function copyLink(row: any) {
  const url = row.payUrl || `${window.location.origin}/pay/${row.linkNo}`;
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success("链接已复制到剪贴板");
  }).catch(() => {
    ElMessage.warning("复制失败，请手动复制：" + url);
  });
}

function viewPaymentStatus(row: any) {
  statusDetail.value = row;
  statusDialogVisible.value = true;
}

async function revokeLink(row: any) {
  try {
    await createCollectionLink(row.billNo, {
      amount: row.amount,
      shareChannel: row.channel,
      expireHours: 0
    });
    ElMessage.success("链接已撤销");
    await loadData();
  } catch {
    ElMessage.error("撤销失败");
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>