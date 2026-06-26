<template>
  <div class="page">
    <PageCard title="促销活动">
      <template #extra>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <el-tabs v-model="activeTab" @tab-change="loadData">
        <!-- 限时秒杀 -->
        <el-tab-pane label="限时秒杀" name="flash">
          <div class="tab-toolbar">
            <el-button type="primary" @click="openFlashDialog()">新增秒杀</el-button>
          </div>
          <el-table :data="flashSales" v-loading="flashLoading" stripe>
            <el-table-column prop="activityName" label="活动名称" min-width="160" />
            <el-table-column prop="startTime" label="开始时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="endTime" label="结束时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="info">未开始</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="productCount" label="商品数" width="100" align="center" />
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openFlashDialog(row)">编辑</el-button>
                <el-button v-if="row.status === 'PENDING' || row.status === 'PAUSED'" size="small" link type="success" @click="activateFlash(row.id)">启用</el-button>
                <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseFlash(row.id)">暂停</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteFlash(row.id)">
                  <template #reference>
                    <el-button size="small" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 满减活动 -->
        <el-tab-pane label="满减活动" name="full">
          <div class="tab-toolbar">
            <el-button type="primary" @click="openFullDialog()">新增满减</el-button>
          </div>
          <el-table :data="fullReductions" v-loading="fullLoading" stripe>
            <el-table-column prop="activityName" label="活动名称" min-width="160" />
            <el-table-column prop="rule" label="规则" width="200">
              <template #default="{ row }">
                满{{ formatYuan(row.thresholdAmount) }}减{{ formatYuan(row.reduceAmount) }}
              </template>
            </el-table-column>
            <el-table-column prop="startTime" label="开始时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="endTime" label="结束时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="info">未开始</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openFullDialog(row)">编辑</el-button>
                <el-button v-if="row.status === 'PENDING' || row.status === 'PAUSED'" size="small" link type="success" @click="activateFull(row.id)">启用</el-button>
                <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseFull(row.id)">暂停</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteFull(row.id)">
                  <template #reference>
                    <el-button size="small" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 拼团活动 -->
        <el-tab-pane label="拼团活动" name="group">
          <div class="tab-toolbar">
            <el-button type="primary" @click="openGroupDialog()">新增拼团</el-button>
          </div>
          <el-table :data="groupBuys" v-loading="groupLoading" stripe>
            <el-table-column prop="activityName" label="活动名称" min-width="160" />
            <el-table-column prop="groupSize" label="成团人数" width="120" align="center" />
            <el-table-column prop="startTime" label="开始时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="endTime" label="结束时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="info">未开始</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openGroupDialog(row)">编辑</el-button>
                <el-button v-if="row.status === 'PENDING' || row.status === 'PAUSED'" size="small" link type="success" @click="activateGroup(row.id)">启用</el-button>
                <el-popconfirm title="确定删除？" @confirm="deleteGroup(row.id)">
                  <template #reference>
                    <el-button size="small" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </PageCard>

    <!-- 秒杀弹窗 -->
    <el-dialog v-model="flashDialogVisible" :title="editingFlash ? '编辑秒杀' : '新增秒杀'" width="560px">
      <el-form ref="flashFormRef" :model="flashForm" :rules="flashRules" label-width="100px">
        <el-form-item label="活动名称" prop="activityName">
          <el-input v-model="flashForm.activityName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker v-model="flashForm.startTime" type="datetime" placeholder="选择开始时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker v-model="flashForm.endTime" type="datetime" placeholder="选择结束时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="秒杀商品">
          <el-select v-model="flashForm.productIds" multiple filterable placeholder="选择商品" style="width: 100%">
            <el-option v-for="p in productList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="flashDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="flashSubmitLoading" @click="handleFlashSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 满减弹窗 -->
    <el-dialog v-model="fullDialogVisible" :title="editingFull ? '编辑满减' : '新增满减'" width="560px">
      <el-form ref="fullFormRef" :model="fullForm" :rules="fullRules" label-width="100px">
        <el-form-item label="活动名称" prop="activityName">
          <el-input v-model="fullForm.activityName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="满减门槛" prop="thresholdAmount">
          <el-input-number v-model="fullForm.thresholdAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="减免金额" prop="reduceAmount">
          <el-input-number v-model="fullForm.reduceAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker v-model="fullForm.startTime" type="datetime" placeholder="选择开始时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker v-model="fullForm.endTime" type="datetime" placeholder="选择结束时间" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fullDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="fullSubmitLoading" @click="handleFullSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 拼团弹窗 -->
    <el-dialog v-model="groupDialogVisible" :title="editingGroup ? '编辑拼团' : '新增拼团'" width="560px">
      <el-form ref="groupFormRef" :model="groupForm" :rules="groupRules" label-width="100px">
        <el-form-item label="活动名称" prop="activityName">
          <el-input v-model="groupForm.activityName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="成团人数" prop="groupSize">
          <el-input-number v-model="groupForm.groupSize" :min="2" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker v-model="groupForm.startTime" type="datetime" placeholder="选择开始时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker v-model="groupForm.endTime" type="datetime" placeholder="选择结束时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="拼团商品">
          <el-select v-model="groupForm.productIds" multiple filterable placeholder="选择商品" style="width: 100%">
            <el-option v-for="p in productList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSubmitLoading" @click="handleGroupSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatYuan } from "../utils/format";
