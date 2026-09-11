<template>
  <div>
    <!-- ① 页头：标题 + 数据口径 ｜ 右侧操作（设计稿 sec-overview .pg-hd） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">运营大盘</div>
        <p class="pd">
          数据口径：常规指标 T+1 · 当日收入/新增付费租户为 5 分钟级准实时<template v-if="updatedAt"> · 更新于 {{ updatedAt }}</template>
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="handleExport"><el-icon><Download /></el-icon>导出报表</span>
        <span class="sel" style="cursor: pointer">{{ periodLabel }}</span>
      </div>
    </div>

    <!-- ② 六项核心指标（设计稿 .g6 > .kpi） -->
    <div class="g6">
      <div v-for="card in kpiCards" :key="card.key" class="kpi">
        <div class="kt">{{ card.title }}</div>
        <div class="kv">{{ card.value }}</div>
        <div class="kd">
          {{ card.hint }}
          <span v-if="card.deltaText" :class="card.deltaTone">{{ card.deltaText }}</span>
        </div>
      </div>
    </div>

    <!-- ③ 主体：左（趋势 + 套餐分布/收入构成）｜右 272px（待办 + 系统健康） -->
    <div class="mt12 dash-cols">
      <div class="dash-main">
        <div class="panel">
          <div class="p-hd">
            <span class="pt">租户增长趋势</span>
            <span class="lg-row">
              <span><i :style="{ background: 'var(--chart-1)' }"></i>日新增</span>
              <span><i :style="{ background: 'var(--chart-1-soft)' }"></i>累计（右轴）</span>
            </span>
          </div>
          <div class="p-bd">
            <div v-if="hasTrend" ref="trendRef" class="chart-box"></div>
            <div v-else class="chart-box">
              <div class="empty">趋势数据待接口对接 · /platform/dashboard/overview → tenantTrend</div>
            </div>
          </div>
        </div>

        <div class="g2 mt12">
          <!-- 套餐分布 -->
          <div class="panel">
            <div class="p-hd"><span class="pt">套餐分布</span><span class="ph-s">按租户数</span></div>
            <div class="p-bd plan-dist">
              <div v-if="hasPlan" ref="planRef" class="chart-box is-donut"></div>
              <div v-else class="chart-box is-donut">
                <div class="empty">待接口对接</div>
              </div>
              <div class="plan-dist-legend">
                <div v-for="row in planRows" :key="row.key" class="qrow">
                  <span><i class="dot" :style="{ background: row.color }"></i>{{ row.label }}</span>
                  <span style="width: 0; flex: 1"></span>
                  <em style="width: auto">{{ row.value }}</em>
                </div>
                <p class="small mt8">升级流向：免费→付费 本月 {{ flow.upgrade ?? '--' }} 家 ｜ 降级 {{ flow.downgrade ?? '--' }} 家</p>
              </div>
            </div>
          </div>

          <!-- 收入构成（本月） -->
          <div class="panel">
            <div class="p-hd"><span class="pt">收入构成（本月）</span><span class="ph-s">单位：万元</span></div>
            <div class="p-bd">
              <div v-if="hasIncome" ref="incomeRef" class="chart-box is-bar"></div>
              <div v-else class="chart-box is-bar">
                <div class="empty">收入构成待接口对接 · /platform/dashboard/overview → incomeComposition</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-aside">
        <!-- 待办事项 -->
        <div class="panel">
          <div class="p-hd"><span class="pt">待办事项</span><span class="lk ver-link">全部 ›</span></div>
          <div class="p-bd todo-bd">
            <div
              v-for="item in todoItems"
              :key="item.key"
              class="todo-row"
              :class="{ 'is-alert': item.alert }"
            >
              <span class="tag todo-badge" :class="item.tagClass">{{ item.label }}</span>
              <div class="todo-main">
                <div class="todo-title">{{ item.title }}</div>
                <div class="small">{{ item.desc }}</div>
              </div>
              <b class="todo-count" :style="{ color: item.countColor }">{{ item.count }}</b>
              <span class="small">›</span>
            </div>
          </div>
        </div>

        <!-- 系统健康状态 -->
        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">系统健康状态</span>
            <span class="tag" :class="healthOk ? 'tag-g' : 'tag-gy'">{{ healthOk ? '整体正常' : '待对接' }}</span>
          </div>
          <div class="p-bd health-bd">
            <div v-for="row in healthRows" :key="row.key" class="qrow">
              <span class="health-label">{{ row.label }}</span>
              <span class="bar" :class="row.tone" style="flex: 1">
                <i :style="{ width: row.percent + '%' }"></i>
              </span>
              <em>{{ row.value }}</em>
            </div>
            <p class="small mt8 health-alarm">{{ alarmText }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ④ 报表导出（设计稿 v1.5） -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">报表导出 <span class="ver-tag">v1.5</span></span>
        <span class="ph-s">聚合报表 · 只含租户元数据与聚合指标，不含租户业务单据明细（清单 5.2）</span>
      </div>
      <div class="p-bd">
        <div class="frow export-frow">
          <span class="fld fld-14">
            <span>报表类型</span>
            <span class="btn-group">
              <span
                v-for="t in reportTypes"
                :key="t.key"
                class="btn"
                :class="{ 'btn-p': exportType === t.key }"
                @click="exportType = t.key"
                >{{ t.label }}</span
              >
            </span>
          </span>
          <span class="fld fld-10">
            <span>统计周期</span>
            <span class="btn-group">
              <span class="btn" :class="{ 'btn-p': exportPeriod === 'thisMonth' }" @click="exportPeriod = 'thisMonth'">本月</span>
              <span class="btn" :class="{ 'btn-p': exportPeriod === 'lastMonth' }" @click="exportPeriod = 'lastMonth'">{{ lastMonthLabel }}</span>
              <span class="btn" :class="{ 'btn-p': exportPeriod === 'custom' }" @click="exportPeriod = 'custom'">自定义区间</span>
            </span>
          </span>
          <span class="fld fld-08">
            <span>格式</span>
            <span class="btn-group">
              <span class="btn" :class="{ 'btn-p': exportFormat === 'excel' }" @click="exportFormat = 'excel'">Excel</span>
              <span class="btn" :class="{ 'btn-p': exportFormat === 'pdf' }" @click="exportFormat = 'pdf'">PDF</span>
            </span>
          </span>
          <span class="btn btn-p export-submit" @click="handleExport">导出所选报表</span>
        </div>

        <div class="tblwrap mt10">
          <table class="tbl export-tbl">
            <thead>
              <tr>
                <th>导出任务</th>
                <th>内容摘要</th>
                <th>范围</th>
                <th>状态</th>
                <th>生成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!exportTasks.length">
                <td colspan="6" class="tbl-empty">暂无导出任务 · 导出记录将在接口对接后展示</td>
              </tr>
              <tr v-for="t in exportTasks" :key="t.id">
                <td><b>{{ t.name }}</b></td>
                <td>{{ t.summary }}</td>
                <td>{{ t.scope }}</td>
                <td><span class="tag" :class="t.tagClass">{{ t.status }}</span></td>
                <td>{{ t.createdAt }}</td>
                <td><span class="btn-t">下载</span><span class="btn-t gy">任务日志</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="small mt8">
          导出说明：报表异步生成，完成后在「下载中心」取件，链接 <b>7 天内有效</b>；财务报表含租户名称 / 套餐 /
          应收实收 / 欠费，不含租户内部销售单、采购单等业务明细；导出行为全部留痕（谁 / 何时 / 导出范围）。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getPlatformOverview } from '../api'

