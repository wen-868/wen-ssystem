<template>
  <div>
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">租户管理</div>
        <p class="pd">共 {{ total }} 条记录 · 只管理元数据与状态阀门，不触碰租户业务数据</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="onExportList">导出列表</span>
        <span class="btn" @click="onBatch">批量操作 ▾</span>
        <span class="btn btn-p" @click="onCreate">+ 新建租户</span>
      </div>
    </div>

    <!-- ════════ 面板：状态页签 + 筛选 + 表格 + 分页 ════════ -->
    <div class="panel">
      <div class="panel-filter">
        <div class="tabs">
          <span class="tab" :class="{ on: activeTab === 'all' }" @click="onTab('all')">全部 {{ total }}</span>
          <span class="tab" :class="{ on: activeTab === 'normal' }" @click="onTab('normal')">正常 {{ countText(statusCounts.normal) }}</span>
          <span class="tab" :class="{ on: activeTab === 'owed' }" @click="onTab('owed')">欠费 <span class="n">{{ countText(statusCounts.owed) }}</span></span>
          <span class="tab" :class="{ on: activeTab === 'frozen' }" @click="onTab('frozen')">冻结 <span class="n">{{ countText(statusCounts.frozen) }}</span></span>
          <span class="tab" :class="{ on: activeTab === 'cancelled' }" @click="onTab('cancelled')">已注销 {{ countText(statusCounts.cancelled) }}</span>
        </div>
        <div class="frow">
          <span class="sel" @click="cyclePlan">套餐版本：{{ filters.plan }} ▾</span>
          <span class="sel" @click="cycleStatus">状态：{{ filters.status }} ▾</span>
          <span class="sel" @click="cycleExpire">到期时间：{{ filters.expire }} ▾</span>
          <input
            class="ipt search-ipt"
            v-model="filters.keyword"
            placeholder="🔍 搜索租户名称 / 联系人 / 手机号"
            @keyup.enter="fetchList"
          />
          <span class="btn btn-p" @click="fetchList">查询</span>
          <span class="btn" @click="onReset">重置</span>
        </div>
      </div>

      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>租户名称</th>
              <th>联系人</th>
              <th>手机号</th>
              <th>套餐</th>
              <th>到期时间</th>
              <th>资源占用</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in list" :key="t.id">
              <td>
                <b>{{ t.tenantName || '—' }}</b>
                <span v-if="t.createdAt" class="sub">创建于 {{ t.createdAt }}</span>
              </td>
              <td>{{ t.contactName || '—' }}</td>
              <td>{{ t.contactMobile || '—' }}</td>
              <td><span class="muted">—</span></td>
              <td>{{ t.expireAt || '—' }}</td>
              <td><span class="muted">—</span></td>
              <td>
                <span class="tag" :class="statusTagClass(t.status)">{{ statusLabel(t.status) }}</span>
              </td>
              <td>
                <template v-for="a in rowActions(t)" :key="a.key">
                  <span class="btn-t" :class="a.cls" @click="onRowAction(a.key, t)">{{ a.label }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="listError" class="empty">
        <span class="err-t">租户列表加载失败</span>
        <span class="retry" @click="fetchList">重试</span>
      </div>
      <div v-else-if="!list.length" class="empty">暂无租户数据</div>

      <div class="pagebar">
        <span>共 {{ total }} 条 · 每页 {{ pageSize }} 条</span>
        <div class="pgbtns">
          <span @click="goPage(page - 1)">‹</span>
          <span
            v-for="(p, i) in pageBtns"
            :key="i"
            :class="{ on: p === page }"
            @click="typeof p === 'number' && goPage(p)"
          >{{ p }}</span>
          <span @click="goPage(page + 1)">›</span>
        </div>
      </div>
    </div>

    <!-- ════════ 租户详情抽屉（设计稿 .drawer，行 574~606） ════════ -->
    <div v-if="detailOpen" class="ov" @click.self="closeDetail"></div>
    <div v-if="detailOpen" class="drawer zx-scope">
      <div class="d-hd">
        <span class="pt">
          租户详情 · {{ currentTenantName }}
          <span class="tag" :class="statusTagClass(detail?.status)">{{ statusLabel(detail?.status) }}</span>
        </span>
        <span class="d-x" @click="closeDetail">✕</span>
      </div>
      <div class="d-bd">
        <div class="tipbar w">
          <span class="ic">!</span>
          <span><b>代登录需审批：</b>发起代登录将提交运营主管审批（审批人≠申请人），签发一次性临时 Token，默认限时 30 分钟自动登出，全程留痕可回放。</span>
        </div>

        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">基础信息</span>
            <template v-if="editing">
              <span class="btn-t" @click="cancelEdit">取消</span>
              <span class="btn-t" @click="saveEdit">保存</span>
            </template>
            <span v-else class="btn-t" @click="onEdit">编辑</span>
          </div>
          <div class="p-bd base-grid">
            <div>
              <span class="small">联系人</span>
              <input v-if="editing" class="ipt" v-model="editForm.contactName" placeholder="请输入联系人" />
              <div v-else class="b">{{ detail?.contactName || '—' }}</div>
            </div>
            <div>
              <span class="small">手机号</span>
              <input v-if="editing" class="ipt" v-model="editForm.contactMobile" placeholder="请输入手机号" />
              <div v-else class="b">{{ detail?.contactMobile || '—' }}</div>
            </div>
            <div>
              <span class="small">套餐</span>
              <div><span class="muted">—</span> <span class="muted">/年</span></div>
            </div>
            <div>
              <span class="small">到期时间</span>
              <input v-if="editing" class="ipt" v-model="editForm.expireAt" placeholder="YYYY-MM-DD" />
              <div v-else class="b">{{ detail?.expireAt || '—' }}</div>
            </div>
            <div><span class="small">所属渠道</span><div class="muted">—</div></div>
            <div><span class="small">运营标签</span><div class="muted">—</div></div>
          </div>
        </div>

        <div class="panel mt12">
          <div class="p-hd">
            <span class="pt">资源配额使用情况</span>
            <span class="btn-t" @click="onExpandQuota">临时扩容</span>
          </div>
          <div class="p-bd">
            <div v-if="quotaLoading" class="empty small">加载中…</div>
            <div v-else-if="quotaError" class="empty small">
              <span class="err-t">配额加载失败</span>
              <span class="retry" @click="fetchQuota">重试</span>
            </div>
            <div v-else-if="!quotaRows.length" class="empty small">暂无配额数据</div>
            <div v-else class="qrow" v-for="row in quotaRows" :key="row.key">
              <span>{{ row.label }}</span>
              <span class="bar" v-if="row.hasLimit" :class="{ o: row.over }"><i :style="{ width: row.pct + '%' }"></i></span>
              <em>{{ row.text }}</em>
            </div>
          </div>
        </div>

        <div class="panel mt12">
          <div class="p-hd"><span class="pt">套餐变更记录</span></div>
          <div class="p-bd">
            <div class="empty small">暂无套餐变更记录</div>
          </div>
        </div>
      </div>
      <div class="d-ft">
        <span class="btn btn-p" @click="onRenew">立即续费</span>
        <span class="btn btn-s" @click="onProxyLogin">代登录（需审批）</span>
        <span class="btn btn-d" @click="onFreeze">冻结</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  listTenantsApi,
  getTenantApi,
  getTenantQuotaApi,
  updateTenantApi,
  toggleTenantApi,
  getTenantStatusStatsApi,
  exportTenantsApi,
} from '../../api/tenant'
import { buildQuotaRows, type QuotaRow } from './quota'