import {
  fetchFlashSales, createFlashSale, updateFlashSale, deleteFlashSale, activateFlashSale, pauseFlashSale,
  fetchFullReductions, createFullReduction, updateFullReduction, deleteFullReduction, activateFullReduction, pauseFullReduction,
  fetchGroupBuys, createGroupBuy, updateGroupBuy, deleteGroupBuy, activateGroupBuy,
  fetchProducts
} from "../api";

const activeTab = ref("flash");

// ============ 限时秒杀 ============
const flashSales = ref<any[]>([]);
const flashLoading = ref(false);
const flashDialogVisible = ref(false);
const editingFlash = ref<any>(null);
const flashFormRef = ref();
const flashSubmitLoading = ref(false);
const flashForm = reactive({
  activityName: "",
  startTime: null as Date | null,
  endTime: null as Date | null,
  productIds: [] as number[]
});
const flashRules = {
  activityName: [{ required: true, message: "请输入活动名称", trigger: "blur" }],
  startTime: [{ required: true, message: "请选择开始时间", trigger: "change" }],
  endTime: [{ required: true, message: "请选择结束时间", trigger: "change" }]
};

async function loadFlashSales() {
  flashLoading.value = true;
  try {
    const res = await fetchFlashSales();
    flashSales.value = res?.records || res?.list || [];
  } catch {
    ElMessage.error("加载秒杀活动失败");
  } finally {
    flashLoading.value = false;
  }
}

function openFlashDialog(row?: any) {
  editingFlash.value = row || null;
  if (row) {
    flashForm.activityName = row.activityName || "";
    flashForm.startTime = row.startTime ? new Date(row.startTime) : null;
    flashForm.endTime = row.endTime ? new Date(row.endTime) : null;
    flashForm.productIds = Array.isArray(row.productIds) ? [...row.productIds] : [];
  } else {
    flashForm.activityName = "";
    flashForm.startTime = null;
    flashForm.endTime = null;
    flashForm.productIds = [];
  }
  flashDialogVisible.value = true;
}

async function handleFlashSubmit() {
  const valid = await flashFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  flashSubmitLoading.value = true;
  try {
    const payload = {
      activityName: flashForm.activityName,
      startTime: flashForm.startTime?.toISOString(),
      endTime: flashForm.endTime?.toISOString(),
      productIds: flashForm.productIds
    };
    if (editingFlash.value) {
      await updateFlashSale(editingFlash.value.id, payload);
      ElMessage.success("秒杀活动更新成功");
    } else {
      await createFlashSale(payload);
      ElMessage.success("秒杀活动创建成功");
    }
    flashDialogVisible.value = false;
    await loadFlashSales();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    flashSubmitLoading.value = false;
  }
}

