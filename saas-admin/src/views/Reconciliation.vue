<template>
  <!-- 根节点直接为内容片段（框架已在 .pf-main 内渲染，此处不再写 .pf-main） -->
  <div>
    <!-- ① 页头：标题 + 计费口径 ｜ 右侧操作（设计稿 sec-bill .pg-hd，行 780） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">账单计费</div>
        <p class="pd">
          计费引擎口径：套餐费 + 增值费分列出账 · 日对账自动校验 · 差异告警至财务群
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="handleExportStatement">导出对账单</span>
        <span class="btn btn-p" @click="handleGenBill">手动生成账单</span>
      </div>
    </div>

    <!-- ② 三项指标卡（设计稿 .g3 > .kpi，行 781~785） -->
    <div class="g3">
      <div class="kpi">
        <div class="kt">本月总收入</div>
        <div class="kv">{{ kpi.revenue == null ? '--' : fmtMoney(kpi.revenue) }}</div>
        <div class="kd">较上月 <span class="up">--</span> · 套餐 / 增值 待接口拆分</div>
      </div>
      <div class="kpi">
        <div class="kt">待收金额</div>
        <div class="kv" style="color: var(--color-warning)">{{ kpi.pending == null ? '--' : fmtMoney(kpi.pending) }}</div>
        <div class="kd">待支付账单 -- 笔 · 含到期未付 -- 笔</div>
      </div>
      <div class="kpi">
        <div class="kt">欠费租户数</div>
        <div class="kv" style="color: var(--color-danger)">{{ kpi.arrears == null ? '--' : kpi.arrears }}</div>
        <div class="kd">宽限期 -- · 功能降级 -- · 已冻结 --</div>
      </div>
    </div>

    <!-- ③ 主面板：页签切换（设计稿 .panel > .tabs，行 786~789） -->
    <div class="panel mt12">
      <div class="tabs">
        <span class="tab" :class="{ on: activeTab === 'flow' }" @click="activeTab = 'flow'">账单流水</span>
        <span class="tab" :class="{ on: activeTab === 'arrears' }" @click="activeTab = 'arrears'">
          欠费管理 <span class="n">{{ arrearsCount }}</span>
        </span>
        <span class="tab" :class="{ on: activeTab === 'recon' }" @click="activeTab = 'recon'">对账中心</span>
        <span class="tab" :class="{ on: activeTab === 'addon' }" @click="activeTab = 'addon'">
          增值扣费 <span class="ver-tag">v1.5</span>
        </span>
      </div>

      <!-- ===== Tab 1：账单流水（行 790~805） ===== -->
      <div v-show="activeTab === 'flow'">
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>账单编号</th>
                <th>租户</th>
                <th>账单类型</th>
                <th class="num">金额</th>
                <th>支付方式</th>
                <th>支付状态</th>
                <th>生成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in billList" :key="row.id">
                <td>{{ row.billNo || '--' }}</td>
                <td><b>{{ row.tenantName || '--' }}</b></td>
                <td>
                  <span v-if="row.billType" class="tag" :class="billTypeTag(row.billType)">{{ row.billType }}</span>
                  <span v-else>--</span>
                </td>
                <td class="num"><b>{{ row.amount == null ? '--' : fmtMoney(row.amount) }}</b></td>
                <td>{{ row.payMethod || '--' }}</td>
                <td>
                  <span class="tag" :class="payStatus(row).cls">{{ payStatus(row).text }}</span>
                </td>
                <td>{{ row.createdAt || '--' }}</td>
                <td>
                  <span class="btn-t" @click="openDetail(row)">详情</span>
                  <span class="btn-t" @click="handleInvoice(row)">开票</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loadingBill" class="empty">加载中…</div>
        <div v-else-if="!billList.length" class="empty">暂无账单流水 · 待接入 GET /platform/reconciliation</div>

        <div class="pagebar">
          <span>共 {{ total }} 笔流水 · 增值扣费逐笔可查可导出</span>
          <div class="pgbtns">
            <span @click="gotoPage(page - 1)">‹</span>
            <span
              v-for="(p, i) in pageBtns"
              :key="i"
              :class="{ on: p === page }"
              @click="typeof p === 'number' && gotoPage(p)"
            >{{ p }}</span>
            <span @click="gotoPage(page + 1)">›</span>
          </div>
        </div>
      </div>

      <!-- ===== Tab 2：欠费管理（行 806~839） ===== -->
      <div v-show="activeTab === 'arrears'">
        <div class="p-hd">
          <span class="pt">欠费管理视图</span>
          <div>
            <span class="btn btn-d" @click="handleBatchUrge">批量催缴（勾选 {{ selectedArrears.length }} 户）</span>
            <span class="btn" @click="handleExportArrears">导出欠费清单</span>
          </div>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tipbar w">
            <span class="ic">!</span>
            <span>
              欠费处理时间线：<b>宽限期 15 天（全功能）→ 功能降级·只读（D+16~30）→ 冻结·仅可导出（D+31~60）→ 保留期（D+61~90）→ 注销清除</b>。降级采用整体只读模式，由配额引擎自动执行。
            </span>
          </div>

          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th>
                    <span class="ck" :class="{ on: selectedArrears.length === arrearsList.length && arrearsList.length }" @click="toggleAllArrears"></span>
                  </th>
                  <th>租户</th>
                  <th>欠费账单</th>
                  <th class="num">欠费金额</th>
                  <th class="num">欠费天数</th>
                  <th>处理阶段</th>
                  <th>下次动作</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in arrearsList" :key="row.id">
                  <td>
                    <span class="ck" :class="{ on: selectedArrears.includes(row.id) }" @click="toggleArrears(row.id)"></span>
                  </td>
                  <td>
                    <b>{{ row.tenantName || '--' }}</b>
                    <span v-if="row.tenantSub" class="sub">{{ row.tenantSub }}</span>
                  </td>
                  <td>{{ row.billNo || '--' }}</td>
                  <td class="num"><b style="color: var(--color-danger)">{{ row.amount == null ? '--' : fmtMoney(row.amount) }}</b></td>
                  <td class="num">{{ row.days == null ? '--' : row.days }}</td>
                  <td>
                    <span v-if="row.stage" class="tag" :class="arrearsStageTag(row.stage)">{{ row.stage }}</span>
                    <span v-else>--</span>
                    <span v-if="row.stageNote" class="small"> {{ row.stageNote }}</span>
                  </td>
                  <td>{{ row.nextAction || '--' }}</td>
                  <td>
                    <span v-if="row.stage !== '已冻结'" class="btn-t warn" @click="handleUrge(row)">立即催缴</span>
                    <span v-if="row.stage === '功能降级'" class="btn-t" @click="handleRetain(row)">续费挽留</span>
                    <span v-if="row.stage === '已冻结'" class="btn-t dgr" @click="handleCancel(row)">发起注销</span>
                    <span v-if="row.stage === '保留期'" class="btn-t gy" @click="handleRecover(row)">恢复缴费</span>
                    <span class="btn-t" @click="openDetail(row)">详情</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!arrearsList.length" class="empty">暂无欠费租户 · 待接入 GET /platform/billing/arrears</div>

          <p class="small mt8">
            批量催缴：站内 + 短信双通道，文案使用「欠费催缴」模板（变量：租户名/到期日/欠费额）；旗舰租户自动生成客服跟进任务。
          </p>

          <!-- 欠费处理策略（全局） -->
          <div class="panel mt10" style="box-shadow: none">
            <div class="p-hd">
              <span class="pt">欠费处理策略（全局） <span class="ver-tag">v1.5</span></span>
              <span class="ph-s">保存需超级管理员确认 · 变更前后快照留痕 · 仅对后续新账单生效</span>
            </div>
            <div class="p-bd">
              <div class="g4">
                <span class="fld">
                  <span>宽限期天数（全功能可用）</span>
                  <span class="ipt">{{ arrearsPolicy.graceDays }} <b class="small" style="font-weight: var(--font-normal)">天</b></span>
                </span>
                <span class="fld">
                  <span>冻结后保留期天数</span>
                  <span class="ipt">{{ arrearsPolicy.retainDays }} <b class="small" style="font-weight: var(--font-normal)">天</b></span>
                </span>
                <span class="fld">
                  <span>到期前提醒节点</span>
                  <span class="ipt">{{ arrearsPolicy.remindNodes }}</span>
                </span>
                <span class="fld">
                  <span>催缴推送通道</span>
                  <span class="ipt">{{ arrearsPolicy.channels }}</span>
                </span>
              </div>

              <div class="mt10" style="border-top: 1px dashed var(--g2); padding-top: var(--space-2)">
                <!-- TODO: 待接入 GET /platform/billing/arrears-policy（全局欠费策略配置） -->
                <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--g1)">
                  <span class="tg" :class="{ off: !arrearsPolicy.autoDowngrade }" @click="arrearsPolicy.autoDowngrade = !arrearsPolicy.autoDowngrade"></span>
                  <div style="flex: 1">
                    <div class="b">宽限期结束自动降级只读（D+16）</div>
                    <div class="small">当前策略：开启 · 整体只读可查看可导出，由配额引擎自动执行</div>
                  </div>
                  <span class="tag tag-g">生效中</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--g1)">
                  <span class="tg" :class="{ off: !arrearsPolicy.autoFreeze }" @click="arrearsPolicy.autoFreeze = !arrearsPolicy.autoFreeze"></span>
                  <div style="flex: 1">
                    <div class="b">降级 30 天后自动冻结（D+31）</div>
                    <div class="small">当前策略：开启 · 冻结后仅可导出数据，暂停计费与登录</div>
                  </div>
                  <span class="tag tag-g">生效中</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--g1)">
                  <span class="tg" :class="{ off: !arrearsPolicy.autoRemind }" @click="arrearsPolicy.autoRemind = !arrearsPolicy.autoRemind"></span>
                  <div style="flex: 1">
                    <div class="b">欠费提醒自动推送</div>
                    <div class="small">进入宽限期即时推送 1 条 + 每周一 09:00 汇总提醒租户主管理员</div>
                  </div>
                  <span class="tag tag-g">生效中</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0">
                  <span class="tg" :class="{ off: !arrearsPolicy.autoCancel }" @click="arrearsPolicy.autoCancel = !arrearsPolicy.autoCancel"></span>
                  <div style="flex: 1">
                    <div class="b">保留期结束自动注销</div>
                    <div class="small">默认关闭：D+90 后转人工，需客服确认后执行「确认清除」</div>
                  </div>
                  <span class="tag tag-gy">人工确认</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Tab 3：对账中心（行 841~856） ===== -->
      <div v-show="activeTab === 'recon'">
        <div class="p-hd">
          <span class="pt">对账中心 · 平台应收 vs 实收</span>
          <span class="ph-s">日对账自动校验 · 差异 &lt;0.1% 判定平账</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>对账日期</th>
                  <th class="num">平台应收</th>
                  <th class="num">支付渠道实收</th>
                  <th class="num">差异</th>
                  <th>差异来源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in reconList" :key="row.id">
                  <td>{{ row.date || '--' }}</td>
                  <td class="num">{{ row.receivable == null ? '--' : fmtMoney(row.receivable) }}</td>
                  <td class="num">{{ row.actual == null ? '--' : fmtMoney(row.actual) }}</td>
                  <td class="num" :style="{ color: row.diff && row.diff < 0 ? 'var(--color-warning)' : 'inherit' }">
                    {{ row.diff == null ? '--' : fmtMoney(row.diff) }}
                  </td>
                  <td>{{ row.source || '--' }}</td>
                  <td><span class="tag" :class="reconStatusTag(row.status)">{{ row.statusText || '--' }}</span></td>
                  <td>
                    <span class="btn-t" @click="handleReconStatement(row)">对账单</span>
                    <span v-if="row.status === 'PENDING'" class="btn-t" @click="handleReReconcile(row)">重新对账</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!reconList.length" class="empty">暂无对账记录 · 待接入 GET /platform/billing/reconciliation-daily</div>
        </div>
      </div>

      <!-- ===== Tab 4：增值扣费（行 857~876） ===== -->
      <div v-show="activeTab === 'addon'">
        <div class="p-hd">
          <span class="pt">增值服务扣费流水 <span class="ver-tag">v1.5</span></span>
          <span class="ph-s">存储超额 / API 超额 / 短信包逐笔可查 · ZZ 流水与账单流水 ZD 单号一一对应</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tipbar">
            <span class="ic">i</span>
            <span>
              <b>增值计费口径：</b>存储超额 <b>¥10 / GB / 月</b>（超出套餐配额部分按日出账）· API 超额阶梯单价（本例 ¥50 / 万次）· 短信超量 <b>¥0.10 / 条</b> · AI 超额见「AI 中心 · 计量流水」（按模型单价）。每日 00:05 日切汇总出账，扣费顺序：账户余额 → 欠费挂账；<b>本月增值扣费合计</b>对应运营大盘「收入构成 · 增值扣费」。
            </span>
          </div>

          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th>流水号</th>
                  <th>租户</th>
                  <th>增值项目</th>
                  <th>计费单价</th>
                  <th class="num">本期用量</th>
                  <th class="num">扣费金额</th>
                  <th>扣费方式</th>
                  <th>关联账单</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in addonList" :key="row.id">
                  <td>{{ row.serialNo || '--' }}</td>
                  <td><b>{{ row.tenantName || '--' }}</b></td>
                  <td>
                    <span v-if="row.item" class="tag" :class="addonItemTag(row.item)">{{ row.item }}</span>
                    <span v-else>--</span>
                  </td>
                  <td>{{ row.unitPrice || '--' }}</td>
                  <td class="num">{{ row.usage == null ? '--' : row.usage }}</td>
                  <td class="num"><b>{{ row.amount == null ? '--' : fmtMoney(row.amount) }}</b></td>
                  <td>{{ row.method || '--' }}</td>
                  <td><span v-if="row.relBill" class="btn-t" @click="openDetail({ id: row.relBillId, billNo: row.relBill })">{{ row.relBill }}</span><span v-else>--</span></td>
                  <td>{{ row.time || '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!addonList.length" class="empty">暂无增值扣费流水 · 待接入 GET /platform/billing/addon-charges</div>

          <p class="small mt8">
            对账关系：合并出账时 ZZ 流水金额之和 = 关联 ZD 账单金额；存储超额用量取自「运维 · 存储监控」日切快照，API 超额触发记录见「运维 · 各租户 API 调用量统计」。
          </p>
        </div>
      </div>
    </div>

    <!-- 账单详情弹窗（内容包一层 .zx-scope，行 794 详情/开票） -->
    <el-dialog v-model="detailVisible" title="账单详情" :width="MODAL_W" :close-on-click-modal="false">
      <div v-if="currentDetail" class="zx-scope">
        <div class="g2">
          <span class="fld"><span>账单编号</span><span class="ipt">{{ currentDetail.billNo || currentDetail.reconciliationNo || '--' }}</span></span>
          <span class="fld"><span>租户</span><span class="ipt">{{ currentDetail.tenantName || '--' }}</span></span>
          <span class="fld"><span>账单类型</span><span class="ipt">{{ currentDetail.billType || '--' }}</span></span>
          <span class="fld"><span>金额</span><span class="ipt">{{ currentDetail.amount == null ? '--' : fmtMoney(currentDetail.amount) }}</span></span>
          <span class="fld"><span>支付方式</span><span class="ipt">{{ currentDetail.payMethod || '--' }}</span></span>
          <span class="fld"><span>支付状态</span><span class="ipt">{{ payStatus(currentDetail).text }}</span></span>
          <span class="fld"><span>生成时间</span><span class="ipt">{{ currentDetail.createdAt || '--' }}</span></span>
          <span class="fld"><span>结算周期</span><span class="ipt">{{ currentDetail.period || '--' }}</span></span>
        </div>
      </div>
      <div v-else class="zx-scope">
        <div class="empty">暂无账单详情 · 待接入 GET /platform/reconciliation/:id</div>
      </div>
      <template #footer>
        <span class="btn" @click="detailVisible = false">关闭</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
// 沿用现有结算/对账接口（约束：必须保留现有调用）
import {
  getPlatformReconciliations,
  getPlatformReconciliationDetail,
  getReconciliationStats,
  settleReconciliation,
} from '../api'

const MODAL_W = 'var(--modal-width)'

// ====== Tab 状态 ======
type TabKey = 'flow' | 'arrears' | 'recon' | 'addon'
const activeTab = ref<TabKey>('flow')

// ====== KPI（沿用 getReconciliationStats） ======
const kpi = reactive({
  revenue: null as number | null,
  pending: null as number | null,
  arrears: null as number | null,
})

// ====== Tab1 账单流水（沿用 getPlatformReconciliations） ======
const loadingBill = ref(false)
const billList = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pageBtns = computed<(number | string)[]>(() => {
  const tp = totalPages.value
  const cur = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const arr: (number | string)[] = [1]
  if (cur > 3) arr.push('...')
  const s = Math.max(2, cur - 1)
  const e = Math.min(tp - 1, cur + 1)
  for (let i = s; i <= e; i++) arr.push(i)
  if (cur < tp - 2) arr.push('...')
  arr.push(tp)
  return arr
})
function gotoPage(p: number) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchBillList()
}

// ====== Tab2 欠费管理（无接口：空态 + TODO） ======
const arrearsList = ref<any[]>([])
const selectedArrears = ref<number[]>([])
const arrearsCount = ref(0)

// 欠费处理策略（全局配置，默认态；待接入独立策略接口）
const arrearsPolicy = reactive({
  graceDays: 15,
  retainDays: 90,
  remindNodes: '提前 7 / 3 / 1 天',
  channels: '站内 + 短信',
  autoDowngrade: true,
  autoFreeze: true,
  autoRemind: true,
  autoCancel: false,
})
function toggleArrears(id: number) {
  const i = selectedArrears.value.indexOf(id)
  if (i >= 0) selectedArrears.value.splice(i, 1)
  else selectedArrears.value.push(id)
}
function toggleAllArrears() {
  if (selectedArrears.value.length === arrearsList.value.length) selectedArrears.value = []
  else selectedArrears.value = arrearsList.value.map((r) => r.id)
}

// ====== Tab3 对账中心（无接口：空态 + TODO） ======
const reconList = ref<any[]>([])

// ====== Tab4 增值扣费（无接口：空态 + TODO） ======
const addonList = ref<any[]>([])

// ====== 详情弹窗 ======
const detailVisible = ref(false)
const currentDetail = ref<any>(null)

// ====== 工具 ======
function fmtMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '--'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return '¥' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function billTypeTag(t: string): string {
  if (/AI|超额/.test(t)) return 'tag-p'
  if (/存储|扩容|加购/.test(t)) return 'tag-o'
  return 'tag-b'
}
function payStatus(row: any): { text: string; cls: string } {
  const st = row.payStatus || row.status || ''
  const map: Record<string, { text: string; cls: string }> = {
    PAID: { text: '已支付', cls: 'tag-g' },
    UNPAID: { text: '待支付', cls: 'tag-o' },
    GRACE: { text: '宽限期', cls: 'tag-o' },
    FROZEN: { text: '已冻结·暂停计费', cls: 'tag-r' },
  }
  return map[st] || { text: st || '已支付', cls: 'tag-gy' }
}
function arrearsStageTag(stage: string): string {
  if (/冻结/.test(stage)) return 'tag-r'
  if (/降级/.test(stage)) return 'tag-r'
  if (/保留/.test(stage)) return 'tag-gy'
  return 'tag-o'
}
function addonItemTag(item: string): string {
  if (/AI|API/.test(item)) return 'tag-p'
  return 'tag-o'
}
function reconStatusTag(status: string): string {
  if (status === 'DONE' || status === 'SETTLED') return 'tag-g'
  return 'tag-o'
}

// ====== 数据加载（保留现有调用 + loading/空态/错误处理） ======
async function fetchStats() {
  try {
    const res: any = await getReconciliationStats()
    const d = res?.data?.data || res?.data || res || {}
    kpi.revenue = d.monthlyRevenue ?? null
    kpi.pending = d.pendingAmount ?? null
    kpi.arrears = d.arrearsTenants ?? null
    arrearsCount.value = d.arrearsTenants ?? 0
  } catch {
    /* 接口不可用时保持空态，不填充示例数据 */
  }
}

async function fetchBillList() {
  loadingBill.value = true
  try {
    const res: any = await getPlatformReconciliations({
      page: page.value,
      pageSize: pageSize.value,
    })
    const d = res?.data?.data || res?.data || res || {}
    billList.value = d.records || []
    total.value = d.total || 0
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '账单流水加载失败')
    billList.value = []
    total.value = 0
  } finally {
    loadingBill.value = false
  }
}

