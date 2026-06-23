<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>供应商管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="搜索供应商名称/编码"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadSuppliers"
              @keyup.enter="loadSuppliers"
            />
            <el-button type="primary" @click="dialogVisible = true">
              <el-icon><Plus /></el-icon> 新增供应商
            </el-button>
            <el-button @click="loadSuppliers">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="suppliers" v-loading="loading" stripe>
        <el-table-column prop="supplierCode" label="供应商编码" width="180" />
        <el-table-column prop="supplierName" label="供应商名称" min-width="160" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column prop="supplierType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.supplierType === 'BRAND'" type="primary">品牌商</el-tag>
            <el-tag v-else-if="row.supplierType === 'DISTRIBUTOR'" type="success">经销商</el-tag>
            <el-tag v-else>{{ row.supplierType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creditLimit" label="信用额度" width="120">
          <template #default="{ row }">¥{{ Number(row.creditLimit || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="creditDays" label="账期(天)" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
            <el-tag v-else type="info">停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button size="small" link type="primary" @click="editSupplier(row)">编辑</el-button>
            <el-button size="small" link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑供应商' : '新增供应商'" width="640px">
      <el-form :model="form" label-width="100px" :rules="rules" ref="formRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商名称" prop="supplierName">
              <el-input v-model="form.supplierName" placeholder="请输入供应商名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系电话" prop="contactPhone">
              <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商类型">
              <el-select v-model="form.supplierType" style="width: 100%">
                <el-option label="品牌商" value="BRAND" />
                <el-option label="经销商" value="DISTRIBUTOR" />
                <el-option label="其他" value="OTHER" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="信用额度">
              <el-input-number v-model="form.creditLimit" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账期(天)">
              <el-input-number v-model="form.creditDays" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入地址" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="税号">
              <el-input v-model="form.taxNo" placeholder="请输入税号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="税率(%)">
              <el-input-number v-model="form.taxRate" :min="0" :max="100" :precision="2" style="width: 100%" />
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
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="供应商详情" size="500px">
      <template v-if="currentSupplier">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="供应商编码">{{ currentSupplier.supplierCode }}</el-descriptions-item>
          <el-descriptions-item label="供应商名称">{{ currentSupplier.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ currentSupplier.contactName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentSupplier.contactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="供应商类型">{{ currentSupplier.supplierType }}</el-descriptions-item>
          <el-descriptions-item label="信用额度">¥{{ Number(currentSupplier.creditLimit || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="账期">{{ currentSupplier.creditDays }} 天</el-descriptions-item>
          <el-descriptions-item label="地址">{{ currentSupplier.address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="税号">{{ currentSupplier.taxNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="税率">{{ currentSupplier.taxRate || 0 }}%</el-descriptions-item>
          <el-descriptions-item label="开户银行">{{ currentSupplier.bankName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="银行账号">{{ currentSupplier.bankAccount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentSupplier.status === 'ACTIVE'" type="success">启用</el-tag>
            <el-tag v-else type="info">停用</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentSupplier.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { createSupplier, fetchSuppliers, updateSupplier, updateSupplierStatus } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const suppliers = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const currentSupplier = ref<any>(null);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  supplierName: "",
  contactName: "",
  contactPhone: "",
  supplierType: "BRAND",
  creditLimit: 0,
  creditDays: 30,
  address: "",
  taxNo: "",
  taxRate: 13,
  bankName: "",
  bankAccount: "",
  remark: ""
};

const form = reactive({ ...defaultForm });

const rules: FormRules = {
  supplierName: [{ required: true, message: "请输入供应商名称", trigger: "blur" }]
};

async function loadSuppliers() {
  loading.value = true;
  try {
    const data = await fetchSuppliers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined
    });
    suppliers.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadSuppliers();
}

function handlePageChange(p: number) {
  page.value = p;
  loadSuppliers();
}

function editSupplier(row: any) {
  isEdit.value = true;
  Object.assign(form, {
    id: row.id,
    supplierName: row.supplierName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    supplierType: row.supplierType,
    creditLimit: row.creditLimit,
    creditDays: row.creditDays,
    address: row.address,
    taxNo: row.taxNo,
    taxRate: row.taxRate,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    remark: row.remark
  });
  dialogVisible.value = true;
}

function viewDetail(row: any) {
  currentSupplier.value = row;
  detailVisible.value = true;
}

async function toggleStatus(row: any) {
  const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  try {
    await ElMessageBox.confirm(
      `确定要${newStatus === "ACTIVE" ? "启用" : "停用"}该供应商吗？`,
      "提示",
      { type: "warning" }
    );
    await updateSupplierStatus(row.id, newStatus);
    ElMessage.success("操作成功");
    loadSuppliers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.message || "操作失败");
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value) {
        await updateSupplier(form.id, form);
        ElMessage.success("更新成功");
      } else {
        await createSupplier(form);
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
</style>