async function activateFlash(id: number) {
  try {
    await activateFlashSale(id);
    ElMessage.success("已启用");
    await loadFlashSales();
  } catch {
    ElMessage.error("操作失败");
  }
}

async function pauseFlash(id: number) {
  try {
    await pauseFlashSale(id);
    ElMessage.success("已暂停");
    await loadFlashSales();
  } catch {
    ElMessage.error("操作失败");
  }
}

async function deleteFlash(id: number) {
  try {
    await deleteFlashSale(id);
    ElMessage.success("已删除");
    await loadFlashSales();
  } catch {
    ElMessage.error("删除失败");
  }
}

// ============ 满减活动 ============
const fullReductions = ref<any[]>([]);
const fullLoading = ref(false);
const fullDialogVisible = ref(false);
const editingFull = ref<any>(null);
const fullFormRef = ref();
const fullSubmitLoading = ref(false);
const fullForm = reactive({
  activityName: "",
  thresholdAmount: 0,
  reduceAmount: 0,
  startTime: null as Date | null,
  endTime: null as Date | null
});
const fullRules = {
  activityName: [{ required: true, message: "请输入活动名称", trigger: "blur" }],
  thresholdAmount: [{ required: true, message: "请输入满减门槛", trigger: "blur" }],
  reduceAmount: [{ required: true, message: "请输入减免金额", trigger: "blur" }],
  startTime: [{ required: true, message: "请选择开始时间", trigger: "change" }],
  endTime: [{ required: true, message: "请选择结束时间", trigger: "change" }]
};

async function loadFullReductions() {
  fullLoading.value = true;
  try {
    const res = await fetchFullReductions();
    fullReductions.value = res?.records || res?.list || [];
  } catch {
    ElMessage.error("加载满减活动失败");
  } finally {
    fullLoading.value = false;
  }
}

function openFullDialog(row?: any) {
  editingFull.value = row || null;
  if (row) {
    fullForm.activityName = row.activityName || "";
    fullForm.thresholdAmount = row.thresholdAmount || 0;
    fullForm.reduceAmount = row.reduceAmount || 0;
    fullForm.startTime = row.startTime ? new Date(row.startTime) : null;
    fullForm.endTime = row.endTime ? new Date(row.endTime) : null;
  } else {
    fullForm.activityName = "";
    fullForm.thresholdAmount = 0;
    fullForm.reduceAmount = 0;
    fullForm.startTime = null;
    fullForm.endTime = null;
  }
  fullDialogVisible.value = true;
}

async function handleFullSubmit() {
  const valid = await fullFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  fullSubmitLoading.value = true;
  try {
    const payload = {
      activityName: fullForm.activityName,
      thresholdAmount: fullForm.thresholdAmount,
      reduceAmount: fullForm.reduceAmount,
      startTime: fullForm.startTime?.toISOString(),
      endTime: fullForm.endTime?.toISOString()
    };
    if (editingFull.value) {
      await updateFullReduction(editingFull.value.id, payload);
      ElMessage.success("满减活动更新成功");
    } else {
      await createFullReduction(payload);
      ElMessage.success("满减活动创建成功");
    }
    fullDialogVisible.value = false;
    await loadFullReductions();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    fullSubmitLoading.value = false;
  }
}

async function activateFull(id: number) {
  try {
    await activateFullReduction(id);
    ElMessage.success("已启用");
    await loadFullReductions();
  } catch {
    ElMessage.error("操作失败");
  }
}

async function pauseFull(id: number) {
  try {
    await pauseFullReduction(id);
    ElMessage.success("已暂停");
    await loadFullReductions();
  } catch {
    ElMessage.error("操作失败");
  }
}

