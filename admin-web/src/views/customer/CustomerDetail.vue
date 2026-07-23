<template>
  <div class="page">
    <div style="margin-bottom: 16px">
      <el-button @click="router.back()" icon="ArrowLeft">返回</el-button>
    </div>

    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>客户详情</span>
          <div class="header-actions">
            <el-button type="success" v-if="member.status === 'ACTIVE'" @click="handleToggleDisable(true)">禁用</el-button>
            <el-button type="primary" v-else @click="handleToggleDisable(false)">启用</el-button>
            <el-button type="primary" @click="openEditDialog">编辑</el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="客户ID">{{ member.memberId || "-" }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ member.name || "-" }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ member.mobile || "-" }}</el-descriptions-item>
        <el-descriptions-item label="客户类型">
          <el-tag v-if="member.customerType === 'RETAIL'" type="primary">零售客户</el-tag>
          <el-tag v-else-if="member.customerType === 'WHOLESALE'" type="success">批发客户</el-tag>
          <el-tag v-else>{{ member.customerType }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="归属销售员">{{ member.staffName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="积分">{{ member.points || 0 }}</el-descriptions-item>
        <el-descriptions-item label="客户等级">
          <el-tag v-if="member.levelCode === 'VIP'" type="danger">VIP</el-tag>
          <el-tag v-else-if="member.levelCode === 'GOLD'" type="warning">GOLD</el-tag>
          <el-tag v-else-if="member.levelCode === 'SILVER'" type="info">SILVER</el-tag>
          <el-tag v-else>{{ member.levelCode || "-" }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="member.status === 'ACTIVE'" type="success">启用</el-tag>
          <el-tag v-else-if="member.status === 'INACTIVE'" type="danger">停用</el-tag>
          <el-tag v-else>{{ member.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="地址">{{ member.address || "-" }}</el-descriptions-item>
        <el-descriptions-item label="结算方式">
          <el-tag v-if="member.settlementType === 'CASH'" type="success">现金</el-tag>
          <el-tag v-else-if="member.settlementType === 'ACCOUNT'" type="warning">挂账</el-tag>
          <el-tag v-else>{{ member.settlementType || "-" }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ member.remark || "-" }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(member.createTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top: 16px" v-loading="cardLoading">
      <template #header>
        <div class="card-header">
          <span>会员卡信息</span>
          <el-button type="primary" size="small" @click="openLevelDialog">调整会员等级</el-button>
        </div>
      </template>

      <el-descriptions :column="2" border v-if="memberCard">
        <el-descriptions-item label="卡号">{{ memberCard.cardNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="卡类型">{{ memberCard.cardType || "-" }}</el-descriptions-item>
        <el-descriptions-item label="余额">{{ memberCard.balance || 0 }}</el-descriptions-item>
        <el-descriptions-item label="开卡时间">{{ formatDate(memberCard.openTime) }}</el-descriptions-item>
        <el-descriptions-item label="过期时间">{{ formatDate(memberCard.expireTime) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="memberCard.status === 'ACTIVE'" type="success">正常</el-tag>
          <el-tag v-else-if="memberCard.status === 'FROZEN'" type="warning">冻结</el-tag>
          <el-tag v-else>{{ memberCard.status }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无会员卡信息" :image-size="80" />
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <span>数据统计</span>
      </template>

      <el-descriptions :column="4" border v-if="purchaseStats">
        <el-descriptions-item label="采购次数">{{ purchaseStats.purchaseCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="采购总额">{{ formatMoney(purchaseStats.totalAmount || 0) }}</el-descriptions-item>
        <el-descriptions-item label="平均采购金额">{{ formatMoney(purchaseStats.avgAmount || 0) }}</el-descriptions-item>
        <el-descriptions-item label="最近采购时间">{{ formatDate(purchaseStats.lastPurchaseTime) }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无采购统计数据" :image-size="80" />
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <span>相关数据</span>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="销售单列表" name="sale-bills">
          <el-table :data="saleBills" v-loading="tabLoading['sale-bills']" stripe empty-text="暂无销售单">
            <el-table-column prop="billNo" label="单据编号" width="180" />
            <el-table-column prop="totalAmount" label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'PAID'" type="success">已付款</el-tag>
                <el-tag v-else-if="row.status === 'UNPAID'" type="warning">未付款</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="saleBillsTotal"
              :page-size="tabPageSize"
              :current-page="tabPages['sale-bills']"
              @size-change="(size: number) => handleTabSizeChange('sale-bills', size)"
              @current-change="(page: number) => handleTabPageChange('sale-bills', page)"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="付款记录" name="payments">
          <el-table :data="payments" v-loading="tabLoading['payments']" stripe empty-text="暂无付款记录">
            <el-table-column prop="paymentNo" label="付款编号" width="180" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="付款方式" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'SUCCESS'" type="success">成功</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">处理中</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="付款时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="paymentsTotal"
              :page-size="tabPageSize"
              :current-page="tabPages['payments']"
              @size-change="(size: number) => handleTabSizeChange('payments', size)"
              @current-change="(page: number) => handleTabPageChange('payments', page)"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="对账单" name="statements">
          <el-table :data="statements" v-loading="tabLoading['statements']" stripe empty-text="暂无对账单">
            <el-table-column prop="statementNo" label="对账编号" width="180" />
            <el-table-column prop="periodStart" label="对账周期" width="180">
              <template #default="{ row }">{{ formatDate(row.periodStart) }} ~ {{ formatDate(row.periodEnd) }}</template>
            </el-table-column>
            <el-table-column prop="totalAmount" label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'CONFIRMED'" type="success">已确认</el-tag>
                <el-tag v-else-if="row.status === 'PENDING'" type="warning">待确认</el-tag>
                <el-tag v-else>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="生成时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="statementsTotal"
              :page-size="tabPageSize"
              :current-page="tabPages['statements']"
              @size-change="(size: number) => handleTabSizeChange('statements', size)"
              @current-change="(page: number) => handleTabPageChange('statements', page)"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="editDialogVisible" title="编辑客户" width="720px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="100px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="editForm.mobile" />
        </el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="editForm.customerType" style="width: 100%">
            <el-option label="零售客户" value="RETAIL" />
            <el-option label="批发客户" value="WHOLESALE" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户地址">
          <el-input v-model="editForm.address" placeholder="请输入客户地址" />
        </el-form-item>
        <el-form-item label="结算方式">
          <el-select v-model="editForm.settlementType" style="width: 100%">
            <el-option label="现金" value="CASH" />
            <el-option label="挂账" value="ACCOUNT" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属销售员">
          <el-select v-model="editForm.staffId" style="width: 100%" filterable placeholder="请选择销售员">
            <el-option v-for="s in staffList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="levelDialogVisible" title="调整会员等级" width="480px">
      <el-form ref="levelFormRef" :model="levelForm" :rules="levelRules" label-width="100px">
        <el-form-item label="目标等级" prop="levelId">
          <el-select v-model="levelForm.levelId" style="width: 100%" placeholder="请选择等级">
            <el-option v-for="l in levelList" :key="l.id" :label="l.name" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="levelForm.reason" type="textarea" :rows="2" placeholder="请输入调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="levelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="levelLoading" @click="handleLevelSubmit">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { formatDate, formatMoney } from "../../utils/format";
import {
  fetchMemberDetail,
  updateMember,
  disableMember,
  fetchMemberCard,
  updateMemberLevel,
  fetchMemberPurchaseStats,
  fetchMemberSaleBills,
  fetchMemberPayments,
  fetchMemberStatements,
  fetchStaff,
  fetchLevelConfigs
} from "../../api";

const route = useRoute();
const router = useRouter();

const memberId = Number(route.params.memberId);

const loading = ref(false);
const cardLoading = ref(false);
const editLoading = ref(false);
const levelLoading = ref(false);
const member = ref<any>({});
const memberCard = ref<any>(null);
const purchaseStats = ref<any>(null);
const staffList = ref<any[]>([]);
const levelList = ref<any[]>([]);

const activeTab = ref("sale-bills");
const tabLoading = ref<Record<string, boolean>>({});
const tabPages = ref<Record<string, number>>({ "sale-bills": 1, payments: 1, statements: 1 });
const tabPageSize = ref(20);

const saleBills = ref<any[]>([]);
const saleBillsTotal = ref(0);
const payments = ref<any[]>([]);
const paymentsTotal = ref(0);
const statements = ref<any[]>([]);
const statementsTotal = ref(0);

const editDialogVisible = ref(false);
const editFormRef = ref<FormInstance>();
const editForm = reactive({
  name: "",
  mobile: "",
  customerType: "RETAIL" as "RETAIL" | "WHOLESALE",
  address: "",
  settlementType: "",
  staffId: null as number | null,
  remark: ""
});

const editRules: FormRules = {
  name: [{ required: true, message: "请填写客户名称", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "请填写正确的手机号", trigger: "blur" }
  ]
};

const levelDialogVisible = ref(false);
const levelFormRef = ref<FormInstance>();
const levelForm = reactive({
  levelId: null as number | null,
  reason: ""
});

const levelRules: FormRules = {
  levelId: [{ required: true, message: "请选择目标等级", trigger: "blur" }],
  reason: [{ required: true, message: "请填写调整原因", trigger: "blur" }]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadMemberDetail() {
  loading.value = true;
  try {
    member.value = await fetchMemberDetail(memberId);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户详情失败"));
  } finally {
    loading.value = false;
  }
}

async function loadMemberCard() {
  cardLoading.value = true;
  try {
    memberCard.value = await fetchMemberCard(memberId);
  } catch {
    memberCard.value = null;
  } finally {
    cardLoading.value = false;
  }
}

async function loadPurchaseStats() {
  try {
    purchaseStats.value = await fetchMemberPurchaseStats(memberId);
  } catch {
    purchaseStats.value = null;
  }
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = data.records || data || [];
  } catch { /* ignore */ }
}

async function loadLevelConfigs() {
  try {
    const data = await fetchLevelConfigs();
    levelList.value = data.records || data || [];
  } catch { /* ignore */ }
}

async function loadSaleBills(page = 1) {
  tabLoading.value["sale-bills"] = true;
  try {
    const data = await fetchMemberSaleBills(memberId, { page, pageSize: tabPageSize.value });
    saleBills.value = data.records || [];
    saleBillsTotal.value = data.total || saleBills.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载销售单失败"));
  } finally {
    tabLoading.value["sale-bills"] = false;
  }
}

async function loadPayments(page = 1) {
  tabLoading.value["payments"] = true;
  try {
    const data = await fetchMemberPayments(memberId, { page, pageSize: tabPageSize.value });
    payments.value = data.records || [];
    paymentsTotal.value = data.total || payments.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载付款记录失败"));
  } finally {
    tabLoading.value["payments"] = false;
  }
}

async function loadStatements(page = 1) {
  tabLoading.value["statements"] = true;
  try {
    const data = await fetchMemberStatements(memberId, { page, pageSize: tabPageSize.value });
    statements.value = data.records || [];
    statementsTotal.value = data.total || statements.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载对账单失败"));
  } finally {
    tabLoading.value["statements"] = false;
  }
}

async function handleToggleDisable(disabled: boolean) {
  const action = disabled ? "禁用" : "启用";
  try {
    await ElMessageBox.confirm(`确定要${action}该客户吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await disableMember(memberId, disabled);
    ElMessage.success(`客户已${action}`);
    loadMemberDetail();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${action}客户失败`));
    }
  }
}

function openEditDialog() {
  editForm.name = member.value.name || "";
  editForm.mobile = member.value.mobile || "";
  editForm.customerType = member.value.customerType || "RETAIL";
  editForm.address = member.value.address || "";
  editForm.settlementType = member.value.settlementType || "";
  editForm.staffId = member.value.staffId || null;
  editForm.remark = member.value.remark || "";
  editDialogVisible.value = true;
}

async function handleEditSubmit() {
  if (!editFormRef.value) return;
  await editFormRef.value.validate(async (valid) => {
    if (!valid) return;
    editLoading.value = true;
    try {
      await updateMember(memberId, { ...editForm });
      ElMessage.success("客户信息已更新");
      editDialogVisible.value = false;
      loadMemberDetail();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "更新客户失败"));
    } finally {
      editLoading.value = false;
    }
  });
}

function openLevelDialog() {
  levelForm.levelId = null;
  levelForm.reason = "";
  levelDialogVisible.value = true;
}

async function handleLevelSubmit() {
  if (!levelFormRef.value) return;
  await levelFormRef.value.validate(async (valid) => {
    if (!valid) return;
    levelLoading.value = true;
    try {
      await updateMemberLevel(memberId, { levelId: levelForm.levelId!, reason: levelForm.reason });
      ElMessage.success("会员等级已调整");
      levelDialogVisible.value = false;
      loadMemberDetail();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "调整会员等级失败"));
    } finally {
      levelLoading.value = false;
    }
  });
}

function handleTabSizeChange(tab: string, size: number) {
  tabPageSize.value = size;
  tabPages.value[tab] = 1;
  loadTabData(tab, 1);
}

function handleTabPageChange(tab: string, page: number) {
  tabPages.value[tab] = page;
  loadTabData(tab, page);
}

function loadTabData(tab: string, page: number) {
  switch (tab) {
    case "sale-bills":
      loadSaleBills(page);
      break;
    case "payments":
      loadPayments(page);
      break;
    case "statements":
      loadStatements(page);
      break;
  }
}

watch(activeTab, (newTab) => {
  if (!tabPages.value[newTab]) {
    tabPages.value[newTab] = 1;
  }
  loadTabData(newTab, tabPages.value[newTab]);
});

onMounted(() => {
  loadMemberDetail();
  loadMemberCard();
  loadPurchaseStats();
  loadStaff();
  loadLevelConfigs();
  loadSaleBills();
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
  gap: 8px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>