/* ── 图表配色：一律读取 design token，避免在脚本里写死色值 ── */
function token(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const COLOR = {
  primary: token('--chart-1'),
  primarySoft: token('--chart-1-soft'),
  primaryMid: token('--chart-1-mid'),
  primaryDeep: token('--chart-1-deep'),
  neutral: token('--chart-neutral'),
  axis: token('--chart-axis-text'),
  grid: token('--chart-grid'),
  ink: token('--ink'),
  g5: token('--g5'),
}

const period = ref('30d')
const periodLabel = computed(() => (period.value === '30d' ? '近 30 天' : period.value))
const updatedAt = ref('')

/* 接口原始数据；字段缺失一律展示空态，不填充任何示例值 */
const raw = ref<Record<string, any>>({})

/* ── 六项指标（设计稿 .kpi 的 kt / kv / kd 三段结构） ── */
const kpiCards = computed(() => {
  const d = raw.value || {}
  const delta = (v: any, suffix = '') =>
    v === null || v === undefined || v === ''
      ? { deltaText: '--', deltaTone: 'muted' }
      : { deltaText: `${Number(v) >= 0 ? '+' : ''}${v}${suffix}`, deltaTone: Number(v) >= 0 ? 'up' : 'dn' }
  return [
    { key: 'total', title: '租户总数', value: d.totalTenants ?? '--', hint: '较上月', ...delta(d.tenantDelta) },
    { key: 'today', title: '今日新增租户', value: d.todayNewTenants ?? '--', hint: '其中付费', deltaText: d.todayNewPaid ?? '--', deltaTone: 'up' },
    { key: 'active', title: '有效租户', value: d.activeTenants ?? '--', hint: '近7日活跃', deltaText: d.activeRate ?? '--', deltaTone: 'muted' },
    { key: 'income', title: '本月收入', value: d.monthIncome == null ? '--' : `¥${d.monthIncome}`, hint: '较上月', ...delta(d.incomeDelta, '%') },
    { key: 'orders', title: '平台订单总量', value: d.totalOrders ?? '--', hint: '今日', deltaText: d.todayOrders ?? '--', deltaTone: 'up' },
    { key: 'ai', title: '大模型消耗总额', value: d.aiCost == null ? '--' : `¥${d.aiCost}`, hint: '本月 · Token', deltaText: d.aiTokens ?? '--', deltaTone: 'muted' },
  ]
})

/* ── 趋势 / 套餐分布 / 收入构成：无数据则空态 ── */
const trend = computed<any[]>(() => raw.value?.tenantTrend || [])
const planDist = computed<any[]>(() => raw.value?.planDistribution || [])
const incomeComp = computed<any[]>(() => raw.value?.incomeComposition || [])
const flow = computed<Record<string, any>>(() => raw.value?.planFlow || {})
const hasTrend = computed(() => trend.value.length > 0)
const hasPlan = computed(() => planDist.value.length > 0)
const hasIncome = computed(() => incomeComp.value.length > 0)

const PLAN_COLORS = [COLOR.neutral, COLOR.primary, COLOR.primaryMid, COLOR.primaryDeep]
const planRows = computed(() => {
  const list = planDist.value
  if (!list.length) {
    return ['免费版', '基础版', '标准版', '旗舰版'].map((label, i) => ({
      key: label,
      label,
      color: PLAN_COLORS[i],
      value: '-- 家 · --%',
    }))
  }
  const total = list.reduce((s, x) => s + Number(x.count || 0), 0) || 1
  return list.map((x, i) => ({
    key: x.name || i,
    label: x.name,
    color: PLAN_COLORS[i % PLAN_COLORS.length],
    value: `${x.count} 家 · ${Math.round((Number(x.count) / total) * 100)}%`,
  }))
})

/* ── 待办四类 ── */
const todoItems = computed(() => {
  const t = raw.value?.todos || {}
  const n = (v: any) => (v == null ? '--' : v)
  return [
    { key: 'audit', label: '审核', title: '待审核租户', desc: '官网自助注册开户待初审', count: n(t.audit), tagClass: 'tag-o', countColor: 'var(--color-warning)', alert: false },
    { key: 'arrears', label: '欠费', title: '欠费租户', desc: '含宽限期 / 功能降级 / 已冻结', count: n(t.arrears), tagClass: 'tag-o', countColor: 'var(--color-warning)', alert: true },
    { key: 'ticket', label: '工单', title: '工单待处理', desc: '故障类 / 账单类 / 功能咨询', count: n(t.ticket), tagClass: 'tag-b', countColor: 'var(--color-primary)', alert: false },
    { key: 'approval', label: '审批', title: '提现审批 / 配额扩容审批', desc: '财务待审 / 临时扩容待批', count: n(t.approval), tagClass: 'tag-p', countColor: 'var(--color-purple)', alert: false },
  ]
})

/* ── 系统健康状态 ── */
const health = computed<Record<string, any>>(() => raw.value?.health || {})
const healthOk = computed(() => Object.keys(health.value).length > 0)
const healthRows = computed(() => {
  const h = health.value
  const FALLBACK_PERCENT = 0
  return [
    { key: 'api', label: 'API 成功率', value: h.apiSuccessRate ?? '--', percent: h.apiSuccessPercent ?? FALLBACK_PERCENT, tone: 'g' },
    { key: 'rt', label: '平均响应', value: h.avgResponse ?? '--', percent: h.avgResponsePercent ?? FALLBACK_PERCENT, tone: '' },
    { key: 'storage', label: '存储水位', value: h.storageUsage ?? '--', percent: h.storagePercent ?? FALLBACK_PERCENT, tone: 'o' },
    { key: 'ai', label: 'AI 网关', value: h.aiGateway ?? '--', percent: h.aiGatewayPercent ?? FALLBACK_PERCENT, tone: 'g' },
    { key: 'mq', label: '消息队列', value: h.messageQueue ?? '--', percent: h.messageQueuePercent ?? FALLBACK_PERCENT, tone: 'g' },
  ]
})
const alarmText = computed(() =>
  raw.value?.lastAlarm ? `最近告警：${raw.value.lastAlarm}` : '最近告警：暂无告警记录（待接口对接）',
)

/* ── 报表导出 ── */
const reportTypes = [
  { key: 'tenantFinance', label: '租户财务报表' },
  { key: 'resourceCost', label: '资源消耗报表' },
  { key: 'planDistribution', label: '套餐分布报表' },
]
const exportType = ref('tenantFinance')
const exportPeriod = ref('thisMonth')
const exportFormat = ref('excel')
const exportTasks = ref<any[]>([])
const lastMonthLabel = computed(() => '上月')

function handleExport() {
  // TODO: 待接入 POST /api/platform/reports/export（异步生成，完成后在下载中心取件）
  ElMessage.info('报表导出接口待对接（POST /api/platform/reports/export）')
}

/* ── 图表实例管理 ── */
const trendRef = ref<HTMLElement | null>(null)
const planRef = ref<HTMLElement | null>(null)
const incomeRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null
let planChart: echarts.ECharts | null = null
let incomeChart: echarts.ECharts | null = null

function renderTrend() {
  if (!trendRef.value || !hasTrend.value) return
  trendChart = trendChart || echarts.init(trendRef.value)
  const dates = trend.value.map((x: any) => x.date)
  trendChart.setOption({
    grid: { left: 36, right: 20, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: COLOR.grid } }, axisLabel: { color: COLOR.axis, fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: COLOR.grid } }, axisLabel: { color: COLOR.axis, fontSize: 10 } },
    series: [
      {
        name: '日新增',
        type: 'line',
        smooth: false,
        symbolSize: 7,
        data: trend.value.map((x: any) => x.newCount),
        lineStyle: { color: COLOR.primary, width: 2.5 },
        itemStyle: { color: COLOR.primary },
        areaStyle: { color: COLOR.primarySoft, opacity: 0.35 },
      },
    ],
  })
}

