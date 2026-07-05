<template>
  <PageCard title="储值卡管理">
    <div class="search-bar">
      <el-input v-model="search.keyword" placeholder="卡号 / 客户名称 / 手机号" clearable style="width: 260px" @keyup.enter="loadCards" />
      <el-select v-model="search.status" placeholder="状态" clearable style="width: 140px">
        <el-option label="正常" value="NORMAL" />
        <el-option label="已冻结" value="FROZEN" />
        <el-option label="已注销" value="CANCELLED" />
      </el-select>
      <el-button @click="loadCards">搜索</el-button>
      <el-button type="primary" @click="handleCreateCard">新建储值卡</el-button>
    </div>

    <el-table :data="cards" v-loading="cardsLoading" stripe empty-text="暂无储值卡">
      <el-table-column prop="cardNo" label="卡号" width="160" />
      <el-table-column prop="customerName" label="客户" min-width="120" />
      <el-table-column prop="balance" label="余额" width="120">
        <template #default="{ row }">{{ formatYuan(row.balance) }}</template>
      </el-table-column>
      <el-table-column prop="totalRecharge" label="累计充值" width="120">
        <template #default="{ row }">{{ formatYuan(row.totalRecharge) }}</template>
      </el-table-column>
      <el-table-column prop="totalConsume" label="累计消费" width="120">
        <template #default="{ row }">{{ formatYuan(row.totalConsume) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="handleRecharge(row)">充值</el-button>
          <el-button size="small" link @click="handleConsume(row)">消费</el-button>
          <el-button size="small" link @click="handleRefund(row)">退款</el-button>
          <el-button v-if="row.status === 'NORMAL'" size="small" link type="warning" @click="handleFreeze(row)">冻结</el-button>
          <el-button v-if="row.status === 'FROZEN'" size="small" link type="success" @click="handleUnfreeze(row)">解冻</el-button>
          <el-button size="small" link @click="handleShowTransactions(row)">交易明细</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        background layout="total, sizes, prev, pager, next, jumper"
        :total="cardsTotal" :page-size="cardsPageSize" :current-page="cardsPage"
        @size-change="handleCardsSizeChange" @current-change="handleCardsPageChange"
      />
    </div>

    <!-- 新建储值卡 -->
    <el-dialog v-model="createCardVisible" title="新建储值卡" width="500px">
      <el-form ref="createCardFormRef" :model="createCardForm" :rules="createCardRules" label-width="100px">
        <el-form-item label="选择客户" prop="customerId">
          <el-select v-model="createCardForm.customerId" filterable placeholder="搜索客户" style="width: 100%">
            <el-option v-for="m in members" :key="m.id" :label="m.name + ' (' + (m.mobile || '') + ')'" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始金额" prop="amount">
          <el-input-number v-model="createCardForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createCardVisible = false">取消</el-button>
        <el-button type="primary" :loading="createCardSubmitLoading" @click="handleCreateCardSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 充值 -->
    <el-dialog v-model="rechargeVisible" title="充值" width="500px">
      <el-form ref="rechargeFormRef" :model="rechargeForm" :rules="rechargeRules" label-width="100px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="rechargeForm.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付方式" prop="paymentMethod">
          <el-input v-model="rechargeForm.paymentMethod" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="rechargeForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" :loading="rechargeSubmitLoading" @click="handleRechargeSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 消费 -->
    <el-dialog v-model="consumeVisible" title="消费" width="500px">
      <el-form ref="consumeFormRef" :model="consumeForm" :rules="consumeRules" label-width="100px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="consumeForm.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="来源" prop="source">
          <el-input v-model="consumeForm.source" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="consumeForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="consumeVisible = false">取消</el-button>
        <el-button type="primary" :loading="consumeSubmitLoading" @click="handleConsumeSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 退款 -->
    <el-dialog v-model="refundVisible" title="退款" width="500px">
      <el-form ref="refundFormRef" :model="refundForm" :rules="refundRules" label-width="100px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="refundForm.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="refundForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" :loading="refundSubmitLoading" @click="handleRefundSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 交易明细 -->
    <el-dialog v-model="transactionsVisible" title="交易明细" width="850px">
      <el-table :data="transactions" v-loading="transactionsLoading" stripe empty-text="暂无交易">
        <el-table-column prop="txnNo" label="交易号" width="180" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'RECHARGE' ? 'success' : row.type === 'CONSUME' ? 'danger' : 'warning'">
              {{ row.type === 'RECHARGE' ? '充值' : row.type === 'CONSUME' ? '消费' : '退款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="balance" label="余额" width="120">
          <template #default="{ row }">{{ formatYuan(row.balance) }}</template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式/来源" min-width="120" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column prop="createdAt" label="时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="transactionsTotal" :page-size="transactionsPageSize" :current-page="transactionsPage"
          @size-change="handleTransactionsSizeChange" @current-change="handleTransactionsPageChange"
        />
      </div>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate, formatYuan } from "../utils/format";
import {
  fetchStoreValueCards, createStoreValueCard, rechargeStoreValueCard, consumeStoreValueCard,
  refundStoreValueCard, freezeStoreValueCard, unfreezeStoreValueCard,
  fetchStoreValueTransactions, fetchMembers
} from "../api";

const cards = ref<any[]>([]);
const cardsLoading = ref(false);
const cardsTotal = ref(0);
const cardsPage = ref(1);
const cardsPageSize = ref(20);
const search = reactive({ keyword: "", status: "" });

function statusTagType(status: string) {
  return status === "NORMAL" ? "success" : status === "FROZEN" ? "warning" : "info";
}
function statusLabel(status: string) {
  const map: Record<string, string> = { NORMAL: "正常", FROZEN: "已冻结", CANCELLED: "已注销" };
  return map[status] || status;
}

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.msg || e?.message || fallback;
}

