<template>
  <div class="page">
    <PageCard title="客户画像">
      <template #extra>
        <el-select v-model="selectedMemberId" placeholder="搜索客户" filterable remote :remote-method="searchMembers" :loading="memberLoading" clearable @change="onMemberChange" style="width: 280px">
          <el-option v-for="m in memberOptions" :key="m.memberId" :label="`${m.name} (${m.mobile})`" :value="m.memberId" />
        </el-select>
      </template>

      <template v-if="!profile">
        <el-empty description="请选择客户查看画像" />
      </template>

      <template v-else>
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card shadow="never" class="profile-card">
              <template #header>
                <div class="card-header">
                  <span>基本信息</span>
                  <el-button size="small" type="primary" @click="openEditDialog">编辑画像</el-button>
                </div>
              </template>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="姓名">{{ profile.name }}</el-descriptions-item>
                <el-descriptions-item label="手机">{{ profile.mobile }}</el-descriptions-item>
                <el-descriptions-item label="等级">{{ profile.levelName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="年龄段">{{ profile.ageRange || '-' }}</el-descriptions-item>
                <el-descriptions-item label="性别">{{ profile.gender === 'MALE' ? '男' : profile.gender === 'FEMALE' ? '女' : '-' }}</el-descriptions-item>
                <el-descriptions-item label="偏好品类">{{ profile.preferCategories || '-' }}</el-descriptions-item>
                <el-descriptions-item label="偏好品牌">{{ profile.preferBrands || '-' }}</el-descriptions-item>
                <el-descriptions-item label="生命周期">{{ profile.lifecycleStage || '-' }}</el-descriptions-item>
                <el-descriptions-item label="平均客单价">¥{{ Number(profile.avgOrderAmount || 0).toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="累计消费次数">{{ profile.totalOrderCount || 0 }} 次</el-descriptions-item>
                <el-descriptions-item label="累计消费金额">¥{{ Number(profile.totalConsumeAmount || 0).toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="最后消费">{{ formatDate(profile.lastConsumeDate) }}</el-descriptions-item>
                <el-descriptions-item label="积分">{{ profile.points || 0 }}</el-descriptions-item>
                <el-descriptions-item label="储值余额">¥{{ Number(profile.storeBalance || 0).toFixed(2) }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>

          <el-col :span="8">
            <el-card shadow="never" class="tag-card">
              <template #header><span>客户标签</span></template>
              <div class="tag-cloud" v-if="profile.tags && profile.tags.length">
                <el-tag v-for="t in profile.tags" :key="t.id" :color="t.color" effect="dark" style="margin: 0 6px 6px 0; border: none">
                  {{ t.name }}
                </el-tag>
              </div>
              <el-empty v-else description="暂无标签" :image-size="60" />
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header><span>消费趋势（近12个月）</span></template>
          <div ref="trendChartRef" class="chart-box" />
        </el-card>
      </template>
    </PageCard>

    <!-- 编辑画像弹窗 -->
    <el-dialog v-model="editVisible" title="编辑画像" width="480px">
      <el-form ref="editFormRef" :model="editForm" label-width="100px">
        <el-form-item label="年龄段">
          <el-select v-model="editForm.ageRange" style="width: 100%" clearable>
            <el-option label="18岁以下" value="18岁以下" />
            <el-option label="18-25岁" value="18-25岁" />
            <el-option label="26-35岁" value="26-35岁" />
            <el-option label="36-45岁" value="36-45岁" />
            <el-option label="46-55岁" value="46-55岁" />
            <el-option label="55岁以上" value="55岁以上" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="editForm.gender" style="width: 100%" clearable>
            <el-option label="男" value="MALE" />
            <el-option label="女" value="FEMALE" />
          </el-select>
        </el-form-item>
        <el-form-item label="偏好品类">
          <el-input v-model="editForm.preferCategories" placeholder="多个品类用逗号分隔" />
        </el-form-item>
        <el-form-item label="偏好品牌">
          <el-input v-model="editForm.preferBrands" placeholder="多个品牌用逗号分隔" />
        </el-form-item>
        <el-form-item label="生命周期">
          <el-select v-model="editForm.lifecycleStage" style="width: 100%" clearable>
            <el-option label="潜客" value="POTENTIAL" />
            <el-option label="新客" value="NEW" />
            <el-option label="活跃" value="ACTIVE" />
            <el-option label="沉睡" value="DORMANT" />
            <el-option label="流失" value="LOST" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from "vue";
import { ElMessage } from "element-plus";
import * as echarts from "echarts";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import { fetchCustomerProfile, updateCustomerProfile, fetchMembers } from "../api";

const selectedMemberId = ref<number | null>(null);
const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);
const profile = ref<any>(null);
const trendChartRef = ref<HTMLDivElement>();
let trendChart: echarts.ECharts | null = null;

const editVisible = ref(false);
const editLoading = ref(false);
const editFormRef = ref();
const editForm = reactive({ ageRange: "", gender: "", preferCategories: "", preferBrands: "", lifecycleStage: "" });

async function searchMembers(query: string) {
  if (!query || query.length < 1) { memberOptions.value = []; return; }
  memberLoading.value = true;
  try {
    const res = await fetchMembers({ keyword: query, pageSize: 20 });
    memberOptions.value = (res.records || res.list || []);
  } catch { memberOptions.value = []; }
  finally { memberLoading.value = false; }
}

async function onMemberChange(val: number | null) {
  if (!val) { profile.value = null; return; }
  try {
    profile.value = await fetchCustomerProfile(val);
    await nextTick();
    renderTrendChart();
  } catch { ElMessage.error("加载客户画像失败"); profile.value = null; }
}

function renderTrendChart() {
  if (!trendChartRef.value || !profile.value?.consumeTrend) return;
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value);
  }
  const months = profile.value.consumeTrend.map((item: any) => item.month || item.label || "");
  const amounts = profile.value.consumeTrend.map((item: any) => item.amount || item.value || 0);
  trendChart.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value", name: "消费金额" },
    series: [{ type: "line", data: amounts, smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: "#409EFF" } }]
  });
}

function openEditDialog() {
  if (!profile.value) return;
  editForm.ageRange = profile.value.ageRange || "";
  editForm.gender = profile.value.gender || "";
  editForm.preferCategories = profile.value.preferCategories || "";
  editForm.preferBrands = profile.value.preferBrands || "";
  editForm.lifecycleStage = profile.value.lifecycleStage || "";
  editVisible.value = true;
}

async function handleEditSubmit() {
  if (!selectedMemberId.value) return;
  editLoading.value = true;
  try {
    await updateCustomerProfile(selectedMemberId.value, {
      ageRange: editForm.ageRange || undefined,
      gender: editForm.gender || undefined,
      preferCategories: editForm.preferCategories || undefined,
      preferBrands: editForm.preferBrands || undefined,
      lifecycleStage: editForm.lifecycleStage || undefined
    });
    ElMessage.success("画像更新成功");
    editVisible.value = false;
    await onMemberChange(selectedMemberId.value);
  } catch { ElMessage.error("更新失败"); }
  finally { editLoading.value = false; }
}

onMounted(() => {});
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.tag-cloud { padding: 4px 0; }
.chart-box { width: 100%; height: 300px; }
</style>