function renderPlan() {
  if (!planRef.value || !hasPlan.value) return
  planChart = planChart || echarts.init(planRef.value)
  planChart.setOption({
    series: [
      {
        type: 'pie',
        radius: ['62%', '82%'],
        label: { show: false },
        data: planDist.value.map((x: any, i: number) => ({
          name: x.name,
          value: x.count,
          itemStyle: { color: PLAN_COLORS[i % PLAN_COLORS.length] },
        })),
      },
    ],
  })
}

function renderIncome() {
  if (!incomeRef.value || !hasIncome.value) return
  incomeChart = incomeChart || echarts.init(incomeRef.value)
  incomeChart.setOption({
    grid: { left: 34, right: 8, top: 16, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: incomeComp.value.map((x: any) => x.name),
      axisLine: { lineStyle: { color: COLOR.grid } },
      axisLabel: { color: COLOR.g5, fontSize: 9.5 },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: COLOR.grid } }, axisLabel: { color: COLOR.axis, fontSize: 9 } },
    series: [
      {
        type: 'bar',
        barWidth: 30,
        itemStyle: { color: COLOR.primary, borderRadius: [4, 4, 0, 0] },
        data: incomeComp.value.map((x: any) => x.amount),
      },
    ],
  })
}

function resizeAll() {
  trendChart?.resize()
  planChart?.resize()
  incomeChart?.resize()
}