async function openDetail(row: any) {
  currentDetail.value = null
  detailVisible.value = true
  try {
    const res: any = await getPlatformReconciliationDetail(row.id)
    currentDetail.value = res?.data?.data || res?.data || res || row
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '账单详情加载失败')
    currentDetail.value = row
  }
}

// ====== 操作（无接口写 TODO） ======
function handleExportStatement() {
  // TODO: 待接入 POST /platform/billing/statement/export（导出对账单）
  ElMessage.info('导出对账单：待接入 POST /platform/billing/statement/export')
}
function handleGenBill() {
  // TODO: 待接入 POST /platform/billing/generate（手动生成账单）
  ElMessage.info('手动生成账单：待接入 POST /platform/billing/generate')
}
function handleInvoice(_row: any) {
  // TODO: 待接入 POST /platform/billing/invoice（开票）
  ElMessage.info('开票：待接入 POST /platform/billing/invoice')
}
function handleBatchUrge() {
  if (!selectedArrears.value.length) {
    ElMessage.warning('请先勾选欠费租户')
    return
  }
  // TODO: 待接入 POST /platform/billing/arrears/urge（批量催缴，站内+短信双通道）
  ElMessage.info('批量催缴：待接入 POST /platform/billing/arrears/urge')
}
function handleExportArrears() {
  // TODO: 待接入 POST /platform/billing/arrears/export（导出欠费清单）
  ElMessage.info('导出欠费清单：待接入 POST /platform/billing/arrears/export')
}
function handleUrge(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/urge（立即催缴）
  ElMessage.info('立即催缴：待接入 POST /platform/billing/arrears/:id/urge')
}
function handleRetain(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/retain（续费挽留）
  ElMessage.info('续费挽留：待接入 POST /platform/billing/arrears/:id/retain')
}
function handleCancel(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/cancel（发起注销）
  ElMessage.warning('发起注销：待接入 POST /platform/billing/arrears/:id/cancel')
}
function handleRecover(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/recover（恢复缴费）
  ElMessage.info('恢复缴费：待接入 POST /platform/billing/arrears/:id/recover')
}
function handleReconStatement(_row: any) {
  // TODO: 待接入 GET /platform/billing/reconciliation-daily/:date/statement（对账单）
  ElMessage.info('对账单：待接入 GET /platform/billing/reconciliation-daily/:date/statement')
}
// 重新对账：沿用现有结算接口（待接入专用 /platform/billing/reconcile）
async function handleReReconcile(row: any) {
  try {
    await settleReconciliation(row.id)
    ElMessage.success('已提交重新对账（沿用结算接口，待接入专用 reconcile 端点）')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '重新对账失败')
  }
}

onMounted(() => {
  fetchStats()
  fetchBillList()
})
</script>
