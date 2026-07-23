<template>
  <div class="page">
    <PageCard title="报价推送">
      <template #extra>
        <el-button type="primary" @click="openCreateQuote">新建报价</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <el-table :data="quotes" v-loading="loading" stripe>
        <el-table-column prop="quoteNo" label="报价单号" width="180" />
        <el-table-column prop="customerName" label="客户名称" min-width="140" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="row.status === 'SENT'" type="primary">已发送</el-tag>
            <el-tag v-else-if="row.status === 'READ'" type="success">已查阅</el-tag>
            <el-tag v-else-if="row.status === 'EXPIRED'" type="warning">已过期</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalItems" label="商品数" width="100" align="center" />
        <el-table-column prop="totalAmount" label="总金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.totalAmount) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="handleSend(row)">发送</el-button>
            <el-button v-if="row.status === 'SENT' || row.status === 'READ'" size="small" link type="warning" @click="handleResend(row)">重发</el-button>
            <el-button v-if="row.status === 'SENT' || row.status === 'READ'" size="small" link type="info" @click="handleViewStats(row)">查看统计</el-button>
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
          @size-change="(s: number) => { pageSize = s; loadData(); }"
          @current-change="(p: number) => { page = p; loadData(); }"
        />
      </div>
    </PageCard>

    <!-- 新建报价弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新建报价" width="900px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="createForm.customerId" filterable placeholder="选择客户" style="width: 100%">
            <el-option v-for="c in customerList" :key="c.id" :label="`${c.name} (${c.mobile || ''})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="添加商品">
          <div class="add-product-row">
            <el-select v-model="selectedSkuId" filterable placeholder="选择商品" style="flex: 1">
              <el-option v-for="p in productList" :key="p.id" :label="`${p.name} (${p.barcode || ''})`" :value="p.id" />
            </el-select>
            <el-input-number v-model="selectedPrice" :min="0" :precision="2" placeholder="单价" style="width: 140px; margin-left: 8px" />
            <el-button type="primary" style="margin-left: 8px" @click="addProductItem">添加</el-button>
          </div>
        </el-form-item>
        <el-form-item label="商品明细">
          <el-table :data="createForm.items" stripe>
            <el-table-column prop="productName" label="商品名称" min-width="140" />
            <el-table-column label="单价" width="140" align="right">
              <template #default="{ row }">
                <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" controls-position="right" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" @click="createForm.items.splice($index, 1)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" placeholder="报价备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreateQuote">保存报价</el-button>
      </template>
    </el-dialog>

    <!-- 报价详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="报价详情" width="900px">
      <div v-if="detailQuote">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="报价单号">{{ detailQuote.quoteNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ detailQuote.customerName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="detailQuote.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else-if="detailQuote.status === 'SENT'" type="primary">已发送</el-tag>
            <el-tag v-else-if="detailQuote.status === 'READ'" type="success">已查阅</el-tag>
            <el-tag v-else-if="detailQuote.status === 'EXPIRED'" type="warning">已过期</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(detailQuote.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="detailQuote.items || []" stripe style="margin-top: 16px">
          <el-table-column prop="productName" label="商品名称" min-width="160" />
          <el-table-column label="单价" width="140" align="right">
            <template #default="{ row }">
              {{ formatYuan(row.unitPrice) }}
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100" align="center">
            <template #default="{ row }">
              {{ row.quantity || 1 }}
            </template>
          </el-table-column>
          <el-table-column label="小计" width="140" align="right">
            <template #default="{ row }">
              {{ formatYuan((row.unitPrice || 0) * (row.quantity || 1)) }}
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
        </el-table>

        <div v-if="detailQuote.remark" style="margin-top: 16px; color: #666">
          <b>备注：</b>{{ detailQuote.remark }}
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 查阅统计 -->
    <el-dialog v-model="statsDialogVisible" title="查阅统计" width="480px">
      <div v-if="statsData">
        <el-statistic title="发送次数" :value="statsData.sendCount || 0" />
        <el-statistic title="查阅人数" :value="statsData.readCount || 0" style="margin-top: 16px" />
        <el-statistic title="未查阅人数" :value="(statsData.totalRecipients || 0) - (statsData.readCount || 0)" style="margin-top: 16px" />
      </div>
      <template #footer>
        <el-button @click="statsDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate, formatYuan } from "../../utils/format";
import { fetchNotifications, sendNotification, fetchProducts, fetchMembers } from "../../api";

const quotes = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const createDialogVisible = ref(false);
const createFormRef = ref();
const createLoading = ref(false);
const createForm = reactive({
  customerId: null as number | null,
  remark: "",
  items: [] as any[]
});

const createRules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }]
};

const customerList = ref<any[]>([]);
const productList = ref<any[]>([]);
const selectedSkuId = ref<number | null>(null);
const selectedPrice = ref(0);

const detailDialogVisible = ref(false);
const detailQuote = ref<any>(null);

const statsDialogVisible = ref(false);
const statsData = ref<any>(null);

function addProductItem() {
  if (!selectedSkuId.value) {
    ElMessage.warning("请选择商品");
    return;
  }
  const product = productList.value.find((p) => p.id === selectedSkuId.value);
  if (!product) return;

  const existing = createForm.items.find((i) => i.skuId === selectedSkuId.value);
  if (existing) {
    ElMessage.warning("该商品已添加");
    return;
  }

  createForm.items.push({
    skuId: selectedSkuId.value,
    productName: product.name,
    unitPrice: selectedPrice.value || product.retailPrice || 0,
    quantity: 1
  });
  selectedSkuId.value = null;
  selectedPrice.value = 0;
}

async function openCreateQuote() {
  createForm.customerId = null;
  createForm.remark = "";
  createForm.items = [];
  createDialogVisible.value = true;
  try {
    const [members, products] = await Promise.all([fetchMembers(), fetchProducts()]);
    customerList.value = members?.records || members?.list || [];
    productList.value = products?.records || products?.list || [];
  } catch {
    ElMessage.error("加载数据失败");
  }
}

async function handleCreateQuote() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (createForm.items.length === 0) {
    ElMessage.warning("请至少添加一个商品");
    return;
  }
  createLoading.value = true;
  try {
    await sendNotification({
      type: "QUOTE",
      customerId: createForm.customerId,
      items: createForm.items,
      remark: createForm.remark
    });
    ElMessage.success("报价创建成功");
    createDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error("创建报价失败");
  } finally {
    createLoading.value = false;
  }
}

function openDetail(row: any) {
  detailQuote.value = row;
  detailDialogVisible.value = true;
}

async function handleSend(row: any) {
  try {
    await sendNotification({ type: "QUOTE_SEND", quoteId: row.id });
    ElMessage.success("报价已发送");
    await loadData();
  } catch {
    ElMessage.error("发送失败");
  }
}

async function handleResend(row: any) {
  try {
    await sendNotification({ type: "QUOTE_RESEND", quoteId: row.id });
    ElMessage.success("报价已重发");
    await loadData();
  } catch {
    ElMessage.error("重发失败");
  }
}

function handleViewStats(row: any) {
  statsData.value = {
    sendCount: row.sendCount || 1,
    readCount: row.readCount || 0,
    totalRecipients: row.totalRecipients || 1
  };
  statsDialogVisible.value = true;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await fetchNotifications({
      type: "QUOTE",
      page: page.value,
      pageSize: pageSize.value
    });
    quotes.value = res?.records || res?.list || [];
    total.value = res?.total || 0;
  } catch {
    quotes.value = [];
  } finally {
    loading.value = false;
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

.add-product-row {
  display: flex;
  align-items: center;
  width: 100%;
}
</style>