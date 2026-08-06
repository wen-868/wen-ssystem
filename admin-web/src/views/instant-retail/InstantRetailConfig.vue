<template>
  <div class="page">
    <el-card class="config-card">
      <el-tabs v-model="activeTab" class="config-tabs">
        <el-tab-pane label="店铺信息" name="store">
          <el-form ref="storeFormRef" :model="storeForm" :rules="storeRules" label-width="120px" class="store-form">
            <el-divider content-position="left">基本信息</el-divider>
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="店铺名称" prop="storeName">
                  <el-input v-model="storeForm.storeName" placeholder="请输入店铺名称" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="联系电话" prop="phone">
                  <el-input v-model="storeForm.phone" placeholder="请输入联系电话" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="店铺Logo" prop="logo">
              <el-upload
                class="logo-uploader"
                :show-file-list="false"
                :auto-upload="false"
                :on-change="handleLogoChange"
                accept="image/*"
              >
                <el-image v-if="storeForm.logo" :src="storeForm.logo" fit="cover" class="logo-image" />
                <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
              </el-upload>
            </el-form-item>
            <el-form-item label="店铺描述" prop="description">
              <el-input v-model="storeForm.description" type="textarea" :rows="3" placeholder="请输入店铺描述" />
            </el-form-item>
            <el-form-item label="营业时间" prop="businessHours">
              <el-time-picker
                v-model="storeForm.businessHours"
                is-range
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                value-format="HH:mm"
                style="width: 300px"
              />
            </el-form-item>

            <el-divider content-position="left">配送设置</el-divider>
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="配送方式">
                  <el-checkbox-group v-model="storeForm.deliveryTypes">
                    <el-checkbox value="DELIVERY">配送</el-checkbox>
                    <el-checkbox value="PICKUP">自提</el-checkbox>
                  </el-checkbox-group>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="起送金额" prop="minOrderAmount">
                  <el-input-number v-model="storeForm.minOrderAmount" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="配送费" prop="deliveryFee">
                  <el-input-number v-model="storeForm.deliveryFee" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="配送半径(km)" prop="deliveryRadius">
                  <el-input-number v-model="storeForm.deliveryRadius" :min="0" :step="0.5" :precision="1" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="预计送达时间" prop="estimatedTime">
                  <el-input v-model="storeForm.estimatedTime" placeholder="如：30-45分钟" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-divider content-position="left">店铺公告</el-divider>
            <el-form-item label="公告内容" prop="notice">
              <el-input v-model="storeForm.notice" type="textarea" :rows="4" placeholder="请输入店铺公告" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="storeSaving" @click="saveStoreConfig">保存设置</el-button>
              <el-button @click="resetStoreForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="轮播图管理" name="banner">
          <div class="banner-toolbar">
            <el-button type="primary" @click="openBannerDialog">新增轮播图</el-button>
            <span class="banner-tip">拖拽卡片调整排序</span>
          </div>
          <div v-loading="bannerLoading" class="banner-grid">
            <div
              v-for="(banner, index) in bannerList"
              :key="banner.id"
              class="banner-card"
              draggable="true"
              @dragstart="handleDragStart(index)"
              @dragover.prevent
              @drop="handleDrop(index)"
            >
              <div class="banner-image-wrapper">
                <el-image :src="banner.image" fit="cover" class="banner-image" />
                <div class="banner-overlay">
                  <el-button type="primary" link @click="openBannerDialog(banner)">编辑</el-button>
                  <el-button type="danger" link @click="handleDeleteBanner(banner)">删除</el-button>
                </div>
              </div>
              <div class="banner-info">
                <div class="banner-title">{{ banner.title }}</div>
                <div class="banner-meta">
                  <el-tag :type="banner.status === 'ON' ? 'success' : 'info'" size="small">
                    {{ banner.status === 'ON' ? '启用' : '禁用' }}
                  </el-tag>
                  <span class="banner-time">{{ banner.startTime || '-' }} ~ {{ banner.endTime || '-' }}</span>
                </div>
              </div>
              <div class="banner-sort">{{ index + 1 }}</div>
            </div>
            <el-empty v-if="bannerList.length === 0" description="暂无轮播图" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="分类管理" name="category">
          <div class="category-toolbar">
            <el-button type="primary" @click="openCategoryDialog">新增分类</el-button>
          </div>
          <el-table v-loading="categoryLoading" :data="categoryTree" row-key="id" default-expand-all :tree-props="{ children: 'children' }" stripe>
            <el-table-column prop="name" label="分类名称" min-width="200">
              <template #default="{ row }">
                <div class="category-name-cell">
                  <el-image v-if="row.icon" :src="row.icon" fit="cover" class="category-icon" />
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="100" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ON' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'ON' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openCategoryDialog(row)">编辑</el-button>
                <el-button size="small" link type="success" @click="openCategoryDialog(null, row)">添加子分类</el-button>
                <el-button size="small" link type="danger" @click="handleDeleteCategory(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="bannerDialogVisible" :title="bannerEditId ? '编辑轮播图' : '新增轮播图'" width="720px">
      <el-form ref="bannerFormRef" :model="bannerForm" :rules="bannerRules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="bannerForm.title" placeholder="请输入轮播图标题" />
        </el-form-item>
        <el-form-item label="图片" prop="image">
          <el-upload
            class="banner-uploader"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="handleBannerImageChange"
            accept="image/*"
          >
            <el-image v-if="bannerForm.image" :src="bannerForm.image" fit="cover" class="banner-upload-image" />
            <el-icon v-else class="banner-upload-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="链接类型" prop="linkType">
          <el-select v-model="bannerForm.linkType" style="width: 100%" @change="handleLinkTypeChange">
            <el-option label="无跳转" value="NONE" />
            <el-option label="商品详情" value="PRODUCT" />
            <el-option label="分类页面" value="CATEGORY" />
            <el-option label="外部链接" value="URL" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="bannerForm.linkType !== 'NONE'" label="链接值" prop="linkValue">
          <el-input v-model="bannerForm.linkValue" :placeholder="getLinkPlaceholder()" />
        </el-form-item>
        <el-form-item label="展示时间" prop="timeRange">
          <el-date-picker
            v-model="bannerForm.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="bannerForm.status">
            <el-radio value="ON">启用</el-radio>
            <el-radio value="OFF">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bannerSaving" @click="saveBanner">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="categoryDialogVisible" :title="categoryEditId ? '编辑分类' : (isAddChild ? '添加子分类' : '新增分类')" width="480px">
      <el-form ref="categoryFormRef" :model="categoryForm" :rules="categoryRules" label-width="100px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="categoryForm.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="分类图标" prop="icon">
          <el-upload
            class="icon-uploader"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="handleCategoryIconChange"
            accept="image/*"
          >
            <el-image v-if="categoryForm.icon" :src="categoryForm.icon" fit="cover" class="icon-upload-image" />
            <el-icon v-else class="icon-upload-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="上级分类" prop="parentId">
          <el-tree-select
            v-model="categoryForm.parentId"
            :data="categoryTree"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            check-strictly
            :render-after-expand="false"
            placeholder="请选择上级分类（不选为一级分类）"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="categoryForm.status">
            <el-radio value="ON">启用</el-radio>
            <el-radio value="OFF">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="categorySaving" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  fetchShopConfig,
  saveShopConfig,
  fetchBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  fetchRetailCategories,
  createRetailCategory,
  updateRetailCategory,
  deleteRetailCategory,
  getErrorMessage
} from "../../api";

