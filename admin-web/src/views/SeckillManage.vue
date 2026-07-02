<template>
  <div class="page">
    <PageCard title="秒杀管理">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增秒杀</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-select v-model="searchForm.status" placeholder="活动状态" clearable style="width: 140px" @change="searchData">
          <el-option label="待开始" value="PENDING" />
          <el-option label="进行中" value="ACTIVE" />
          <el-option label="已结束" value="ENDED" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchData">搜索</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="productName" label="商品名称" min-width="140" />
        <el-table-column label="秒杀价" width="110">
          <template #default="{ row }">¥{{ row.seckillPrice }}</template>
        </el-table-column>
        <el-table-column label="原价" width="100">
          <template #default="{ row }">¥{{ row.originalPrice || '-' }}</template>
        </el-table-column>
        <el-table-column prop="seckillStock" label="秒杀库存" width="100" align="center" />
        <el-table-column prop="limitPerUser" label="每人限购" width="100" align="center" />
        <el-table-column label="开始时间" width="160">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="160">
          <template #default="{ row }">{{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">待开始</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="deleteItem(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; searchData(); }" @current-change="(p: number) => { page = p; searchData(); }" />
      </div>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑秒杀' : '新增秒杀'" width="520px">
      <el-form ref="formRef" :model="form" label-width="100px">
        <el-form-item label="选择商品" prop="productId" :rules="[{ required: true, message: '请选择商品' }]">
          <el-select v-model="form.productId" placeholder="请选择商品" filterable style="width: 100%">
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="秒杀价格" prop="seckillPrice" :rules="[{ required: true, message: '请输入秒杀价格' }]">
          <el-input-number v-model="form.seckillPrice" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="秒杀库存" prop="seckillStock" :rules="[{ required: true, message: '请输入秒杀库存' }]">
          <el-input-number v-model="form.seckillStock" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每人限购">
          <el-input-number v-model="form.limitPerUser" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="活动时间" prop="timeRange" :rules="[{ required: true, message: '请选择活动时间' }]">
          <el-date-picker v-model="form.timeRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="待开始" value="PENDING" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { api } from "../api";

const list = ref<any[]>([]);
const products = ref<any[]>([]);
const loading = ref(false); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const dialogVisible = ref(false); const editing = ref(false); const formRef = ref(); const submitLoading = ref(false);
const editingItem = ref<any>(null);

const searchForm = reactive({ status: "" });
const form = reactive({
  productId: null as number | null,
  seckillPrice: 0,
  seckillStock: 1,
  limitPerUser: 1,
  timeRange: [] as any[],
  status: "PENDING"
});

async function loadProducts() {
  try {
    const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 200 } });
    const res = data.data || {};
    products.value = res.records || res.list || [];
  } catch { /* ignore */ }
}

async function searchData() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/seckill-products", {
      params: { page: page.value, pageSize: pageSize.value, status: searchForm.status || undefined }
    });
    const res = data.data || {};
    list.value = res.records || [];
    total.value = res.total || 0;
  } catch { ElMessage.error("加载秒杀列表失败"); }
  finally { loading.value = false; }
}

function openDialog(row?: any) {
  editingItem.value = row || null; editing.value = !!row;
  if (row) {
    form.productId = row.productId || row.product_id;
    form.seckillPrice = row.seckillPrice || row.seckill_price;
    form.seckillStock = row.seckillStock || row.seckill_stock;
    form.limitPerUser = row.limitPerUser || row.limit_per_user || 1;
    form.timeRange = [row.startTime || row.start_time, row.endTime || row.end_time];
    form.status = row.status;
  } else {
    form.productId = null; form.seckillPrice = 0; form.seckillStock = 1;
    form.limitPerUser = 1; form.timeRange = []; form.status = "PENDING";
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    const payload = {
      productId: form.productId,
      seckillPrice: form.seckillPrice,
      seckillStock: form.seckillStock,
      limitPerUser: form.limitPerUser,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      status: form.status
    };
    if (editing.value) {
      await api.put(`/admin/seckill-products/${editingItem.value.id}`, payload);
      ElMessage.success("修改成功");
    } else {
      await api.post("/admin/seckill-products", payload);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false; await searchData();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function deleteItem(id: number) {
  try { await api.delete(`/admin/seckill-products/${id}`); ElMessage.success("删除成功"); await searchData(); }
  catch { ElMessage.error("删除失败"); }
}

async function loadData() { await searchData(); }

onMounted(() => { loadProducts(); loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>