async function loadCards() {
  cardsLoading.value = true;
  try {
    const data = await fetchStoreValueCards({
      keyword: search.keyword || undefined,
      status: search.status || undefined,
      page: cardsPage.value,
      pageSize: cardsPageSize.value
    });
    cards.value = data.records || [];
    cardsTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载储值卡失败"));
  } finally {
    cardsLoading.value = false;
  }
}

function handleCardsSizeChange(size: number) {
  cardsPageSize.value = size;
  cardsPage.value = 1;
  loadCards();
}

function handleCardsPageChange(p: number) {
  cardsPage.value = p;
  loadCards();
}

// ── 新建储值卡 ──
const members = ref<any[]>([]);
const createCardVisible = ref(false);
const createCardSubmitLoading = ref(false);
const createCardFormRef = ref<FormInstance>();
const createCardForm = reactive({ customerId: "", amount: 0 });
const createCardRules: FormRules = {
  customerId: [{ required: true, message: "请选择客户", trigger: "change" }],
  amount: [{ required: true, message: "请输入初始金额", trigger: "blur" }]
};

async function handleCreateCard() {
  createCardVisible.value = true;
  createCardForm.customerId = "";
  createCardForm.amount = 0;
  try {
    const data = await fetchMembers({});
    members.value = Array.isArray(data) ? data : (data.records || []);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户列表失败"));
  }
}

async function handleCreateCardSubmit() {
  if (!createCardFormRef.value) return;
  await createCardFormRef.value.validate(async (valid) => {
    if (!valid) return;
    createCardSubmitLoading.value = true;
    try {
      await createStoreValueCard({ ...createCardForm, customerId: Number(createCardForm.customerId) });
      ElMessage.success("储值卡已创建");
      createCardVisible.value = false;
      loadCards();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "创建失败"));
    } finally {
      createCardSubmitLoading.value = false;
    }
  });
}

// ── 充值 ──
const currentCard = ref<any>(null);
const rechargeVisible = ref(false);
const rechargeSubmitLoading = ref(false);
const rechargeFormRef = ref<FormInstance>();
const rechargeForm = reactive({ amount: 0, paymentMethod: "", remark: "" });
const rechargeRules: FormRules = {
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  paymentMethod: [{ required: true, message: "请输入支付方式", trigger: "blur" }]
};

function handleRecharge(row: any) {
  currentCard.value = row;
  rechargeForm.amount = 0;
  rechargeForm.paymentMethod = "";
  rechargeForm.remark = "";
  rechargeVisible.value = true;
}

