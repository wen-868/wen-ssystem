<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">收款分析</h2>
      <p class="page-desc">收款结构与趋势分析</p>
    </div>
  </div>
<!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="12" align="middle">
        <el-col :span="5">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="refreshAll"
          />
        </el-col>
        <el-col :span="4">
          <el-select v-model="selectedStores" multiple placeholder="选择门店" clearable style="width: 100%" @change="refreshAll">
            <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="selectedChannels" multiple placeholder="选择渠道" clearable style="width: 100%" @change="refreshAll">
            <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-button type="primary" @click="refreshAll">
            <el-icon><Search /></el-icon> 查询
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 收款总览卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-a">
          <div class="stat-label">累计收款总额</div>
          <div class="stat-value">¥{{ formatMoney(overview.totalCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-b">
          <div class="stat-label">本月收款</div>
          <div class="stat-value">¥{{ formatMoney(overview.monthCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-c">
          <div class="stat-label">今日收款</div>
          <div class="stat-value">¥{{ formatMoney(overview.todayCollection) }}</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <div class="stat-card stat-card-d">
          <div class="stat-label">待收金额</div>
          <div class="stat-value">¥{{ formatMoney(overview.pendingAmount) }}</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6" :md="4" :lg="4">
        <div class="stat-card stat-card-e">
          <div class="stat-label">退款率</div>
          <div class="stat-value">{{ overview.refundRate }}%</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6" :md="4" :lg="4">
        <div class="stat-card stat-card-f">
          <div class="stat-label">平均收款周期</div>
          <div class="stat-value">{{ overview.avgCollectionCycle }}天</div>
        </div>
      </el-col>
    </el-row>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
      <!-- Tab 1: 收款漏斗 -->
      <el-tab-pane label="收款漏斗" name="funnel">
        <div ref="funnelChartRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 2: 收款趋势 -->
      <el-tab-pane label="收款趋势" name="trend">
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="6">
            <el-checkbox v-model="splitByChannel" @change="initTrendChart">按渠道拆分</el-checkbox>
          </el-col>
        </el-row>
        <div ref="collectionTrendRef" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 3: 渠道分布 -->
      <el-tab-pane label="渠道分布" name="channelDist">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="channelPieRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <div class="table-card">
<el-table :data="channelConversionData" stripe border style="width: 100%">
              <el-table-column prop="channel" label="渠道" width="100" />
              <el-table-column prop="shareCount" label="分享数" width="80" />
              <el-table-column prop="viewCount" label="查看数" width="80" />
              <el-table-column prop="payCount" label="支付数" width="80" />
              <el-table-column prop="payAmount" label="支付金额" width="110">
                <template #default="{ row }">¥{{ formatMoney(row.payAmount) }}</template>
              </el-table-column>
              <el-table-column prop="conversionRate" label="转化率" width="90">
                <template #default="{ row }">{{ row.conversionRate }}%</template>
              </el-table-column>
              <el-table-column prop="ratio" label="占比" width="80">
                <template #default="{ row }">{{ row.ratio }}%</template>
              </el-table-column>
            </el-table>
</div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- Tab 4: 超时未付分析 -->
      <el-tab-pane label="超时未付分析" name="timeout">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="timeoutDistRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <div ref="timeoutTrendRef" class="chart-box chart-medium"></div>
          </el-col>
        </el-row>
        <div class="table-card">
<el-table :data="timeoutOrders" stripe border style="width: 100%; margin-top: 16px">
          <el-table-column prop="billNo" label="订单号" width="180" />
          <el-table-column prop="customerName" label="客户" width="120" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="overdueHours" label="超时(小时)" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="160" />
          <el-table-column label="状态" width="100">
            <template #default>
              <el-tag type="danger" size="small">超时未付</el-tag>
            </template>
          </el-table-column>
        </el-table>
</div>
        <el-pagination
          v-if="timeoutOrders.length > 0"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, prev, pager, next"
          :total="timeoutOrders.length"
          :page-size="10"
          :pager-count="5"
          small
        />
      </el-tab-pane>

      <!-- Tab 5: 退款分析 -->
      <el-tab-pane label="退款分析" name="refund">
        <el-row :gutter="16">
          <el-col :span="12">
            <div ref="refundTrendRef" class="chart-box chart-medium"></div>
          </el-col>
          <el-col :span="12">
            <div ref="refundReasonPieRef" class="chart-box chart-medium"></div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CHART_COLORS } from "@/styles/theme";
import { Search } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { ElMessage } from 'element-plus'
import {
  fetchReportCollectionSummary,
  fetchReportCollectionFunnel,
  fetchReportCollectionDailyTrend,
  fetchReportCollectionChannelConversion,
  fetchReportCollectionTimeout,
  fetchReportCollectionRefundAnalysis,
} from '@/api'
import { fetchStores } from '@/api/common'

// ─── 筛选状态 ───
const dateRange = ref<string[]>(['2026-06-01', '2026-06-30'])
const selectedStores = ref<number[]>([])
const selectedChannels = ref<string[]>([])
const storeOptions = ref<{ label: string; value: number }[]>([])
const channelOptions = ref<{ label: string; value: string }[]>([])

function getRange() {
  return {
    startDate: dateRange.value?.[0],
    endDate: dateRange.value?.[1],
    storeId: selectedStores.value.length === 1 ? selectedStores.value[0] : undefined,
  }
}

async function loadStores() {
  try {
    const data = await fetchStores()
    const records = Array.isArray(data) ? data : (data?.records || data?.list || [])
    storeOptions.value = records.map((s: any) => ({ label: s.name, value: Number(s.id) }))
  } catch {
    storeOptions.value = []
  }
}

function formatMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── 收款总览 ───
const overview = ref({
  totalCollection: 0,
  monthCollection: 0,
  todayCollection: 0,
  pendingAmount: 0,
  refundRate: 0,
  avgCollectionCycle: 0,
})

async function loadSummary() {
  try {
    const data = await fetchReportCollectionSummary({ storeId: getRange().storeId })
    overview.value = {
      totalCollection: Number(data?.totalCollection ?? 0),
      monthCollection: Number(data?.monthCollection ?? 0),
      todayCollection: Number(data?.todayCollection ?? 0),
      pendingAmount: Number(data?.pendingAmount ?? 0),
      refundRate: Number(data?.refundRate ?? 0),
      avgCollectionCycle: Number(data?.avgCollectionHours ?? 0),
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载收款总览失败')
  }
}

// ─── Tab 1: 收款漏斗 ───
const funnelChartRef = ref<HTMLDivElement | null>(null)
let funnelChart: echarts.ECharts | null = null
const funnelLoading = ref(false)

const funnelData = ref<{ name: string; value: number }[]>([
  { name: '分享数', value: 0 },
  { name: '查看数', value: 0 },
  { name: '支付数', value: 0 },
  { name: '支付成功数', value: 0 },
])

async function loadFunnel() {
  funnelLoading.value = true
  try {
    const data = await fetchReportCollectionFunnel(getRange())
    funnelData.value = [
      { name: '分享数', value: Number(data?.shareCount ?? 0) },
      { name: '查看数', value: Number(data?.viewCount ?? 0) },
      { name: '支付数', value: Number(data?.payCount ?? 0) },
      { name: '支付成功数', value: Number(data?.payAmount ?? 0) },
    ]
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载收款漏斗失败')
  } finally {
    funnelLoading.value = false
  }
}

function initFunnelChart() {
  if (!funnelChartRef.value) return
  if (funnelChart) funnelChart.dispose()
  funnelChart = echarts.init(funnelChartRef.value)
  const data = funnelData.value
  funnelChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const rate = p.dataIndex === 0 ? '100%' : ((p.value / funnelData.value[0].value) * 100).toFixed(1) + '%'
        return `${p.name}: ${p.value} (转化率: ${rate})`
      }
    },
    series: [{
      type: 'funnel',
      left: '15%',
      right: '15%',
      top: 30,
      bottom: 30,
      width: '70%',
      minSize: '20%',
      maxSize: '100%',
      gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: (p: any) => {
          const rate = p.dataIndex === 0 ? '100%' : ((p.value / funnelData.value[0].value) * 100).toFixed(1) + '%'
          return `${p.name}\n${p.value} (${rate})`
        },
        fontSize: 12
      },
      data: data.map(d => ({ name: d.name, value: d.value })),
      itemStyle: { borderColor: '#fff', borderWidth: 1 }
    }]
  })
}

// ─── Tab 2: 收款趋势 ───
const collectionTrendRef = ref<HTMLDivElement | null>(null)
let collectionTrendChart: echarts.ECharts | null = null
const splitByChannel = ref(false)
const trendLoading = ref(false)

const trendData = ref<{ date: string; amount: number; count: number }[]>([])
const trendByChannelData = ref<{ date: string; channel: string; amount: number; count: number }[]>([])

async function loadTrend() {
  trendLoading.value = true
  try {
    const range = getRange()
    const [daily, byChannel] = await Promise.all([
      fetchReportCollectionDailyTrend({ ...range, splitByChannel: false }),
      fetchReportCollectionDailyTrend({ ...range, splitByChannel: true }),
    ])
    const asList = (d: any) => (Array.isArray(d) ? d : (d?.list || d?.records || []))
    trendData.value = asList(daily).map((d: any) => ({
      date: String(d.date).slice(5, 10),
      amount: Number(d.paidAmount ?? 0),
      count: Number(d.paidCount ?? 0),
    }))
    trendByChannelData.value = asList(byChannel).map((d: any) => ({
      date: String(d.date).slice(5, 10),
      channel: d.channel || '未知',
      amount: Number(d.paidAmount ?? 0),
      count: Number(d.paidCount ?? 0),
    }))
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载收款趋势失败')
  } finally {
    trendLoading.value = false
  }
}

function initTrendChart() {
  if (!collectionTrendRef.value) return
  if (collectionTrendChart) collectionTrendChart.dispose()
  collectionTrendChart = echarts.init(collectionTrendRef.value)

  if (splitByChannel.value) {
    const dates = Array.from(new Set(trendByChannelData.value.map(d => d.date))).sort()
    const channels = Array.from(new Set(trendByChannelData.value.map(d => d.channel)))
    const palette = [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.warning, CHART_COLORS.purple]
    const series = channels.map((ch, idx) => ({
      name: ch,
      type: 'line' as const,
      smooth: true,
      data: dates.map(date => {
        const row = trendByChannelData.value.find(d => d.date === date && d.channel === ch)
        return row ? row.amount : 0
      }),
      itemStyle: { color: palette[idx % palette.length] }
    }))
    collectionTrendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: channels },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
      series
    })
  } else {
    collectionTrendChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['收款金额', '收款笔数'] },
      grid: { left: 50, right: 50, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: trendData.value.map(d => d.date), axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
      yAxis: [
        { type: 'value', name: '元', axisLabel: { formatter: (v: number) => (v / 10000).toFixed(0) + '万' } },
        { type: 'value', name: '笔' }
      ],
      series: [
        { name: '收款金额', type: 'line', smooth: true, data: trendData.value.map(d => d.amount), itemStyle: { color: CHART_COLORS.primary } },
        { name: '收款笔数', type: 'line', smooth: true, yAxisIndex: 1, data: trendData.value.map(d => d.count), itemStyle: { color: CHART_COLORS.success } }
      ]
    })
  }
}

