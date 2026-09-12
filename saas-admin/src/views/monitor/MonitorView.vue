<template>
  <div>
    <!-- ① 页头（设计稿 sec-ops .pg-hd） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">监控告警</div>
        <p class="pd">实时运行态势 · 异常自动告警与留痕（5 分钟级触达值班人）</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="loadAll"><el-icon><Refresh /></el-icon>刷新</span>
      </div>
    </div>

    <!-- 加载 / 错误态 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}</span>
    </div>

    <!-- ② 三项核心 KPI（设计稿 .g3 > .kpi） -->
    <div class="g3">
      <div class="kpi">
        <div class="kt">今日 API 请求量</div>
        <div class="kv">{{ kpi.apiRequests.value }}</div>
        <div class="kd">较昨日 <span :class="kpi.apiRequests.deltaTone">{{ kpi.apiRequests.delta }}</span></div>
      </div>
      <div class="kpi">
        <div class="kt">API 成功率</div>
        <div class="kv" :style="kpi.successRate.color ? { color: kpi.successRate.color } : {}">{{ kpi.successRate.value }}</div>
        <div class="kd">{{ kpi.successRate.sub }}</div>
      </div>
      <div class="kpi">
        <div class="kt">活跃告警</div>
        <div class="kv" :style="kpi.activeAlerts.color ? { color: kpi.activeAlerts.color } : {}">{{ kpi.activeAlerts.value }}</div>
        <div class="kd">{{ kpi.activeAlerts.sub }}</div>
      </div>
    </div>

    <!-- ③ API 趋势 + 存储 TOP5 -->
    <div class="g2 mt12 monitor-cols">
      <div class="panel">
        <div class="p-hd">
          <span class="pt">API 请求量趋势（今日 · 小时级）</span>
          <span class="lg-row">
            <span><i :style="{ background: 'var(--chart-1)' }"></i>请求量(万)</span>
            <span><i :style="{ background: 'var(--chart-4)' }"></i>错误率(‰)</span>
          </span>
        </div>
        <div class="p-bd">
          <div ref="trendRef" class="chart-box"></div>
          <div v-if="!hasTrend" class="empty" style="height: var(--chart-h-line)">
            API 请求量趋势待接口对接 · fetchApiStats
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="p-hd">
          <span class="pt">存储监控 · 租户占用 TOP5</span>
          <span class="btn-t" @click="onOrphanScan">孤儿文件扫描</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <template v-if="storageTop.length">
            <div v-for="t in storageTop" :key="t.name" class="qrow store-row">
              <span>{{ t.name }}</span>
              <span class="bar" :class="t.tone" style="flex: 1"><i :style="{ width: t.percent + '%' }"></i></span>
              <em>{{ t.usage }}</em>
            </div>
          </template>
          <div v-else class="empty">暂无租户存储占用数据 · 接口待对接</div>
          <div class="tipbar r mt10">
            <span class="ic">!</span>
            <span>
              超额三档预警：80% 提醒 / 95% 预警 / 100% 硬拦截上传。
              <template v-if="storageAlert">{{ storageAlert }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ④ 各租户 API 调用量统计 · 超限告警（设计稿 v1.5 新增） -->
    <div class="panel mt12">
      <div class="pg-hd">
        <div>
          <div class="pt4">各租户 API 调用量统计 · 超限告警 <span class="ver-tag">v1.5 新增</span></div>
          <p class="pd">按套餐配额逐租户统计当月 API 调用量 · 80% / 95% / 100% 三档阈值分级处置 · 超额部分按增值服务口径自动出账</p>
        </div>
        <div class="pg-act">
          <span class="btn" @click="onExportMonthly">导出月报</span>
          <span class="btn btn-p" @click="onThresholdCfg">阈值配置</span>
        </div>
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>租户 / 对接场景</th>
              <th>本月调用量</th>
              <th>配额 / 使用率</th>
              <th>状态</th>
              <th>触发动作与关联单据</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div v-if="!tenantApi.length" class="empty">暂无租户 API 调用量数据 · 接口待对接</div>
      <div class="frow" style="margin-top: var(--space-3)">
        <span class="fld" style="flex: 1">
          <span>80% 预警</span>
          <div class="notify-row">
            <span
              v-for="(n, i) in notify80"
              :key="i"
              class="btn"
              :class="{ 'btn-p': n.enabled }"
              @click="n.enabled = !n.enabled"
              >{{ n.enabled ? '✓ ' : '' }}{{ n.label }}</span
            >
          </div>
        </span>
        <span class="fld" style="flex: 1">
          <span>95% 告警</span>
          <div class="notify-row">
            <span
              v-for="(n, i) in notify95"
              :key="i"
              class="btn"
              :class="{ 'btn-p': n.enabled }"
              @click="n.enabled = !n.enabled"
              >{{ n.enabled ? '✓ ' : '' }}{{ n.label }}</span
            >
          </div>
        </span>
        <span class="fld" style="flex: 1">
          <span>100% 处置</span>
          <div class="notify-row">
            <span
              v-for="(n, i) in notify100"
              :key="i"
              class="btn"
              :class="{ 'btn-p': n.enabled }"
              @click="n.enabled = !n.enabled"
              >{{ n.enabled ? '✓ ' : '' }}{{ n.label }}</span
            >
          </div>
        </span>
      </div>
      <div class="tipbar r" style="margin-top: var(--space-3)">
        <b>留痕与合规：</b>阈值变更、临时提额与手动解限均写入管理员操作日志（仅追加不可删改）；超额部分按「增值服务扣费」口径自动出账并同步账单中心，租户可在账单 Tab 4 查询完整流水。<span class="ver-tag">v1.5</span>
      </div>
    </div>

    <!-- ⑤ 异常接口 TOP / 日志中心 -->
    <div class="panel mt12">
      <div class="tabs">
        <span
          v-for="(t, i) in logTabs"
          :key="t.key"
          class="tab"
          :class="{ on: activeLogTab === t.key }"
          @click="activeLogTab = t.key"
          >{{ t.label }}<span v-if="t.badge" class="n">{{ t.badge }}</span></span
        >
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>接口</th>
              <th>所属服务</th>
              <th class="num">调用量(今日)</th>
              <th class="num">错误率</th>
              <th class="num">P95耗时</th>
              <th>最近报错时间</th>
              <th>最近错误摘要</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div v-if="!errorTop.length" class="empty">暂无{{ activeLogTab === 'errorApi' ? '异常接口' : '日志' }}数据 · 接口待对接</div>
      <p class="small mt8" style="padding: 0 14px 12px">
        日志中心说明：管理员操作日志 / 租户登录日志 / 系统错误日志三个 Tab 结构一致（时间 / 对象 / 操作 / 结果 / IP），支持按人、模块、时间检索，保留 ≥180 天，导出需权限；异常登录（异地 / 高频失败）自动标红。P0 告警 5 分钟内短信+电话双通道触达值班人并自动创建故障工单。
      </p>
    </div>

    <!-- ⑥ 代登录审计记录 · 五步审计法 -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">
          <span class="tag tag-r" style="margin-right: var(--space-1)">独立 Tab</span>代登录审计记录 · 五步审计法
        </span>
        <div class="frow">
          <span class="sel" @click="onFilterAuditor">操作人：全部 ▾</span>
          <span class="sel" @click="onFilterMonth">本月 ▾</span>
          <span class="btn" @click="onExportAudit">导出审计</span>
        </div>
      </div>
      <div class="p-bd" style="padding-top: var(--space-2)">
        <div class="steps">
          <span class="step done"><span class="sn">✓</span>申请（工单关联必填）</span><span class="step-line"></span>
          <span class="step done"><span class="sn">✓</span>审批（审批人≠申请人）</span><span class="step-line"></span>
          <span class="step on"><span class="sn">3</span>限时会话（≤30分钟）</span><span class="step-line"></span>
          <span class="step"><span class="sn">4</span>全程留痕录屏</span><span class="step-line"></span>
          <span class="step"><span class="sn">5</span>回放与月度抽检</span>
        </div>
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>工单号</th>
                <th>操作人</th>
                <th>目标租户</th>
                <th>事由</th>
                <th>进入时间</th>
                <th>退出时间</th>
                <th class="num">时长</th>
                <th>操作摘要</th>
                <th>审批人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div v-if="!auditRows.length" class="empty">暂无代登录审计记录 · 接口待对接</div>
        <p class="small mt8">
          安全约束：一次性临时 Token 不可续期；会话内页面操作逐屏记录可回放；支付配置 / 密钥等敏感页强制脱敏禁改；每月抽检 ≥10% 会话，无工单 / 超频代登录自动告警。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { fetchMonitorData } from '../../api/monitor'

/* 图表配色一律读取 design token，避免在脚本里写死色值 */
function token(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const COLOR = {
  primary: token('--chart-1'),
  danger: token('--chart-4'),
  grid: token('--chart-grid'),
  axis: token('--chart-axis-text'),
}

const loading = ref(false)
const error = ref('')
const apiStats = ref<any>({})

/* ── KPI（数据来自接口，缺省以占位符展示，不填充示例值） ── */
const kpi = computed(() => {
  const d = apiStats.value || {}
  return {
    apiRequests: {
      value: d.todayApiRequests ?? '—',
      delta: d.apiDelta ?? '—',
      deltaTone: 'up',
    },
    successRate: {
      value: d.successRate ?? '—',
      color: d.successRate != null ? 'var(--color-success)' : '',
      sub: d.p95 ? `P95 耗时 ${d.p95} · 目标 <2s` : 'P95 耗时 — · 目标 <2s',
    },
    activeAlerts: {
      value: d.activeAlerts ?? '—',
      color: d.activeAlerts != null ? 'var(--color-warning)' : '',
      sub: d.alertBreakdown ?? 'P0×— · P1×— · P2×— · 5分钟触达值班人',
    },
  }
})

/* ── API 趋势（双轴：请求量 + 错误率） ── */
const trend = computed<any[]>(() => apiStats.value?.trend || [])
const hasTrend = computed(() => trend.value.length > 0)
const trendRef = ref<HTMLElement | null>(null)
let trendChart: echarts.ECharts | null = null

function renderTrend() {
  if (!trendRef.value || !hasTrend.value) return
  trendChart = trendChart || echarts.init(trendRef.value)
  trendChart.setOption({
    grid: { left: 36, right: 36, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: trend.value.map((x: any) => x.hour),
      axisLine: { lineStyle: { color: COLOR.grid } },
      axisLabel: { color: COLOR.axis, fontSize: 9 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '请求量(万)',
        splitLine: { lineStyle: { color: COLOR.grid } },
        axisLabel: { color: COLOR.axis, fontSize: 9 },
      },
      {
        type: 'value',
        name: '错误率(‰)',
        splitLine: { show: false },
        axisLabel: { color: COLOR.axis, fontSize: 9 },
      },
    ],
    series: [
      {
        name: '请求量(万)',
        type: 'line',
        smooth: true,
        yAxisIndex: 0,
        symbolSize: 5,
        data: trend.value.map((x: any) => x.requests),
        lineStyle: { color: COLOR.primary, width: 2.5 },
        itemStyle: { color: COLOR.primary },
      },
      {
        name: '错误率(‰)',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbolSize: 4,
        data: trend.value.map((x: any) => x.errRate),
        lineStyle: { color: COLOR.danger, width: 1.5, type: 'dashed' },
        itemStyle: { color: COLOR.danger },
      },
    ],
  })
}

/* ── 存储 TOP5（数据来自接口，缺省空态） ── */
const storageTop = ref<any[]>([])
const storageAlert = ref('')

/* ── 各租户 API 调用量（数据来自接口，缺省空态） ── */
const tenantApi = ref<any[]>([])

/* ── 阈值通知渠道（控制态，默认参照设计稿策略；非造假数据） ── */
const notify80 = ref([
  { label: '站内通知', enabled: true },
  { label: '邮件提醒', enabled: true },
  { label: '短信（主联系人）', enabled: false },
])
const notify95 = ref([
  { label: '自动升级 P2 工单', enabled: false },
  { label: '通知客户成功经理', enabled: true },
])
const notify100 = ref([
  { label: '硬限流（HTTP 429）', enabled: true },
  { label: '临时提额 +20% · 7 天', enabled: false },
])

/* ── 日志中心 / 异常接口 TOP ── */
const logTabs = [
  { key: 'errorApi', label: '异常接口 TOP' },
  { key: 'opLog', label: '管理员操作日志' },
  { key: 'loginLog', label: '租户登录日志' },
  { key: 'errLog', label: '系统错误日志' },
  { key: 'proxyLog', label: '代登录审计', badge: 2 },
]
const activeLogTab = ref('errorApi')
const errorTop = ref<any[]>([])

/* ── 代登录审计 ── */
const auditRows = ref<any[]>([])

function onOrphanScan() {
  // TODO: 待接入孤儿文件扫描（建议 GET /platform/monitor/storage/orphan-scan）
  ElMessage.info('孤儿文件扫描接口待对接（GET /platform/monitor/storage/orphan-scan）')
}
function onExportMonthly() {
  // TODO: 待接入租户 API 月报导出（建议 GET /platform/monitor/tenant-api/export）
  ElMessage.info('租户 API 月报导出接口待对接（GET /platform/monitor/tenant-api/export）')
}
function onThresholdCfg() {
  // TODO: 待接入阈值配置（建议 GET/PUT /platform/monitor/thresholds）
  ElMessage.info('阈值配置接口待对接（PUT /platform/monitor/thresholds）')
}
function onFilterAuditor() {
  // TODO: 待接入审计筛选（建议 GET /platform/monitor/proxy-audit?operator=）
  ElMessage.info('代登录审计筛选接口待对接（GET /platform/monitor/proxy-audit）')
}
function onFilterMonth() {
  ElMessage.info('代登录审计按月筛选接口待对接（GET /platform/monitor/proxy-audit）')
}
function onExportAudit() {
  // TODO: 待接入审计导出（建议 GET /platform/monitor/proxy-audit/export）
  ElMessage.info('代登录审计导出接口待对接（GET /platform/monitor/proxy-audit/export）')
}

function resizeChart() {
  trendChart?.resize()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 现有接口保留调用（KPI + 趋势）
    const res: any = await fetchMonitorData()
    apiStats.value = res?.data?.data || res?.data || {}
    // 存储 TOP5 / 租户 API / 异常接口 / 代登录审计 暂无对应接口，保持空态（不造假）
    // TODO: 待接入 GET /platform/monitor/storage/top5、/platform/monitor/tenant-api、
    //       /platform/error-logs、/platform/monitor/proxy-audit
    try {
      const el: any = await getErrorLogs({ pageSize: 20 })
      errorTop.value = el?.data?.data?.records || []
    } catch {
      errorTop.value = []
    }
  } catch {
    error.value = '监控数据加载失败（接口待对接，当前展示空态）'
  } finally {
    loading.value = false
    await nextTick()
    renderTrend()
  }
}

watch(hasTrend, async () => {
  await nextTick()
  renderTrend()
})

async function loadAll() {
  await load()
}

onMounted(() => {
  load()
  window.addEventListener('resize', resizeChart)
})
onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  trendChart?.dispose()
})
</script>

<style scoped>
/* 页面级布局仅使用 design token 组合，不写死任何色值/字号/间距/圆角 */
.monitor-cols {
  grid-template-columns: 1.5fr 1fr;
}
.store-row > span {
  width: var(--qrow-label-w);
  flex: none;
}
.notify-row {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
@media (max-width: 1180px) {
  .monitor-cols {
    grid-template-columns: 1fr;
  }
}
</style>
