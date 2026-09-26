<template>
  <div>
    <!-- ① 页头（设计稿 sec-ticket .pg-hd）：标题 + 概览文案 ｜ 右侧操作 -->
    <div class="pg-hd">
      <div>
        <div class="pt4">工单系统</div>
        <p class="pd">
          今日新增 {{ summary.todayNew }} · 我的待办 {{ summary.myTodo }} · 今日超时预警
          {{ summary.overtimeWarn }} · 平均首响 {{ summary.avgFirstResp }}
        </p>
        <!-- 口径诚实标注：上面四项指标后端暂无数据源（服务报表口径待定义）⇒ 显示 —；
             下面四项为后端看板接口的真实计数 -->
        <p class="small">
          看板实时计数：待处理 {{ boardCounts.pending }} · 处理中 {{ boardCounts.processing }} · 已解决
          {{ boardCounts.resolved }} · 已关闭 {{ boardCounts.closed }}（今日新增 / 今日超时预警 / 平均首响三项后端暂无数据源，显示 —）
        </p>
      </div>
      <div class="pg-act">
        <!-- 筛选器：只看我的 / 全部（设计稿 .sel「只看我的 ▾」） -->
        <span class="sel" style="cursor: pointer" @click="toggleOnlyMine">
          {{ onlyMine ? '只看我的' : '全部工单' }}
        </span>
        <!-- 服务报表（设计稿 .btn） -->
        <span class="btn" @click="handleReport">服务报表</span>
      </div>
    </div>

    <!-- 加载/错误态 -->
    <div v-if="error" class="tipbar r mt8">
      <span class="ic">!</span>
      <span>{{ error }}（本次展示空态）</span>
    </div>

    <!-- ② 看板（设计稿 .kan / .kan-col / .kan-hd / .kcard / .sla） -->
    <div class="kan mt12">
      <div v-for="col in columns" :key="col.key" class="kan-col">
        <div class="kan-hd">
          <span>{{ col.title }}</span>
          <span class="cnt">{{ col.cards.length }}</span>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="empty">加载中…</div>
        <!-- 空态（设计稿示例工单不写入，统一空态） -->
        <div v-else-if="!col.cards.length" class="empty">暂无工单</div>

        <!-- 工单卡片 -->
        <template v-else>
          <div
            v-for="card in col.cards"
            :key="card.id"
            class="kcard"
            @click="openDetail(card)"
          >
            <div class="kcard-tags">
              <span class="tag" :class="card.catTone">{{ card.category }}</span>
              <span class="tag tag-gy">{{ card.priorityLabel }}</span>
            </div>
            <div class="kt">{{ card.title }}</div>
            <div class="kmeta">
              <span>{{ card.tenant }}</span>
              <span>{{ card.code }}</span>
              <span>{{ card.time }}</span>
            </div>
            <!-- SLA 条：后端 t_support_ticket 无 SLA 字段（恒无值）⇒ 无数据源时不渲染进度条，只留诚实文案 -->
            <div v-if="card.hasSla" class="sla" :class="card.slaTone">
              <i :style="{ width: card.slaPercent + '%' }"></i>
            </div>
            <p class="small sla-note">{{ card.slaText }}</p>
          </div>
        </template>
      </div>
    </div>

    <!-- ③ 工单详情抽屉（设计稿「工单详情叠加」1722~1742 行：遮罩 + 472px 右侧抽屉） -->
    <template v-if="detail">
      <!-- 内容包一层 .zx-scope：复用 components.css 的 .panel/.p-bd/.tag/.btn/.small/.b 组件类 -->
      <div class="ov" @click="closeDetail"></div>
      <aside class="drawer zx-scope">
        <!-- 标题 = 工单号 + 分类 tag，右侧 ✕ 关闭 -->
        <div class="d-hd">
          <span class="pt"
            >{{ detail.code
            }}<span class="tag" :class="detail.catTone">{{ detail.category }}</span></span
          >
          <span class="d-x" @click="closeDetail">✕</span>
        </div>

        <div class="d-bd">
          <!-- 概况（设计稿 1728~1731 行）：两列网格，问题描述跨两列 -->
          <div class="panel">
            <div class="p-bd d-grid">
              <div>
                <span class="small">租户</span>
                <div class="b">{{ detail.tenant }}</div>
              </div>
              <div>
                <span class="small">套餐</span>
                <div><span class="tag tag-gy">{{ detail.plan }}</span>（后端工单表无套餐字段，显示 —）</div>
              </div>
              <div>
                <span class="small">提交时间</span>
                <div>{{ detail.time }}</div>
              </div>
              <div>
                <span class="small">解决 SLA</span>
                <div :class="{ 'd-danger': detail.slaTone === 'r' }">{{ detail.resolveSla }}</div>
              </div>
              <div class="d-span2">
                <span class="small">问题描述</span>
                <div>{{ detail.description }}</div>
              </div>
            </div>
          </div>

          <!-- 关联入口：代登录 / 知识库（后端无对应端点：platform-ticket 路由测试显式断言不含
               impersonation / kb-suggestions ⇒ 置灰禁用 + 诚实提示，不接线） -->
          <div class="d-links mt8">
            <span class="btn is-off" aria-disabled="true" @click="handleImpersonate"
              >关联代登录</span
            >
            <span class="btn is-off" aria-disabled="true" @click="handleKnowledge">知识库</span>
          </div>

          <!-- 对话时间线（设计稿 1733~1738 行） -->
          <p class="b mt12 tl-title">对话时间线</p>
          <div class="mt8">
            <div v-if="detailLoading" class="empty tl-empty">加载中…</div>
            <!-- 时间线为空 ⇒ 空态，不虚构任何对话内容/处理人 -->
            <div v-else-if="!timeline.length" class="empty tl-empty">暂无对话记录</div>
            <template v-else>
              <div v-for="item in timeline" :key="item.id" class="tl-row">
                <span class="ava" :class="item.avaTone">{{ item.avatarText }}</span>
                <div class="tl-bub" :class="item.bubbleTone">
                  {{ item.content }}
                  <span class="small tl-meta">{{ item.meta }}</span>
                </div>
              </div>
            </template>
            <div v-if="detailNotice" class="tipbar r">{{ detailNotice }}</div>
            <p class="small mt8">
              SLA 与数据范围档位口径待定义（后端工单表无 SLA / 数据范围字段），本面板不展示近似值。
            </p>
          </div>
        </div>

        <!-- 底部状态流转（设计稿 1740 行，文案照抄；已接线到后端真实端点） -->
        <div class="d-ft">
          <div v-if="actionNotice" class="tipbar r">
            <span class="ic">!</span>
            <span>{{ actionNotice }}</span>
          </div>
          <span class="btn btn-p" @click="handleReply">回复租户</span>
          <span class="btn" @click="handleTransfer">转交 / 改派</span>
          <span class="btn btn-s" @click="handleResolve">标记解决</span>
          <span class="btn btn-d" @click="handleCloseTicket">关闭工单</span>
        </div>
      </aside>
    </template>

    <!-- ④ 服务报表抽屉：后端口径未定 ⇒ 渲染「口径待定义」显式空态，不造数、不省略 definitionPending 提示 -->
    <template v-if="report.open">
      <div class="ov" @click="closeReport"></div>
      <aside class="drawer zx-scope">
        <div class="d-hd">
          <span class="pt">服务报表</span>
          <span class="d-x" @click="closeReport">✕</span>
        </div>
        <div class="d-bd">
          <div v-if="report.loading" class="empty">加载中…</div>
          <template v-else>
            <div v-if="report.definitionPending" class="tipbar w">
              <span class="ic">i</span>
              <span>报表口径待定义：后端服务报表端点已上线，但统计口径尚未确定（definitionPending = true），本面板不展示任何近似指标。</span>
            </div>
            <div v-if="report.error" class="tipbar r mt8">
              <span class="ic">!</span>
              <span>{{ report.error }}</span>
            </div>
            <div v-if="!report.items.length" class="empty tl-empty mt8">暂无报表数据（口径待定义）</div>
            <template v-else>
              <div v-for="(row, i) in report.items" :key="i" class="small">{{ row }}</div>
            </template>
          </template>
        </div>
        <div class="d-ft">
          <span class="btn" @click="closeReport">关闭</span>
        </div>
      </aside>
    </template>

    <!-- 分类字典空态提示（工单类型未配置时卡片分类显示 — 而非臆造名称） -->
    <p v-if="!loading && !error && categories.length === 0" class="small">
      工单类型未配置（分类显示 —）；后端另有「工单类型配置」端点，本页暂无配置入口。
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  closeSupportTicket,
  getSupportTicket,
  getSupportTicketReport,
  getSupportTicketTimeline,
  listSupportTickets,
  listTicketCategories,
  replySupportTicket,
  resolveSupportTicket,
  transferSupportTicket,
} from '../../api'
import { pickBackendMessage } from '../../utils/http-error'