const activeTab = ref("store");

// ==================== 店铺信息 ====================
const storeFormRef = ref<FormInstance>();
const storeSaving = ref(false);
const storeLoading = ref(false);

const storeForm = reactive({
  storeName: "",
  logo: "",
  description: "",
  phone: "",
  businessHours: [] as string[],
  deliveryTypes: ["DELIVERY", "PICKUP"],
  minOrderAmount: 0,
  deliveryFee: 0,
  deliveryRadius: 3,
  estimatedTime: "",
  notice: ""
});

const storeRules: FormRules = {
  storeName: [{ required: true, message: "请输入店铺名称", trigger: "blur" }],
  phone: [{ required: true, message: "请输入联系电话", trigger: "blur" }],
  minOrderAmount: [{ required: true, message: "请输入起送金额", trigger: "blur" }],
  deliveryFee: [{ required: true, message: "请输入配送费", trigger: "blur" }]
};

function handleLogoChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => {
    storeForm.logo = e.target?.result as string;
  };
  reader.readAsDataURL(file.raw);
}

function splitBusinessHours(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[~至-]/).map(s => s.trim()).filter(Boolean).slice(0, 2);
}

function loadStoreConfig() {
  storeLoading.value = true;
  fetchShopConfig()
    .then((cfg: any) => {
      if (!cfg) {
        resetStoreForm();
        return;
      }
      storeForm.storeName = cfg.shop_name ?? cfg.shopName ?? "";
      storeForm.logo = cfg.shop_logo ?? cfg.shopLogo ?? "";
      storeForm.description = cfg.shop_description ?? cfg.shopDescription ?? "";
      storeForm.phone = cfg.contact_phone ?? cfg.contactPhone ?? "";
      storeForm.businessHours = splitBusinessHours(cfg.business_hours ?? cfg.businessHours ?? "");
      const deliveryEnabled = Number(cfg.delivery_enabled ?? cfg.deliveryEnabled ?? 1) === 1;
      const pickupEnabled = Number(cfg.pickup_enabled ?? cfg.pickupEnabled ?? 1) === 1;
      storeForm.deliveryTypes = [
        ...(deliveryEnabled ? ["DELIVERY"] : []),
        ...(pickupEnabled ? ["PICKUP"] : [])
      ];
      storeForm.minOrderAmount = Number(cfg.min_order_amount ?? cfg.minOrderAmount ?? 0);
      storeForm.deliveryFee = Number(cfg.delivery_fee ?? cfg.deliveryFee ?? 0);
      storeForm.deliveryRadius = Number(cfg.delivery_radius ?? cfg.deliveryRadius ?? 3);
      storeForm.estimatedTime = cfg.estimated_delivery_time ?? cfg.estimatedDeliveryTime ?? "";
      storeForm.notice = cfg.announcement ?? "";
    })
    .catch((e) => {
      ElMessage.error(getErrorMessage(e, "加载店铺配置失败"));
    })
    .finally(() => {
      storeLoading.value = false;
    });
}

