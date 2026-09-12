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

function openDetail(card: TicketCard) {
  // TODO: 点击卡片展开工单详情抽屉（设计稿交互态 .drawer）；详情接口待接入
  // 当前卡片数据为空，交互态预留，不虚构内容
  void card
  ElMessage.info('工单详情接口待对接（GET /platform/support/tickets/:id）')
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
</style>