async function handleRechargeSubmit() {
  if (!rechargeFormRef.value) return;
  await rechargeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    rechargeSubmitLoading.value = true;
    try {
      await rechargeStoreValueCard(currentCard.value.id, rechargeForm);
      ElMessage.success("充值成功");
      rechargeVisible.value = false;
      loadCards();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "充值失败"));
    } finally {
      rechargeSubmitLoading.value = false;
    }
  });
}

// ── 消费 ──
const consumeVisible = ref(false);
const consumeSubmitLoading = ref(false);
const consumeFormRef = ref<FormInstance>();
const consumeForm = reactive({ amount: 0, source: "", remark: "" });
const consumeRules: FormRules = {
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }],
  source: [{ required: true, message: "请输入来源", trigger: "blur" }]
};

function handleConsume(row: any) {
  currentCard.value = row;
  consumeForm.amount = 0;
  consumeForm.source = "";
  consumeForm.remark = "";
  consumeVisible.value = true;
}

async function handleConsumeSubmit() {
  if (!consumeFormRef.value) return;
  await consumeFormRef.value.validate(async (valid) => {
    if (!valid) return;
    consumeSubmitLoading.value = true;
    try {
      await consumeStoreValueCard(currentCard.value.id, consumeForm);
      ElMessage.success("消费成功");
      consumeVisible.value = false;
      loadCards();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "消费失败"));
    } finally {
      consumeSubmitLoading.value = false;
    }
  });
}

// ── 退款 ──
const refundVisible = ref(false);
const refundSubmitLoading = ref(false);
const refundFormRef = ref<FormInstance>();
const refundForm = reactive({ amount: 0, remark: "" });
const refundRules: FormRules = {
  amount: [{ required: true, message: "请输入金额", trigger: "blur" }]
};

function handleRefund(row: any) {
  currentCard.value = row;
  refundForm.amount = 0;
  refundForm.remark = "";
  refundVisible.value = true;
}

async function handleRefundSubmit() {
  if (!refundFormRef.value) return;
  await refundFormRef.value.validate(async (valid) => {
    if (!valid) return;
    refundSubmitLoading.value = true;
    try {
      await refundStoreValueCard(currentCard.value.id, refundForm);
      ElMessage.success("退款成功");
      refundVisible.value = false;
      loadCards();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "退款失败"));
    } finally {
      refundSubmitLoading.value = false;
    }
  });
}

// ── 冻结/解冻 ──
async function handleFreeze(row: any) {
  try {
    await ElMessageBox.confirm("确定冻结该储值卡？", "提示", { type: "warning" });
    await freezeStoreValueCard(row.id);
    ElMessage.success("已冻结");
    loadCards();
  } catch (e: any) {
    if (e !== "cancel") ElMessage.error(getErrorMessage(e, "冻结失败"));
  }
}

async function handleUnfreeze(row: any) {
  try {
    await unfreezeStoreValueCard(row.id);
    ElMessage.success("已解冻");
    loadCards();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "解冻失败"));
  }
}

// ── 交易明细 ──
const transactionsVisible = ref(false);
const transactions = ref<any[]>([]);
const transactionsLoading = ref(false);
const transactionsTotal = ref(0);
const transactionsPage = ref(1);
const transactionsPageSize = ref(20);
const currentTxnCardId = ref("");

async function handleShowTransactions(row: any) {
  currentTxnCardId.value = row.id;
  transactionsVisible.value = true;
  transactionsPage.value = 1;
  await loadTransactions();
}

async function loadTransactions() {
  transactionsLoading.value = true;
  try {
    const data = await fetchStoreValueTransactions({
      cardId: Number(currentTxnCardId.value),
      page: transactionsPage.value,
      pageSize: transactionsPageSize.value
    });
    transactions.value = data.records || [];
    transactionsTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载交易明细失败"));
  } finally {
    transactionsLoading.value = false;
  }
}

function handleTransactionsSizeChange(size: number) {
  transactionsPageSize.value = size;
  transactionsPage.value = 1;
  loadTransactions();
}

function handleTransactionsPageChange(p: number) {
  transactionsPage.value = p;
  loadTransactions();
}

onMounted(() => {
  loadCards();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>