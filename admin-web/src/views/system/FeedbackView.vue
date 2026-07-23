<template>
  <div class="feedback-page">
    <div class="feedback-header">
      <h2>建议反馈</h2>
      <el-button type="primary" @click="showDialog = true">提交反馈</el-button>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="filter">
        <el-form-item label="类型">
          <el-select v-model="filter.type" placeholder="全部" clearable style="width: 140px" @change="loadList">
            <el-option label="BUG反馈" value="BUG" />
            <el-option label="功能建议" value="FEATURE" />
            <el-option label="改进意见" value="IMPROVEMENT" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 140px" @change="loadList">
            <el-option label="待处理" value="PENDING" />
            <el-option label="处理中" value="PROCESSING" />
            <el-option label="已解决" value="RESOLVED" />
            <el-option label="已拒绝" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filter.keyword" placeholder="搜索标题或内容" clearable style="width: 200px" @clear="loadList" @keyup.enter="loadList" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" min-width="250" show-overflow-tooltip />
        <el-table-column prop="userName" label="提交人" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openDetail(row)">详情</el-button>
            <el-dropdown v-if="row.status === 'PENDING'" trigger="click" @command="(cmd: string) => handleStatus(row, cmd)">
              <el-button size="small" type="warning" link>处理</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="PROCESSING">标记处理中</el-dropdown-item>
                  <el-dropdown-item command="RESOLVED">标记已解决</el-dropdown-item>
                  <el-dropdown-item command="REJECTED">拒绝</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="loadList"
        />
      </div>
    </el-card>

    <!-- 提交弹窗 -->
    <el-dialog v-model="showDialog" title="提交反馈" width="720px" :close-on-click-modal="false">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="BUG">BUG反馈</el-radio>
            <el-radio value="FEATURE">功能建议</el-radio>
            <el-radio value="IMPROVEMENT">改进意见</el-radio>
            <el-radio value="OTHER">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="简要描述你的问题或建议" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="详细描述问题现象、复现步骤或建议内容" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="form.contact" placeholder="手机号或邮箱（选填，方便我们联系你）" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="反馈详情" width="720px">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="typeTag(detail.type)" size="small">{{ typeLabel(detail.type) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交人">{{ detail.userName || '未知' }}</el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="内容" :span="2">
            <div style="white-space: pre-wrap; max-height: 200px; overflow-y: auto">{{ detail.content }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ detail.contact || '-' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTime(detail.created_at) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.page_url" label="页面URL" :span="2">{{ detail.page_url }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.reply" label="管理员回复" :span="2">
            <div style="white-space: pre-wrap; background: #f0f9eb; padding: 8px; border-radius: 4px">{{ detail.reply }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../../api";

const loading = ref(false);
const submitting = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showDialog = ref(false);
const showDetail = ref(false);
const detail = ref<any>(null);
const formRef = ref();

const filter = reactive({ type: "", status: "", keyword: "" });
const form = reactive({ type: "BUG", title: "", content: "", contact: "" });
const rules = {
  type: [{ required: true, message: "请选择类型", trigger: "change" }],
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  content: [{ required: true, message: "请输入内容", trigger: "blur" }],
};

function typeLabel(t: string) {
  const map: Record<string, string> = { BUG: "BUG反馈", FEATURE: "功能建议", IMPROVEMENT: "改进意见", OTHER: "其他" };
  return map[t] || t;
}
function typeTag(t: string) {
  const map: Record<string, string> = { BUG: "danger", FEATURE: "success", IMPROVEMENT: "warning", OTHER: "info" };
  return map[t] || "info";
}
function statusLabel(s: string) {
  const map: Record<string, string> = { PENDING: "待处理", PROCESSING: "处理中", RESOLVED: "已解决", REJECTED: "已拒绝" };
  return map[s] || s;
}
function statusTag(s: string) {
  const map: Record<string, string> = { PENDING: "warning", PROCESSING: "primary", RESOLVED: "success", REJECTED: "info" };
  return map[s] || "info";
}
function formatTime(t: string) {
  if (!t) return "-";
  return new Date(t).toLocaleString("zh-CN");
}

async function loadList() {
  loading.value = true;
  try {
    const res = await api.get("/admin/feedbacks", {
      params: { ...filter, page: page.value, pageSize: pageSize.value },
    });
    const d = res.data.data || res.data;
    list.value = d.list || [];
    total.value = d.total || 0;
  } catch (e: any) {
    ElMessage.error("加载失败: " + (e.response?.data?.msg || e.message));
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await api.post("/admin/feedback", {
      ...form,
      page_url: window.location.href,
      browser_info: navigator.userAgent,
    });
    ElMessage.success("反馈提交成功，感谢你的建议！");
    showDialog.value = false;
    form.type = "BUG";
    form.title = "";
    form.content = "";
    form.contact = "";
    loadList();
  } catch (e: any) {
    ElMessage.error("提交失败: " + (e.response?.data?.msg || e.message));
  } finally {
    submitting.value = false;
  }
}

function openDetail(row: any) {
  detail.value = row;
  showDetail.value = true;
}

async function handleStatus(row: any, status: string) {
  try {
    await api.put(`/admin/feedback/${row.id}`, { status });
    ElMessage.success("状态更新成功");
    loadList();
  } catch (e: any) {
    ElMessage.error("更新失败: " + (e.response?.data?.msg || e.message));
  }
}

onMounted(loadList);
</script>

<style scoped>
.feedback-page { padding: 0; }
.feedback-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.feedback-header h2 { margin: 0; font-size: 20px; }
.filter-card { margin-bottom: 16px; }
.pagination-wrap { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