/* ── 类型：看板卡片（字段全部来自接口；后端无对应列的一律显示 —，不虚构示例值） ── */
interface TicketCard {
  id: number | string
  /** 工单类别名（由 GET /ticket-categories 的 id→name 映射得到；未配置类型显示 —） */
  category: string
  /** 类别色板：故障类=红(r) · 账单类=橙(o) · 功能类=蓝(b) · 咨询类=紫(p) · 未匹配=灰(gy) */
  catTone: 'tag-r' | 'tag-o' | 'tag-b' | 'tag-p' | 'tag-gy'
  /** 优先级原文（后端 priority 字段；无值显示 —） */
  priorityLabel: string
  /** 标题 */
  title: string
  /** 租户标识（后端 TicketCard 只给 tenantId，不 JOIN 租户名） */
  tenant: string
  /** 工单单号 */
  code: string
  /** 提交时间 */
  time: string
  /** 是否有 SLA 数据（后端工单表无 SLA 字段 ⇒ 恒 false，进度条不渲染） */
  hasSla: boolean
  /** SLA 条色：充足(空=绿) / 预警(w=橙) / 紧急(r=红) */
  slaTone: '' | 'w' | 'r'
  /** SLA 剩余比例 0~100 */
  slaPercent: number
  /** SLA 文案（当前恒为「口径待定义」诚实标注） */
  slaText: string
  /** 后端状态原文（PENDING/PROCESSING/RESOLVED/CLOSED） */
  statusRaw: string
}

