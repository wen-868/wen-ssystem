<template>
  <div class="ai-chart">
    <div v-if="parseError" class="ai-chart-error">图表数据解析失败</div>
    <div v-else ref="chartEl" class="ai-chart-box" />
  </div>
</template>

<script setup lang="ts">
/**
 * AiChart — AI 回答图表渲染
 *
 * 解析 AI 回答中的 [CHART]{json}[/CHART] 标记并渲染 ECharts：
 * - type=line（时间趋势）/ bar（排行/对比）/ pie（占比）
 * - 数据格式：{ type, title?, xAxis?: string[], series: [{ name, data: number[] }] }
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-16
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import echarts from "../../utils/echarts";

/** 图表标记正则（取首个完整标记） */
const CHART_RE = /\[CHART\]([\s\S]*?)\[\/CHART\]/;

interface AiChartData {
  type: "line" | "bar" | "pie";
  title?: string;
  xAxis?: string[];
  series: Array<{ name?: string; data: number[] }>;
}

const props = defineProps<{ content: string }>();

const chartEl = ref<HTMLElement | null>(null);
const parseError = ref(false);
let chart: ReturnType<typeof echarts.init> | null = null;

function parseChart(content: string): AiChartData | null {
  const match = content.match(CHART_RE);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as AiChartData;
    if (!data.type || !Array.isArray(data.series) || data.series.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function buildOption(data: AiChartData) {
  const base = {
    title: data.title ? { text: data.title, left: "center", textStyle: { fontSize: 13 } } : undefined,
    tooltip: { trigger: "axis" as const },
    legend: data.series.length > 1 ? { bottom: 0 } : undefined,
    grid: { left: 40, right: 16, top: data.title ? 34 : 16, bottom: data.series.length > 1 ? 36 : 24 },
  };

  if (data.type === "pie") {
    return {
      ...base,
      tooltip: { trigger: "item" as const },
      series: [
        {
          type: "pie",
          radius: "62%",
          center: ["50%", "52%"],
          label: { formatter: "{b}: {d}%" },
          data: (data.xAxis ?? []).map((name, i) => ({
            name,
            value: data.series[0]?.data[i] ?? 0,
          })),
        },
      ],
    };
  }

  return {
    ...base,
    xAxis: { type: "category", data: data.xAxis ?? [] },
    yAxis: { type: "value" },
    series: data.series.map((s) => ({
      name: s.name ?? "数值",
      type: data.type,
      smooth: data.type === "line",
      data: s.data,
    })),
  };
}

function render() {
  if (!chartEl.value) return;
  const data = parseChart(props.content);
  if (!data) {
    parseError.value = true;
    return;
  }
  parseError.value = false;
  if (!chart) {
    chart = echarts.init(chartEl.value);
  }
  chart.setOption(buildOption(data), true);
}

onMounted(() => {
  render();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  chart?.dispose();
  chart = null;
});

function handleResize() {
  chart?.resize();
}

watch(() => props.content, render);
</script>

<style scoped>
.ai-chart {
  width: 100%;
  margin-top: 8px;
}
.ai-chart-box {
  width: 100%;
  height: 240px;
}
.ai-chart-error {
  padding: 12px;
  color: var(--color-muted, #909399);
  font-size: 12px;
  text-align: center;
  border: 1px dashed var(--color-border, #e4e7ed);
  border-radius: 6px;
}
</style>