const router = useRouter()

/* ───────────────────────────────────────────────────────────
   列表数据（沿用现有 listTenantsApi，保留 loading / 空态 / 错误态 + 可重试）
   ─────────────────────────────────────────────────────────── */
const loading = ref(false)
const listError = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const pageSize = ref(20)
const page = ref(1)

/**
 * ✅ 已联调：GET /api/platform/tenants/stats（各状态租户计数，C1-2 A1 落地）
 * ⚠️ 与 GET /platform/tenants/usage-stats **不是同一件事**（后者是使用量指标，无状态计数）——
 *    这一点已反复核过，勿把两者混用。
 * 后端枚举口径（tenant-status-stats.service.ts:39-41）：
 *   正常 ← ACTIVE / '1' ；停用 ← DISABLED / '0' ；已到期 ← EXPIRED
 *   欠费(owed) / 已注销(cancelled) 后端**无对应枚举** → 接口恒返回 0（非前端填 0）
 * 接口未取到时一律 null → 页面显示「—」，**绝不填 0 冒充计数**。
 */
const statusCounts = reactive<Record<string, number | null>>({
  normal: null, owed: null, frozen: null, cancelled: null,
})
const statsError = ref(false)
function countText(n: number | null): string {
  return n == null ? '—' : String(n)
}

