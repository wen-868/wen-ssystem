<template>
  <div class="supplier-page">
    <div class="page-header">
      <h2>供应商管理</h2>
      <p class="page-desc">管理供应商信息、联系人和合作状态</p>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="关键字">
          <el-input
            v-model="filterForm.keyword"
            placeholder="供应商名称/编码"
            clearable
            style="width: 220px"
            @clear="loadSuppliers"
            @keyup.enter="loadSuppliers"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="filterForm.category"
            placeholder="全部分类"
            clearable
            style="width: 140px"
            @change="loadSuppliers"
          >
            <el-option label="品牌商" value="BRAND" />
            <el-option label="批发商" value="WHOLESALER" />
            <el-option label="经销商" value="DISTRIBUTOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filterForm.status"
            placeholder="全部状态"
            clearable
            style="width: 120px"
            @change="loadSuppliers"
          >
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadSuppliers">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <div class="table-actions">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon> 新增供应商
        </el-button>
        <el-button @click="loadSuppliers">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="supplierCode" label="供应商编码" width="180" />
        <el-table-column prop="name" label="供应商名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="shortName" label="简称" width="120" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.category === 'BRAND'" type="primary">品牌商</el-tag>
            <el-tag v-else-if="row.category === 'WHOLESALER'" type="success">批发商</el-tag>
            <el-tag v-else-if="row.category === 'DISTRIBUTOR'" type="warning">经销商</el-tag>
            <el-tag v-else>{{ row.category || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creditLevel" label="信用等级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.creditLevel === 'A'" type="success">A级</el-tag>
            <el-tag v-else-if="row.creditLevel === 'B'" type="warning">B级</el-tag>
            <el-tag v-else-if="row.creditLevel === 'C'" type="danger">C级</el-tag>
            <el-tag v-else type="info">{{ row.creditLevel || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="settlementType" label="结算方式" width="100">
          <template #default="{ row }">
            <span v-if="row.settlementType === 'CASH'">现结</span>
            <span v-else-if="row.settlementType === 'MONTHLY'">月结</span>
            <span v-else-if="row.settlementType === 'WEEKLY'">周结</span>
            <span v-else>{{ row.settlementType || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 1 ? 'danger' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑供应商' : '新增供应商'"
      width="680px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入供应商名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="简称">
              <el-input v-model="form.shortName" placeholder="请输入简称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
                <el-option label="品牌商" value="BRAND" />
                <el-option label="批发商" value="WHOLESALER" />
                <el-option label="经销商" value="DISTRIBUTOR" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="信用等级">
              <el-select v-model="form.creditLevel" placeholder="请选择" style="width: 100%">
                <el-option label="A级" value="A" />
                <el-option label="B级" value="B" />
                <el-option label="C级" value="C" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="结算方式">
              <el-select v-model="form.settlementType" placeholder="请选择" style="width: 100%">
                <el-option label="现结" value="CASH" />
                <el-option label="月结" value="MONTHLY" />
                <el-option label="周结" value="WEEKLY" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结算日">
              <el-input-number v-model="form.settlementDay" :min="1" :max="31" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="税率(%)">
              <el-input-number v-model="form.taxRate" :min="0" :max="100" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="1">启用</el-radio>
                <el-radio :value="0">禁用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入详细地址" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="省份">
              <el-input v-model="form.province" placeholder="省份" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="城市">
              <el-input v-model="form.city" placeholder="城市" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区县">
              <el-input v-model="form.district" placeholder="区县" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开户银行">
              <el-input v-model="form.bankName" placeholder="请输入开户银行" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="银行账号">
              <el-input v-model="form.bankAccount" placeholder="请输入银行账号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="户名">
          <el-input v-model="form.bankAccountName" placeholder="请输入银行户名" />
        </el-form-item>

        <el-divider content-position="left">联系人</el-divider>

        <div class="contacts-section">
          <div class="contacts-header">
            <span>联系人列表</span>
            <el-button type="primary" link @click="addContact">
              <el-icon><Plus /></el-icon> 添加联系人
            </el-button>
          </div>
          <div v-if="form.contacts.length === 0" class="empty-contacts">
            暂无联系人，点击上方按钮添加
          </div>
          <div v-else class="contacts-list">
            <div v-for="(contact, index) in form.contacts" :key="index" class="contact-item">
              <div class="contact-fields">
                <el-input v-model="contact.name" placeholder="姓名" style="width: 120px" />
                <el-input v-model="contact.mobile" placeholder="手机号" style="width: 140px" />
                <el-input v-model="contact.phone" placeholder="电话" style="width: 140px" />
                <el-input v-model="contact.position" placeholder="职位" style="width: 120px" />
                <el-input v-model="contact.email" placeholder="邮箱" style="width: 160px" />
                <el-checkbox v-model="contact.isPrimary">主要联系人</el-checkbox>
              </div>
              <el-button link type="danger" @click="removeContact(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="供应商详情" size="560px">
      <template v-if="currentSupplier">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="供应商编码">{{ currentSupplier.supplierCode }}</el-descriptions-item>
          <el-descriptions-item label="供应商名称">{{ currentSupplier.name }}</el-descriptions-item>
          <el-descriptions-item label="简称">{{ currentSupplier.shortName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="分类">
            <el-tag v-if="currentSupplier.category === 'BRAND'" type="primary" size="small">品牌商</el-tag>
            <el-tag v-else-if="currentSupplier.category === 'WHOLESALER'" type="success" size="small">批发商</el-tag>
            <el-tag v-else>{{ currentSupplier.category || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="信用等级">{{ currentSupplier.creditLevel || '-' }}</el-descriptions-item>
          <el-descriptions-item label="结算方式">
            <span v-if="currentSupplier.settlementType === 'CASH'">现结</span>
            <span v-else-if="currentSupplier.settlementType === 'MONTHLY'">月结</span>
            <span v-else>{{ currentSupplier.settlementType || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="结算日">{{ currentSupplier.settlementDay || '-' }}</el-descriptions-item>
          <el-descriptions-item label="税率">{{ currentSupplier.taxRate || 0 }}%</el-descriptions-item>
          <el-descriptions-item label="状态" :span="2">
            <el-tag v-if="currentSupplier.status === 1" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">禁用</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">{{ currentSupplier.address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="开户银行">{{ currentSupplier.bankName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="银行账号">{{ currentSupplier.bankAccount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="户名">{{ currentSupplier.bankAccountName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentSupplier.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentSupplier.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">联系人</el-divider>
        <div v-if="!currentSupplier.contacts || currentSupplier.contacts.length === 0" class="empty-contacts">
          暂无联系人信息
        </div>
        <div v-else>
          <div v-for="(contact, index) in currentSupplier.contacts" :key="index" class="detail-contact-item">
            <div class="contact-name">
              {{ contact.name }}
              <el-tag v-if="contact.isPrimary" type="primary" size="small" style="margin-left: 8px">主要联系人</el-tag>
            </div>
            <div class="contact-info">
              <span v-if="contact.mobile">手机：{{ contact.mobile }}</span>
              <span v-if="contact.phone" style="margin-left: 16px">电话：{{ contact.phone }}</span>
              <span v-if="contact.email" style="margin-left: 16px">邮箱：{{ contact.email }}</span>
              <span v-if="contact.position" style="margin-left: 16px">职位：{{ contact.position }}</span>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh, Delete } from "@element-plus/icons-vue";
import { fetchSuppliers, createSupplier, updateSupplier } from "../api";
import { formatDate } from "../utils/format";

const loading = ref(false);
const submitLoading = ref(false);
const tableData = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const currentSupplier = ref<any>(null);
const formRef = ref<FormInstance>();

const filterForm = reactive({
  keyword: "",
  category: "",
  status: "" as string | number
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const defaultForm = {
  supplierId: 0,
  name: "",
  shortName: "",
  category: "BRAND",
  province: "",
  city: "",
  district: "",
  address: "",
  creditLevel: "A",
  settlementType: "MONTHLY",
  settlementDay: null as number | null,
  taxRate: 13,
  bankName: "",
  bankAccount: "",
  bankAccountName: "",
  status: 1,
  remark: "",
  contacts: [] as any[]
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  name: [{ required: true, message: "请输入供应商名称", trigger: "blur" }],
  category: [{ required: true, message: "请选择分类", trigger: "change" }]
};

async function loadSuppliers() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (filterForm.keyword) params.keyword = filterForm.keyword;
    if (filterForm.category) params.category = filterForm.category;
    if (filterForm.status !== "") params.status = filterForm.status;

    const data = await fetchSuppliers(params);
    tableData.value = data.records || [];
    pagination.total = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function resetFilter() {
  filterForm.keyword = "";
  filterForm.category = "";
  filterForm.status = "";
  pagination.page = 1;
  loadSuppliers();
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  loadSuppliers();
}

function handlePageChange(page: number) {
  pagination.page = page;
  loadSuppliers();
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm, contacts: [] });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  Object.assign(form, {
    supplierId: row.supplierId,
    name: row.name,
    shortName: row.shortName,
    category: row.category,
    province: row.province,
    city: row.city,
    district: row.district,
    address: row.address,
    creditLevel: row.creditLevel,
    settlementType: row.settlementType,
    settlementDay: row.settlementDay,
    taxRate: row.taxRate,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    bankAccountName: row.bankAccountName,
    status: row.status,
    remark: row.remark,
    contacts: row.contacts ? JSON.parse(JSON.stringify(row.contacts)) : []
  });
  dialogVisible.value = true;
}

function handleView(row: any) {
  currentSupplier.value = row;
  detailVisible.value = true;
}

async function handleToggleStatus(row: any) {
  const newStatus = row.status === 1 ? 0 : 1;
  const action = newStatus === 1 ? "启用" : "禁用";
  try {
    await ElMessageBox.confirm(`确定要${action}该供应商吗？`, "提示", { type: "warning" });
    await updateSupplier(row.supplierId, { status: newStatus });
    ElMessage.success(`${action}成功`);
    loadSuppliers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.message || "操作失败");
    }
  }
}

function addContact() {
  form.contacts.push({
    name: "",
    mobile: "",
    phone: "",
    email: "",
    wechat: "",
    isPrimary: form.contacts.length === 0,
    position: "",
    remark: ""
  });
}

function removeContact(index: number) {
  form.contacts.splice(index, 1);
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = { ...form };
      delete payload.supplierId;

      if (isEdit.value) {
        await updateSupplier(form.supplierId, payload);
        ElMessage.success("更新成功");
      } else {
        await createSupplier(payload);
        ElMessage.success("创建成功");
      }
      dialogVisible.value = false;
      loadSuppliers();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || "保存失败");
    } finally {
      submitLoading.value = false;
    }
  });
}

onMounted(() => {
  loadSuppliers();
});
</script>

<style scoped>
.supplier-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 16px;
}

.table-card {
  margin-bottom: 16px;
}

.table-actions {
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.contacts-section {
  margin-bottom: 16px;
}

.contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.empty-contacts {
  padding: 20px;
  text-align: center;
  color: #909399;
  background: #f5f7fa;
  border-radius: 4px;
}

.contacts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.contact-fields {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.detail-contact-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.contact-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.contact-info {
  color: #606266;
  font-size: 14px;
}
</style>
