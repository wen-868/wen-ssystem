<template>
  <div class="page">
    <PageCard title="拼团管理">
      <template #extra>
        <el-button type="primary" @click="openActivityDialog()">新增活动</el-button>
        <el-button @click="loadActivities">刷新</el-button>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 活动管理 tab -->
        <el-tab-pane label="活动管理" name="activities">
          <div class="search-bar">
            <el-select v-model="activitySearch.status" placeholder="活动状态" clearable style="width: 140px" @change="searchActivities">
              <el-option label="待开始" value="PENDING" />
              <el-option label="进行中" value="ACTIVE" />
              <el-option label="已结束" value="ENDED" />
            </el-select>
            <el-button type="primary" style="margin-left: 12px" @click="searchActivities">搜索</el-button>
          </div>

          <el-table :data="activityList" v-loading="activityLoading" stripe>
            <el-table-column prop="productName" label="商品名称" min-width="140" />
            <el-table-column label="拼团价" width="110">
              <template #default="{ row }">¥{{ row.groupPrice }}</template>
            </el-table-column>
            <el-table-column label="原价" width="100">
              <template #default="{ row }">¥{{ row.originalPrice || '-' }}</template>
            </el-table-column>
            <el-table-column prop="minGroupSize" label="最低成团人数" width="120" align="center" />
            <el-table-column prop="maxGroupSize" label="最大参团人数" width="120" align="center" />
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
                <el-button size="small" link type="primary" @click="openActivityDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteActivity(row.id)">
                  <template #reference><el-button size="small" link type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
          </el-table>

          <div class="pagination">
            <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="activityTotal" :page-size="activityPageSize" :current-page="activityPage" @size-change="(s: number) => { activityPageSize = s; searchActivities(); }" @current-change="(p: number) => { activityPage = p; searchActivities(); }" />
          </div>
        </el-tab-pane>

        <!-- 拼团记录 tab -->
        <el-tab-pane label="拼团记录" name="records">
          <div class="search-bar">
            <el-select v-model="recordSearch.activityId" placeholder="活动筛选" clearable style="width: 200px" @change="searchRecords">
              <el-option v-for="a in activityList" :key="a.id" :label="a.productName" :value="a.id" />
            </el-select>
            <el-select v-model="recordSearch.status" placeholder="状态" clearable style="width: 140px; margin-left: 12px" @change="searchRecords">
              <el-option label="拼团中" value="GROUPING" />
              <el-option label="已成团" value="SUCCESS" />
              <el-option label="已失败" value="FAILED" />
            </el-select>
            <el-button type="primary" style="margin-left: 12px" @click="searchRecords">搜索</el-button>
          </div>

          <el-table :data="recordList" v-loading="recordLoading" stripe>
            <el-table-column prop="id" label="团号" width="100" />
            <el-table-column prop="productName" label="商品" min-width="140" />
            <el-table-column label="拼团价" width="110">
              <template #default="{ row }">¥{{ row.groupPrice }}</template>
            </el-table-column>
            <el-table-column prop="memberCount" label="参团人数" width="100" align="center" />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'GROUPING'" type="warning">拼团中</el-tag>
                <el-tag v-else-if="row.status === 'SUCCESS'" type="success">已成团</el-tag>
                <el-tag v-else-if="row.status === 'FAILED'" type="danger">已失败</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
          </el-table>

          <div class="pagination">
            <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="recordTotal" :page-size="recordPageSize" :current-page="recordPage" @size-change="(s: number) => { recordPageSize = s; searchRecords(); }" @current-change="(p: number) => { recordPage = p; searchRecords(); }" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 活动新增/编辑 dialog -->
    <el-dialog v-model="activityDialogVisible" :title="activityEditing ? '编辑活动' : '新增活动'" width="520px">
      <el-form ref="activityFormRef" :model="activityForm" :rules="activityFormRules" label-width="120px">
        <el-form-item label="选择商品" prop="productId">
          <el-select v-model="activityForm.productId" placeholder="请选择商品" filterable style="width: 100%">
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="拼团价格" prop="groupPrice">
          <el-input-number v-model="activityForm.groupPrice" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最低成团人数" prop="minGroupSize">
          <el-input-number v-model="activityForm.minGroupSize" :min="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最大参团人数">
          <el-input-number v-model="activityForm.maxGroupSize" :min="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="活动时间" prop="timeRange">
          <el-date-picker v-model="activityForm.timeRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="activityForm.status" style="width: 100%">
            <el-option label="待开始" value="PENDING" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="activityDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="activitySubmitLoading" @click="handleActivitySubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { api } from "../api";

// ============ Tabs ============
const activeTab = ref("activities");

