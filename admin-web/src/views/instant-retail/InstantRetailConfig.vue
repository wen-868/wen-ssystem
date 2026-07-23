<template>
  <div class="page">
    <el-card class="config-card">
      <el-tabs v-model="activeTab" class="config-tabs">
        <el-tab-pane label="店铺信息" name="store">
          <el-form :model="storeForm" :rules="storeRules" ref="storeFormRef" label-width="120px" class="store-form">
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
                <el-form-item label="免配送费" prop="freeDeliveryAmount">
                  <el-input-number v-model="storeForm.freeDeliveryAmount" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
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
          <div class="banner-grid" v-loading="bannerLoading">
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
                  <el-button type="danger" link @click="deleteBanner(banner)">删除</el-button>
                </div>
              </div>
              <div class="banner-info">
                <div class="banner-title">{{ banner.title }}</div>
                <div class="banner-meta">
                  <el-tag :type="banner.status === 'ENABLED' ? 'success' : 'info'" size="small">
                    {{ banner.status === 'ENABLED' ? '启用' : '禁用' }}
                  </el-tag>
                  <span class="banner-time">{{ banner.startTime }} ~ {{ banner.endTime }}</span>
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
          <el-table :data="categoryTree" v-loading="categoryLoading" row-key="id" default-expand-all :tree-props="{ children: 'children' }" stripe>
            <el-table-column prop="name" label="分类名称" min-width="200">
              <template #default="{ row }">
                <div class="category-name-cell">
                  <el-image v-if="row.icon" :src="row.icon" fit="cover" class="category-icon" />
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="sort" label="排序" width="100" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ENABLED' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'ENABLED' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openCategoryDialog(row)">编辑</el-button>
                <el-button size="small" link type="success" @click="openCategoryDialog(null, row)">添加子分类</el-button>
                <el-button size="small" link type="danger" @click="deleteCategory(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="bannerDialogVisible" :title="bannerEditId ? '编辑轮播图' : '新增轮播图'" width="720px">
      <el-form :model="bannerForm" :rules="bannerRules" ref="bannerFormRef" label-width="100px">
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
            <el-radio value="ENABLED">启用</el-radio>
            <el-radio value="DISABLED">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bannerSaving" @click="saveBanner">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="categoryDialogVisible" :title="categoryEditId ? '编辑分类' : (isAddChild ? '添加子分类' : '新增分类')" width="480px">
      <el-form :model="categoryForm" :rules="categoryRules" ref="categoryFormRef" label-width="100px">
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
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="categoryForm.sort" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="categoryForm.status">
            <el-radio value="ENABLED">启用</el-radio>
            <el-radio value="DISABLED">禁用</el-radio>
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
import { formatYuan } from "../../utils/format";

const activeTab = ref("store");

// ==================== 店铺信息 ====================
const storeFormRef = ref<FormInstance>();
const storeSaving = ref(false);

