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
          <span class="tab" :class="{ on: activeTab === 'normal' }" @click="onTab('normal')">正常 {{ statusCounts.normal }}</span>
          <span class="tab" :class="{ on: activeTab === 'owed' }" @click="onTab('owed')">欠费 <span class="n">{{ statusCounts.owed }}</span></span>
          <span class="tab" :class="{ on: activeTab === 'frozen' }" @click="onTab('frozen')">冻结 <span class="n">{{ statusCounts.frozen }}</span></span>
          <span class="tab" :class="{ on: activeTab === 'cancelled' }" @click="onTab('cancelled')">已注销 {{ statusCounts.cancelled }}</span>
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
      <div v-else-if="!list.length" class="empty">暂无租户数据 · 待接入 GET /platform/tenants</div>

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
          <span class="tag tag-g">正常</span>
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
            <span class="btn-t" @click="onEdit">编辑</span>
          </div>
          <div class="p-bd base-grid">
            <div><span class="small">联系人</span><div class="b">{{ detail?.contactName || '—' }}</div></div>
            <div><span class="small">手机号</span><div class="b">{{ detail?.contactMobile || '—' }}</div></div>
            <div>
              <span class="small">套餐</span>
              <div><span class="muted">—</span> <span class="muted">/年</span></div>
            </div>
            <div><span class="small">到期时间</span><div class="b">{{ detail?.expireAt || '—' }}</div></div>
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
            <div class="empty small">配额数据待接入 · GET /platform/tenants/:id/quota</div>
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
import { ElMessage } from 'element-plus'
import { listTenantsApi, getTenantApi } from '../../api/tenant'

/* ───────────────────────────────────────────────────────────
   列表数据（沿用现有 listTenantsApi，保留 loading / 空态 / 错误处理）
   ─────────────────────────────────────────────────────────── */
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const pageSize = ref(20)
const page = ref(1)

// TODO: 待接入 GET /platform/tenants/stats —— 返回各状态计数（正常/欠费/冻结/已注销）
const statusCounts = reactive({ normal: 0, owed: 0, frozen: 0, cancelled: 0 })

type TabKey = 'all' | 'normal' | 'owed' | 'frozen' | 'cancelled'
const activeTab = ref<TabKey>('all')

const planOptions = ['全部', '免费版', '基础版', '标准版', '旗舰版']
const statusOptions = ['全部', '正常', '欠费', '冻结', '已注销']
const expireOptions = ['全部', '近30天到期', '已到期', '永久免费']
const filters = reactive({ plan: '全部', status: '全部', expire: '近30天到期', keyword: '' })

async function fetchList() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    if (filters.status !== '全部') params.status = filters.status
    if (filters.plan !== '全部') params.plan = filters.plan
    const res: any = await listTenantsApi(params)
    list.value = res.data?.records || res.data?.list || []
    total.value = res.data?.total || 0
    // TODO: 待接入状态统计接口，回填 statusCounts
  } catch (e) {
    ElMessage.error('租户列表加载失败')
    list.value = []
    total.value = 0
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

function cyclePlan() {
  const i = planOptions.indexOf(filters.plan)
  filters.plan = planOptions[(i + 1) % planOptions.length]
  // TODO: 触发查询（下拉选择后自动筛选）
}
function cycleStatus() {
  const i = statusOptions.indexOf(filters.status)
  filters.status = statusOptions[(i + 1) % statusOptions.length]
}
function cycleExpire() {
  const i = expireOptions.indexOf(filters.expire)
  filters.expire = expireOptions[(i + 1) % expireOptions.length]
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
   状态 → 标签（设计稿四态：正常/欠费/冻结/已注销；现有接口仅 ACTIVE/DISABLED）
   TODO: 待接入设计稿四态枚举，建立 status → 标签映射
   ─────────────────────────────────────────────────────────── */
function statusTagClass(s: string): string {
  const up = (s || '').toUpperCase()
  if (up === 'DISABLED' || up === 'FROZEN' || up === '冻结') return 'tag-r'
  if (up === 'OWED' || up === '欠费') return 'tag-o'
  if (up === 'CANCELLED' || up === '已注销') return 'tag-gy'
  return 'tag-g'
}
function statusLabel(s: string): string {
  const up = (s || '').toUpperCase()
  if (up === 'DISABLED' || up === 'FROZEN' || up === '冻结') return '已冻结'
  if (up === 'OWED' || up === '欠费') return '欠费'
  if (up === 'CANCELLED' || up === '已注销') return '已注销'
  return '正常'
}

/* ───────────────────────────────────────────────────────────
   行操作（按状态差异渲染，对齐设计稿 559~566）
   ─────────────────────────────────────────────────────────── */
function rowActions(row: any) {
  const s = (row.status || '').toUpperCase()
  const base = [{ key: 'detail', label: '详情', cls: '' }]
  if (s === 'FROZEN' || s === '冻结') {
    return [...base, { key: 'unfreeze', label: '解冻', cls: 'warn' }, { key: 'proxy', label: '模拟登录', cls: 'gy' }]
  }
  if (s === 'OWED' || s === '欠费') {
    return [...base, { key: 'urge', label: '催缴', cls: 'warn' }, { key: 'proxy', label: '模拟登录', cls: '' }]
  }
  if (s === 'CANCELLED' || s === '已注销') {
    return [{ key: 'detail', label: '详情', cls: 'gy' }, { key: 'restore', label: '恢复', cls: '' }]
  }
  return [
    ...base,
    { key: 'renew', label: '续费', cls: '' },
    { key: 'proxy', label: '模拟登录', cls: '' },
    { key: 'overview', label: '概况', cls: '' },
    { key: 'export', label: '数据导出', cls: '' },
    { key: 'reset', label: '重置数据', cls: 'dgr' }
  ]
}
function onRowAction(key: string, row: any) {
  if (key === 'detail') return openDetail(row)
  const map: Record<string, string> = {
    renew: '续费', proxy: '代登录审批', overview: '租户概况', export: '数据导出',
    reset: '重置数据', urge: '催缴', unfreeze: '解冻', restore: '恢复'
  }
  ElMessage.info(`${map[key] || key}：待接入对应接口`)
}

/* ───────────────────────────────────────────────────────────
   页头 / 筛选动作（均为演示态，待接入后端）
   ─────────────────────────────────────────────────────────── */
function onExportList() { ElMessage.info('导出列表：待接入 GET /platform/tenants/export') }
function onBatch() { ElMessage.info('批量操作：待接入批量接口') }
function onCreate() { ElMessage.info('新建租户：待接入 POST /platform/tenants') }
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

async function openDetail(row: any) {
  currentTenantName.value = row.tenantName || '—'
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res: any = await getTenantApi(row.id)
    detail.value = res.data
  } catch (e) {
    detail.value = null
    ElMessage.error('租户详情加载失败')
  } finally {
    detailLoading.value = false
  }
}
function closeDetail() {
  detailOpen.value = false
}
function onEdit() { ElMessage.info('编辑：待接入 PUT /platform/tenants/:id') }
function onExpandQuota() { ElMessage.info('临时扩容：待接入 POST /platform/tenants/:id/quota-expand') }
function onRenew() { ElMessage.info('立即续费：待接入 POST /platform/tenants/:id/renew') }
function onProxyLogin() { ElMessage.info('代登录（需审批）：待接入 POST /platform/tenants/:id/proxy-login') }
function onFreeze() { ElMessage.info('冻结：待接入 POST /platform/tenants/:id/freeze') }

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
</style>