// ─── Tab 3: 渠道分布 ───
const channelPieRef = ref<HTMLDivElement | null>(null)
let channelPieChart: echarts.ECharts | null = null
const channelDistLoading = ref(false)

const channelDistribution = ref<{ method: string; amount: number; ratio: number }[]>([])
const channelConversionData = ref<any[]>([])

async function loadChannelDistribution() {
  channelDistLoading.value = true
  try {
    const data = await fetchReportCollectionChannelConversion(getRange())
    const list = Array.isArray(data) ? data : (data?.list || data?.records || [])
    const totalAmount = list.reduce((s: number, d: any) => s + Number(d.paidAmount ?? 0), 0)
    channelConversionData.value = list.map((d: any) => {
      const payAmount = Number(d.paidAmount ?? 0)
      return {
        channel: d.channel || '未知',
        shareCount: Number(d.totalCount ?? 0),
        viewCount: Number(d.totalCount ?? 0),
        payCount: Number(d.paidCount ?? 0),
        payAmount,
        conversionRate: Number(d.conversionRate ?? 0),
        ratio: totalAmount > 0 ? Math.round((payAmount / totalAmount) * 1000) / 10 : 0,
      }
    })
    channelDistribution.value = channelConversionData.value.map((d) => ({
      method: d.channel,
      amount: d.payAmount,
      ratio: d.ratio,
    }))
    channelOptions.value = channelConversionData.value.map((d) => ({ label: d.channel, value: d.channel }))
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载渠道分布失败')
  } finally {
    channelDistLoading.value = false
  }
}