function saveStoreConfig() {
  if (!storeFormRef.value) return;
  storeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    storeSaving.value = true;
    try {
      await saveShopConfig({
        shopName: storeForm.storeName,
        shopLogo: storeForm.logo,
        description: storeForm.description,
        phone: storeForm.phone,
        businessHours: storeForm.businessHours.length ? storeForm.businessHours.join("~") : null,
        deliveryEnabled: storeForm.deliveryTypes.includes("DELIVERY"),
        pickupEnabled: storeForm.deliveryTypes.includes("PICKUP"),
        minOrderAmount: storeForm.minOrderAmount,
        deliveryFee: storeForm.deliveryFee,
        deliveryRange: storeForm.deliveryRadius,
        estimatedTime: storeForm.estimatedTime,
        announcement: storeForm.notice,
        status: "OPEN"
      });
      ElMessage.success("店铺设置已保存");
    } catch (e) {
      ElMessage.error(getErrorMessage(e, "保存店铺设置失败"));
    } finally {
      storeSaving.value = false;
    }
  });
}

function resetStoreForm() {
  storeForm.storeName = "";
  storeForm.logo = "";
  storeForm.description = "";
  storeForm.phone = "";
  storeForm.businessHours = [];
  storeForm.deliveryTypes = ["DELIVERY", "PICKUP"];
  storeForm.minOrderAmount = 0;
  storeForm.deliveryFee = 0;
  storeForm.deliveryRadius = 3;
  storeForm.estimatedTime = "";
  storeForm.notice = "";
}

// ==================== 轮播图管理 ====================
const bannerLoading = ref(false);
const bannerList = ref<any[]>([]);
const bannerDialogVisible = ref(false);
const bannerFormRef = ref<FormInstance>();
const bannerSaving = ref(false);
const bannerEditId = ref<number | null>(null);
const dragIndex = ref<number | null>(null);

const bannerForm = reactive({
  title: "",
  image: "",
  linkType: "NONE",
  linkValue: "",
  timeRange: [] as string[],
  status: "ON"
});

const bannerRules: FormRules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  image: [{ required: true, message: "请上传图片", trigger: "change" }]
};

function mapBanner(row: any) {
  return {
    id: row.id,
    title: row.banner_title ?? row.bannerTitle ?? "",
    image: row.banner_image ?? row.bannerImage ?? "",
    linkType: row.link_type ?? row.linkType ?? "NONE",
    linkValue: row.link_value ?? row.linkValue ?? "",
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    status: row.status ?? "ON",
    startTime: row.start_time ?? row.startTime ?? null,
    endTime: row.end_time ?? row.endTime ?? null
  };
}

