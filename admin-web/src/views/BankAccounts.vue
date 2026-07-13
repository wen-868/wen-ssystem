<template>
  <PageCard title="银行账户管理">
    <div class="bank-header">
      <el-input
        v-model="keyword"
        placeholder="搜索开户行/账户名称/账号"
        size="default"
        style="width: 260px; margin-right: 10px"
        clearable
        @clear="loadAccounts"
        @keyup.enter="loadAccounts"
      />
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增账户
      </el-button>
      <el-button @click="loadAccounts">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <el-table :data="accountList" v-loading="loading" stripe empty-text="暂无银行账户">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="bankName" label="开户行" min-width="140" />
      <el-table-column prop="accountNo" label="账号" min-width="180" />
      <el-table-column prop="accountName" label="账户名称" min-width="140" />
      <el-table-column prop="accountType" label="账户类型" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.accountType === 'DEBIT'" type="success">借记卡</el-tag>
          <el-tag v-else-if="row.accountType === 'CREDIT'" type="warning">信用卡</el-tag>
          <el-tag v-else-if="row.accountType === 'CORPORATE'" type="danger">对公账户</el-tag>
          <el-tag v-else>{{ row.accountType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="balance" label="余额" width="140">
        <template #default="{ row }">
          <span class="balance-text">{{ formatMoney(row.balance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
          <el-tag v-else type="info">停用</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="handleViewBalance(row)">余额流水</el-button>
          <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="handleToggleStatus(row)">
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
        @current-page="handlePageChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑银行账户' : '新增银行账户'" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="开户行" prop="bankName">
          <el-input v-model="form.bankName" placeholder="请输入开户行名称" />
        </el-form-item>
        <el-form-item label="账号" prop="accountNo">
          <el-input v-model="form.accountNo" placeholder="请输入银行账号" />
        </el-form-item>
        <el-form-item label="账户名称" prop="accountName">
          <el-input v-model="form.accountName" placeholder="请输入账户名称" />
        </el-form-item>
        <el-form-item label="账户类型" prop="accountType">
          <el-select v-model="form.accountType" style="width: 100%">
            <el-option label="借记卡" value="DEBIT" />
            <el-option label="信用卡" value="CREDIT" />
            <el-option label="对公账户" value="CORPORATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始余额">
          <el-input-number v-model="form.balance" :min="0" :precision="2" style="width: 100%" placeholder="初始余额" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 余额流水弹窗 -->
    <el-dialog v-model="balanceDialogVisible" title="账户余额流水" width="800px" :close-on-click-modal="false">
      <div class="balance-header">
        <span class="balance-info">账户：{{ currentAccount?.bankName }} - {{ currentAccount?.accountName }}</span>
        <span class="balance-amount">当前余额：{{ formatMoney(currentAccount?.balance || 0) }}</span>
      </div>
      <el-table :data="transactionList" v-loading="balanceLoading" stripe empty-text="暂无流水记录">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="transactionType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.transactionType === 'INCOME'" type="success">收入</el-tag>
            <el-tag v-else type="danger">支出</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span :class="row.transactionType === 'INCOME' ? 'income' : 'expense'">
              {{ row.transactionType === 'INCOME' ? '+' : '-' }}{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balance" label="余额" width="120">
          <template #default="{ row }">
            {{ formatMoney(row.balance) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" />
        <el-table-column prop="createdAt" label="交易时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination" v-if="transactionTotal > 0">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="transactionTotal"
          :page-size="transactionPageSize"
          :current-page="transactionPage"
          @size-change="handleTransactionSizeChange"
          @current-page="handleTransactionPageChange"
        />
      </div>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatMoney } from "../utils/format";
import {
  fetchBankAccountsForFinance,
  createBankAccountForFinance,
  updateBankAccountForFinance,
  toggleBankAccountStatus,
  fetchBankAccountTransactions
} from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const balanceLoading = ref(false);
const accountList = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const balanceDialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();

const transactionList = ref<any[]>([]);
const transactionTotal = ref(0);
const transactionPage = ref(1);
const transactionPageSize = ref(20);
const currentAccount = ref<any>(null);

const defaultForm = {
  id: 0,
  bankName: "",
  accountNo: "",
  accountName: "",
  accountType: "DEBIT" as "DEBIT" | "CREDIT" | "CORPORATE",
  balance: 0,
  remark: ""
};

const form = reactive({ ...defaultForm });

const formRules: FormRules = {
  bankName: [{ required: true, message: "请输入开户行名称", trigger: "blur" }],
  accountNo: [{ required: true, message: "请输入银行账号", trigger: "blur" }],
  accountName: [{ required: true, message: "请输入账户名称", trigger: "blur" }],
  accountType: [{ required: true, message: "请选择账户类型", trigger: "change" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadAccounts() {
  loading.value = true;
  try {
    const data = await fetchBankAccountsForFinance({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined
    });
    accountList.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载银行账户失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadAccounts();
}

function handlePageChange(p: number) {
  page.value = p;
  loadAccounts();
}

function handleAdd() {
  isEdit.value = false;
  Object.assign(form, { ...defaultForm });
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  form.id = row.id;
  form.bankName = row.bankName || "";
  form.accountNo = row.accountNo || "";
  form.accountName = row.accountName || "";
  form.accountType = (row.accountType as "DEBIT" | "CREDIT" | "CORPORATE") || "DEBIT";
  form.balance = row.balance || 0;
  form.remark = row.remark || "";
  dialogVisible.value = true;
}

async function handleToggleStatus(row: any) {
  try {
    await toggleBankAccountStatus(row.id);
    ElMessage.success(row.status === 'ACTIVE' ? '账户已停用' : '账户已启用');
    loadAccounts();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, row.status === 'ACTIVE' ? '停用失败' : '启用失败'));
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      const payload: any = {
        bankName: form.bankName,
        accountNo: form.accountNo,
        accountName: form.accountName,
        accountType: form.accountType,
        balance: form.balance,
        remark: form.remark || undefined
      };
      if (isEdit.value) {
        await updateBankAccountForFinance(form.id, payload);
        ElMessage.success("银行账户已更新");
      } else {
        await createBankAccountForFinance(payload);
        ElMessage.success("银行账户已创建");
      }
      dialogVisible.value = false;
      Object.assign(form, defaultForm);
      loadAccounts();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, isEdit.value ? "更新失败" : "创建失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleViewBalance(row: any) {
  currentAccount.value = row;
  transactionPage.value = 1;
  balanceDialogVisible.value = true;
  await loadTransactions();
}

async function loadTransactions() {
  if (!currentAccount.value) return;
  balanceLoading.value = true;
  try {
    const data = await fetchBankAccountTransactions(currentAccount.value.id, {
      page: transactionPage.value,
      pageSize: transactionPageSize.value
    });
    transactionList.value = data.records || [];
    transactionTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载流水失败"));
  } finally {
    balanceLoading.value = false;
  }
}

function handleTransactionSizeChange(size: number) {
  transactionPageSize.value = size;
  transactionPage.value = 1;
  loadTransactions();
}

function handleTransactionPageChange(p: number) {
  transactionPage.value = p;
  loadTransactions();
}

onMounted(() => {
  loadAccounts();
});
</script>

<style scoped>
.bank-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.balance-text {
  font-weight: 600;
  color: #409eff;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.balance-info {
  font-size: 14px;
  font-weight: 600;
}

.balance-amount {
  font-size: 16px;
  font-weight: 700;
  color: #409eff;
}

.income {
  color: #67c23a;
  font-weight: 600;
}

.expense {
  color: #f56c6c;
  font-weight: 600;
}
</style>