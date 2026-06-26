<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台经营看板</h2>
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in cards" :key="card.label">
        <el-card shadow="hover" style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">{{ card.label }}</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px;">{{ card.value }}</div>
            </div>
            <el-icon :size="40" :color="card.color">
              <component :is="card.icon" />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-card style="margin-top: 20px;">
      <template #header><span>收入趋势</span></template>
      <div ref="chartRef" style="height: 300px;"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import * as echarts from "echarts";

const chartRef = ref<HTMLDivElement>();

const cards = [
  { label: "总租户数", value: "--", icon: "OfficeBuilding", color: "#2563eb" },
  { label: "活跃租户", value: "--", icon: "UserFilled", color: "#10b981" },
  { label: "本月收入", value: "--", icon: "Money", color: "#f59e0b" },
  { label: "待审核数", value: "--", icon: "Clock", color: "#ef4444" }
];

onMounted(() => {
  if (chartRef.value) {
    const chart = echarts.init(chartRef.value);
    chart.setOption({
      xAxis: { type: "category", data: ["1月", "2月", "3月", "4月", "5月", "6月"] },
      yAxis: { type: "value" },
      series: [{ data: [], type: "line", smooth: true }]
    });
    chart.resize();
  }
});
</script>