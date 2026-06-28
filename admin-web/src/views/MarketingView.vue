<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>营销中心</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="优惠券" name="coupons">
          <div class="tab-toolbar">
            <el-input
              v-model="couponKeyword"
              placeholder="搜索优惠券名称"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadCoupons"
              @keyup.enter="loadCoupons"
            />
            <el-select v-model="couponStatus" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadCoupons">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="已启用" value="ACTIVE" />
              <el-option label="已暂停" value="PAUSED" />
              <el-option label="已结束" value="ENDED" />
            </el-select>
            <el-button @click="loadCoupons">搜索</el-button>
            <el-button type="primary" @click="couponDialogVisible = true">新建优惠券</el-button>
            <el-button @click="loadCoupons">刷新</el-button>
          </div>

          <el-table :data="coupons" v-loading="couponLoading" stripe>
            <el-table-column prop="name" label="优惠券名称" min-width="160" />
            <el-table-column prop="type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'CASH'" type="danger">满减券</el-tag>
                <el-tag v-else-if="row.type === 'DISCOUNT'" type="warning">折扣券</el-tag>
                <el-tag v-else-if="row.type === 'FREE_SHIPPING'" type="success">免邮券</el-tag>
                <el-tag v-else>{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="面值" width="140">
              <template #default="{ row }">
                <span v-if="row.type === 'CASH'">满{{ row.minAmount }}减{{ row.discountAmount }}</span>
                <span v-else-if="row.type === 'DISCOUNT'">{{ row.discountRate }}折</span>
                <span v-else>免邮</span>
              </template>
            </el-table-column>
            <el-table-column prop="totalCount" label="发放数量" width="100" />
            <el-table-column prop="usedCount" label="已使用" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
                <el-tag v-else-if="row.status === 'ACTIVE'" type="success">已启用</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="validPeriod" label="有效期" width="180">
              <template #default="{ row }">
                {{ row.validFrom || '' }} ~ {{ row.validTo || '' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewCouponDetail(row)">详情</el-button>
                <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="activateCoupon(row)">启用</el-button>
                <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseCoupon(row)">暂停</el-button>
                <el-button size="small" link type="danger" @click="deleteCoupon(row)">删除</el-button>
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
              :total="couponTotal"
              :page-size="couponPageSize"
              :current-page="couponPage"
              @size-change="handleCouponSizeChange"
              @current-change="handleCouponPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="满减活动" name="fullReduction">
          <div class="tab-toolbar">
            <el-select v-model="frStatus" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadFullReductions">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="进行中" value="ACTIVE" />
              <el-option label="已暂停" value="PAUSED" />
              <el-option label="已结束" value="ENDED" />
            </el-select>
            <el-button @click="loadFullReductions">搜索</el-button>
            <el-button type="primary" @click="frDialogVisible = true">新建活动</el-button>
            <el-button @click="loadFullReductions">刷新</el-button>
          </div>

          <el-table :data="fullReductions" v-loading="frLoading" stripe>
            <el-table-column prop="name" label="活动名称" min-width="160" />
            <el-table-column label="优惠规则" min-width="200">
              <template #default="{ row }">
                <span v-for="(rule, idx) in (row.rules || [])" :key="idx">
                  满{{ rule.minAmount }}减{{ rule.discountAmount }}<span v-if="idx < (row.rules?.length || 0) - 1">、</span>
                </span>
                <span v-if="!row.rules?.length">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
                <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="startTime" label="开始时间" width="170" />
            <el-table-column prop="endTime" label="结束时间" width="170" />
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewFRDetail(row)">详情</el-button>
                <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="activateFR(row)">启用</el-button>
                <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseFR(row)">暂停</el-button>
                <el-button size="small" link type="danger" @click="deleteFR(row)">删除</el-button>
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
              :total="frTotal"
              :page-size="frPageSize"
              :current-page="frPage"
              @size-change="handleFRSizeChange"
              @current-change="handleFRPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="秒杀活动" name="flashSale">
          <div class="tab-toolbar">
            <el-select v-model="fsStatus" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadFlashSales">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="进行中" value="ACTIVE" />
              <el-option label="已暂停" value="PAUSED" />
              <el-option label="已结束" value="ENDED" />
            </el-select>
            <el-button @click="loadFlashSales">搜索</el-button>
            <el-button type="primary" @click="fsDialogVisible = true">新建活动</el-button>
            <el-button @click="loadFlashSales">刷新</el-button>
          </div>

          <el-table :data="flashSales" v-loading="fsLoading" stripe>
            <el-table-column prop="name" label="活动名称" min-width="160" />
            <el-table-column prop="discountRate" label="折扣力度" width="120">
              <template #default="{ row }">{{ row.discountRate }}折</template>
            </el-table-column>
            <el-table-column prop="totalStock" label="总库存" width="100" />
            <el-table-column prop="soldCount" label="已售" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
                <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="startTime" label="开始时间" width="170" />
            <el-table-column prop="endTime" label="结束时间" width="170" />
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewFSDetail(row)">详情</el-button>
                <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="activateFS(row)">启用</el-button>
                <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="pauseFS(row)">暂停</el-button>
                <el-button size="small" link type="danger" @click="deleteFS(row)">删除</el-button>
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
              :total="fsTotal"
              :page-size="fsPageSize"
              :current-page="fsPage"
              @size-change="handleFSSizeChange"
              @current-change="handleFSPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="拼团活动" name="groupBuy">
          <div class="tab-toolbar">
            <el-select v-model="gbStatus" placeholder="状态" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadGroupBuys">
              <el-option label="草稿" value="DRAFT" />
              <el-option label="进行中" value="ACTIVE" />
              <el-option label="已结束" value="ENDED" />
            </el-select>
            <el-button @click="loadGroupBuys">搜索</el-button>
            <el-button type="primary" @click="gbDialogVisible = true">新建活动</el-button>
            <el-button @click="loadGroupBuys">刷新</el-button>
          </div>

          <el-table :data="groupBuys" v-loading="gbLoading" stripe>
            <el-table-column prop="name" label="活动名称" min-width="160" />
            <el-table-column prop="groupPrice" label="拼团价" width="120">
              <template #default="{ row }">¥{{ Number(row.groupPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="minGroupSize" label="成团人数" width="100" />
            <el-table-column prop="totalGroups" label="已成团" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
                <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
                <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="startTime" label="开始时间" width="170" />
            <el-table-column prop="endTime" label="结束时间" width="170" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewGBDetail(row)">详情</el-button>
                <el-button v-if="row.status === 'DRAFT'" size="small" link type="success" @click="activateGB(row)">启用</el-button>
                <el-button size="small" link type="danger" @click="deleteGB(row)">删除</el-button>
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
              :total="gbTotal"
              :page-size="gbPageSize"
              :current-page="gbPage"
              @size-change="handleGBSizeChange"
              @current-change="handleGBPageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="叠加规则" name="stackRules">
          <div class="tab-toolbar">
            <el-button type="primary" @click="stackDialogVisible = true">新建规则</el-button>
            <el-button @click="loadStackRules">刷新</el-button>
          </div>

          <el-table :data="stackRules" v-loading="stackLoading" stripe>
            <el-table-column prop="name" label="规则名称" min-width="160" />
            <el-table-column label="可叠加类型" min-width="200">
              <template #default="{ row }">
                <el-tag v-for="(type, idx) in (row.allowedTypes || [])" :key="idx" style="margin-right: 4px">
                  {{ type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="100" />
            <el-table-column prop="description" label="说明" min-width="160" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="editStackRule(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="handleDeleteStackRule(row)">删除</el-button>
              </template>
            </el-table-column>
          <template #empty>
            <el-empty description="暂无数据" :image-size="80" />
          </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="couponDialogVisible" title="新建优惠券" width="560px">
      <el-form :model="couponForm" label-width="100px">
        <el-form-item label="优惠券名称">
          <el-input v-model="couponForm.name" placeholder="请输入优惠券名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="couponForm.type" style="width: 100%">
            <el-option label="满减券" value="CASH" />
            <el-option label="折扣券" value="DISCOUNT" />
            <el-option label="免邮券" value="FREE_SHIPPING" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="couponForm.type === 'CASH'" label="最低消费">
          <el-input-number v-model="couponForm.minAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="couponForm.type === 'CASH'" label="减免金额">
          <el-input-number v-model="couponForm.discountAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="couponForm.type === 'DISCOUNT'" label="折扣率">
          <el-input-number v-model="couponForm.discountRate" :min="0" :max="10" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="发放数量">
          <el-input-number v-model="couponForm.totalCount" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="couponForm.validRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="couponDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="couponSubmitLoading" @click="submitCoupon">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchCouponTemplates,
  createCouponTemplate,
  activateCouponTemplate,
  pauseCouponTemplate,
  deleteCouponTemplate,
  fetchFullReductions,
  createFullReduction,
  activateFullReduction,
  pauseFullReduction,
  deleteFullReduction,
  fetchFlashSales,
  createFlashSale,
  activateFlashSale,
  pauseFlashSale,
  deleteFlashSale,
  fetchGroupBuys,
  createGroupBuy,
  activateGroupBuy,
  deleteGroupBuy,
  fetchStackRules,
  createStackRule,
  deleteStackRule,
} from "../api";

const activeTab = ref("coupons");

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function handleTabChange() {
  if (activeTab.value === "coupons" && coupons.value.length === 0) loadCoupons();
  if (activeTab.value === "fullReduction" && fullReductions.value.length === 0) loadFullReductions();
  if (activeTab.value === "flashSale" && flashSales.value.length === 0) loadFlashSales();
  if (activeTab.value === "groupBuy" && groupBuys.value.length === 0) loadGroupBuys();
  if (activeTab.value === "stackRules" && stackRules.value.length === 0) loadStackRules();
}

// ==================== Coupons ====================
const couponLoading = ref(false);
const couponSubmitLoading = ref(false);
const coupons = ref<any[]>([]);
const couponTotal = ref(0);
const couponPage = ref(1);
const couponPageSize = ref(20);
const couponKeyword = ref("");
const couponStatus = ref("");
const couponDialogVisible = ref(false);

const couponForm = reactive({
  name: "",
  type: "CASH",
  minAmount: 0,
  discountAmount: 0,
  discountRate: 0,
  totalCount: 100,
  validRange: [] as any[],
});

async function loadCoupons() {
  couponLoading.value = true;
  try {
    const data = await fetchCouponTemplates({
      keyword: couponKeyword.value || undefined,
      status: couponStatus.value || undefined,
      page: couponPage.value,
      pageSize: couponPageSize.value,
    });
    coupons.value = data.records || [];
    couponTotal.value = data.total || coupons.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载优惠券失败"));
  } finally {
    couponLoading.value = false;
  }
}

function handleCouponSizeChange(size: number) {
  couponPageSize.value = size;
  couponPage.value = 1;
  loadCoupons();
}

function handleCouponPageChange(p: number) {
  couponPage.value = p;
  loadCoupons();
}

async function submitCoupon() {
  if (!couponForm.name) {
    ElMessage.warning("请输入优惠券名称");
    return;
  }
  couponSubmitLoading.value = true;
  try {
    await createCouponTemplate(couponForm);
    ElMessage.success("创建成功");
    couponDialogVisible.value = false;
    loadCoupons();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "创建失败"));
  } finally {
    couponSubmitLoading.value = false;
  }
}

function viewCouponDetail(row: any) {
  ElMessage.info("查看详情: " + row.name);
}

async function activateCoupon(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认启用优惠券 ${row.name}?`, "确认启用", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await activateCouponTemplate(row.id);
    ElMessage.success("已启用");
    loadCoupons();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function pauseCoupon(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认暂停优惠券 ${row.name}?`, "确认暂停", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await pauseCouponTemplate(row.id);
    ElMessage.success("已暂停");
    loadCoupons();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function deleteCoupon(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除优惠券 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteCouponTemplate(row.id);
    ElMessage.success("已删除");
    loadCoupons();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ==================== Full Reduction ====================
const frLoading = ref(false);
const fullReductions = ref<any[]>([]);
const frTotal = ref(0);
const frPage = ref(1);
const frPageSize = ref(20);
const frStatus = ref("");
const frDialogVisible = ref(false);

async function loadFullReductions() {
  frLoading.value = true;
  try {
    const data = await fetchFullReductions({
      status: frStatus.value || undefined,
      page: frPage.value,
      pageSize: frPageSize.value,
    });
    fullReductions.value = data.records || [];
    frTotal.value = data.total || fullReductions.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载满减活动失败"));
  } finally {
    frLoading.value = false;
  }
}

function handleFRSizeChange(size: number) {
  frPageSize.value = size;
  frPage.value = 1;
  loadFullReductions();
}

function handleFRPageChange(p: number) {
  frPage.value = p;
  loadFullReductions();
}

function viewFRDetail(row: any) {
  ElMessage.info("查看详情: " + row.name);
}

async function activateFR(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认启用活动 ${row.name}?`, "确认启用", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await activateFullReduction(row.id);
    ElMessage.success("已启用");
    loadFullReductions();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function pauseFR(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认暂停活动 ${row.name}?`, "确认暂停", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await pauseFullReduction(row.id);
    ElMessage.success("已暂停");
    loadFullReductions();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function deleteFR(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除活动 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteFullReduction(row.id);
    ElMessage.success("已删除");
    loadFullReductions();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ==================== Flash Sale ====================
const fsLoading = ref(false);
const flashSales = ref<any[]>([]);
const fsTotal = ref(0);
const fsPage = ref(1);
const fsPageSize = ref(20);
const fsStatus = ref("");
const fsDialogVisible = ref(false);

async function loadFlashSales() {
  fsLoading.value = true;
  try {
    const data = await fetchFlashSales({
      status: fsStatus.value || undefined,
      page: fsPage.value,
      pageSize: fsPageSize.value,
    });
    flashSales.value = data.records || [];
    fsTotal.value = data.total || flashSales.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载秒杀活动失败"));
  } finally {
    fsLoading.value = false;
  }
}

function handleFSSizeChange(size: number) {
  fsPageSize.value = size;
  fsPage.value = 1;
  loadFlashSales();
}

function handleFSPageChange(p: number) {
  fsPage.value = p;
  loadFlashSales();
}

function viewFSDetail(row: any) {
  ElMessage.info("查看详情: " + row.name);
}

async function activateFS(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认启用秒杀 ${row.name}?`, "确认启用", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await activateFlashSale(row.id);
    ElMessage.success("已启用");
    loadFlashSales();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function pauseFS(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认暂停秒杀 ${row.name}?`, "确认暂停", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await pauseFlashSale(row.id);
    ElMessage.success("已暂停");
    loadFlashSales();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function deleteFS(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除秒杀 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteFlashSale(row.id);
    ElMessage.success("已删除");
    loadFlashSales();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ==================== Group Buy ====================
const gbLoading = ref(false);
const groupBuys = ref<any[]>([]);
const gbTotal = ref(0);
const gbPage = ref(1);
const gbPageSize = ref(20);
const gbStatus = ref("");
const gbDialogVisible = ref(false);

async function loadGroupBuys() {
  gbLoading.value = true;
  try {
    const data = await fetchGroupBuys({
      status: gbStatus.value || undefined,
      page: gbPage.value,
      pageSize: gbPageSize.value,
    });
    groupBuys.value = data.records || [];
    gbTotal.value = data.total || groupBuys.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载拼团活动失败"));
  } finally {
    gbLoading.value = false;
  }
}

function handleGBSizeChange(size: number) {
  gbPageSize.value = size;
  gbPage.value = 1;
  loadGroupBuys();
}

function handleGBPageChange(p: number) {
  gbPage.value = p;
  loadGroupBuys();
}

function viewGBDetail(row: any) {
  ElMessage.info("查看详情: " + row.name);
}

async function activateGB(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认启用拼团 ${row.name}?`, "确认启用", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await activateGroupBuy(row.id);
    ElMessage.success("已启用");
    loadGroupBuys();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "操作失败"));
  }
}

async function deleteGB(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除拼团 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteGroupBuy(row.id);
    ElMessage.success("已删除");
    loadGroupBuys();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ==================== Stack Rules ====================
const stackLoading = ref(false);
const stackRules = ref<any[]>([]);
const stackDialogVisible = ref(false);

async function loadStackRules() {
  stackLoading.value = true;
  try {
    const data = await fetchStackRules();
    stackRules.value = data || [];
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载叠加规则失败"));
  } finally {
    stackLoading.value = false;
  }
}

function editStackRule(row: any) {
  ElMessage.info("编辑规则: " + row.name);
}

async function handleDeleteStackRule(row: any) {
  const confirmed = await ElMessageBox.confirm(`确认删除规则 ${row.name}?`, "确认删除", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  try {
    await deleteStackRule(row.id);
    ElMessage.success("已删除");
    loadStackRules();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

onMounted(() => {
  loadCoupons();
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
}
.tab-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