const storeForm = reactive({
  storeName: "",
  logo: "",
  description: "",
  phone: "",
  businessHours: [] as string[],
  deliveryTypes: ["DELIVERY", "PICKUP"],
  minOrderAmount: 0,
  deliveryFee: 0,
  freeDeliveryAmount: 0,
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

function saveStoreConfig() {
  if (!storeFormRef.value) return;
  storeFormRef.value.validate((valid) => {
    if (!valid) return;
    storeSaving.value = true;
    setTimeout(() => {
      ElMessage.success("店铺设置已保存");
      storeSaving.value = false;
    }, 500);
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
  storeForm.freeDeliveryAmount = 0;
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
  status: "ENABLED"
});

const bannerRules: FormRules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  image: [{ required: true, message: "请上传图片", trigger: "change" }],
  timeRange: [{ required: true, message: "请选择展示时间", trigger: "change" }]
};

const mockBanners = [
  { id: 1, title: "新人专享满减活动", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=promotion%20banner%20fresh%20food%20sale&image_size=landscape_16_9", linkType: "PROMOTION", linkValue: "1001", startTime: "2024-01-01 00:00:00", endTime: "2024-12-31 23:59:59", status: "ENABLED", sort: 1 },
  { id: 2, title: "生鲜果蔬限时特惠", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20vegetables%20fruits%20banner&image_size=landscape_16_9", linkType: "CATEGORY", linkValue: "FRESH", startTime: "2024-01-01 00:00:00", endTime: "2024-12-31 23:59:59", status: "ENABLED", sort: 2 },
  { id: 3, title: "零食饮料满99减20", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=snacks%20beverages%20promotion%20banner&image_size=landscape_16_9", linkType: "CATEGORY", linkValue: "SNACKS", startTime: "2024-06-01 00:00:00", endTime: "2024-06-30 23:59:59", status: "ENABLED", sort: 3 },
  { id: 4, title: "首页推荐位", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=supermarket%20homepage%20banner&image_size=landscape_16_9", linkType: "NONE", linkValue: "", startTime: "2024-01-01 00:00:00", endTime: "2024-12-31 23:59:59", status: "DISABLED", sort: 4 }
];

function loadBanners() {
  bannerLoading.value = true;
  setTimeout(() => {
    bannerList.value = [...mockBanners];
    bannerLoading.value = false;
  }, 300);
}

function handleDragStart(index: number) {
  dragIndex.value = index;
}

function handleDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return;
  const list = [...bannerList.value];
  const [removed] = list.splice(dragIndex.value, 1);
  list.splice(targetIndex, 0, removed);
  bannerList.value = list;
  dragIndex.value = null;
  ElMessage.success("排序已更新");
}

function openBannerDialog(row?: any) {
  bannerEditId.value = row?.id || null;
  if (row) {
    bannerForm.title = row.title;
    bannerForm.image = row.image;
    bannerForm.linkType = row.linkType || "NONE";
    bannerForm.linkValue = row.linkValue || "";
    bannerForm.timeRange = [row.startTime, row.endTime];
    bannerForm.status = row.status;
  } else {
    bannerForm.title = "";
    bannerForm.image = "";
    bannerForm.linkType = "NONE";
    bannerForm.linkValue = "";
    bannerForm.timeRange = [];
    bannerForm.status = "ENABLED";
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
  bannerFormRef.value.validate((valid) => {
    if (!valid) return;
    bannerSaving.value = true;
    setTimeout(() => {
      if (bannerEditId.value) {
        const index = bannerList.value.findIndex(b => b.id === bannerEditId.value);
        if (index > -1) {
          bannerList.value[index] = {
            ...bannerList.value[index],
            title: bannerForm.title,
            image: bannerForm.image,
            linkType: bannerForm.linkType,
            linkValue: bannerForm.linkValue,
            startTime: bannerForm.timeRange[0],
            endTime: bannerForm.timeRange[1],
            status: bannerForm.status
          };
        }
        ElMessage.success("轮播图已更新");
      } else {
        const newBanner = {
          id: Date.now(),
          title: bannerForm.title,
          image: bannerForm.image,
          linkType: bannerForm.linkType,
          linkValue: bannerForm.linkValue,
          startTime: bannerForm.timeRange[0],
          endTime: bannerForm.timeRange[1],
          status: bannerForm.status,
          sort: bannerList.value.length + 1
        };
        bannerList.value.push(newBanner);
        ElMessage.success("轮播图已添加");
      }
      bannerSaving.value = false;
      bannerDialogVisible.value = false;
    }, 500);
  });
}

function deleteBanner(row: any) {
  ElMessageBox.confirm(`确定要删除轮播图「${row.title}」吗？`, "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    bannerList.value = bannerList.value.filter(b => b.id !== row.id);
    ElMessage.success("已删除");
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
  sort: 0,
  status: "ENABLED"
});

const categoryRules: FormRules = {
  name: [{ required: true, message: "请输入分类名称", trigger: "blur" }],
  sort: [{ required: true, message: "请输入排序", trigger: "blur" }]
};

const mockCategories = [
  {
    id: 1,
    name: "生鲜果蔬",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vegetable%20icon%20simple&image_size=square",
    parentId: null,
    sort: 1,
    status: "ENABLED",
    children: [
      { id: 11, name: "时令蔬菜", icon: "", parentId: 1, sort: 1, status: "ENABLED", children: [] },
      { id: 12, name: "新鲜水果", icon: "", parentId: 1, sort: 2, status: "ENABLED", children: [] },
      { id: 13, name: "菌菇类", icon: "", parentId: 1, sort: 3, status: "ENABLED", children: [] }
    ]
  },
  {
    id: 2,
    name: "零食饮料",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=snack%20icon%20simple&image_size=square",
    parentId: null,
    sort: 2,
    status: "ENABLED",
    children: [
      { id: 21, name: "休闲零食", icon: "", parentId: 2, sort: 1, status: "ENABLED", children: [] },
      { id: 22, name: "饼干糕点", icon: "", parentId: 2, sort: 2, status: "ENABLED", children: [] },
      { id: 23, name: "饮料冲调", icon: "", parentId: 2, sort: 3, status: "ENABLED", children: [] }
    ]
  },
  {
    id: 3,
    name: "日用百货",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=daily%20necessities%20icon%20simple&image_size=square",
    parentId: null,
    sort: 3,
    status: "ENABLED",
    children: [
      { id: 31, name: "纸品湿巾", icon: "", parentId: 3, sort: 1, status: "ENABLED", children: [] },
      { id: 32, name: "家居清洁", icon: "", parentId: 3, sort: 2, status: "DISABLED", children: [] }
    ]
  },
  {
    id: 4,
    name: "乳品烘焙",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=milk%20bread%20icon%20simple&image_size=square",
    parentId: null,
    sort: 4,
    status: "ENABLED",
    children: []
  },
  {
    id: 5,
    name: "酒水冲调",
    icon: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=drink%20icon%20simple&image_size=square",
    parentId: null,
    sort: 5,
    status: "DISABLED",
    children: []
  }
];

function loadCategories() {
  categoryLoading.value = true;
  setTimeout(() => {
    categoryTree.value = JSON.parse(JSON.stringify(mockCategories));
    categoryLoading.value = false;
  }, 300);
}

function openCategoryDialog(row?: any, parent?: any) {
  categoryEditId.value = row?.id || null;
  isAddChild.value = !!parent;
  
  if (row) {
    categoryForm.name = row.name;
    categoryForm.icon = row.icon || "";
    categoryForm.parentId = row.parentId;
    categoryForm.sort = row.sort;
    categoryForm.status = row.status;
  } else {
    categoryForm.name = "";
    categoryForm.icon = "";
    categoryForm.parentId = parent?.id || null;
    categoryForm.sort = 0;
    categoryForm.status = "ENABLED";
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

function addToTree(list: any[], parentId: number | null, newItem: any): boolean {
  if (parentId === null) {
    list.push(newItem);
    return true;
  }
  for (const item of list) {
    if (item.id === parentId) {
      if (!item.children) item.children = [];
      item.children.push(newItem);
      return true;
    }
    if (item.children && addToTree(item.children, parentId, newItem)) {
      return true;
    }
  }
  return false;
}

function updateInTree(list: any[], id: number, updates: any): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = { ...list[i], ...updates };
      return true;
    }
    if (list[i].children && updateInTree(list[i].children, id, updates)) {
      return true;
    }
  }
  return false;
}

function deleteFromTree(list: any[], id: number): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list.splice(i, 1);
      return true;
    }
    if (list[i].children && deleteFromTree(list[i].children, id)) {
      return true;
    }
  }
  return false;
}

function saveCategory() {
  if (!categoryFormRef.value) return;
  categoryFormRef.value.validate((valid) => {
    if (!valid) return;
    categorySaving.value = true;
    setTimeout(() => {
      if (categoryEditId.value) {
        updateInTree(categoryTree.value, categoryEditId.value, {
          name: categoryForm.name,
          icon: categoryForm.icon,
          parentId: categoryForm.parentId,
          sort: categoryForm.sort,
          status: categoryForm.status
        });
        ElMessage.success("分类已更新");
      } else {
        const newCategory = {
          id: Date.now(),
          name: categoryForm.name,
          icon: categoryForm.icon,
          parentId: categoryForm.parentId,
          sort: categoryForm.sort,
          status: categoryForm.status,
          children: []
        };
        addToTree(categoryTree.value, categoryForm.parentId, newCategory);
        ElMessage.success("分类已添加");
      }
      categorySaving.value = false;
      categoryDialogVisible.value = false;
    }, 500);
  });
}

function deleteCategory(row: any) {
  ElMessageBox.confirm(`确定要删除分类「${row.name}」吗？子分类也将被删除。`, "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    deleteFromTree(categoryTree.value, row.id);
    ElMessage.success("已删除");
  }).catch(() => {});
}

onMounted(() => {
  storeForm.storeName = "优选生活超市（望京店）";
  storeForm.logo = "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=supermarket%20logo%20simple&image_size=square";
  storeForm.description = "优选生活超市，提供新鲜果蔬、零食饮料、日用百货等万余种商品，30分钟极速送达。";
  storeForm.phone = "400-888-8888";
  storeForm.businessHours = ["08:00", "22:00"];
  storeForm.deliveryTypes = ["DELIVERY", "PICKUP"];
  storeForm.minOrderAmount = 20;
  storeForm.deliveryFee = 5;
  storeForm.freeDeliveryAmount = 49;
  storeForm.deliveryRadius = 3;
  storeForm.estimatedTime = "30-45分钟";
  storeForm.notice = "欢迎光临优选生活超市！新用户首单立减10元，满49元免配送费。";
  
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