function loadBanners() {
  bannerLoading.value = true;
  fetchBanners()
    .then((result: any) => {
      const list = Array.isArray(result) ? result : (result?.records ?? []);
      bannerList.value = list.map(mapBanner);
    })
    .catch((e) => {
      ElMessage.error(getErrorMessage(e, "加载轮播图失败"));
      bannerList.value = [];
    })
    .finally(() => {
      bannerLoading.value = false;
    });
}

function handleDragStart(index: number) {
  dragIndex.value = index;
}

async function handleDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return;
  const list = [...bannerList.value];
  const [removed] = list.splice(dragIndex.value, 1);
  list.splice(targetIndex, 0, removed);
  bannerList.value = list;
  dragIndex.value = null;
  try {
    for (let i = 0; i < list.length; i++) {
      if (list[i].sortOrder !== i + 1) {
        await updateBanner(list[i].id, { sortNo: i + 1 });
      }
    }
    ElMessage.success("排序已更新");
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "保存排序失败"));
    loadBanners();
  }
}

function openBannerDialog(row?: any) {
  bannerEditId.value = row?.id || null;
  if (row) {
    bannerForm.title = row.title;
    bannerForm.image = row.image;
    bannerForm.linkType = row.linkType || "NONE";
    bannerForm.linkValue = row.linkValue || "";
    bannerForm.timeRange = [row.startTime, row.endTime].filter(Boolean) as string[];
    bannerForm.status = row.status || "ON";
  } else {
    bannerForm.title = "";
    bannerForm.image = "";
    bannerForm.linkType = "NONE";
    bannerForm.linkValue = "";
    bannerForm.timeRange = [];
    bannerForm.status = "ON";
  }
  bannerDialogVisible.value = true;
}

function handleBannerImageChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => {
    bannerForm.image = e.target?.result as string;
  };
  reader.readAsDataURL(file.raw);
}

function handleLinkTypeChange() {
  bannerForm.linkValue = "";
}

function getLinkPlaceholder() {
  const map: Record<string, string> = {
    PRODUCT: "请输入商品ID",
    CATEGORY: "请输入分类ID",
    URL: "请输入完整链接地址"
  };
  return map[bannerForm.linkType] || "";
}

function saveBanner() {
  if (!bannerFormRef.value) return;
  bannerFormRef.value.validate(async (valid) => {
    if (!valid) return;
    bannerSaving.value = true;
    const payload: Record<string, unknown> = {
      title: bannerForm.title,
      imageUrl: bannerForm.image,
      linkUrl: bannerForm.linkValue || null,
      linkType: bannerForm.linkType,
      status: bannerForm.status
    };
    if (bannerForm.timeRange?.[0]) payload.startTime = bannerForm.timeRange[0];
    if (bannerForm.timeRange?.[1]) payload.endTime = bannerForm.timeRange[1];
    try {
      if (bannerEditId.value) {
        await updateBanner(bannerEditId.value, payload);
        ElMessage.success("轮播图已更新");
      } else {
        payload.sortNo = bannerList.value.length + 1;
        await createBanner(payload);
        ElMessage.success("轮播图已添加");
      }
      bannerDialogVisible.value = false;
      loadBanners();
    } catch (e) {
      ElMessage.error(getErrorMessage(e, "保存轮播图失败"));
    } finally {
      bannerSaving.value = false;
    }
  });
}

function handleDeleteBanner(row: any) {
  ElMessageBox.confirm(`确定要删除轮播图「${row.title}」吗？`, "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(async () => {
    try {
      await deleteBanner(row.id);
      ElMessage.success("已删除");
      loadBanners();
    } catch (e) {
      ElMessage.error(getErrorMessage(e, "删除轮播图失败"));
    }
  }).catch(() => {});
}

// ==================== 分类管理 ====================
const categoryLoading = ref(false);
const categoryTree = ref<any[]>([]);
const categoryDialogVisible = ref(false);
const categoryFormRef = ref<FormInstance>();
const categorySaving = ref(false);
const categoryEditId = ref<number | null>(null);
const isAddChild = ref(false);

const categoryForm = reactive({
  name: "",
  icon: "",
  parentId: null as number | null,
  sortOrder: 0,
  status: "ON"
});

const categoryRules: FormRules = {
  name: [{ required: true, message: "请输入分类名称", trigger: "blur" }]
};

function mapCategory(row: any): any {
  return {
    id: row.id,
    name: row.category_name ?? row.name ?? "",
    icon: row.category_icon ?? row.icon ?? "",
    parentId: row.parent_id ?? row.parentId ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    status: row.status ?? "ON",
    children: Array.isArray(row.children) ? row.children.map(mapCategory) : []
  };
}