async function deleteFull(id: number) {
  try {
    await deleteFullReduction(id);
    ElMessage.success("已删除");
    await loadFullReductions();
  } catch {
    ElMessage.error("删除失败");
  }
}

// ============ 拼团活动 ============
const groupBuys = ref<any[]>([]);
const groupLoading = ref(false);
const groupDialogVisible = ref(false);
const editingGroup = ref<any>(null);
const groupFormRef = ref();
const groupSubmitLoading = ref(false);
const groupForm = reactive({
  activityName: "",
  groupSize: 2,
  startTime: null as Date | null,
  endTime: null as Date | null,
  productIds: [] as number[]
});
const groupRules = {
  activityName: [{ required: true, message: "请输入活动名称", trigger: "blur" }],
  groupSize: [{ required: true, message: "请输入成团人数", trigger: "blur" }],
  startTime: [{ required: true, message: "请选择开始时间", trigger: "change" }],
  endTime: [{ required: true, message: "请选择结束时间", trigger: "change" }]
};

async function loadGroupBuys() {
  groupLoading.value = true;
  try {
    const res = await fetchGroupBuys();
    groupBuys.value = res?.records || res?.list || [];
  } catch {
    ElMessage.error("加载拼团活动失败");
  } finally {
    groupLoading.value = false;
  }
}

function openGroupDialog(row?: any) {
  editingGroup.value = row || null;
  if (row) {
    groupForm.activityName = row.activityName || "";
    groupForm.groupSize = row.groupSize || 2;
    groupForm.startTime = row.startTime ? new Date(row.startTime) : null;
    groupForm.endTime = row.endTime ? new Date(row.endTime) : null;
    groupForm.productIds = Array.isArray(row.productIds) ? [...row.productIds] : [];
  } else {
    groupForm.activityName = "";
    groupForm.groupSize = 2;
    groupForm.startTime = null;
    groupForm.endTime = null;
    groupForm.productIds = [];
  }
  groupDialogVisible.value = true;
}

async function handleGroupSubmit() {
  const valid = await groupFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  groupSubmitLoading.value = true;
  try {
    const payload = {
      activityName: groupForm.activityName,
      groupSize: groupForm.groupSize,
      startTime: groupForm.startTime?.toISOString(),
      endTime: groupForm.endTime?.toISOString(),
      productIds: groupForm.productIds
    };
    if (editingGroup.value) {
      await updateGroupBuy(editingGroup.value.id, payload);
      ElMessage.success("拼团活动更新成功");
    } else {
      await createGroupBuy(payload);
      ElMessage.success("拼团活动创建成功");
    }
    groupDialogVisible.value = false;
    await loadGroupBuys();
  } catch {
    ElMessage.error("操作失败");
  } finally {
    groupSubmitLoading.value = false;
  }
}

async function activateGroup(id: number) {
  try {
    await activateGroupBuy(id);
    ElMessage.success("已启用");
    await loadGroupBuys();
  } catch {
    ElMessage.error("操作失败");
  }
}

async function deleteGroup(id: number) {
  try {
    await deleteGroupBuy(id);
    ElMessage.success("已删除");
    await loadGroupBuys();
  } catch {
    ElMessage.error("删除失败");
  }
}

// ============ Common ============
const productList = ref<any[]>([]);

async function loadProductList() {
  try {
    const res = await fetchProducts();
    productList.value = res?.records || res?.list || [];
  } catch {
    // ignore
  }
}

async function loadData() {
  if (activeTab.value === "flash") {
    await loadFlashSales();
  } else if (activeTab.value === "full") {
    await loadFullReductions();
  } else if (activeTab.value === "group") {
    await loadGroupBuys();
  }
}

onMounted(() => {
  loadFlashSales();
  loadProductList();
});
</script>

<style scoped>
.tab-toolbar {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>