interface TicketColumn {
  key: 'pending' | 'processing' | 'resolved'
  title: string
  cards: TicketCard[]
}

/* ── 类型：工单详情（概况来自详情接口，取不到显示 —） ── */
interface TicketDetail {
  id: TicketCard['id']
  /** 工单单号（设计稿 d-hd 标题） */
  code: string
  category: string
  catTone: TicketCard['catTone']
  tenant: string
  /** 套餐：后端工单表无该字段 ⇒ 恒 — */
  plan: string
  time: string
  /** 解决 SLA 文案（后端无 SLA 字段 ⇒ 口径待定义） */
  resolveSla: string
  slaTone: TicketCard['slaTone']
  /** 问题描述（来自详情接口 description；为空显示 —） */
  description: string
}

/* ── 类型：对话时间线条目（字段全部来自详情时间线接口） ── */
interface TimelineItem {
  id: string
  /** 头像文字（取署名人首字） */
  avatarText: string
  /** 头像色板：租户=紫 / 客服=主色 / 内部记录=灰 */
  avaTone: 'ava-p' | 'ava-gy' | ''
  /** 气泡样式：租户=灰底 / 公开回复=蓝底蓝框 / 内部备注=橙底橙虚线框 */
  bubbleTone: 'tl-ten' | 'tl-pub' | 'tl-int'
  content: string
  /** 署名时间（含角色 / 时间 / 可见范围） */
  meta: string
}

/** 字段缺失占位符 */
const dash = '—'

