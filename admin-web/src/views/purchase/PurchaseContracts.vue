<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>采购合同</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="合同编号/关键词"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadContracts"
              @keyup.enter="loadContracts"
            />
            <el-select v-model="filterStatus" placeholder="全部状态" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadContracts">
              <el-option label="待审核" value="PENDING" />
              <el-option label="执行中" value="ACTIVE" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已作废" value="VOIDED" />
            </el-select>
            <el-select v-model="filterSupplierId" placeholder="供应商" size="default" style="width: 160px; margin-right: 10px" clearable filterable @change="loadContracts">
              <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 10px; width: 260px"
              value-format="YYYY-MM-DD"
              @change="loadContracts"
            />
            <el-button type="primary" @click="handleCreate">
              <el-icon><Plus /></el-icon> 新建合同
            </el-button>
            <el-button @click="handleExport">导出</el-button>
            <el-button @click="loadContracts">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="contracts" v-loading="loading" stripe>
        <el-table-column prop="contractNo" label="合同编号" width="200" />
        <el-table-column prop="supplierName" label="供应商名称" width="180" />
        <el-table-column prop="contractType" label="合同类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.contractType === 'FRAME'" type="primary">采购框架</el-tag>
            <el-tag v-else-if="row.contractType === 'SINGLE'" type="success">单次采购</el-tag>
            <el-tag v-else>{{ row.contractType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contractAmount" label="合同金额" width="130">
          <template #default="{ row }">¥{{ Number(row.contractAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已付金额" width="120">
          <template #default="{ row }">¥{{ Number(row.paidAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="unpaidAmount" label="未付金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.unpaidAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveDate" label="生效日期" width="120" />
        <el-table-column prop="expiryDate" label="到期日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">执行中</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="info">已完成</el-tag>
            <el-tag v-else-if="row.status === 'VOIDED'" type="danger">已作废</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="success" @click="handleGenerateOrder(row)">生成采购单</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑采购合同' : '新建采购合同'" width="900px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-divider content-position="left">基础信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同编号" prop="contractNo">
              <el-input v-model="form.contractNo" :disabled="isEdit" placeholder="自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId">
              <el-select v-model="form.supplierId" placeholder="请选择供应商" style="width: 100%" filterable @change="onSupplierChange">
                <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同类型" prop="contractType">
              <el-select v-model="form.contractType" style="width: 100%">
                <el-option label="采购框架" value="FRAME" />
                <el-option label="单次采购" value="SINGLE" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同金额" prop="contractAmount">
              <el-input-number v-model="form.contractAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="生效日期" prop="effectiveDate">
              <el-date-picker v-model="form.effectiveDate" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期" prop="expiryDate">
              <el-date-picker v-model="form.expiryDate" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">合同内容</el-divider>
        <el-form-item label="商品明细">
          <el-table :data="form.items" size="small" border>
            <el-table-column prop="productName" label="商品名称" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.productName" size="small" placeholder="商品名称" />
              </template>
            </el-table-column>
            <el-table-column prop="spec" label="规格" width="120">
              <template #default="{ row }">
                <el-input v-model="row.spec" size="small" placeholder="规格" />
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" :min="0" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价(元)" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="110">
              <template #default="{ row }">¥{{ Number((row.quantity || 0) * (row.unitPrice || 0)).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button size="small" link type="danger" @click="removeItem($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" plain style="margin-top: 10px" @click="addItem">+ 添加商品</el-button>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            v-model:file-list="form.attachments"
            action="#"
            :auto-upload="false"
            multiple
            :limit="5"
          >
            <el-button size="small">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持上传最多5个附件</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-drawer v-model="detailVisible" title="采购合同详情" size="600px">
      <template v-if="currentContract">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同编号">{{ currentContract.contractNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ currentContract.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">
            <el-tag v-if="currentContract.contractType === 'FRAME'" type="primary">采购框架</el-tag>
            <el-tag v-else-if="currentContract.contractType === 'SINGLE'" type="success">单次采购</el-tag>
            <el-tag v-else>{{ currentContract.contractType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentContract.status === 'PENDING'" type="warning">待审核</el-tag>
            <el-tag v-else-if="currentContract.status === 'ACTIVE'" type="success">执行中</el-tag>
            <el-tag v-else-if="currentContract.status === 'COMPLETED'" type="info">已完成</el-tag>
            <el-tag v-else-if="currentContract.status === 'VOIDED'" type="danger">已作废</el-tag>
            <el-tag v-else>{{ currentContract.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="合同金额">¥{{ Number(currentContract.contractAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ Number(currentContract.paidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="未付金额">¥{{ Number(currentContract.unpaidAmount || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentContract.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="生效日期">{{ currentContract.effectiveDate }}</el-descriptions-item>
          <el-descriptions-item label="到期日期">{{ currentContract.expiryDate }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">商品明细</h4>
        <el-table :data="currentContract.items || []" size="small" border>
          <el-table-column prop="productName" label="商品名称" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="100">
            <template #default="{ row }">¥{{ Number((row.quantity || 0) * (row.unitPrice || 0)).toFixed(2) }}</template>
          </el-table-column>
        </el-table>

        <el-divider />
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="备注">{{ currentContract.remark || '无' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">审批记录</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(log, idx) in currentContract.approvalLogs || []"
            :key="idx"
            :timestamp="log.time"
            :type="log.status === 'APPROVED' ? 'success' : log.status === 'REJECTED' ? 'danger' : 'primary'"
          >
            {{ log.action }} - {{ log.operator }}
            <p v-if="log.remark" style="margin: 4px 0 0; color: #999999; font-size: 12px">{{ log.remark }}</p>
          </el-timeline-item>
          <el-timeline-item v-if="!currentContract.approvalLogs?.length" type="primary">
            暂无审批记录
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  createPurchaseContract,
  deletePurchaseContract,
  fetchPurchaseContractDetail,
  fetchPurchaseContracts,
  fetchSuppliers,
  updatePurchaseContract,
  exportPurchaseContractsCsv
} from "../../api";

const loading = ref(false);
const submitLoading = ref(false);
const contracts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const filterStatus = ref("");
const filterSupplierId = ref<number | null>(null);
const dateRange = ref<string[]>([]);
const suppliers = ref<any[]>([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const currentContract = ref<any>(null);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const defaultForm = {
  id: 0,
  contractNo: "",
  supplierId: null as number | null,
  supplierName: "",
  contractType: "FRAME" as "FRAME" | "SINGLE",
  contractAmount: 0,
  effectiveDate: "",
  expiryDate: "",
  remark: "",
  items: [{ productName: "", spec: "", quantity: 1, unitPrice: 0 }] as any[],
  attachments: [] as any[]
};

const form = reactive({ ...defaultForm, items: [{ ...defaultForm.items[0] }], attachments: [] });

const rules: FormRules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }],
  contractType: [{ required: true, message: "请选择合同类型", trigger: "change" }],
  contractAmount: [{ required: true, message: "请填写合同金额", trigger: "blur" }],
  effectiveDate: [{ required: true, message: "请选择生效日期", trigger: "change" }],
  expiryDate: [{ required: true, message: "请选择到期日期", trigger: "change" }]
};

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
});

function onSupplierChange(val: number) {
  const s = suppliers.value.find(s => s.id === val);
  if (s) form.supplierName = s.name;
}

async function loadContracts() {
  loading.value = true;
  try {
    const data = await fetchPurchaseContracts({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: filterStatus.value || undefined,
      supplierId: filterSupplierId.value || undefined,
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined
    });
    contracts.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  try {
    const data = await fetchSuppliers({ page: 1, pageSize: 100 });
    suppliers.value = data.records || data || [];
  } catch (e) {
    console.error("加载供应商失败", e);
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadContracts();
}

function handlePageChange(p: number) {
  page.value = p;
  loadContracts();
}

function handleCreate() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm, items: [{ productName: "", spec: "", quantity: 1, unitPrice: 0 }], attachments: [] });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  Object.assign(form, {
    ...row,
    items: row.items?.length ? row.items.map((i: any) => ({ ...i })) : [{ productName: "", spec: "", quantity: 1, unitPrice: 0 }],
    attachments: row.attachments || []
  });
  dialogVisible.value = true;
}

function addItem() {
  form.items.push({ productName: "", spec: "", quantity: 1, unitPrice: 0 });
}

function removeItem(index: number) {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (form.items.length === 0 || !form.items.some(i => i.productName && i.quantity > 0)) {
    ElMessage.warning("请添加有效的商品明细");
    return;
  }
  submitLoading.value = true;
  try {
    if (isEdit.value) {
      await updatePurchaseContract(form.id, form);
      ElMessage.success("更新成功");
    } else {
      await createPurchaseContract(form);
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadContracts();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally {
    submitLoading.value = false;
  }
}

async function viewDetail(row: any) {
  try {
    currentContract.value = await fetchPurchaseContractDetail(row.id);
    detailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载详情失败");
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定删除该采购合同吗？", "提示", { type: "warning" });
    await deletePurchaseContract(row.id);
    ElMessage.success("删除成功");
    loadContracts();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.msg || "删除失败");
    }
  }
}

function handleGenerateOrder(row: any) {
  ElMessage.info("生成采购单功能待实现");
}

async function handleExport() {
  try {
    const blob = await exportPurchaseContractsCsv({
      keyword: keyword.value || undefined,
      status: filterStatus.value || undefined,
      supplierId: filterSupplierId.value || undefined
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `采购合同_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "导出失败");
  }
}

onMounted(() => {
  loadContracts();
  loadSuppliers();
});
</script>

<style scoped>
.page { padding: 0; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.amount-text { color: var(--color-danger); font-weight: 600; }
</style>
