<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <div class="toolbar-left">
          <el-select v-model="typeFilter" placeholder="优惠券类型" clearable style="width: 140px; margin-right: 12px" @change="loadData">
            <el-option label="满减券" value="AMOUNT" />
            <el-option label="折扣券" value="PERCENT" />
            <el-option label="免邮券" value="FREE_SHIP" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="未开始" value="PENDING" />
            <el-option label="进行中" value="ACTIVE" />
            <el-option label="已暂停" value="PAUSED" />
            <el-option label="已结束" value="ENDED" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="搜索优惠券名称"
            clearable
            style="width: 200px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="openDialog()">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>
            新建优惠券
          </el-button>
          <el-button @click="loadData">
            <el-icon style="margin-right: 4px"><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <el-table :data="coupons" v-loading="loading" stripe>
        <el-table-column prop="name" label="优惠券名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'AMOUNT'" type="primary">满减券</el-tag>
            <el-tag v-else-if="row.type === 'PERCENT'" type="success">折扣券</el-tag>
            <el-tag v-else-if="row.type === 'FREE_SHIP'" type="warning">免邮券</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="面额/折扣" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.type === 'PERCENT'">{{ row.value }}折</span>
            <span v-else>¥{{ row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用门槛" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.minAmount > 0">满¥{{ row.minAmount }}</span>
            <span v-else>无门槛</span>
          </template>
        </el-table-column>
        <el-table-column label="发放量" width="130" align="center">
          <template #default="{ row }">{{ row.receivedCount }} / {{ row.totalCount }}</template>
        </el-table-column>
        <el-table-column label="使用量" width="80" align="center">
          <template #default="{ row }">{{ row.usedCount }}</template>
        </el-table-column>
        <el-table-column label="每人限领" width="80" align="center">
          <template #default="{ row }">{{ row.perLimit }}张</template>
        </el-table-column>
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="info">未开始</el-tag>
            <el-tag v-else-if="row.status === 'ACTIVE'" type="success">进行中</el-tag>
            <el-tag v-else-if="row.status === 'PAUSED'" type="warning">已暂停</el-tag>
            <el-tag v-else-if="row.status === 'ENDED'" type="danger">已结束</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="primary" @click="viewDetail(row)">发放记录</el-button>
            <el-button v-if="row.status === 'ACTIVE'" size="small" link type="warning" @click="toggleStatus(row, 'PAUSED')">停用</el-button>
            <el-button v-if="['PENDING', 'PAUSED'].includes(row.status)" size="small" link type="success" @click="toggleStatus(row, 'ACTIVE')">启用</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="handleSizeChange" @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑优惠券' : '新建优惠券'"
      width="720px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入优惠券名称" />
        </el-form-item>
        <el-form-item label="优惠券类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="AMOUNT">满减券</el-radio>
            <el-radio value="PERCENT">折扣券</el-radio>
            <el-radio value="FREE_SHIP">免邮券</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="面额/折扣" prop="value">
          <el-input-number v-model="form.value" :min="0.01" :precision="2" style="width: 200px" />
          <span class="form-hint">{{ form.type === 'PERCENT' ? '折（如8.5=8.5折）' : '元' }}</span>
        </el-form-item>
        <el-form-item label="使用门槛" prop="minAmount">
          <el-input-number v-model="form.minAmount" :min="0" :precision="2" style="width: 200px" />
          <span class="form-hint">元（0表示无门槛）</span>
        </el-form-item>
        <el-form-item label="有效期" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="发放总量" prop="totalCount">
              <el-input-number v-model="form.totalCount" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每人限领" prop="perLimit">
              <el-input-number v-model="form.perLimit" :min="1" style="width: 100%" />
              <span class="form-hint">张</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="适用商品">
          <el-radio-group v-model="form.scope">
            <el-radio value="ALL">全部商品</el-radio>
            <el-radio value="CATEGORY">指定分类</el-radio>
            <el-radio value="PRODUCT">指定商品</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="使用说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="优惠券使用说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 发放记录对话框 -->
    <el-dialog v-model="recordVisible" title="发放记录" width="900px">
      <el-table :data="issueRecords" size="small" max-height="400">
        <el-table-column prop="userName" label="用户" width="100" />
        <el-table-column prop="userPhone" label="手机号" width="120" />
        <el-table-column prop="couponCode" label="券码" width="180" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'UNUSED'" type="primary" size="small">未使用</el-tag>
            <el-tag v-else-if="row.status === 'USED'" type="success" size="small">已使用</el-tag>
            <el-tag v-else-if="row.status === 'EXPIRED'" type="info" size="small">已过期</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issueTime" label="领取时间" width="160" />
        <el-table-column prop="useTime" label="使用时间" width="160" />
      </el-table>
      <template #footer>
        <el-button @click="recordVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";

const loading = ref(false);
const coupons = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const typeFilter = ref("");
const statusFilter = ref("");

// ==================== 表单 ====================
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const submitLoading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: "",
  type: "AMOUNT",
  value: 0,
  minAmount: 0,
  timeRange: [] as any[],
  totalCount: 1000,
  perLimit: 1,
  scope: "ALL",
  description: ""
});