function loadCategories() {
  categoryLoading.value = true;
  fetchRetailCategories()
    .then((result: any) => {
      const list = Array.isArray(result) ? result : (result?.records ?? []);
      categoryTree.value = list.map(mapCategory);
    })
    .catch((e) => {
      ElMessage.error(getErrorMessage(e, "加载分类失败"));
      categoryTree.value = [];
    })
    .finally(() => {
      categoryLoading.value = false;
    });
}

function openCategoryDialog(row?: any, parent?: any) {
  categoryEditId.value = row?.id || null;
  isAddChild.value = !!parent;

  if (row) {
    categoryForm.name = row.name;
    categoryForm.icon = row.icon || "";
    categoryForm.parentId = row.parentId;
    categoryForm.sortOrder = row.sortOrder;
    categoryForm.status = row.status;
  } else {
    categoryForm.name = "";
    categoryForm.icon = "";
    categoryForm.parentId = parent?.id || null;
    categoryForm.sortOrder = 0;
    categoryForm.status = "ON";
  }
  categoryDialogVisible.value = true;
}

function handleCategoryIconChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => {
    categoryForm.icon = e.target?.result as string;
  };
  reader.readAsDataURL(file.raw);
}

function saveCategory() {
  if (!categoryFormRef.value) return;
  categoryFormRef.value.validate(async (valid) => {
    if (!valid) return;
    categorySaving.value = true;
    const payload: Record<string, unknown> = {
      name: categoryForm.name,
      icon: categoryForm.icon || null,
      parentId: categoryForm.parentId,
      sortNo: categoryForm.sortOrder,
      status: categoryForm.status
    };
    try {
      if (categoryEditId.value) {
        await updateRetailCategory(categoryEditId.value, payload);
        ElMessage.success("分类已更新");
      } else {
        await createRetailCategory(payload);
        ElMessage.success("分类已添加");
      }
      categoryDialogVisible.value = false;
      loadCategories();
    } catch (e) {
      ElMessage.error(getErrorMessage(e, "保存分类失败"));
    } finally {
      categorySaving.value = false;
    }
  });
}

function handleDeleteCategory(row: any) {
  ElMessageBox.confirm(`确定要删除分类「${row.name}」吗？子分类也将被删除。`, "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(async () => {
    try {
      await deleteRetailCategory(row.id);
      ElMessage.success("已删除");
      loadCategories();
    } catch (e) {
      ElMessage.error(getErrorMessage(e, "删除分类失败"));
    }
  }).catch(() => {});
}

onMounted(() => {
  loadStoreConfig();
  loadBanners();
  loadCategories();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.config-card {
  border: none;
}
.config-tabs {
  --el-tabs-header-height: 56px;
}
.store-form {
  max-width: 1000px;
  padding: 20px 0;
}
.logo-uploader {
  width: 100px;
  height: 100px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.3s;
}
.logo-uploader:hover {
  border-color: var(--el-color-primary);
}
.logo-image {
  width: 100%;
  height: 100%;
}
.logo-uploader-icon {
  font-size: 28px;
  color: var(--el-text-color-secondary);
}
.banner-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.banner-tip {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.banner-card {
  position: relative;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
  cursor: move;
  transition: box-shadow 0.3s, transform 0.2s;
}
.banner-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.banner-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 50%;
  overflow: hidden;
}
.banner-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.banner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  opacity: 0;
  transition: opacity 0.3s;
}
.banner-card:hover .banner-overlay {
  opacity: 1;
}
.banner-overlay .el-button {
  color: #fff;
}
.banner-info {
  padding: 12px;
}
.banner-title {
  font-weight: 500;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.banner-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.banner-time {
  font-size: 11px;
}
.banner-sort {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
}
.banner-uploader {
  width: 320px;
  height: 160px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.banner-uploader:hover {
  border-color: var(--el-color-primary);
}
.banner-upload-image {
  width: 100%;
  height: 100%;
}
.banner-upload-icon {
  font-size: 32px;
  color: var(--el-text-color-secondary);
}
.category-toolbar {
  margin-bottom: 16px;
}
.category-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.category-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
}
.icon-uploader {
  width: 60px;
  height: 60px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.icon-uploader:hover {
  border-color: var(--el-color-primary);
}
.icon-upload-image {
  width: 100%;
  height: 100%;
}
.icon-upload-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
}
</style>