/** 分类关键字 → 色板（设计稿四类；名称来自后端类型配置，匹配不上即中性灰） */
const CATEGORY_TONES: Array<[string, TicketCard['catTone']]> = [
  ['故障', 'tag-r'],
  ['账单', 'tag-o'],
  ['功能', 'tag-b'],
  ['咨询', 'tag-p'],
]

/** 时间戳展示：取 'YYYY-MM-DD HH:mm'；无值显示 —（不造时间） */
function showTime(v: any): string {
  return v ? String(v).replace('T', ' ').slice(0, 16) : dash
}

/* ── 三列结构（列标题为设计稿结构，卡片初始为空数组 → 空态） ── */
const columns = ref<TicketColumn[]>([
  { key: 'pending', title: '待处理', cards: [] },
  { key: 'processing', title: '处理中', cards: [] },
  { key: 'resolved', title: '已解决', cards: [] },
])

/* ── 页头概览：后端无「今日新增 / 我的待办 / 超时预警 / 平均首响」数据源 ⇒ 恒 —（不写死数值） ── */
const summary = ref<{
  todayNew: string
  myTodo: string
  overtimeWarn: string
  avgFirstResp: string
}>({
  todayNew: dash,
  myTodo: dash,
  overtimeWarn: dash,
  avgFirstResp: dash,
})

/** 看板四态真实计数（来自 GET /tickets 的 summary，全量计数、不受分页影响） */
const boardCounts = ref({ pending: 0, processing: 0, resolved: 0, closed: 0 })
/** 工单类型（id → name），用于把 categoryId 显示成类型名；未配置 ⇒ 空数组 */
const categories = ref<Array<{ id: number; name: string }>>([])

const loading = ref(false)
const error = ref('')
const onlyMine = ref(false)

function toggleOnlyMine() {
  onlyMine.value = !onlyMine.value
  // 只看我的 ⇒ 重新拉取（后端 onlyMine=true 且无管理员身份时显式 400，不静默降级）
  load()
}

/** 服务报表抽屉状态（后端 definitionPending 必须显式呈现） */
const report = ref<{ open: boolean; loading: boolean; items: any[]; definitionPending: boolean; error: string }>({
  open: false,
  loading: false,
  items: [],
  definitionPending: false,
  error: '',
})

async function handleReport() {
  report.value = { open: true, loading: true, items: [], definitionPending: false, error: '' }
  try {
    const res: any = await getSupportTicketReport()
    const d = res?.data?.data ?? {}
    report.value = {
      open: true,
      loading: false,
      items: Array.isArray(d.items) ? d.items : [],
      definitionPending: d.definitionPending === true,
      error: '',
    }
  } catch {
    report.value = { open: true, loading: false, items: [], definitionPending: false, error: '服务报表加载失败' }
  }
}

function closeReport() {
  report.value = { open: false, loading: false, items: [], definitionPending: false, error: '' }
}

/* ── 详情抽屉状态 ── */
const detail = ref<TicketDetail | null>(null)
const detailLoading = ref(false)
const detailNotice = ref('')
const actionNotice = ref('')
/** 对话时间线：来自 GET /tickets/:id/timeline（平台视角含内部备注），空即空态 */
const timeline = ref<TimelineItem[]>([])

/** 分类名（id → name；未配置类型时返回 —，不臆造名称） */
function categoryName(categoryId: any): string {
  const hit = categories.value.find((c) => c.id === Number(categoryId))
  return hit?.name ?? dash
}

function categoryTone(name: string): TicketCard['catTone'] {
  const hit = CATEGORY_TONES.find(([keyword]) => name.includes(keyword))
  return hit ? hit[1] : 'tag-gy'
}