const formRules: FormRules = {
  name: [{ required: true, message: "请输入优惠券名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择优惠券类型", trigger: "change" }],
  value: [{ required: true, message: "请输入面额/折扣", trigger: "blur" }],
  timeRange: [{ required: true, message: "请选择有效期", trigger: "change" }],
  totalCount: [{ required: true, message: "请输入发放总量", trigger: "blur" }],
  perLimit: [{ required: true, message: "请输入每人限领", trigger: "blur" }]
};

// ==================== 发放记录 ====================
const recordVisible = ref(false);
const issueRecords = ref<any[]>([]);

const mockCoupons = Array.from({ length: 15 }, (_, i) => {
  const types = ["AMOUNT", "PERCENT", "FREE_SHIP"];
  const statuses = ["PENDING", "ACTIVE", "ACTIVE", "ACTIVE", "PAUSED", "ENDED"];
  const type = types[i % 3];
  const totalCount = Math.floor(Math.random() * 5000) + 500;
  return {
    id: i + 1,
    name: `优惠券-${i + 1}`,
    type,
    value: type === "PERCENT" ? (Math.floor(Math.random() * 3) + 7) : (Math.floor(Math.random() * 50) + 5),
    minAmount: type === "FREE_SHIP" ? 0 : Math.floor(Math.random() * 200) + 50,
    totalCount,
    receivedCount: Math.floor(Math.random() * totalCount),
    usedCount: Math.floor(Math.random() * totalCount * 0.3),
    perLimit: Math.floor(Math.random() * 3) + 1,
    startTime: "2026-06-01 00:00",
    endTime: "2026-08-31 23:59",
    status: statuses[i % 6],
    scope: "ALL",
    description: ""
  };
});

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockCoupons];
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(kw));
    }
    if (typeFilter.value) {
      filtered = filtered.filter(c => c.type === typeFilter.value);
    }
    if (statusFilter.value) {
      filtered = filtered.filter(c => c.status === statusFilter.value);
    }
    const start = (page.value - 1) * pageSize.value;
    coupons.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function handleSizeChange(size: number) { pageSize.value = size; page.value = 1; loadData(); }
function handlePageChange(p: number) { page.value = p; loadData(); }

function openDialog(row?: any) {
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    form.name = row.name;
    form.type = row.type;
    form.value = row.value;
    form.minAmount = row.minAmount;
    form.timeRange = [row.startTime, row.endTime];
    form.totalCount = row.totalCount;
    form.perLimit = row.perLimit;
    form.scope = row.scope || "ALL";
    form.description = row.description || "";
  } else {
    isEdit.value = false;
    editingId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.name = "";
  form.type = "AMOUNT";
  form.value = 0;
  form.minAmount = 0;
  form.timeRange = [];
  form.totalCount = 1000;
  form.perLimit = 1;
  form.scope = "ALL";
  form.description = "";
  formRef.value?.resetFields();
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;
  setTimeout(() => {
    const base = {
      name: form.name,
      type: form.type,
      value: form.value,
      minAmount: form.minAmount,
      startTime: form.timeRange[0] || "",
      endTime: form.timeRange[1] || "",
      totalCount: form.totalCount,
      perLimit: form.perLimit,
      scope: form.scope,
      description: form.description
    };
    if (isEdit.value && editingId.value) {
      const idx = mockCoupons.findIndex(c => c.id === editingId.value);
      if (idx > -1) Object.assign(mockCoupons[idx], base);
      ElMessage.success("修改成功");
    } else {
      const newId = Math.max(...mockCoupons.map(c => c.id), 0) + 1;
      mockCoupons.unshift({ id: newId, ...base, receivedCount: 0, usedCount: 0, status: "PENDING" });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    loadData();
    submitLoading.value = false;
  }, 500);
}

function viewDetail(row: any) {
  issueRecords.value = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    userName: ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"][i],
    userPhone: "1380000" + (1000 + i),
    couponCode: `CP${String(row.id).padStart(3, "0")}${String(i + 1).padStart(4, "0")}`,
    status: i < 5 ? "UNUSED" : (i < 7 ? "USED" : "EXPIRED"),
    issueTime: `2026-07-0${i + 1} 14:30:00`,
    useTime: i < 5 ? "-" : `2026-07-0${i + 1} 16:00:00`
  }));
  recordVisible.value = true;
}

async function toggleStatus(row: any, newStatus: string) {
  const text = newStatus === "ACTIVE" ? "启用" : "停用";
  await ElMessageBox.confirm(`确认${text}优惠券「${row.name}」？`, `确认${text}`, { type: "warning" });
  row.status = newStatus;
  ElMessage.success(`已${text}`);
  loadData();
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确认删除优惠券「${row.name}」？`, "确认删除", { type: "warning" });
  const idx = mockCoupons.findIndex(c => c.id === row.id);
  if (idx > -1) mockCoupons.splice(idx, 1);
  ElMessage.success("已删除");
  loadData();
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.form-hint { margin-left: 8px; font-size: 12px; color: #9ca3af; }
</style>