async function fetchStatusStats() {
  statsError.value = false
  try {
    const res: any = await getTenantStatusStatsApi()
    const c = res?.data?.counts || {}
    statusCounts.normal = c.normal ?? 0
    statusCounts.owed = c.owed ?? 0
    statusCounts.frozen = c.frozen ?? 0
    statusCounts.cancelled = c.cancelled ?? 0
  } catch {
    // 拿不到就回退为「—」，不填 0
    statusCounts.normal = null
    statusCounts.owed = null
    statusCounts.frozen = null
    statusCounts.cancelled = null
    statsError.value = true
  }
}

type TabKey = 'all' | 'normal' | 'owed' | 'frozen' | 'cancelled'
const activeTab = ref<TabKey>('all')

const planOptions = ['全部', '免费版', '基础版', '标准版', '旗舰版']
const statusOptions = ['全部', '正常', '欠费', '冻结', '已注销']
const expireOptions = ['全部', '近30天到期', '已到期', '永久免费']
const filters = reactive({ plan: '全部', status: '全部', expire: '近30天到期', keyword: '' })

async function fetchList() {
  loading.value = true
  listError.value = false
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    // ⚠️ 已登记技术债（转 C1-2）：后端 listTenants 当前**只支持 keyword**
    //   （backend/src/services/platform-tenant.service.ts:32-58，SQL 里未出现 status/plan/expire 条件）
    //   status/plan 两个参数发出后会被后端直接忽略 —— 不报错，但也**不生效**。
    //   此处保留发送，是为后端补齐后前端免改；**不得据此认为筛选已生效**。
    if (filters.status !== '全部') params.status = filters.status
    if (filters.plan !== '全部') params.plan = filters.plan
    const res: any = await listTenantsApi(params)
    list.value = res.data?.records || res.data?.list || []
    total.value = res.data?.total || 0
    await fetchStatusStats()
  } catch {
    list.value = []
    total.value = 0
    listError.value = true
    await fetchStatusStats()
  } finally {
    loading.value = false
  }
}

function onTab(tab: TabKey) {
  activeTab.value = tab
  const s = { all: '全部', normal: '正常', owed: '欠费', frozen: '冻结', cancelled: '已注销' }[tab]
  filters.status = s
  page.value = 1
  fetchList()
}

/* 下拉切换后自动回到第 1 页并重新查询（此前切了不查，属纯前端行为缺陷） */
function cyclePlan() {
  const i = planOptions.indexOf(filters.plan)
  filters.plan = planOptions[(i + 1) % planOptions.length]
  page.value = 1
  fetchList()
}
function cycleStatus() {
  const i = statusOptions.indexOf(filters.status)
  filters.status = statusOptions[(i + 1) % statusOptions.length]
  page.value = 1
  fetchList()
}
function cycleExpire() {
  const i = expireOptions.indexOf(filters.expire)
  filters.expire = expireOptions[(i + 1) % expireOptions.length]
  page.value = 1
  fetchList()
}

const pageBtns = computed<(number | string)[]>(() => {
  const totalPages = Math.max(1, Math.ceil(total.value / pageSize.value))
  const show = Math.min(5, totalPages)
  const out: (number | string)[] = []
  for (let i = 1; i <= show; i++) out.push(i)
  if (totalPages > show) {
    out.push('…')
    out.push(totalPages)
  }
  return out
})
function goPage(p: number) {
  const totalPages = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (p < 1 || p > totalPages) return
  page.value = p
  fetchList()
}

/* ───────────────────────────────────────────────────────────
   status → 标签映射：按**后端真实枚举**建立，不自造
   取证（逐条可复跑）：
   - backend/src/controllers/platform/tenant.controller.ts:61
       togglePlatformTenantStatus：`if (!["ACTIVE","DISABLED"].includes(status)) → 400`
       ⇒ 后端**强校验**的合法值只有 ACTIVE / DISABLED 两个
   - backend/src/services/platform-tenant.service.ts:89  新建租户写入 status='ACTIVE'
   - backend/src/services/platform/tenant-usage.service.ts:158  rank 过滤 `t.status = 'ACTIVE'`
   ⇒ 设计稿四态中的「欠费」「已注销」在后端**无对应枚举**，已转 C1-2。
   ⚠️ 命名口径待凌舟裁定：设计稿把禁用的租户叫「冻结」，后端语义是「禁用」，
      二者不是同一业务动作，本处按后端语义显示「已停用」，避免把「禁用」谎报成「冻结」。
   ─────────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '正常', cls: 'tag-g' },
  // 历史表定义为 TINYINT（1=正常 0=停用），存量数据可能是 '1'/'0'
  '1': { label: '正常', cls: 'tag-g' },
  DISABLED: { label: '已停用', cls: 'tag-r' },
  '0': { label: '已停用', cls: 'tag-r' },
  EXPIRED: { label: '已到期', cls: 'tag-o' },
}
const UNKNOWN_STATUS = { label: '未知状态', cls: 'tag-gy' }
function statusMeta(s: string) {
  return STATUS_MAP[(s || '').toUpperCase()] || UNKNOWN_STATUS
}
function statusTagClass(s: string): string {
  return statusMeta(s).cls
}
function statusLabel(s: string): string {
  return statusMeta(s).label
}

/* ───────────────────────────────────────────────────────────
   行操作（按状态差异渲染，对齐设计稿 559~566）
   ─────────────────────────────────────────────────────────── */