/** 后端工单行 → 看板卡片 */
function toTicketCard(row: any): TicketCard {
  const category = categoryName(row?.categoryId)
  return {
    id: row?.id,
    category,
    catTone: category === dash ? 'tag-gy' : categoryTone(category),
    priorityLabel: row?.priority == null || row.priority === '' ? dash : String(row.priority),
    title: row?.title ?? dash,
    tenant: row?.tenantId == null ? dash : String(row.tenantId),
    code: row?.ticketNo ?? dash,
    time: showTime(row?.createdAt),
    hasSla: false,
    slaTone: '',
    slaPercent: 0,
    slaText: 'SLA 口径待定义（后端工单表无 SLA 字段）',
    statusRaw: String(row?.status ?? ''),
  }
}

async function openDetail(card: TicketCard) {
  // 先用卡片真实数据渲染，再以详情接口校正（避免空窗期，也不虚构字段）
  detail.value = {
    id: card.id,
    code: card.code || dash,
    category: card.category || dash,
    catTone: card.catTone,
    tenant: card.tenant || dash,
    plan: dash,
    time: card.time || dash,
    resolveSla: '口径待定义',
    slaTone: card.slaTone,
    description: dash,
  }
  timeline.value = []
  detailNotice.value = ''
  actionNotice.value = ''
  await loadDetail(card.id)
}

/** 拉取工单详情 + 对话时间线（GET /tickets/:id 与 GET /tickets/:id/timeline） */
async function loadDetail(id: TicketCard['id']) {
  detailLoading.value = true
  try {
    const [dRes, tRes] = await Promise.all([
      getSupportTicket(id),
      getSupportTicketTimeline(id),
    ])
    const d = (dRes as any)?.data?.data
    if (d) {
      const category = categoryName(d.categoryId)
      detail.value = {
        id: d.id ?? id,
        code: d.ticketNo ?? detail.value?.code ?? dash,
        category,
        catTone: category === dash ? 'tag-gy' : categoryTone(category),
        tenant: d.tenantId == null ? dash : String(d.tenantId),
        plan: dash,
        time: showTime(d.createdAt),
        resolveSla: '口径待定义',
        slaTone: '',
        description: d.description ? String(d.description) : dash,
      }
    }
    const items = (tRes as any)?.data?.data?.items
    timeline.value = (Array.isArray(items) ? items : []).map(toTimelineItem)
  } catch {
    detailNotice.value = '详情 / 对话时间线加载失败'
  } finally {
    detailLoading.value = false
  }
}

/** 时间线条目：bubbleType(PUBLIC/INTERNAL/TENANT) 决定气泡与头像色 */
function toTimelineItem(row: any): TimelineItem {
  const bubble = String(row?.bubbleType ?? '')
  const sender = row?.senderName ? String(row.senderName) : String(row?.senderType ?? '')
  const meta = [sender || dash, showTime(row?.createdAt), bubble === 'INTERNAL' ? '内部备注（租户不可见）' : '']
    .filter(Boolean)
    .join(' · ')
  return {
    id: String(row?.id),
    avatarText: (sender || dash).slice(0, 1),
    avaTone: bubble === 'INTERNAL' ? 'ava-gy' : bubble === 'PUBLIC' ? '' : 'ava-p',
    bubbleTone: bubble === 'INTERNAL' ? 'tl-int' : bubble === 'PUBLIC' ? 'tl-pub' : 'tl-ten',
    content: String(row?.content ?? ''),
    meta,
  }
}

function closeDetail() {
  detail.value = null
  timeline.value = []
  detailNotice.value = ''
  actionNotice.value = ''
}

/* ── 底部状态流转（设计稿 1740 行）：真实 POST 到已上线端点，成功后刷新详情/看板 ── */

/** 取消/关闭弹窗的拒绝原因（ElMessageBox 以字符串 'cancel'/'close' 拒绝），不算失败 */
function isCancelled(e: any): boolean {
  return e === 'cancel' || e === 'close'
}

async function refreshAfterAction() {
  await load()
  const id = detail.value?.id
  if (id != null) await loadDetail(id)
}

