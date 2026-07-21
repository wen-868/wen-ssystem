<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>门店管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="storeDialogVisible = true">新增门店</el-button>
            <el-button @click="loadStores">刷新门店</el-button>
          </div>
        </div>
      </template>

      <el-table :data="stores" v-loading="loading" stripe>
        <el-table-column prop="storeCode" label="门店编码" width="160" />
        <el-table-column prop="name" label="门店名称" min-width="160" />
        <el-table-column prop="address" label="地址" min-width="200" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column prop="businessStatus" label="营业状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.businessStatus === 'OPEN'" type="success">营业中</el-tag>
            <el-tag v-else-if="row.businessStatus === 'CLOSED'" type="info">已关闭</el-tag>
            <el-tag v-else>{{ row.businessStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openStoreEdit(row)">编辑</el-button>
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
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="storeDialogVisible" title="新增门店" width="480px">
      <el-form ref="storeFormRef" :model="storeForm" :rules="storeRules" label-width="100px">
        <el-form-item label="门店编码" prop="code">
          <el-input v-model="storeForm.code" />
        </el-form-item>
        <el-form-item label="门店名称" prop="name">
          <el-input v-model="storeForm.name" />
        </el-form-item>
        <el-form-item label="门店地址">
          <el-input v-model="storeForm.address" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="storeForm.phone" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="storeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreateStore">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="storeEditDialogVisible" title="编辑门店" width="520px">
      <el-form ref="storeEditFormRef" :model="storeEditForm" :rules="storeEditFormRules" label-width="110px">
        <el-form-item label="门店名称">
          <el-input v-model="storeEditForm.name" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="storeEditForm.address" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="storeEditForm.contact" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="storeEditForm.phone" />
        </el-form-item>
        <el-form-item label="配送半径(km)">
          <el-input-number v-model="storeEditForm.deliveryRadius" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="营业状态">
          <el-select v-model="storeEditForm.businessStatus" style="width: 100%">
            <el-option label="营业中" value="OPEN" />
            <el-option label="已关闭" value="CLOSED" />
          </el-select>
        </el-form-item>
        <el-form-item label="小程序 AppID">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="storeEditForm.miniappAppid" placeholder="输入微信小程序 AppID" style="flex: 1" />
            <el-button type="primary" :loading="wxFetchLoading" @click="handleFetchWxInfo">拉取商户信息</el-button>
          </div>
        </el-form-item>
        <el-form-item label="微信商户名称">
          <el-input v-model="storeEditForm.wxMerchantName" readonly placeholder="从微信拉取" />
        </el-form-item>
        <el-form-item label="客服电话">
          <el-input v-model="storeEditForm.wxServicePhone" readonly placeholder="从微信拉取" />
        </el-form-item>
        <el-form-item label="小程序头像">
          <el-image
            v-if="storeEditForm.wxHeadImg"
            :src="storeEditForm.wxHeadImg"
            fit="cover"
            style="width: 64px; height: 64px; border-radius: 8px"
            :preview-src-list="[storeEditForm.wxHeadImg]"
            preview-teleported
          />
          <span v-else class="muted">暂无头像</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="storeEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="storeEditLoading" @click="submitStoreEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { createStore, fetchStoreDetail, fetchStores, fetchWxInfo, updateStore } from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const storeEditLoading = ref(false);
const wxFetchLoading = ref(false);
const stores = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const storeDialogVisible = ref(false);
const storeEditDialogVisible = ref(false);
const storeFormRef = ref<FormInstance>();
const storeEditFormRef = ref<FormInstance>();

const mobilePattern = /^1[3-9]\d{9}$/;

const storeForm = reactive({
  code: "",
  name: "",
  address: "",
  phone: ""
});

const storeEditForm = ref({
  id: 0,
  name: '',
  address: '',
  contact: '',
  phone: '',
  deliveryRadius: 3,
  businessStatus: 'OPEN',
  miniappAppid: '',
  wxMerchantName: '',
  wxServicePhone: '',
  wxHeadImg: ''
});

const storeEditFormRules: FormRules = {
  name: [{ required: true, message: "请填写门店名称", trigger: "blur" }]
};

const storeRules: FormRules = {
  code: [
    { required: true, message: "请填写门店编码", trigger: "blur" },
    { min: 2, max: 32, message: "门店编码 2 到 32 个字符", trigger: "blur" }
  ],
  name: [{ required: true, message: "请填写门店名称", trigger: "blur" }],
  phone: [{
    validator: (_: any, value: string, callback: any) => {
      if (!value) callback();
      else if (mobilePattern.test(value)) callback();
      else callback(new Error("请填写正确的手机号"));
    },
    trigger: "blur"
  }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadStores() {
  loading.value = true;
  try {
    const data = await fetchStores();
    const list = data.records || [];
    total.value = data.total || list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    stores.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载门店列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadStores();
}

function handlePageChange(p: number) {
  page.value = p;
  loadStores();
}

async function handleCreateStore() {
  if (!storeFormRef.value) return;
  await storeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createStore({
        code: storeForm.code,
        name: storeForm.name,
        address: storeForm.address,
        phone: storeForm.phone
      });
      ElMessage.success("门店已新增");
      storeDialogVisible.value = false;
      storeForm.code = "";
      storeForm.name = "";
      storeForm.address = "";
      storeForm.phone = "";
      loadStores();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "新增门店失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function openStoreEdit(row: any) {
  storeEditLoading.value = true;
  storeEditDialogVisible.value = true;
  try {
    const { data } = await fetchStoreDetail(row.id || row.storeId);
    const detail = data.data || data;
    storeEditForm.value = {
      id: detail.id || row.id || row.storeId,
      name: detail.name || '',
      address: detail.address || '',
      contact: detail.contact || '',
      phone: detail.phone || '',
      deliveryRadius: detail.deliveryRadius || 3,
      businessStatus: detail.businessStatus || 'OPEN',
      miniappAppid: detail.miniappAppid || '',
      wxMerchantName: detail.wxMerchantName || '',
      wxServicePhone: detail.wxServicePhone || '',
      wxHeadImg: detail.wxHeadImg || ''
    };
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "获取门店详情失败"));
    storeEditDialogVisible.value = false;
  } finally {
    storeEditLoading.value = false;
  }
}

async function submitStoreEdit() {
  const valid = await storeEditFormRef.value?.validate().catch(() => false); if (!valid) return;
  storeEditLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, {
      name: storeEditForm.value.name,
      address: storeEditForm.value.address,
      contact: storeEditForm.value.contact,
      phone: storeEditForm.value.phone,
      deliveryRadius: storeEditForm.value.deliveryRadius,
      businessStatus: storeEditForm.value.businessStatus,
      miniappAppid: storeEditForm.value.miniappAppid,
      wxMerchantName: storeEditForm.value.wxMerchantName,
      wxServicePhone: storeEditForm.value.wxServicePhone,
      wxHeadImg: storeEditForm.value.wxHeadImg
    });
    ElMessage.success("门店信息已更新");
    storeEditDialogVisible.value = false;
    loadStores();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "更新门店失败"));
  } finally {
    storeEditLoading.value = false;
  }
}

async function handleFetchWxInfo() {
  if (!storeEditForm.value.miniappAppid) {
    ElMessage.warning("请先输入小程序 AppID");
    return;
  }
  wxFetchLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, { miniappAppid: storeEditForm.value.miniappAppid });
    const { data } = await fetchWxInfo(storeEditForm.value.id);
    const wxData = data.data || data;
    storeEditForm.value.wxMerchantName = wxData.wxMerchantName || wxData.merchantName || '';
    storeEditForm.value.wxServicePhone = wxData.wxServicePhone || wxData.servicePhone || '';
    storeEditForm.value.wxHeadImg = wxData.wxHeadImg || wxData.headImg || '';
    ElMessage.success("商户信息拉取成功");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "拉取商户信息失败"));
  } finally {
    wxFetchLoading.value = false;
  }
}

onMounted(() => {
  loadStores();
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
.header-actions {
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.muted {
  color: #909399;
  font-size: 13px;
}
</style>