function rowActions(row: any) {
  const s = (row.status || '').toUpperCase()
  const base = [{ key: 'detail', label: '详情', cls: '' }]
  // 仅按后端真实枚举 ACTIVE / DISABLED 分支；不再为后端不存在的 FROZEN/OWED/CANCELLED 造分支
  if (s === 'DISABLED') {
    return [
      ...base,
      { key: 'unfreeze', label: '启用', cls: 'warn' },
      { key: 'overview', label: '概况', cls: '' },
    ]
  }
  if (s === 'ACTIVE') {
    return [
      ...base,
      { key: 'freeze', label: '停用', cls: 'warn' },
      { key: 'overview', label: '概况', cls: '' },
      { key: 'renew', label: '续费', cls: '' },
      { key: 'proxy', label: '代登录', cls: '' },
      { key: 'export', label: '数据导出', cls: '' },
      { key: 'reset', label: '重置数据', cls: 'dgr' },
    ]
  }
  return [...base, { key: 'overview', label: '概况', cls: '' }]
}

/* ⛔ C1-2 后端仍缺（不得谎报成功）：renew / :id/export / reset 三个写操作 */
const BLOCKED_ACTIONS: Record<string, string> = {
  renew: '续费（POST /platform/tenants/:id/renew）',
  export: '数据导出（POST /platform/tenants/:id/export，仅列表级 /tenants/export 已落地）',
  reset: '重置数据（POST /platform/tenants/:id/reset）',
}

async function onRowAction(key: string, row: any) {
  if (key === 'detail') return openDetail(row)
  // 概况 / 代登录：跳真实详情页（代登录需在详情页填「登录事由」才能提交审批，行内无输入位）
  if (key === 'overview' || key === 'proxy') return router.push(`/tenants/${row.id}`)
  // 启用/停用：接已存在的 POST /platform/tenants/:id/toggle
  if (key === 'freeze') return toggleTenantStatus(row, 'DISABLED')
  if (key === 'unfreeze') return toggleTenantStatus(row, 'ACTIVE')
  ElMessage.warning(`${BLOCKED_ACTIONS[key] || key}：后端接口未就绪，已转 C1-2`)
}

/** POST /platform/tenants/:id/toggle（platform-tenant.routes.ts:34，已存在） */
async function toggleTenantStatus(row: any, next: 'ACTIVE' | 'DISABLED') {
  const text = next === 'ACTIVE' ? '启用' : '停用'
  try {
    await toggleTenantApi(row.id, next)
    ElMessage.success(`已${text}：${row.tenantName || row.id}`)
    await fetchList()
  } catch {
    /* request 拦截器已统一弹中文错误，页面不重复提示 */
  }
}

/* ───────────────────────────────────────────────────────────
   页头动作：能接的接真实接口，接不上的如实报「后端未就绪」，不再谎报
   ─────────────────────────────────────────────────────────── */
// ✅ 已联调：GET /api/platform/tenants/export（C1-2 A2 落地，返回 CSV）
async function onExportList() {
  try {
    const res: any = await exportTenantsApi(filters.keyword.trim() || undefined)
    const blob = res instanceof Blob ? res : new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('租户列表已导出')
  } catch {
    /* request 拦截器已统一弹中文错误，页面不重复提示 */
  }
}
// ⛔ C1-2 后端未实现：批量操作接口
function onBatch() {
  ElMessage.warning('批量操作：后端暂无批量接口，已转 C1-2')
}
// ✅ 已联调：跳真实新建页（路由 /tenants/create → TenantForm.vue:75 调 POST /platform/tenants）
function onCreate() {
  router.push('/tenants/create')
}
function onReset() {
  filters.plan = '全部'
  filters.status = '全部'
  filters.expire = '近30天到期'
  filters.keyword = ''
  page.value = 1
  fetchList()
}

/* ───────────────────────────────────────────────────────────
   详情抽屉（沿用现有 getTenantApi，保留 loading / 空态 / 错误处理）
   ─────────────────────────────────────────────────────────── */