async function handleReply() {
  const id = detail.value?.id
  if (id == null) return
  actionNotice.value = ''
  try {
    const { value } = await ElMessageBox.prompt('回复内容（对租户公开可见）', '回复租户', {
      inputType: 'textarea',
      inputValidator: (v: string) => (v && v.trim() ? true : '回复内容不能为空'),
      confirmButtonText: '发送',
      cancelButtonText: '取消',
    })
    await replySupportTicket(id, String(value).trim())
    ElMessage.success('已回复租户')
    await refreshAfterAction()
  } catch (e: any) {
    if (isCancelled(e)) return
    actionNotice.value = pickBackendMessage(e?.response?.data) || '回复失败'
  }
}

async function handleTransfer() {
  const id = detail.value?.id
  if (id == null) return
  actionNotice.value = ''
  try {
    const { value } = await ElMessageBox.prompt('受理人平台管理员 ID（数字；后端按 assigneeId 改派并留痕）', '转交 / 改派', {
      inputValidator: (v: string) => (/^\d+$/.test(String(v ?? '').trim()) && Number(v) > 0 ? true : '请输入正整数管理员 ID'),
      confirmButtonText: '转交',
      cancelButtonText: '取消',
    })
    await transferSupportTicket(id, Number(String(value).trim()))
    ElMessage.success('已转交')
    await refreshAfterAction()
  } catch (e: any) {
    if (isCancelled(e)) return
    actionNotice.value = pickBackendMessage(e?.response?.data) || '转交失败'
  }
}

async function handleResolve() {
  const id = detail.value?.id
  if (id == null) return
  actionNotice.value = ''
  try {
    await ElMessageBox.confirm('确认将该工单标记为已解决？', '标记解决', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await resolveSupportTicket(id)
    ElMessage.success('已标记解决')
    await refreshAfterAction()
  } catch (e: any) {
    if (isCancelled(e)) return
    actionNotice.value = pickBackendMessage(e?.response?.data) || '标记解决失败'
  }
}

async function handleCloseTicket() {
  const id = detail.value?.id
  if (id == null) return
  actionNotice.value = ''
  try {
    await ElMessageBox.confirm('确认关闭该工单？（仅「已解决」状态可关闭）', '关闭工单', {
      confirmButtonText: '确认关闭',
      cancelButtonText: '取消',
    })
    await closeSupportTicket(id)
    ElMessage.success('工单已关闭')
    await refreshAfterAction()
  } catch (e: any) {
    if (isCancelled(e)) return
    actionNotice.value = pickBackendMessage(e?.response?.data) || '关闭工单失败'
  }
}

/* 关联入口：代登录授权 / 知识库推荐 —— 后端无对应端点（路由测试显式断言不含），保持禁用 + 诚实提示 */
function handleImpersonate() {
  ElMessage.info('关联代登录：后端无该端点（工单域只含 10 条已上线端点），未接入')
}
function handleKnowledge() {
  ElMessage.info('知识库推荐：后端无该端点（工单域只含 10 条已上线端点），未接入')
}

/* ── 数据加载：GET /api/platform/support/tickets（分组看板 + 四态计数） ── */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await listSupportTickets({ onlyMine: onlyMine.value, page: 1, pageSize: 50 })
    const d = res?.data?.data ?? {}
    const groups = d.groups ?? {}
    columns.value = columns.value.map((col) => {
      const rows = groups[col.key]
      return { ...col, cards: (Array.isArray(rows) ? rows : []).map(toTicketCard) }
    })
    const s = d.summary ?? {}
    boardCounts.value = {
      pending: Number(s.pending ?? 0),
      processing: Number(s.processing ?? 0),
      resolved: Number(s.resolved ?? 0),
      closed: Number(s.closed ?? 0),
    }
  } catch {
    error.value = '工单数据加载失败'
    columns.value = columns.value.map((col) => ({ ...col, cards: [] }))
    boardCounts.value = { pending: 0, processing: 0, resolved: 0, closed: 0 }
  } finally {
    loading.value = false
  }
}

/** 工单类型字典：用于把 categoryId 显示为类型名（零预置 ⇒ 空数组，不造内置类型） */
async function loadCategories() {
  try {
    const res: any = await listTicketCategories()
    const list = res?.data?.data?.categories
    categories.value = (Array.isArray(list) ? list : []).map((c: any) => ({ id: Number(c?.id), name: String(c?.name ?? '') }))
  } catch {
    categories.value = []
  }
}

