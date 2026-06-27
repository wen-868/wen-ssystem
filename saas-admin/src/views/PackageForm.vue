<template>
  <div>
    <el-page-header @back="goBack" :content="isEdit ? '编辑套餐' : '新建套餐'" style="margin-bottom: 24px;" />

    <el-card v-loading="pageLoading">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" style="max-width: 800px;">
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="套餐编码" prop="planCode">
              <el-input v-model="form.planCode" placeholder="如 BASIC、PRO、ENTERPRISE" :disabled="isEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="套餐名称" prop="planName">
              <el-input v-model="form.planName" placeholder="如 基础版" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="套餐类型" prop="planType">
              <el-select v-model="form.planType" style="width: 100%;">
                <el-option label="月付" value="MONTHLY" />
                <el-option label="年付" value="YEARLY" />
                <el-option label="永久" value="PERMANENT" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio-button value="ACTIVE">启用</el-radio-button>
                <el-radio-button value="INACTIVE">停用</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="套餐简要描述" />
        </el-form-item>

        <!-- 价格与期限 -->
        <el-divider content-position="left">价格与期限</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="售价" prop="price">
              <el-input-number v-model="form.price" :min="0" :precision="2" :step="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原价" prop="originalPrice">
              <el-input-number v-model="form.originalPrice" :min="0" :precision="2" :step="100" placeholder="选填" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="有效期(天)" prop="durationDays">
              <el-input-number v-model="form.durationDays" :min="1" :step="30" :disabled="form.planType === 'PERMANENT'" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="form.sortOrder" :min="0" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 资源限制 -->
        <el-divider content-position="left">资源限制</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大用户数" prop="maxUsers">
              <el-input-number v-model="form.maxUsers" :min="1" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大门店数" prop="maxStores">
              <el-input-number v-model="form.maxStores" :min="1" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大商品数" prop="maxProducts">
              <el-input-number v-model="form.maxProducts" :min="1" :step="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大客户数" prop="maxCustomers">
              <el-input-number v-model="form.maxCustomers" :min="1" :step="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="最大存储(MB)" prop="maxStorageMb">
          <el-input-number v-model="form.maxStorageMb" :min="1" :step="512" style="width: 240px;" />
        </el-form-item>

        <!-- 功能模块 -->
        <el-divider content-position="left">功能模块</el-divider>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          <el-checkbox
            v-for="mod in moduleOptions"
            :key="mod.code"
            :model-value="selectedModules.includes(mod.code)"
            @change="(val: any) => toggleModule(mod.code, val)"
            border
          >
            {{ mod.label }}
          </el-checkbox>
        </div>

        <!-- 特色功能 -->
        <el-divider content-position="left">特色功能</el-divider>
        <el-form-item label="功能标签">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-tag
              v-for="(tag, idx) in form.features"
              :key="idx"
              closable
              @close="removeFeature(idx)"
            >{{ tag }}</el-tag>
            <el-input
              v-if="showFeatureInput"
              ref="featureInputRef"
              v-model="featureInputValue"
              size="small"
              style="width: 120px;"
              placeholder="输入标签"
              @keyup.enter="addFeature"
              @blur="addFeature"
            />
            <el-button v-else size="small" @click="showFeatureInput = true">+ 添加标签</el-button>
          </div>
        </el-form-item>

        <el-form-item style="margin-top: 32px;">
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '创建套餐' }}
          </el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { getPlanDetail, createPlan, updatePlan } from "../api";

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => !!route.params.id);
const planId = computed(() => Number(route.params.id));

const formRef = ref<FormInstance>();
const pageLoading = ref(false);
const submitLoading = ref(false);

const form = reactive({
  planCode: "",
  planName: "",
  planType: "MONTHLY" as string,
  price: 0,
  originalPrice: null as number | null,
  durationDays: 30,
  maxUsers: 5,
  maxStores: 1,
  maxCustomers: 1000,
  maxProducts: 500,
  maxStorageMb: 1024,
  features: [] as string[],
  description: "",
  sortOrder: 0,
  status: "ACTIVE" as string
});

const moduleOptions = [
  { code: "PRODUCT", label: "商品中心" },
  { code: "PURCHASE", label: "采购管理" },
  { code: "INVENTORY", label: "库存管理" },
  { code: "SALE", label: "销售管理" },
  { code: "CUSTOMER", label: "客户管理" },
  { code: "MARKETING", label: "营销中心" },
  { code: "FINANCE", label: "财务管理" },
  { code: "REPORT", label: "经营分析" },
  { code: "SYSTEM", label: "系统设置" }
];

const selectedModules = ref<string[]>([]);

function toggleModule(code: string, checked: boolean) {
  if (checked) {
    if (!selectedModules.value.includes(code)) {
      selectedModules.value.push(code);
    }
  } else {
    selectedModules.value = selectedModules.value.filter(m => m !== code);
  }
}

const showFeatureInput = ref(false);
const featureInputValue = ref("");
const featureInputRef = ref<any>();

function addFeature() {
  const val = featureInputValue.value.trim();
  if (val && !form.features.includes(val)) {
    form.features.push(val);
    featureInputValue.value = "";
  }
  showFeatureInput.value = false;
}

function removeFeature(idx: number) {
  form.features.splice(idx, 1);
}

const rules: FormRules = {
  planCode: [{ required: true, message: "请输入套餐编码", trigger: "blur" }],
  planName: [{ required: true, message: "请输入套餐名称", trigger: "blur" }],
  planType: [{ required: true, message: "请选择套餐类型", trigger: "change" }],
  price: [{ required: true, type: "number", message: "请输入售价", trigger: "blur" }],
  durationDays: [{ required: true, type: "number", message: "请输入有效期", trigger: "blur" }],
  maxUsers: [{ required: true, type: "number", message: "请输入最大用户数", trigger: "blur" }]
};

function goBack() {
  router.push("/packages");
}

async function fetchDetail() {
  pageLoading.value = true;
  try {
    const res = await getPlanDetail(planId.value);
    const data = res.data?.data || (res as any).data || res;
    const features = typeof data.features === "string" ? JSON.parse(data.features || "[]") : (data.features || []);
    const moduleAccess: string[] = typeof data.moduleAccess === "string" ? JSON.parse(data.moduleAccess || "[]") : (data.moduleAccess || []);

    Object.assign(form, {
      planCode: data.planCode || "",
      planName: data.planName || "",
      planType: data.planType || "MONTHLY",
      price: data.price || 0,
      originalPrice: data.originalPrice ?? null,
      durationDays: data.durationDays || 30,
      maxUsers: data.maxUsers ?? 5,
      maxStores: data.maxStores ?? 1,
      maxCustomers: data.maxCustomers ?? 1000,
      maxProducts: data.maxProducts ?? 500,
      maxStorageMb: data.maxStorageMb ?? 1024,
      features,
      description: data.description || "",
      sortOrder: data.sortOrder ?? 0,
      status: data.status || "ACTIVE"
    });
    selectedModules.value = [...moduleAccess];
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    pageLoading.value = false;
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch { return; }

  submitLoading.value = true;
  try {
    const payload = {
      ...form,
      moduleAccess: selectedModules.value,
      originalPrice: form.originalPrice ?? undefined
    };

    if (isEdit.value) {
      await updatePlan(planId.value, payload);
      ElMessage.success("保存成功");
    } else {
      await createPlan(payload);
      ElMessage.success("创建成功");
    }
    router.push("/packages");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  } finally {
    submitLoading.value = false;
  }
}

onMounted(() => {
  if (isEdit.value) {
    fetchDetail();
  }
});
</script>