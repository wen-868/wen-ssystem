<template>
  <div>
    <!-- 顶部 Tab 头：API 密钥 / Webhook 管理（两页共享，当前页 .on） -->
    <div class="tabs">
      <span class="tab" @click="goApiKeys">API 密钥</span>
      <span class="tab on">Webhook 管理</span>
    </div>

    <!-- 页头：标题 + 操作 -->
    <div class="pg-hd mt12">
      <div>
        <div class="pt4">Webhook</div>
        <p class="pd">事件回调订阅 · 租户侧可接收单据 / 库存 / 状态变更事件</p>
      </div>
      <div class="pg-act">
        <span class="btn btn-p" @click="openCreate"><el-icon><Plus /></el-icon>新建订阅</span>
      </div>
    </div>

    <!-- 事件订阅表格面板 -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">Webhook 事件订阅</span>
        <span class="ph-s">签名密钥仅创建时展示一次，列表不再回显</span>
      </div>
      <div class="p-bd">
        <div class="tblwrap">
          <table class="tbl" style="font-size: var(--text-xs)">
            <thead>
              <tr>
                <th>租户</th>
                <th>事件类型</th>
                <th>回调地址</th>
                <th>签名密钥</th>
                <th>重试策略</th>
                <th class="num">近7日推送 / 成功率</th>
                <th>最近触发状态</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in subs" :key="row.id">
                <td><b>{{ tenantLabel(row.tenantId) }}</b></td>
                <td>
                  {{ eventName(row.eventType) }}
                  <span class="sub">{{ row.eventType }}</span>
                </td>
                <td><span class="mask">{{ row.callbackUrl }}</span></td>
                <td><span class="muted">仅创建时展示</span></td>
                <td>{{ row.retryPolicy }}</td>
                <td class="num">{{ row.recentPushCount ?? 0 }} / {{ fmtRate(row.recentSuccessRate) }}</td>
                <td>
                  <span class="tag" :class="triggerClass(row)" :title="row.lastError || ''">{{ triggerText(row) }}</span>
                </td>
                <td><span class="tag" :class="row.paused ? 'tag-r' : 'tag-g'">{{ row.paused ? '已暂停' : '生效中' }}</span></td>
                <td>
                  <template v-if="row.paused">
                    <span class="btn-t warn" @click="onResume(row)">恢复订阅</span>
                    <span class="btn-t" @click="onFailReason(row)">失败原因</span>
                  </template>
                  <template v-else-if="row.lastStatus === 'FAIL'">
                    <span class="btn-t warn" @click="onRetry(row)">手动重推</span>
                    <span class="btn-t" @click="onFailReason(row)">失败原因</span>
                    <span class="btn-t" @click="onLog(row)">日志</span>
                  </template>
                  <template v-else>
                    <span class="btn-t" @click="onTest(row)">测试推送</span>
                    <span class="btn-t" @click="onLog(row)">日志</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="loadError" class="empty">
          订阅列表加载失败
          <span class="btn-t" @click="loadSubs">重试</span>
        </div>
        <div v-else-if="!subs.length" class="empty">暂无事件订阅，可点右上角「新建订阅」创建</div>
      </div>
    </div>

    <!-- 安全与保障说明条 -->
    <p class="small mt8">
      安全与保障：回调带签名头（租户侧须验签）；时间戳 ±5 分钟防重放；连续失败自动暂停订阅并站内通知租户；事件目录含单据创建/审核通过、库存低于阈值、租户状态变更等。
    </p>

    <!-- 新建订阅弹窗 -->
    <el-dialog
      v-model="createVisible"
      title="新建 Webhook 订阅"
      :width="MODAL_W"
      :close-on-click-modal="false"
      @closed="createdKey = ''"
    >
      <div style="display: grid; gap: var(--space-3)">
        <div class="fld">
          <span>选择租户 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <!-- 租户下拉取自现成 GET /api/platform/tenants（裁定 §二.1 A：本批只显示租户名，不新增「开通状态」） -->
          <el-select
            v-model="form.tenantId"
            filterable
            placeholder="请选择租户"
            style="width: 100%"
            :loading="tenantsLoading"
          >
            <el-option
              v-for="t in tenants"
              :key="String(t.tenantCode)"
              :label="t.tenantName"
              :value="String(t.tenantCode)"
            />
          </el-select>
        </div>
        <div class="fld">
          <span>事件类型 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <!-- 事件目录取自 GET /api/platform/open/events（后端常量枚举，非前端自造码表） -->
          <el-select v-model="form.eventType" placeholder="请选择事件类型" style="width: 100%" :loading="eventsLoading">
            <el-option
              v-for="e in events"
              :key="e.code"
              :label="`${e.name}（${e.code}）`"
              :value="e.code"
            />
          </el-select>
        </div>
        <div class="fld">
          <span>回调地址 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <el-input v-model="form.callbackUrl" placeholder="https://租户域名/webhook/接收路径" />
          <span class="small muted">仅支持 https，禁止本机/内网地址（服务端强校验，不通过会返回 400）。</span>
        </div>
        <div class="fld">
          <span>重试策略</span>
          <span class="ipt" style="width: 100%">服务端默认策略（1min / 5min / 30min ×3，创建时不可修改）</span>
        </div>

        <div class="tipbar w">
          <span class="ic">!</span>
          <span>签名密钥 <b>仅在创建时展示一次</b>，遗失只能重置；连续失败 ≥10 次将自动暂停订阅并站内通知租户。</span>
        </div>

        <div class="panel" style="box-shadow: none; background: var(--g0)">
          <div class="p-bd" style="font-size: var(--text-sm)">
            <span class="small">创建结果</span>
            <div class="mt6">
              签名密钥：
              <span v-if="createdKey" class="mask" style="color: var(--color-primary-hover); border-color: var(--color-primary-soft)">{{ createdKey }}</span>
              <span v-else class="muted">—</span>
              <span v-if="createdKey" class="btn-t" @click="copy(createdKey)">复制</span>
            </div>
            <p v-if="createdKey" class="small mt6"><span class="ck on"></span> 我已妥善保存签名密钥，关闭后将无法再次查看</p>
            <p v-else class="small mt6 muted">确认创建后自动展示，仅此一次</p>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="btn" @click="createVisible = false">{{ createdKey ? '关闭' : '取消' }}</span>
        <span class="btn btn-p" @click="confirmCreate">{{ creating ? '创建中…' : createdKey ? '完成' : '确认创建' }}</span>
      </template>
    </el-dialog>

    <!-- 投递日志弹窗：GET /api/platform/open/webhooks/:id/logs -->
    <el-dialog v-model="logVisible" title="投递日志" :width="MODAL_W">
      <div v-if="logLoading" class="empty">加载中…</div>
      <div v-else-if="logError" class="empty">日志加载失败</div>
      <template v-else>
        <div v-if="logs.length" class="tblwrap">
          <table class="tbl" style="font-size: var(--text-xs)">
            <thead>
              <tr>
                <th>时间</th><th>状态</th><th class="num">HTTP</th><th class="num">尝试</th>
                <th class="num">耗时</th><th>来源</th><th>失败原因</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in logs" :key="d.id">
                <td>{{ fmtDateTime(d.createdAt) }}</td>
                <td><span class="tag" :class="d.status === 'OK' ? 'tag-g' : 'tag-o'">{{ d.status === 'OK' ? '成功' : '失败' }}</span></td>
                <td class="num">{{ d.httpStatus ?? '—' }}</td>
                <td class="num">{{ d.attempt }}</td>
                <td class="num">{{ d.durationMs === null || d.durationMs === undefined ? '—' : `${d.durationMs}ms` }}</td>
                <td>{{ triggeredByText(d.triggeredBy) }}</td>
                <td :title="d.error || ''">{{ truncate(d.error) }}</td>
                <td><span class="btn-t" @click="onRedeliver(logSubId, d.id)">重推</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">该订阅暂无投递记录</div>
        <p class="small muted mt8">共 {{ logTotal }} 条 · 第 {{ logPage }} / {{ Math.max(1, Math.ceil(logTotal / logPageSize)) }} 页</p>
        <div class="mt6">
          <span class="btn" :class="{ 'btn-p': logPage > 1 }" @click="turnLogPage(-1)">上一页</span>
          <span class="btn" style="margin-left: var(--space-2)" :class="{ 'btn-p': logPage * logPageSize < logTotal }" @click="turnLogPage(1)">下一页</span>
        </div>
      </template>
      <template #footer>
        <span class="btn" @click="logVisible = false">关闭</span>
      </template>
    </el-dialog>

    <!-- 失败原因弹窗：GET /api/platform/open/webhooks/:id/failures -->
    <el-dialog v-model="failVisible" title="失败原因" :width="MODAL_W">
      <div v-if="failLoading" class="empty">加载中…</div>
      <div v-else-if="failError" class="empty">失败记录加载失败</div>
      <template v-else>
        <div v-if="failures.length" class="tblwrap">
          <table class="tbl" style="font-size: var(--text-xs)">
            <thead>
              <tr><th>时间</th><th class="num">HTTP</th><th class="num">尝试</th><th>来源</th><th>失败原因</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in failures" :key="d.id">
                <td>{{ fmtDateTime(d.createdAt) }}</td>
                <td class="num">{{ d.httpStatus ?? '—' }}</td>
                <td class="num">{{ d.attempt }}</td>
                <td>{{ triggeredByText(d.triggeredBy) }}</td>
                <td>{{ d.error || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">该订阅暂无失败投递记录</div>
      </template>
      <template #footer>
        <span class="btn" @click="failVisible = false">关闭</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  listOpenWebhooksApi,
  createOpenWebhookApi,
  testOpenWebhookApi,
  listOpenWebhookLogsApi,
  redeliverOpenWebhookApi,
  resumeOpenWebhookApi,
  listOpenWebhookFailuresApi,
  listOpenPlatformEventsApi,
  type OpenWebhookItem,
  type OpenWebhookDelivery,
  type OpenPlatformEventItem,
} from '../../api/open-platform'
// 租户下拉复用现成租户列表接口（裁定 §二.1 A），本单未新增租户端点
import { listTenantsApi } from '../../api/tenant'

const router = useRouter()
const MODAL_W = 'var(--modal-width)'

// ====== 订阅列表（全部取自 GET /api/platform/open/webhooks，无数据即空态） ======
const loading = ref(false)
const loadError = ref(false)
const subs = ref<OpenWebhookItem[]>([])

const tenants = ref<Array<{ tenantCode: string | number; tenantName: string }>>([])
const tenantsLoading = ref(false)
const tenantNameMap = reactive<Record<string, string>>({})

const events = ref<OpenPlatformEventItem[]>([])
const eventsLoading = ref(false)

async function loadSubs() {
  loading.value = true
  loadError.value = false
  try {
    const res: any = await listOpenWebhooksApi()
    subs.value = res?.data?.records ?? []
  } catch {
    subs.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  tenantsLoading.value = true
  try {
    const res: any = await listTenantsApi({ page: 1, pageSize: 200 })
    tenants.value = res?.data?.records ?? []
    for (const t of tenants.value) {
      if (t?.tenantCode !== undefined && t?.tenantCode !== null) tenantNameMap[String(t.tenantCode)] = t.tenantName
    }
  } catch {
    tenants.value = []
  } finally {
    tenantsLoading.value = false
  }
}

/** 事件目录：GET /api/platform/open/events（后端常量枚举） */
async function loadEvents() {
  eventsLoading.value = true
  try {
    const res: any = await listOpenPlatformEventsApi()
    events.value = res?.data?.records ?? []
  } catch {
    events.value = []
  } finally {
    eventsLoading.value = false
  }
}

onMounted(() => {
  void loadSubs()
  void loadTenants()
  void loadEvents()
})

// ====== 展示工具 ======
function tenantLabel(tenantId?: string): string {
  const key = String(tenantId ?? '')
  if (!key) return '—'
  return tenantNameMap[key] || key
}

function eventName(code?: string): string {
  const hit = events.value.find((e) => e.code === code)
  return hit?.name || (code ? String(code) : '—')
}

/** 成功率：接口给百分数（0~100）或 null；无推送记录显示「—」 */
function fmtRate(v?: number | null): string {
  if (v === null || v === undefined) return '—'
  return `${Number(v)}%`
}

function fmtDateTime(v?: string | null): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

function triggeredByText(t?: string): string {
  if (t === 'TEST') return '测试推送'
  if (t === 'MANUAL') return '手动重推'
  if (t === 'AUTO') return '事件触发'
  return t || '—'
}

function truncate(v?: string | null): string {
  const s = String(v ?? '')
  if (!s) return '—'
  return s.length > 28 ? `${s.slice(0, 28)}…` : s
}

function copy(t: string) {
  navigator.clipboard?.writeText(t).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

function triggerClass(row: OpenWebhookItem): string {
  if (row.paused) return 'tag-r'
  return row.lastStatus === 'FAIL' ? 'tag-o' : row.lastStatus === 'OK' ? 'tag-g' : 'tag-gy'
}

function triggerText(row: OpenWebhookItem): string {
  if (row.paused) return `连续失败 ≥${row.pauseThreshold ?? 10} 次 · 已自动暂停`
  if (!row.lastStatus) return '尚未触发'
  const time = fmtDateTime(row.lastTriggerAt)
  if (row.lastStatus === 'FAIL') return `失败 · ${time}`
  return `成功 · ${time}`
}

// ====== 行操作（全部接真实端点） ======
/** 测试推送：POST /api/platform/open/webhooks/:id/test */
async function onTest(row: OpenWebhookItem) {
  try {
    const res: any = await testOpenWebhookApi(row.id)
    const d: OpenWebhookDelivery | undefined = res?.data?.delivery
    if (d?.status === 'OK') {
      ElMessage.success(`测试推送成功（HTTP ${d.httpStatus ?? '—'}，${d.durationMs ?? '—'}ms）`)
    } else {
      ElMessage.warning(`测试推送失败：${d?.error || '详见投递日志'}`)
    }
    await loadSubs()
  } catch {
    // 失败文案由 utils/request 的响应拦截器统一提示
  }
}

/** 手动重推：POST /api/platform/open/webhooks/:id/redeliver（缺省重推最近一条） */
async function onRetry(row: OpenWebhookItem) {
  await onRedeliver(row.id)
}

async function onRedeliver(subscriptionId: number, deliveryId?: number) {
  try {
    const res: any = await redeliverOpenWebhookApi(subscriptionId, deliveryId ? { deliveryId } : undefined)
    const d: OpenWebhookDelivery | undefined = res?.data?.delivery
    if (d?.status === 'OK') {
      ElMessage.success(`重推成功（第 ${d.attempt ?? 1} 次尝试，HTTP ${d.httpStatus ?? '—'}）`)
    } else {
      ElMessage.warning(`重推仍未成功：${d?.error || '详见投递日志'}`)
    }
    await loadSubs()
    if (logVisible.value) await loadLogs(subscriptionId, logPage.value)
  } catch {
    // 404（无投递记录）等失败文案由拦截器提示
  }
}

/** 恢复订阅：POST /api/platform/open/webhooks/:id/resume */
async function onResume(row: OpenWebhookItem) {
  try {
    const res: any = await resumeOpenWebhookApi(row.id)
    ElMessage.success(res?.data?.resumed ? '已恢复订阅' : '该订阅未暂停，无需恢复')
    await loadSubs()
  } catch {
    // 失败文案由拦截器提示
  }
}

// ====== 投递日志：GET /api/platform/open/webhooks/:id/logs ======
const logVisible = ref(false)
const logLoading = ref(false)
const logError = ref(false)
const logs = ref<OpenWebhookDelivery[]>([])
const logSubId = ref(0)
const logPage = ref(1)
const logPageSize = 10
const logTotal = ref(0)

async function loadLogs(subscriptionId: number, page: number) {
  logLoading.value = true
  logError.value = false
  try {
    const res: any = await listOpenWebhookLogsApi(subscriptionId, { page, pageSize: logPageSize })
    logs.value = res?.data?.records ?? []
    logTotal.value = Number(res?.data?.total ?? 0)
    logPage.value = page
  } catch {
    logs.value = []
    logTotal.value = 0
    logError.value = true
  } finally {
    logLoading.value = false
  }
}

async function onLog(row: OpenWebhookItem) {
  logSubId.value = row.id
  logs.value = []
  logVisible.value = true
  await loadLogs(row.id, 1)
}

function turnLogPage(delta: number) {
  const next = logPage.value + delta
  if (next < 1) return
  if (delta > 0 && logPage.value * logPageSize >= logTotal.value) return
  void loadLogs(logSubId.value, next)
}

// ====== 失败原因：GET /api/platform/open/webhooks/:id/failures ======
const failVisible = ref(false)
const failLoading = ref(false)
const failError = ref(false)
const failures = ref<OpenWebhookDelivery[]>([])

async function onFailReason(row: OpenWebhookItem) {
  failures.value = []
  failError.value = false
  failVisible.value = true
  failLoading.value = true
  try {
    const res: any = await listOpenWebhookFailuresApi(row.id, { limit: 20 })
    failures.value = res?.data?.records ?? []
  } catch {
    failError.value = true
  } finally {
    failLoading.value = false
  }
}

// ====== Tab 切换 ======
function goApiKeys() { router.push('/open/api-keys') }

// ====== 新建订阅（POST /api/platform/open/webhooks） ======
const createVisible = ref(false)
const creating = ref(false)
const createdKey = ref('')
const form = reactive({ tenantId: '', eventType: '', callbackUrl: '' })

function openCreate() {
  createdKey.value = ''
  form.tenantId = ''
  form.eventType = ''
  form.callbackUrl = ''
  createVisible.value = true
}

async function confirmCreate() {
  if (createdKey.value) {
    createVisible.value = false
    return
  }
  if (!form.tenantId) {
    ElMessage.warning('请选择租户')
    return
  }
  if (!form.eventType) {
    ElMessage.warning('请选择事件类型')
    return
  }
  if (!form.callbackUrl.trim()) {
    ElMessage.warning('请填写回调地址')
    return
  }
  creating.value = true
  try {
    const res: any = await createOpenWebhookApi({
      tenantId: form.tenantId,
      eventType: form.eventType,
      callbackUrl: form.callbackUrl.trim(),
    })
    createdKey.value = String(res?.data?.signSecret ?? '')
    ElMessage.success('创建成功，请立即保存签名密钥')
    await loadSubs()
  } catch {
    // 400（事件码/SSRF 校验）等失败文案由拦截器提示
  } finally {
    creating.value = false
  }
}
</script>