onMounted(async () => {
  // 先取类型字典再取看板，保证卡片分类名一次渲染到位（字典为空则分类显示 —）
  await loadCategories()
  await load()
})
</script>

<style scoped>
/* 页面级样式仅使用 design token 组合，不写死任何色值/字号/间距/圆角 */
.kcard-tags {
  display: flex;
  gap: var(--tag-gap);
  flex-wrap: wrap;
}
.sla-note {
  margin-top: var(--space-1);
}

/* ─────────────────────────────────────────────────────────────
   工单详情抽屉（设计稿「工单详情叠加」1722~1742 行）
   components.css 未移植 .ov/.drawer/.d-hd/.d-bd/.d-ft/.d-x/.ava，
   故按 design token 在组件内局部实现（同 LibrarySpus.vue 弹窗局部实现写法）。
   颜色/间距/字号/圆角一律引用 tokens.css 变量，不写死字面量。
   抽屉宽度取设计稿 1725 行 inline width:472px（--drawer-width=436px 为通用值）。
   ──────────────────────────────────────────────────────────── */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 30;
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 472px;
  max-width: 92%;
  background: var(--bg-card);
  z-index: 31;
  box-shadow: var(--drawer-shadow);
  display: flex;
  flex-direction: column;
}
.d-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.d-hd .pt {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.d-hd .tag {
  margin-left: var(--space-1);
}
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.d-x:hover {
  background: var(--g0);
  color: var(--g6);
}
.d-bd {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
}
.d-ft {
  flex: none;
  border-top: 1px solid var(--g2);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  background: var(--bg-card);
}
/* 抽屉底部提示条占满整行（错误/业务提示不挤在按钮之间） */
.d-ft .tipbar {
  flex: 1 1 100%;
}

/* 概况两列网格（设计稿 1728 行 grid-template-columns:1fr 1fr; gap:8px 12px） */
.d-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}
.d-grid .small {
  display: block;
  margin-bottom: var(--space-1);
}
.d-span2 {
  grid-column: 1 / -1;
}
/* 解决 SLA 超时（卡片 slaTone=r）用危险色，对齐设计稿 1730 行红色文案 */
.d-danger {
  color: var(--color-danger);
}
.d-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* 后端无对应端点的入口置灰禁用（仍可点击，只给诚实提示）——
   当前仅「关联代登录 / 知识库」两项：工单域已上线的 10 条端点不含它们（路由测试显式断言） */
.zx-scope .btn.is-off {
  color: var(--g4);
  background: var(--g0);
  border-color: var(--g2);
  cursor: not-allowed;
}
.zx-scope .btn.is-off:hover {
  border-color: var(--g2);
}

/* 对话时间线（设计稿 1733~1738 行） */
.tl-title {
  font-size: var(--text-sm);
}
.zx-scope .tl-empty {
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--g2);
  border-radius: var(--radius-lg);
}
.tl-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
/* 头像圆（设计稿 .ava 28px 圆形） */
.ava {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-size: var(--text-sm);
  display: grid;
  place-items: center;
  flex: none;
}
.ava-p {
  background: var(--color-purple);
}
.ava-gy {
  background: var(--g1);
  color: var(--g7);
}
.tl-bub {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}
.tl-bub .tl-meta {
  display: block;
  margin-top: var(--space-1);
}
/* 租户留言：灰底（设计稿 --g0） */
.tl-ten {
  background: var(--g0);
}
/* 公开回复：蓝底蓝框（设计稿 --blue-l / --blue-b） */
.tl-pub {
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-soft);
}
/* 内部备注：黄底橙色虚线框（设计稿 #fffbeb / #fcd34d / #92400e） */
.tl-int {
  background: var(--color-warning-soft);
  border: 1px dashed var(--warning-line);
  color: var(--warning-text);
}
</style>