const detailOpen = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)
const currentTenantName = ref('—')

/* 资源配额：GET /platform/tenants/:id/quota（platform-tenant.routes.ts:25，已存在） */
const quota = ref<any>(null)
const quotaLoading = ref(false)
const quotaError = ref(false)
const quotaRows = computed<QuotaRow[]>(() => buildQuotaRows(quota.value))

/* 基础信息内联编辑：PUT /platform/tenants/:id（platform-tenant.routes.ts:31，已存在） */
const editing = ref(false)
const editForm = reactive({ contactName: '', contactMobile: '', expireAt: '' })

async function openDetail(row: any) {
  currentTenantName.value = row.tenantName || '—'
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  editing.value = false
  try {
    const res: any = await getTenantApi(row.id)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
  await fetchQuota(row.id)
}

async function fetchQuota(tenantId: number) {
  quotaLoading.value = true
  quotaError.value = false
  quota.value = null
  try {
    const res: any = await getTenantQuotaApi(tenantId)
    quota.value = res.data
  } catch {
    quota.value = null
    quotaError.value = true
  } finally {
    quotaLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  editing.value = false
}

function onEdit() {
  editing.value = true
  editForm.contactName = detail.value?.contactName || ''
  editForm.contactMobile = detail.value?.contactMobile || ''
  editForm.expireAt = detail.value?.expireAt || ''
}
function cancelEdit() {
  editing.value = false
}
async function saveEdit() {
  try {
    await updateTenantApi(detail.value.id, {
      contactName: editForm.contactName,
      contactMobile: editForm.contactMobile,
      expireAt: editForm.expireAt || null,
    })
    ElMessage.success('已保存租户基础信息')
    editing.value = false
    const res: any = await getTenantApi(detail.value.id)
    detail.value = res.data
    await fetchList()
  } catch {
    /* request 拦截器已统一弹中文错误，页面不重复提示 */
  }
}

// ✅ 已联调（改道）：POST /api/platform/tenants/:id/quota-expand 需 field/amount/days 三个必填参数，
//    抽屉内无输入位，故跳租户详情页（那里有扩容表单弹窗）发起，不在抽屉里假装提交。
function onExpandQuota() {
  const id = detail.value?.id
  if (!id) return
  closeDetail()
  router.push(`/tenants/${id}`)
}
// ⛔ C1-2 后端未实现：POST /platform/tenants/:id/renew
function onRenew() {
  ElMessage.warning('立即续费：POST /platform/tenants/:id/renew 后端接口未就绪，已转 C1-2')
}
// ⛔ C1-2 后端未实现：POST /platform/tenants/:id/proxy-login
function onProxyLogin() {
  ElMessage.warning('代登录（需审批）：POST /platform/tenants/:id/proxy-login 后端接口未就绪，已转 C1-2')
}
// ✅ 已联调：抽屉「冻结」→ POST /platform/tenants/:id/toggle（后端真实语义为「停用」）
async function onFreeze() {
  if (!detail.value?.id) return
  await toggleTenantStatus(detail.value, 'DISABLED')
  closeDetail()
}

onMounted(fetchList)
</script>

<style scoped>
/* ───── 筛选区（设计稿行 543：padding 12px 14px + 底描边；tabs 下间距 11px） ───── */
.panel-filter {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g1);
}
.panel-filter .tabs {
  border: none;
  padding: 0;
  margin-bottom: var(--space-3); /* 设计稿 11px 无对应 token，取 --space-3(12px) 近似 */
}
.search-ipt {
  width: var(--sbox-width); /* 设计稿 190px 无对应 token，取 --sbox-width(220px) 近似 */
}

/* ───── 基础信息网格（设计稿行 581：1fr 1fr，gap 9px 12px，font-size 12px） ───── */
.base-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2) var(--space-3); /* 9px→--space-2(8px) 近似；12px→--space-3 */
  font-size: var(--text-sm);
}
.base-grid > div {
  min-width: 0;
}
.base-grid .small {
  font-size: var(--text-xs);
  color: var(--g4);
}

/* ───── 详情抽屉（设计稿 .drawer / .d-hd / .d-bd / .d-ft，行 213~219） ───── */
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
  width: var(--drawer-width);
  max-width: 88%;
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
  gap: var(--space-2);
  background: var(--bg-card);
}
.d-ft > .btn {
  flex: 1;
  justify-content: center;
}

/* ───── 错误态 + 可重试（C1-1：与「空态」分开，不再用占位文案充当空态） ───── */
.empty .err-t {
  color: var(--color-danger);
}
.empty .retry {
  margin-left: var(--space-2);
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}
</style>
