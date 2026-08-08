<template>
  <div class="page">
    <!-- 页头：标题 + 说明 + 操作区 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">客户管理</h2>
        <p class="page-desc">管理客户档案、等级与结算方式</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="loadMembers">刷新</el-button>
        <el-button type="primary" @click="memberDialogVisible = true">
          <el-icon><Plus /></el-icon>&nbsp;新增客户
        </el-button>
      </div>
    </div>

    <StatBar :stats="memberStats" />

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="客户名/手机号"
        clearable
        @clear="loadMembers"
        @keyup.enter="loadMembers"
      />
      <el-button type="primary" @click="loadMembers">查询</el-button>
      <div class="filter-bar-spacer" />
    </div>

    <TableSkeleton v-if="loading" />
    <div v-else class="table-card">
      <el-table :data="members" stripe>
        <el-table-column prop="memberId" label="客户ID" width="100" />
        <el-table-column prop="name" label="客户名称" min-width="140" />
        <el-table-column prop="contact" label="联系人" min-width="100" show-overflow-tooltip />
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="customerType" label="客户类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getCustomerTypeTagType(row.customerType)">{{ getCustomerTypeName(row.customerType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="staffName" label="归属销售员" width="140" />
        <el-table-column prop="points" label="积分" width="80" />
        <el-table-column prop="levelCode" label="客户等级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.levelCode === 'VIP'" type="danger">VIP</el-tag>
            <el-tag v-else-if="row.levelCode === 'GOLD'" type="warning">GOLD</el-tag>
            <el-tag v-else-if="row.levelCode === 'SILVER'" type="info">SILVER</el-tag>
            <el-tag v-else>{{ row.levelCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ACTIVE'" type="success">启用</el-tag>
            <el-tag v-else-if="row.status === 'INACTIVE'" type="danger">停用</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="140" show-overflow-tooltip />
        <el-table-column prop="settlementType" label="结算方式" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.settlementType === 'CASH'" type="success">现金</el-tag>
            <el-tag v-else-if="row.settlementType === 'ACCOUNT'" type="warning">挂账</el-tag>
            <el-tag v-else>{{ row.settlementType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleViewDetail(row)">详情</el-button>
            <el-button size="small" link type="primary" @click="handleAssignMember(row)">分配管理员</el-button>
            <el-button size="small" link @click="handleShowPriceHistory(row)">价格参考</el-button>
            <el-button size="small" link v-if="row.status === 'ACTIVE'" type="danger" @click="handleToggleDisable(row, true)">禁用</el-button>
            <el-button size="small" link v-else type="success" @click="handleToggleDisable(row, false)">启用</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无客户数据" :image-size="80" />
        </template>
      </el-table>

      <div class="table-card-footer">
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
    </div>

    <el-alert v-if="priceHistoryTip" type="info" show-icon :closable="false" class="price-tip">
      <template #title>{{ priceHistoryTip }}</template>
    </el-alert>

    <el-dialog v-model="memberDialogVisible" title="新增客户" width="720px">
      <el-form ref="memberFormRef" :model="memberForm" :rules="memberRules" label-width="100px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="memberForm.name" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="memberForm.contact" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="memberForm.mobile" />
        </el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="memberForm.customerType" style="width: 100%" placeholder="请选择客户类型">
            <el-option v-for="t in customerTypeOptions" :key="t.id" :label="t.name" :value="t.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户地址">
          <el-input v-model="memberForm.address" placeholder="请输入客户地址" />
        </el-form-item>
        <el-form-item label="结算方式">
          <el-select v-model="memberForm.settlementType" style="width: 100%">
            <el-option label="现金" value="CASH" />
            <el-option label="挂账" value="ACCOUNT" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属销售员">
          <el-select v-model="memberForm.staffId" style="width: 100%" filterable placeholder="请选择销售员">
            <el-option v-for="s in staffList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="memberForm.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleCreateMember">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import TableSkeleton from "../../components/TableSkeleton.vue";
import StatBar from "../../components/StatBar.vue";
import { assignMember, createMember, disableMember, fetchMemberPriceHistory, fetchMembers, fetchStaff } from "../../api";
import { fetchCustomerTypes } from "../../api/customer";

const router = useRouter();
const loading = ref(false);
const submitLoading = ref(false);
const members = ref<any[]>([]);

/** 客户统计条（对标设计稿 p07） */
const memberStats = computed(() => {
  const list = members.value;
  const vip = list.filter((m) => m.levelCode === "VIP").length;
  const active = list.filter((m) => m.status === "ACTIVE").length;
  return [
    { label: "全部客户", value: list.length, primary: true },
    { label: "VIP", value: vip },
    { label: "启用", value: active },
  ];
});
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const memberDialogVisible = ref(false);
const memberFormRef = ref<FormInstance>();
const priceHistoryTip = ref("");
const staffList = ref<any[]>([]);
const customerTypeOptions = ref<any[]>([]);

const mobilePattern = /^1[3-9]\d{9}$/;

const memberForm = reactive({
  name: "",
  contact: "",
  mobile: "",
  customerType: "" as string,
  address: "",
  settlementType: "",
  staffId: null as number | null,
  remark: "",
});

const memberRules: FormRules = {
  name: [{ required: true, message: "请填写客户名称", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "请填写正确的手机号", trigger: "blur" }
  ]
};

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = data.records || data || [];
  } catch { /* ignore */ }
}

async function loadCustomerTypes() {
  try {
    const data = await fetchCustomerTypes({ status: "ENABLED" });
    customerTypeOptions.value = data.records || data || [];
  } catch { /* ignore */ }
}

function getCustomerTypeName(code: string) {
  const found = customerTypeOptions.value.find(t => t.code === code);
  return found?.name || code;
}

function getCustomerTypeTagType(code: string) {
  const found = customerTypeOptions.value.find(t => t.code === code);
  // 根据索引返回不同颜色，简单处理
  const idx = customerTypeOptions.value.indexOf(found);
  const types = ["primary", "success", "warning", "info", "danger"];
  return found ? types[idx % types.length] : "info";
}

async function loadMembers() {
  loading.value = true;
  try {
    const data = await fetchMembers({ keyword: keyword.value || undefined });
    const list = data.records || [];
    total.value = data.total || list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    members.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载客户列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadMembers();
}

function handlePageChange(p: number) {
  page.value = p;
  loadMembers();
}

async function handleCreateMember() {
  if (!memberFormRef.value) return;
  await memberFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      await createMember({ ...memberForm, staffId: memberForm.staffId ?? undefined });
      ElMessage.success("客户已新增");
      memberDialogVisible.value = false;
      memberForm.name = "";
      memberForm.contact = "";
      memberForm.mobile = "";
      memberForm.customerType = customerTypeOptions.value[0]?.code || "";
      memberForm.address = "";
      memberForm.settlementType = "";
      memberForm.staffId = null;
      memberForm.remark = "";
      loadMembers();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "新增客户失败"));
    } finally {
      submitLoading.value = false;
    }
  });
}

async function handleAssignMember(row: any) {
  try {
    await assignMember(row.memberId, 1);
    ElMessage.success("客户已分配给系统管理员");
    loadMembers();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "分配失败"));
  }
}

async function handleShowPriceHistory(row: any) {
  try {
    const records = await fetchMemberPriceHistory(row.memberId, 1);
    if (!records || !records.length) {
      priceHistoryTip.value = `${row.name} 暂无 SKU 1 历史开单价`;
      return;
    }
    const ref = records[0];
    priceHistoryTip.value = `${row.name} / SKU ${ref.skuId}：上次 ¥${ref.lastPrice}，最高 ¥${ref.highestPrice}，最低 ¥${ref.lowestPrice}`;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "获取价格历史失败"));
  }
}

function handleViewDetail(row: any) {
  router.push(`/customers/detail/${row.memberId}`);
}

async function handleToggleDisable(row: any, disabled: boolean) {
  const action = disabled ? "禁用" : "启用";
  try {
    await ElMessageBox.confirm(`确定要${action}客户「${row.name}」吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    await disableMember(row.memberId, disabled);
    ElMessage.success(`客户已${action}`);
    loadMembers();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(getErrorMessage(e, `${action}客户失败`));
    }
  }
}

onMounted(() => {
  loadMembers();
  loadStaff();
  loadCustomerTypes();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.price-tip {
  margin-top: 12px;
}
</style>
