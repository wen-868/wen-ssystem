<template>
  <div class="page">
    <PageCard title="SaaS 套餐管理">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增套餐</el-button>
        <el-button @click="loadPlans">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="套餐名称"
          clearable
          style="width: 200px"
          @keyup.enter="loadPlans"
        />
        <el-select
          v-model="searchStatus"
          placeholder="状态"
          clearable
          style="width: 140px; margin-left: 12px"
          @change="loadPlans"
        >
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="INACTIVE" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="loadPlans">搜索</el-button>
      </div>

      <el-table :data="filteredPlans" v-loading="loading" stripe>
        <el-table-column prop="name" label="套餐名称" min-width="140">
          <template #default="{ row }">
            <el-tag :type="getPlanTagType(row.name)">{{ row.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="月费" width="120" align="center">
          <template #default="{ row }">
            <span class="price-text">{{ formatYuan(row.price) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="年费" width="120" align="center">
          <template #default="{ row }">
            <span class="price-text">{{ formatYuan(row.annualPrice || row.price * 10) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长(月)" width="100" align="center" />
        <el-table-column label="功能模块" min-width="280">
          <template #default="{ row }">
            <el-tag
              v-for="mod in getEnabledModules(row)"
              :key="mod.key"
              size="small"
              style="margin-right: 4px; margin-bottom: 4px"
              :type="mod.tagType"
            >{{ mod.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'INACTIVE' ? 'info' : 'success'">
              {{ row.status === 'INACTIVE' ? '停用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="warning" @click="openModuleDialog(row)">功能配置</el-button>
            <el-button size="small" link type="success" @click="openPricingDialog(row)">定价管理</el-button>
            <el-button size="small" link type="danger" @click="handleToggleStatus(row)">
              {{ row.status === 'INACTIVE' ? '启用' : '停用' }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无套餐数据" :image-size="80" />
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
    </PageCard>

    <!-- 新增/编辑套餐对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑套餐' : '新增套餐'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="套餐名称" prop="name">
          <el-input v-model="form.name" placeholder="如：基础版、标准版、旗舰版" />
        </el-form-item>
        <el-form-item label="月费(元)" prop="price">
          <el-input-number v-model="form.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="年费(元)" prop="annualPrice">
          <el-input-number v-model="form.annualPrice" :min="0" :precision="2" style="width: 100%" placeholder="不填则自动按月费x10计算" />
        </el-form-item>
        <el-form-item label="时长(月)" prop="duration">
          <el-input-number v-model="form.duration" :min="1" :max="120" style="width: 100%" />
        </el-form-item>
        <el-form-item label="套餐描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="套餐详细描述" />
        </el-form-item>
        <el-form-item label="功能特性">
          <div style="display: flex; gap: 8px; margin-bottom: 8px; width: 100%">
            <el-input v-model="featureInput" placeholder="输入特性后回车添加" @keyup.enter="addFeature" style="flex: 1" />
            <el-button @click="addFeature">添加</el-button>
          </div>
          <el-tag
            v-for="(feat, idx) in form.features"
            :key="idx"
            closable
            @close="removeFeature(idx)"
            style="margin-right: 6px; margin-bottom: 4px"
          >{{ feat }}</el-tag>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-value="ACTIVE" inactive-value="INACTIVE" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 功能模块配置对话框 -->
    <el-dialog v-model="moduleDialogVisible" title="功能模块配置" width="600px">
      <el-alert title="勾选该套餐包含的功能模块，未勾选的模块该套餐租户无法使用" type="info" :closable="false" style="margin-bottom: 16px" />
      <el-table :data="moduleList" stripe>
        <el-table-column label="模块" width="160">
          <template #default="{ row }">
            <el-tag :type="row.tagType">{{ row.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="200" />
        <el-table-column label="启用" width="100" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="moduleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="moduleSubmitLoading" @click="handleModuleSubmit">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 定价管理对话框 -->
    <el-dialog v-model="pricingDialogVisible" title="套餐定价管理" width="500px">
      <el-form ref="pricingFormRef" :model="pricingForm" label-width="120px">
        <el-form-item label="套餐名称">
          <el-input :value="pricingForm.name" disabled />
        </el-form-item>
        <el-form-item label="月费(元)">
          <el-input-number v-model="pricingForm.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="年费(元)">
          <el-input-number v-model="pricingForm.annualPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="季度费(元)">
          <el-input-number v-model="pricingForm.quarterlyPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="一次性开通费">
          <el-input-number v-model="pricingForm.setupFee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="超出用户单价">
          <el-input-number v-model="pricingForm.extraUserPrice" :min="0" :precision="2" style="width: 100%" />
          <span class="form-hint">超出套餐包含用户数后，每个额外用户的月费</span>
        </el-form-item>
        <el-form-item label="超出门店单价">
          <el-input-number v-model="pricingForm.extraStorePrice" :min="0" :precision="2" style="width: 100%" />
          <span class="form-hint">超出套餐包含门店数后，每个额外门店的月费</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pricingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pricingSubmitLoading" @click="handlePricingSubmit">保存定价</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatYuan } from "../utils/format";
import { fetchSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan } from "../api";

// 功能模块定义
interface PlanModule {
  key: string;
  label: string;
  description: string;
  tagType: "" | "success" | "warning" | "info" | "danger";
  enabled: boolean;
}

const allModules: Omit<PlanModule, "enabled">[] = [
  { key: "sales", label: "销售管理", description: "销售开单、销售单据、退货管理", tagType: "" },
  { key: "purchase", label: "采购管理", description: "采购订单、入库、退货、供应商管理", tagType: "" },
  { key: "inventory", label: "库存管理", description: "库存列表、盘点、调拨、批次管理", tagType: "success" },
  { key: "instant_retail", label: "即时零售", description: "外卖平台对接、商品上架、订单同步", tagType: "warning" },
  { key: "marketing", label: "营销推广", description: "优惠券、秒杀、满减、积分商城", tagType: "danger" },
  { key: "member", label: "会员体系", description: "会员管理、储值卡、积分、等级", tagType: "info" },
  { key: "finance", label: "财务管理", description: "收付款、对账、费用、利润核算", tagType: "" },
  { key: "reports", label: "数据报表", description: "销售分析、库存报表、自定义报表", tagType: "success" },
  { key: "terminal", label: "门店终端", description: "收银台、交接班、日结管理", tagType: "warning" },
  { key: "miniapp", label: "小程序商城", description: "C端小程序、在线下单、微信支付", tagType: "danger" }
];

const loading = ref(false);
const submitLoading = ref(false);
const plans = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchKeyword = ref("");
const searchStatus = ref("");

const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const editingPlanId = ref<number | string>("");
const featureInput = ref("");

const form = reactive({
  name: "",
  price: 0,
  annualPrice: 0,
  duration: 1,
  description: "",
  features: [] as string[],
  status: "ACTIVE" as string
});

const rules: FormRules = {
  name: [{ required: true, message: "请填写套餐名称", trigger: "blur" }],
  price: [{ required: true, message: "请填写月费", trigger: "blur" }],
  duration: [{ required: true, message: "请填写时长", trigger: "blur" }]
};

// 功能模块配置
const moduleDialogVisible = ref(false);
const moduleSubmitLoading = ref(false);
const moduleList = ref<PlanModule[]>([]);
const editingModulePlanId = ref<number | string>("");

// 定价管理
const pricingDialogVisible = ref(false);
const pricingSubmitLoading = ref(false);
const pricingForm = reactive({
  name: "",
  price: 0,
  annualPrice: 0,
  quarterlyPrice: 0,
  setupFee: 0,
  extraUserPrice: 0,
  extraStorePrice: 0
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

const filteredPlans = computed(() => {
  let list = plans.value;
  if (searchKeyword.value) {
    list = list.filter((p: any) => p.name?.includes(searchKeyword.value));
  }
  if (searchStatus.value) {
    list = list.filter((p: any) => (p.status || "ACTIVE") === searchStatus.value);
  }
  return list;
});

function getPlanTagType(name: string): "" | "success" | "warning" | "danger" | "info" {
  if (name?.includes("旗舰") || name?.includes("企业")) return "danger";
  if (name?.includes("标准") || name?.includes("专业")) return "warning";
  if (name?.includes("基础") || name?.includes("入门")) return "info";
  return "";
}

function getEnabledModules(row: any): Omit<PlanModule, "enabled" | "description">[] {
  const modules: string[] = row.modules || row.featureModules || [];
  if (modules.length === 0) {
    // 默认全部启用
    return allModules.map(m => ({ key: m.key, label: m.label, tagType: m.tagType }));
  }
  return allModules
    .filter(m => modules.includes(m.key))
    .map(m => ({ key: m.key, label: m.label, tagType: m.tagType }));
}

async function loadPlans() {
  loading.value = true;
  try {
    const data = (await fetchSubscriptionPlans({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      status: searchStatus.value || undefined
    })).data;
    const list = data.records || data.list || [];
    total.value = data.total || list.length;
    plans.value = list;
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "加载套餐列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadPlans();
}

function handlePageChange(p: number) {
  page.value = p;
  loadPlans();
}

function openDialog(row?: any) {
  isEdit.value = !!row;
  editingPlanId.value = row?.planId || row?.id || "";
  if (row) {
    form.name = row.name || "";
    form.price = row.price || 0;
    form.annualPrice = row.annualPrice || 0;
    form.duration = row.duration || 1;
    form.description = row.description || "";
    form.features = [...(row.features || [])];
    form.status = row.status || "ACTIVE";
  } else {
    form.name = "";
    form.price = 0;
    form.annualPrice = 0;
    form.duration = 1;
    form.description = "";
    form.features = [];
    form.status = "ACTIVE";
  }
  featureInput.value = "";
  dialogVisible.value = true;
}

function addFeature() {
  const val = featureInput.value.trim();
  if (val && !form.features.includes(val)) {
    form.features.push(val);
  }
  featureInput.value = "";
}

function removeFeature(idx: number) {
  form.features.splice(idx, 1);
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        price: form.price,
        annualPrice: form.annualPrice || form.price * 10,
        duration: form.duration,
        description: form.description,
        features: form.features,
        status: form.status
      };
      if (isEdit.value) {
        await updateSubscriptionPlan(Number(editingPlanId.value), payload);
        ElMessage.success("套餐已更新");
      } else {
        await createSubscriptionPlan(payload);
        ElMessage.success("套餐已创建");
      }
      dialogVisible.value = false;
      loadPlans();
    } catch (e: unknown) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新套餐失败" : "创建套餐失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
  const action = newStatus === "ACTIVE" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确定要${action}套餐「${row.name}」吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await updateSubscriptionPlan(Number(row.planId || row.id), { status: newStatus });
    ElMessage.success(`套餐已${action}`);
    loadPlans();
  } catch (e: unknown) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${action}套餐失败`));
    }
  }
}

// 功能模块配置
function openModuleDialog(row: any) {
  editingModulePlanId.value = row.planId || row.id;
  const enabledModules: string[] = row.modules || row.featureModules || [];
  moduleList.value = allModules.map(m => ({
    ...m,
    enabled: enabledModules.length === 0 || enabledModules.includes(m.key)
  }));
  moduleDialogVisible.value = true;
}

async function handleModuleSubmit() {
  moduleSubmitLoading.value = true;
  try {
    const enabledKeys = moduleList.value.filter(m => m.enabled).map(m => m.key);
    await updateSubscriptionPlan(Number(editingModulePlanId.value), { modules: enabledKeys });
    ElMessage.success("功能模块配置已保存");
    moduleDialogVisible.value = false;
    loadPlans();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "保存功能模块配置失败"));
  } finally {
    moduleSubmitLoading.value = false;
  }
}

// 定价管理
function openPricingDialog(row: any) {
  editingPlanId.value = row.planId || row.id;
  pricingForm.name = row.name || "";
  pricingForm.price = row.price || 0;
  pricingForm.annualPrice = row.annualPrice || row.price * 10 || 0;
  pricingForm.quarterlyPrice = row.quarterlyPrice || 0;
  pricingForm.setupFee = row.setupFee || 0;
  pricingForm.extraUserPrice = row.extraUserPrice || 0;
  pricingForm.extraStorePrice = row.extraStorePrice || 0;
  pricingDialogVisible.value = true;
}

async function handlePricingSubmit() {
  pricingSubmitLoading.value = true;
  try {
    await updateSubscriptionPlan(Number(editingPlanId.value), {
      price: pricingForm.price,
      annualPrice: pricingForm.annualPrice,
      quarterlyPrice: pricingForm.quarterlyPrice,
      setupFee: pricingForm.setupFee,
      extraUserPrice: pricingForm.extraUserPrice,
      extraStorePrice: pricingForm.extraStorePrice
    });
    ElMessage.success("定价已保存");
    pricingDialogVisible.value = false;
    loadPlans();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "保存定价失败"));
  } finally {
    pricingSubmitLoading.value = false;
  }
}

onMounted(() => {
  loadPlans();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.price-text {
  font-weight: 600;
  color: #e6a23c;
}
.form-hint {
  font-size: 12px;
  color: #999;
  display: block;
  margin-top: 4px;
}
</style>
