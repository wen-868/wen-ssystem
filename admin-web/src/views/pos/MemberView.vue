<template>
  <div class="pos-member">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>会员识别</span>
          <div class="search-area">
            <el-input v-model="keyword" placeholder="输入手机号/姓名搜索会员" size="small" style="width: 260px" clearable @keyup.enter="handleSearch" />
            <el-button size="small" type="primary" @click="handleSearch">搜索</el-button>
          </div>
        </div>
      </template>

      <el-table :data="members" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="memberId" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="customerType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.customerType === "WHOLESALE" ? "批发" : "零售" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="80" />
        <el-table-column prop="level" label="等级" width="80" />
        <el-table-column prop="totalAmount" label="累计消费" width="100">
          <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="会员详情" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ currentMember.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ currentMember.mobile }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentMember.customerType === "WHOLESALE" ? "批发" : "零售" }}</el-descriptions-item>
        <el-descriptions-item label="等级">{{ currentMember.level }}</el-descriptions-item>
        <el-descriptions-item label="积分">{{ currentMember.points }}</el-descriptions-item>
        <el-descriptions-item label="累计消费">¥{{ Number(currentMember.totalAmount || 0).toFixed(2) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { searchStoreMembers } from "../../api";

const loading = ref(false);
const keyword = ref("");
const members = ref<any[]>([]);
const detailVisible = ref(false);
const currentMember = ref<any>({});

async function handleSearch() {
  if (!keyword.value.trim()) {
    ElMessage.warning("请输入搜索关键词");
    return;
  }
  loading.value = true;
  try {
    const data = await searchStoreMembers(keyword.value.trim());
    members.value = data.records || [];
    if (members.value.length === 0) {
      ElMessage.info("未找到会员");
    }
  } catch {
    ElMessage.error("搜索失败");
  } finally {
    loading.value = false;
  }
}

function viewDetail(row: any) {
  currentMember.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  // 初始不加载，等搜索
});
</script>

<style scoped>
.pos-member {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-area {
  display: flex;
  gap: 8px;
}
</style>