// ============ 活动管理 ============
const activityList = ref<any[]>([]);
const products = ref<any[]>([]);
const activityLoading = ref(false); const activityTotal = ref(0); const activityPage = ref(1); const activityPageSize = ref(20);
const activityDialogVisible = ref(false); const activityEditing = ref(false); const activityFormRef = ref(); const activitySubmitLoading = ref(false);
const activityEditingItem = ref<any>(null);

const activitySearch = reactive({ status: "" });
const activityForm = reactive({
  productId: null as number | null,
  groupPrice: 0,
  minGroupSize: 2,
  maxGroupSize: 10,
  timeRange: [] as any[],
  status: "PENDING"
});

const activityFormRules: FormRules = {
  productId: [{ required: true, message: '请选择商品' }],
  groupPrice: [{ required: true, message: '请输入拼团价格' }],
  minGroupSize: [{ required: true, message: '请输入最低成团人数' }],
  timeRange: [{ required: true, message: '请选择活动时间' }]
};

async function loadProducts() {
  try {
    const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 200 } });
    const res = data.data || {};
    products.value = res.records || res.list || [];
  } catch { /* ignore */ }
}

async function searchActivities() {
  activityLoading.value = true;
  try {
    const { data } = await api.get("/admin/group-buy-activities", {
      params: { page: activityPage.value, pageSize: activityPageSize.value, status: activitySearch.status || undefined }
    });
    const res = data.data || {};
    activityList.value = res.records || [];
    activityTotal.value = res.total || 0;
  } catch { ElMessage.error("加载拼团活动失败"); }
  finally { activityLoading.value = false; }
}

function openActivityDialog(row?: any) {
  activityEditingItem.value = row || null; activityEditing.value = !!row;
  if (row) {
    activityForm.productId = row.productId || row.product_id;
    activityForm.groupPrice = row.groupPrice || row.group_price;
    activityForm.minGroupSize = row.minGroupSize || row.min_group_size || 2;
    activityForm.maxGroupSize = row.maxGroupSize || row.max_group_size || 10;
    activityForm.timeRange = [row.startTime || row.start_time, row.endTime || row.end_time];
    activityForm.status = row.status;
  } else {
    activityForm.productId = null; activityForm.groupPrice = 0; activityForm.minGroupSize = 2;
    activityForm.maxGroupSize = 10; activityForm.timeRange = []; activityForm.status = "PENDING";
  }
  activityDialogVisible.value = true;
}

async function handleActivitySubmit() {
  const valid = await activityFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  activitySubmitLoading.value = true;
  try {
    const payload = {
      productId: activityForm.productId,
      groupPrice: activityForm.groupPrice,
      minGroupSize: activityForm.minGroupSize,
      maxGroupSize: activityForm.maxGroupSize,
      startTime: activityForm.timeRange[0] || "",
      endTime: activityForm.timeRange[1] || "",
      status: activityForm.status
    };
    if (activityEditing.value) {
      await api.put(`/admin/group-buy-activities/${activityEditingItem.value.id}`, payload);
      ElMessage.success("修改成功");
    } else {
      await api.post("/admin/group-buy-activities", payload);
      ElMessage.success("创建成功");
    }
    activityDialogVisible.value = false; await searchActivities();
  } catch { ElMessage.error("操作失败"); }
  finally { activitySubmitLoading.value = false; }
}

async function deleteActivity(id: number) {
  try { await api.delete(`/admin/group-buy-activities/${id}`); ElMessage.success("删除成功"); await searchActivities(); }
  catch { ElMessage.error("删除失败"); }
}

async function loadActivities() { await searchActivities(); }

// ============ 拼团记录 ============
const recordList = ref<any[]>([]);
const recordLoading = ref(false); const recordTotal = ref(0); const recordPage = ref(1); const recordPageSize = ref(20);

const recordSearch = reactive({ activityId: null as number | null, status: "" });

async function searchRecords() {
  recordLoading.value = true;
  try {
    const { data } = await api.get("/admin/group-buy-records", {
      params: { page: recordPage.value, pageSize: recordPageSize.value, activityId: recordSearch.activityId || undefined, status: recordSearch.status || undefined }
    });
    const res = data.data || {};
    recordList.value = res.records || [];
    recordTotal.value = res.total || 0;
  } catch { ElMessage.error("加载拼团记录失败"); }
  finally { recordLoading.value = false; }
}

function handleTabChange(tab: any) {
  const name = typeof tab === "string" ? tab : tab?.paneName || tab;
  if (name === "records") { searchRecords(); }
}

onMounted(() => { loadProducts(); loadActivities(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>