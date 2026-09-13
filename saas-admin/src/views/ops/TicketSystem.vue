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
      <span>{{ error }}（接口待对接，当前展示空态）</span>
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
              <span class="tag tag-gy">{{ card.plan }}</span>
            </div>
            <div class="kt">{{ card.title }}</div>
            <div class="kmeta">
              <span>{{ card.tenant }}</span>
              <span>{{ card.code }}</span>
              <span>{{ card.time }}</span>
            </div>
            <div class="sla" :class="card.slaTone">
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
                <div><span class="tag tag-b">{{ detail.plan }}</span> SLA 保障</div>
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

          <!-- 关联入口：代登录 / 知识库（接口未接入 → 置灰禁用 + 诚实提示） -->
          <div class="d-links mt8">
            <span class="btn is-off" aria-disabled="true" @click="handleImpersonate"
              >关联代登录</span
            >
            <span class="btn is-off" aria-disabled="true" @click="handleKnowledge">知识库</span>
          </div>

          <!-- 对话时间线（设计稿 1733~1738 行） -->
          <p class="b mt12 tl-title">对话时间线</p>
          <div class="mt8">
            <!-- 时间线接口未接入：恒为空数组 → 空态，不虚构任何对话内容/处理人 -->
            <div v-if="!timeline.length" class="empty tl-empty">
              暂无对话记录 · 待接入 GET /platform/support/tickets/{id}/timeline
            </div>
            <div v-for="item in timeline" :key="item.id" class="tl-row">
              <span class="ava" :class="item.avaTone">{{ item.avatarText }}</span>
              <div class="tl-bub" :class="item.bubbleTone">
                {{ item.content }}
                <span class="small tl-meta">{{ item.meta }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部状态流转（设计稿 1740 行，文案照抄；接口未接入 → 置灰禁用 + 诚实提示） -->
        <div class="d-ft">
          <span class="btn btn-p is-off" aria-disabled="true" @click="handleReply">回复租户</span>
          <span class="btn is-off" aria-disabled="true" @click="handleTransfer">转交 / 改派</span>
          <span class="btn btn-s is-off" aria-disabled="true" @click="handleResolve">标记解决</span>
          <span class="btn btn-d is-off" aria-disabled="true" @click="handleCloseTicket"
            >关闭工单</span
          >
        </div>
      </aside>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

/* ── 类型：看板卡片（字段全部来自接口，当前不虚构任何示例值） ── */
interface TicketCard {
  id: number | string
  /** 工单类别：故障 / 账单问题 / 功能问题 / 使用咨询 */
  category: string
  /** 类别色板：故障=红(r) · 账单问题=橙(o) · 功能问题=蓝(b) · 使用咨询=紫(p) */
  catTone: 'tag-r' | 'tag-o' | 'tag-b' | 'tag-p'
  /** 套餐档位：旗舰版 / 标准版 / 基础版 / 免费版 */
  plan: string
  /** 标题 */
  title: string
  /** 租户名 */
  tenant: string
  /** 工单单号 */
  code: string
  /** 提交时间 */
  time: string
  /** SLA 条色：充足(空=绿) / 预警(w=橙) / 紧急(r=红) */
  slaTone: '' | 'w' | 'r'
  /** SLA 剩余比例 0~100 */
  slaPercent: number
  /** SLA 文案：如「首响 SLA 剩 1h12m · 已分配：何斌」 */
  slaText: string
}

interface TicketColumn {
  key: 'pending' | 'processing' | 'resolved'
  title: string
  cards: TicketCard[]
}

/* ── 类型：工单详情（字段一律取自被点击的看板卡片，取不到显示 —） ── */
interface TicketDetail {
  id: TicketCard['id']
  /** 工单单号（设计稿 d-hd 标题） */
  code: string
  category: string
  catTone: TicketCard['catTone']
  tenant: string
  plan: string
  time: string
  /** 解决 SLA 文案；详情接口应返回独立字段，当前回退到卡片 SLA 文案 */
  resolveSla: string
  slaTone: TicketCard['slaTone']
  /** 问题描述；卡片暂无该字段，当前回退到卡片标题 */
  description: string
}

/* ── 类型：对话时间线条目（字段全部来自接口，接入前数组为空） ── */
interface TimelineItem {
  id: string
  /** 头像文字（取姓名首字），由接口下发 */
  avatarText: string
  /** 头像色板：租户=紫 / 客服=主色 / 内部记录=灰 */
  avaTone: 'ava-p' | 'ava-gy' | ''
  /** 气泡样式：租户=灰底 / 公开回复=蓝底蓝框 / 内部备注=橙底橙虚线框 */
  bubbleTone: 'tl-ten' | 'tl-pub' | 'tl-int'
  content: string
  /** 署名时间（由接口下发，含角色 / 时间 / 可见范围） */
  meta: string
}

/** 字段缺失占位符 */
const dash = '—'

/* ── 三列结构（列标题为设计稿结构，卡片初始为空数组 → 空态） ── */
const columns = ref<TicketColumn[]>([
  { key: 'pending', title: '待处理', cards: [] },
  { key: 'processing', title: '处理中', cards: [] },
  { key: 'resolved', title: '已解决（近7天）', cards: [] },
])

/* ── 页头概览（接口未接入时以占位符展示，不写死具体数值） ── */
const summary = ref<{
  todayNew: string
  myTodo: string
  overtimeWarn: string
  avgFirstResp: string
}>({
  todayNew: '--',
  myTodo: '--',
  overtimeWarn: '--',
  avgFirstResp: '--',
})

const loading = ref(false)
const error = ref('')
const onlyMine = ref(false)

function toggleOnlyMine() {
  onlyMine.value = !onlyMine.value
  // TODO: 待接入接口后，将 onlyMine 作为请求参数重新拉取分组数据
  load()
}

function handleReport() {
  // TODO: 待接入工单服务报表导出 / 跳转报表页（建议 GET /platform/support/tickets/report）
  ElMessage.info('服务报表接口待对接（GET /platform/support/tickets/report）')
}

/* ── 详情抽屉状态 ── */
const detail = ref<TicketDetail | null>(null)
/** 对话时间线：接口未接入 → 恒为空数组，展示空态 */
const timeline = ref<TimelineItem[]>([])

/** 接口未接入的诚实提示：不模拟任何成功结果 */
function notReady(action: string, method: string, path: string) {
  ElMessage.info(`${action}：待接入 ${method} ${path}`)
}

function openDetail(card: TicketCard) {
  // 详情字段全部取自被点击的卡片（真实接口数据），取不到的以 — 占位
  detail.value = {
    id: card.id,
    code: card.code || dash,
    category: card.category || dash,
    catTone: card.catTone,
    tenant: card.tenant || dash,
    plan: card.plan || dash,
    time: card.time || dash,
    resolveSla: card.slaText || dash,
    slaTone: card.slaTone,
    description: card.title || dash,
  }
  // TODO: 待接入 GET /platform/support/tickets/{id}/timeline，返回后填充 timeline
  // （每条需标记 bubbleTone：公开回复=tl-pub / 内部备注=tl-int / 租户留言=tl-ten）
  timeline.value = []
}

function closeDetail() {
  detail.value = null
  timeline.value = []
}

/* 底部状态流转（设计稿 1740 行）：待接口接入后改为真实 POST 并刷新看板 */
function handleReply() {
  notReady('回复租户', 'POST', '/platform/support/tickets/{id}/reply')
}
function handleTransfer() {
  notReady('转交 / 改派', 'POST', '/platform/support/tickets/{id}/transfer')
}
function handleResolve() {
  notReady('标记解决', 'POST', '/platform/support/tickets/{id}/resolve')
}
function handleCloseTicket() {
  notReady('关闭工单', 'POST', '/platform/support/tickets/{id}/close')
}

/* 关联入口：代登录授权 / 知识库推荐 */
function handleImpersonate() {
  notReady('关联代登录', 'GET', '/platform/support/tickets/{id}/impersonation')
}
function handleKnowledge() {
  notReady('知识库', 'GET', '/platform/support/tickets/{id}/kb-suggestions')
}

/* ── 数据加载：无对应接口时保留 loading/空态/错误处理骨架 ── */
async function load() {
  loading.value = true
  error.value = ''
  try {
    // TODO: 待接入 GET /platform/support/tickets（按状态分组返回 待处理/处理中/已解决）
    // 建议响应：{ pending: TicketCard[], processing: TicketCard[], resolved: TicketCard[], summary: {...} }
    // 对接时改用 src/api 层封装（原 `import { api } from '../api'` 指向不存在的 src/views/api，已删除）：
    // const res = await request.get('/platform/support/tickets', { params: { onlyMine: onlyMine.value } })
    // const d = res?.data?.data || {}
    // columns.value = mapToColumns(d)
    // summary.value = { todayNew: d.summary?.todayNew ?? '--', ... }
  } catch {
    error.value = '工单数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
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

/* 接口未接入 → 按钮置灰禁用（仍可点击，仅给出待接入提示） */
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
