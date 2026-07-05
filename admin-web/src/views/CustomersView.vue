<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>客户管理</span>
          <div class="header-actions">
            <el-input
              v-model="keyword"
              placeholder="客户名/手机号"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadMembers"
              @keyup.enter="loadMembers"
            />
            <el-button @click="loadMembers">搜索</el-button>
            <el-button @click="loadMembers">刷新客户</el-button>
            <el-button type="primary" @click="memberDialogVisible = true">新增客户</el-button>
          </div>
        </div>
      </template>

      <el-table :data="members" v-loading="loading" stripe empty-text="暂无客户">
        <el-table-column prop="memberId" label="客户ID" width="100" />
        <el-table-column prop="name" label="客户名称" min-width="140" />
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="customerType" label="客户类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.customerType === 'RETAIL'" type="primary">零售客户</el-tag>
            <el-tag v-else-if="row.customerType === 'WHOLESALE'" type="success">批发客户</el-tag>
            <el-tag v-else>{{ row.customerType }}</el-tag>
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
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleAssignMember(row)">分配给管理员</el-button>
            <el-button size="small" link @click="handleShowPriceHistory(row)">价格参考</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>

      <el-alert v-if="priceHistoryTip" type="info" show-icon :closable="false" style="margin-top: 12px">
        <template #title>{{ priceHistoryTip }}</template>
      </el-alert>

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

    <el-dialog v-model="memberDialogVisible" title="新增客户" width="520px">
      <el-form ref="memberFormRef" :model="memberForm" :rules="memberRules" label-width="100px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="memberForm.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="memberForm.mobile" />
        </el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="memberForm.customerType" style="width: 100%">
            <el-option label="零售客户" value="RETAIL" />
            <el-option label="批发客户" value="WHOLESALE" />
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
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { assignMember, createMember, fetchMemberPriceHistory, fetchMembers, fetchStaff } from "../api";

const loading = ref(false);
const submitLoading = ref(false);
const members = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const memberDialogVisible = ref(false);
const memberFormRef = ref<FormInstance>();
const priceHistoryTip = ref("");
const staffList = ref<any[]>([]);

const mobilePattern = /^1[3-9]\d{9}$/;

const memberForm = reactive({
  name: "",
  mobile: "",
  customerType: "RETAIL" as "RETAIL" | "WHOLESALE",
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
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadStaff() {
  try {
    const data = await fetchStaff();
    staffList.value = data.records || data || [];
  } catch { /* ignore */ }
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
      memberForm.mobile = "";
      memberForm.customerType = "RETAIL";
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

onMounted(() => {
  loadMembers();
  loadStaff();
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