function initChannelPieChart() {
  if (!channelPieRef.value) return
  if (channelPieChart) channelPieChart.dispose()
  channelPieChart = echarts.init(channelPieRef.value)
  channelPieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['60%', '50%'],
      data: channelDistribution.value.map(c => ({ name: c.method, value: c.amount })),
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

// ─── Tab 4: 超时未付分析 ───
const timeoutDistRef = ref<HTMLDivElement | null>(null)
const timeoutTrendRef = ref<HTMLDivElement | null>(null)
let timeoutDistChart: echarts.ECharts | null = null
let timeoutTrendChart: echarts.ECharts | null = null
const timeoutLoading = ref(false)

const timeoutOrders = ref<any[]>([])
const timeoutDistData = ref<{ name: string; value: number }[]>([])
const timeoutRateData = ref<{ date: string; rate: number }[]>([])

async function loadTimeout() {
  timeoutLoading.value = true
  try {
    const data = await fetchReportCollectionTimeout(getRange())
    const intervals = (data?.intervals || []).map((it: any) => ({ name: it.label, value: Number(it.count ?? 0) }))
    timeoutDistData.value = intervals
    timeoutOrders.value = (data?.orders || []).map((o: any) => ({
      billNo: o.linkNo,
      customerName: o.customerName || '-',
      amount: Number(o.amount ?? 0),
      overdueHours: Number(o.overdueHours ?? 0),
      createdAt: String(o.createdAt).replace('T', ' ').slice(0, 19),
    }))
    // 超时率趋势：按当前筛选区间生成每日占位（无历史明细，仅展示实时超时率）
    timeoutRateData.value = []
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载超时未付分析失败')
  } finally {
    timeoutLoading.value = false
  }
}

function initTimeoutDistChart() {
  if (!timeoutDistRef.value) return
  if (timeoutDistChart) timeoutDistChart.dispose()
  timeoutDistChart = echarts.init(timeoutDistRef.value)
  timeoutDistChart.setOption({
    title: { text: '超时区间分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'middle', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: '65%', center: ['60%', '50%'],
      data: timeoutDistData.value,
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

function initTimeoutTrendChart() {
  if (!timeoutTrendRef.value) return
  if (timeoutTrendChart) timeoutTrendChart.dispose()
  timeoutTrendChart = echarts.init(timeoutTrendRef.value)
  // 超时率趋势：后端仅有实时区间分布，无历史逐日数据源，显示空态（TODO: 接入超时率历史统计后填充）
  const days: string[] = []
  const data: number[] = []
  timeoutTrendChart.setOption({
    title: { text: '超时率趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
    yAxis: { type: 'value', name: '%', max: 100 },
    series: [{
      type: 'line', smooth: true, data,
      itemStyle: { color: CHART_COLORS.danger },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,87,108,0.3)' }, { offset: 1, color: 'rgba(245,87,108,0.05)' }]) }
    }]
  })
}

// ─── Tab 5: 退款分析 ───
const refundTrendRef = ref<HTMLDivElement | null>(null)
const refundReasonPieRef = ref<HTMLDivElement | null>(null)
let refundTrendChart: echarts.ECharts | null = null
let refundReasonPieChart: echarts.ECharts | null = null
const refundLoading = ref(false)

const refundReasonData = ref<{ name: string; value: number }[]>([])
const refundTrendData = ref<{ date: string; refundAmount: number; refundRate: number }[]>([])

async function loadRefundAnalysis() {
  refundLoading.value = true
  try {
    const data = await fetchReportCollectionRefundAnalysis({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
    })
    refundTrendData.value = (data?.trend || []).map((d: any) => ({
      date: String(d.date).slice(5, 10),
      refundAmount: Number(d.refundAmount ?? 0),
      refundRate: Number(d.refundRate ?? 0),
    }))
    refundReasonData.value = (data?.reasonDistribution || []).map((d: any) => ({
      name: d.name || '其他',
      value: Number(d.count ?? 0),
    }))
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载退款分析失败')
  } finally {
    refundLoading.value = false
  }
}

function initRefundTrendChart() {
  if (!refundTrendRef.value) return
  if (refundTrendChart) refundTrendChart.dispose()
  refundTrendChart = echarts.init(refundTrendRef.value)
  const days = refundTrendData.value.map(d => d.date)
  refundTrendChart.setOption({
    title: { text: '退款金额/退款率趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['退款金额', '退款率'], bottom: 0 },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days, axisLabel: { fontSize: 10, rotate: 45, interval: 4 } },
    yAxis: [
      { type: 'value', name: '元', axisLabel: { formatter: (v: number) => (v / 1000).toFixed(0) + 'k' } },
      { type: 'value', name: '%', max: 100 }
    ],
    series: [
      { name: '退款金额', type: 'line', smooth: true, data: refundTrendData.value.map(d => d.refundAmount), itemStyle: { color: CHART_COLORS.danger } },
      { name: '退款率', type: 'line', smooth: true, yAxisIndex: 1, data: refundTrendData.value.map(d => d.refundRate), itemStyle: { color: CHART_COLORS.warning } }
    ]
  })
}

function initRefundReasonPieChart() {
  if (!refundReasonPieRef.value) return
  if (refundReasonPieChart) refundReasonPieChart.dispose()
  refundReasonPieChart = echarts.init(refundReasonPieRef.value)
  refundReasonPieChart.setOption({
    title: { text: '退款原因分类', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'middle', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: '65%', center: ['60%', '50%'],
      data: refundReasonData.value,
      label: { formatter: '{b}\n{d}%', fontSize: 10 }
    }]
  })
}

// ─── 图表生命周期管理 ───
const activeTab = ref('funnel')

const tabInits: Record<string, () => void> = {
  funnel: initFunnelChart,
  trend: initTrendChart,
  channelDist: initChannelPieChart,
  timeout: () => { initTimeoutDistChart(); initTimeoutTrendChart() },
  refund: () => { initRefundTrendChart(); initRefundReasonPieChart() }
}

function onTabChange(name: string) {
  const initFn = tabInits[name]
  if (initFn) {
    setTimeout(initFn, 50)
  }
}

const allChartInstances = () => [
  funnelChart, collectionTrendChart,
  channelPieChart, timeoutDistChart, timeoutTrendChart,
  refundTrendChart, refundReasonPieChart
]

function handleResize() {
  allChartInstances().forEach(c => c?.resize())
}

function disposeAllCharts() {
  allChartInstances().forEach(c => c?.dispose())
  funnelChart = null
  collectionTrendChart = null
  channelPieChart = null
  timeoutDistChart = null
  timeoutTrendChart = null
  refundTrendChart = null
  refundReasonPieChart = null
}

function refreshAll() {
  loadSummary()
  loadFunnel().then(() => { if (activeTab.value === 'funnel') initFunnelChart() })
  loadTrend().then(() => { if (activeTab.value === 'trend') initTrendChart() })
  loadChannelDistribution().then(() => { if (activeTab.value === 'channelDist') initChannelPieChart() })
  loadTimeout().then(() => { if (activeTab.value === 'timeout') { initTimeoutDistChart(); initTimeoutTrendChart() } })
  loadRefundAnalysis().then(() => { if (activeTab.value === 'refund') { initRefundTrendChart(); initRefundReasonPieChart() } })
}

async function loadAllData() {
  await Promise.all([
    loadStores(),
    loadSummary(),
    loadFunnel(),
    loadTrend(),
    loadChannelDistribution(),
    loadTimeout(),
    loadRefundAnalysis(),
  ])
  initFunnelChart()
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})
</script>

<style scoped>
.page { padding: 0;
}

.filter-card {
  margin-bottom: 16px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  color: var(--text-inverse);
  margin-bottom: 16px;
}

.stat-card-a { background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-5) 100%); }
.stat-card-b { background: linear-gradient(135deg, var(--color-success) 0%, rgba(14,168,121,0.4) 100%); }
.stat-card-c { background: linear-gradient(135deg, var(--chart-5) 0%, var(--color-danger) 100%); }
.stat-card-d { background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-6) 100%); }
.stat-card-e { background: linear-gradient(135deg, var(--color-danger) 0%, var(--color-warning) 100%); }
.stat-card-f { background: linear-gradient(135deg, var(--chart-5) 0%, rgba(139,92,246,0.35) 100%); }

.stat-label {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
}

.chart-box {
  width: 100%;
}

.chart-tall {
  height: 400px;
}

.chart-medium {
  height: 320px;
}
</style>