async function load() {
  try {
    const res: any = await getPlatformOverview()
    raw.value = res?.data?.data || res?.data || {}
    updatedAt.value = raw.value?.updatedAt || ''
  } catch {
    /* 接口不可用时保持空态，不填充示例数据 */
    raw.value = {}
  } finally {
    await nextTick()
    renderTrend()
    renderPlan()
    renderIncome()
  }
}

watch([hasTrend, hasPlan, hasIncome], async () => {
  await nextTick()
  renderTrend()
  renderPlan()
  renderIncome()
})

onMounted(() => {
  load()
  window.addEventListener('resize', resizeAll)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeAll)
  trendChart?.dispose()
  planChart?.dispose()
  incomeChart?.dispose()
})
</script>

<style scoped>
/* 页面级布局仅使用 token 组合，不写死任何色值/尺寸 */
.dash-cols {
  display: grid;
  grid-template-columns: 1fr var(--dash-aside-w);
  gap: var(--space-3);
  align-items: start;
}
.dash-main,
.dash-aside {
  min-width: 0;
}
.dash-aside {
  position: sticky;
  top: 0;
}
.todo-bd {
  padding: 6px 8px;
}
.health-bd {
  padding-top: var(--space-2);
}
.health-label {
  width: var(--health-label-w);
}
.health-alarm {
  border-top: 1px dashed var(--g2);
  padding-top: var(--space-2);
}
.plan-dist {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}
.plan-dist-legend {
  flex: 1;
  min-width: 0;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
  margin-right: 5px;
}
.ver-link {
  font-size: var(--text-xs);
}
.export-frow {
  align-items: flex-end;
}
.fld-14 {
  flex: 1.4;
}
.fld-10 {
  flex: 1;
}
.fld-08 {
  flex: 0.8;
}
.btn-group {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.export-submit {
  margin-bottom: 2px;
}
.export-tbl {
  font-size: var(--tbl-th-font-size);
}
.tbl-empty {
  text-align: center;
  color: var(--g4);
  padding: var(--space-6) var(--space-3);
}
/* 窄屏折叠为单列（令牌 --dash-aside-w 的响应式降级） */
@media (max-width: 1180px) {
  .dash-cols {
    grid-template-columns: 1fr;
  }
  .dash-aside {
    position: static;
  }
}
</style>
