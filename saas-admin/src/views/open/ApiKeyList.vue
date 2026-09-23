<template>
  <div>
    <!-- 顶部 Tab 头：API 密钥 / Webhook 管理（两页共享，当前页 .on） -->
    <div class="tabs">
      <span class="tab on">API 密钥</span>
      <span class="tab" @click="goWebhooks">Webhook 管理</span>
    </div>

    <!-- 页头：标题 + 概览说明 + 操作（计数取自 GET /api/platform/open/api-keys 的 total） -->
    <div class="pg-hd mt12">
      <div>
        <div class="pt4">API 密钥</div>
        <p class="pd">已签发密钥 {{ keyTotal }} 个 · 在用 {{ activeTotal }} · 沙箱环境独立隔离 · 免费版/基础版默认不开放</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="openDoc">接口文档目录</span>
        <span class="btn btn-p" @click="openIssue"><el-icon><Plus /></el-icon>签发密钥</span>
      </div>
    </div>

    <!-- 密钥表格面板 -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">API 密钥列表</span>
        <span class="ph-s">租户级调用凭证 · AppKey 已打码（服务端打码，页面不回显完整密钥）</span>
      </div>
      <div class="p-bd">
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>租户</th>
                <th>AppKey</th>
                <th>权限范围</th>
                <th>QPS 限制</th>
                <th class="num">今日调用</th>
                <th class="num">错误率</th>
                <th>状态</th>
                <th>签发时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in apiKeys" :key="row.id">
                <td>
                  <b>{{ tenantLabel(row.tenantId) }}</b>
                  <span v-if="row.appName" class="sub">{{ row.appName }}</span>
                </td>
                <td><span class="mask">{{ maskedKey(row.apiKey) }}</span></td>
                <td>
                  <span
                    v-for="(g, i) in scopeGroups(row.scopes)"
                    :key="i"
                    class="tag"
                    :class="g.rw ? 'tag-b' : 'tag-gy'"
                  >{{ g.label }}</span>
                  <span v-if="!scopeGroups(row.scopes).length" class="muted">—</span>
                </td>
                <td>{{ row.qps }} 次/秒</td>
                <td class="num">{{ row.todayCount ?? 0 }}</td>
                <td class="num" title="列表接口未提供错误率，请点「调用量」查看近 7 日聚合">—</td>
                <td><span class="tag" :class="statusClass(row)">{{ statusText(row) }}</span></td>
                <td>{{ fmtDate(row.createdAt) }}</td>
                <td>
                  <span class="btn-t" @click="onEdit(row)">编辑</span>
                  <template v-if="isRotating(row)">
                    <span class="btn-t" @click="onFinishRotate(row)">完成轮换</span>
                    <span class="btn-t" @click="onCalls(row)">调用量</span>
                  </template>
                  <template v-else-if="isDisabled(row)">
                    <span class="btn-t" @click="onEnable(row)">启用</span>
                    <span class="btn-t dgr" @click="onRevoke(row)">吊销</span>
                  </template>
                  <template v-else>
                    <span class="btn-t" @click="onRotate(row)">轮换</span>
                    <span class="btn-t" @click="onCalls(row)">调用量</span>
                    <span class="btn-t dgr" @click="onRevoke(row)">吊销</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="loadError" class="empty">
          密钥列表加载失败
          <span class="btn-t" @click="loadAll">重试</span>
        </div>
        <div v-else-if="!apiKeys.length" class="empty">暂无已签发密钥，可点右上角「签发密钥」创建</div>
      </div>
    </div>

    <!-- 签发密钥弹窗 -->
    <el-dialog
      v-model="issueVisible"
      title="签发 API 密钥"
      :width="MODAL_W"
      :close-on-click-modal="false"
      @closed="issuedResult = null"
    >
      <div style="display: grid; gap: var(--space-3)">
        <div class="fld">
          <span>应用名称 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <el-input v-model="form.appName" maxlength="128" placeholder="例如：青云食品 · 自有 BI 对接" />
        </div>

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
          <span>权限范围（默认最小权限：只读 + 基础域）</span>
          <div class="g2">
            <div v-for="d in scopes" :key="d.key" class="mx">
              <div class="mx-hd">
                <span class="ck" :class="{ on: d.checked }" @click="d.checked = !d.checked"></span>
                {{ d.label }}（{{ d.rw ? '读写' : '只读' }}）
              </div>
              <div class="mx-bd">
                <span class="mx-it" @click="toggleRw(d)">
                  <span class="ck" :class="{ on: d.checked && d.rw }"></span>读写
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="frow">
          <span class="fld" style="flex: 1">
            <span>限流档位（对齐套餐 API 额度）</span>
            <div style="display: flex; gap: var(--space-2)">
              <span
                v-for="t in qpsTiers"
                :key="t"
                class="btn"
                :class="{ 'btn-p': form.qps === t }"
                @click="form.qps = t"
              >{{ t }} 次/秒</span>
            </div>
          </span>
          <span class="fld" style="flex: 1">
            <span>备注</span>
            <el-input v-model="form.remark" maxlength="500" placeholder="例如：对接租户自有 BI 系统" />
          </span>
        </div>

        <div class="tipbar w">
          <span class="ic">!</span>
          <span>AppSecret <b>仅在签发时展示一次</b>，遗失只能重置；权限范围与限额变更立即生效并写入平台审计日志；吊销立即生效（需二次确认），不可恢复。</span>
        </div>

        <div class="panel" style="box-shadow: none; background: var(--g0)">
          <div class="p-bd" style="font-size: var(--text-sm)">
            <span class="small">签发结果</span>
            <div class="mt6">AppKey：<span v-if="issuedResult?.apiKey" class="mask">{{ issuedResult.apiKey }}</span><span v-else class="muted">—</span></div>
            <div class="mt6">
              AppSecret：
              <span v-if="issuedResult?.apiSecret" class="mask" style="color: var(--color-primary-hover); border-color: var(--color-primary-soft)">{{ issuedResult.apiSecret }}</span>
              <span v-else class="muted">—</span>
              <span v-if="issuedResult?.apiSecret" class="btn-t" @click="copy(issuedResult.apiSecret)">复制</span>
              <span v-if="issuedResult?.apiSecret" class="btn-t" @click="download">下载 .txt</span>
            </div>
            <p v-if="issuedResult" class="small mt6"><span class="ck on"></span> 我已妥善保存 Secret，关闭后将无法再次查看</p>
            <p v-else class="small mt6 muted">确认签发后自动展示，仅此一次</p>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="btn" @click="issueVisible = false">取消</span>
        <span class="btn btn-p" @click="confirmIssue">{{ issuing ? '签发中…' : '确认签发' }}</span>
      </template>
    </el-dialog>

    <!-- 轮换结果弹窗：新密钥明文仅此一次 -->
    <el-dialog
      v-model="rotateVisible"
      title="轮换结果（新密钥仅此一次）"
      :width="MODAL_W"
      :close-on-click-modal="false"
      @closed="rotateResult = null"
    >
      <div v-if="rotateResult" style="display: grid; gap: var(--space-3)">
        <div class="tipbar w">
          <span class="ic">!</span>
          <span>新密钥已生效；旧密钥 <b>{{ rotateResult.previousAppKeyMasked }}</b> 并行期至 {{ fmtDateTime(rotateResult.rotateExpireAt) }}（参见「完成轮换」）。</span>
        </div>
        <div class="panel" style="box-shadow: none; background: var(--g0)">
          <div class="p-bd" style="font-size: var(--text-sm)">
            <div>AppKey：<span class="mask">{{ rotateResult.apiKey }}</span><span class="btn-t" @click="copy(rotateResult.apiKey)">复制</span></div>
            <div class="mt6">AppSecret：<span class="mask" style="color: var(--color-primary-hover); border-color: var(--color-primary-soft)">{{ rotateResult.apiSecret }}</span><span class="btn-t" @click="copy(rotateResult.apiSecret)">复制</span></div>
            <p class="small mt6"><span class="ck on"></span> 我已妥善保存新 Secret，关闭后将无法再次查看</p>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="btn btn-p" @click="rotateVisible = false">我已保存</span>
      </template>
    </el-dialog>

    <!-- 调用量弹窗：GET /api/platform/open/api-keys/:id/stats -->
    <el-dialog v-model="statsVisible" title="调用量（近 7 日）" :width="MODAL_W">
      <div v-if="statsLoading" class="empty">加载中…</div>
      <div v-else-if="statsError" class="empty">统计数据加载失败</div>
      <div v-else-if="stats" style="display: grid; gap: var(--space-3)">
        <div class="small muted">
          {{ stats.appName }} · AppKey <span class="mask">{{ maskedKey(stats.apiKey) }}</span> · 租户 {{ tenantLabel(stats.tenantId) }}
        </div>
        <div class="frow">
          <span class="fld" style="flex: 1"><span>今日调用</span><b>{{ stats.todayCount ?? 0 }}</b></span>
          <span class="fld" style="flex: 1"><span>近 7 日合计</span><b>{{ stats.total?.callCount ?? 0 }}</b></span>
          <span class="fld" style="flex: 1"><span>近 7 日错误率</span><b>{{ fmtRate(stats.total?.errorRate) }}</b></span>
        </div>
        <div v-if="stats.hasData" class="tblwrap">
          <table class="tbl">
            <thead>
              <tr><th>日期</th><th class="num">调用数</th><th class="num">错误数</th><th class="num">错误率</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in stats.series" :key="d.date">
                <td>{{ d.date }}</td>
                <td class="num">{{ d.callCount }}</td>
                <td class="num">{{ d.errorCount }}</td>
                <td class="num">{{ fmtRate(d.errorRate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">暂无近 7 日调用明细（当日聚合数据源尚未产生记录）</div>
        <p class="small muted">口径：今日调用数取自密钥当日计数；近 7 日为调用日聚合表的真实记录，无记录时为空态（不填 0 冒充）。</p>
      </div>
      <template #footer>
        <span class="btn" @click="statsVisible = false">关闭</span>
      </template>
    </el-dialog>

    <!-- 编辑弹窗：PUT /api/platform/open/api-keys/:id（限额 / QPS / 白名单 / 权限范围 / 备注 / 状态） -->
    <el-dialog v-model="editVisible" title="编辑 API 密钥" :width="MODAL_W" :close-on-click-modal="false">
      <div v-if="editing" style="display: grid; gap: var(--space-3)">
        <div class="small muted">AppKey <span class="mask">{{ maskedKey(editing.apiKey) }}</span> · 租户 {{ tenantLabel(editing.tenantId) }}</div>
        <div class="frow">
          <span class="fld" style="flex: 1">
            <span>日调用上限（0 = 不限，按后端口径）</span>
            <el-input v-model.number="editForm.dailyLimit" type="number" min="0" max="1000000" />
          </span>
          <span class="fld" style="flex: 1">
            <span>QPS 档位</span>
            <div style="display: flex; gap: var(--space-2)">
              <span
                v-for="t in qpsTiers"
                :key="t"
                class="btn"
                :class="{ 'btn-p': editForm.qps === t }"
                @click="editForm.qps = t"
              >{{ t }} 次/秒</span>
            </div>
          </span>
        </div>
        <div class="fld">
          <span>IP 白名单（每行一个，留空 = 不限制）</span>
          <el-input v-model="editForm.allowedIpsText" type="textarea" :rows="3" placeholder="203.0.113.10" />
        </div>
        <div class="fld">
          <span>权限范围</span>
          <div class="g2">
            <div v-for="d in editScopes" :key="d.key" class="mx">
              <div class="mx-hd">
                <span class="ck" :class="{ on: d.checked }" @click="d.checked = !d.checked"></span>
                {{ d.label }}（{{ d.rw ? '读写' : '只读' }}）
              </div>
              <div class="mx-bd">
                <span class="mx-it" @click="toggleEditRw(d)">
                  <span class="ck" :class="{ on: d.checked && d.rw }"></span>读写
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="fld">
          <span>备注</span>
          <el-input v-model="editForm.remark" maxlength="500" placeholder="留空表示清除备注" />
        </div>
        <div class="tipbar w">
          <span class="ic">!</span>
          <span>保存后立即生效并写入平台审计日志（本批不含租户侧审批环节）。</span>
        </div>
      </div>
      <template #footer>
        <span class="btn" @click="editVisible = false">取消</span>
        <span class="btn btn-p" @click="confirmEdit">保存</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  listOpenApiKeysApi,
  createOpenApiKeyApi,
  updateOpenApiKeyApi,
  deleteOpenApiKeyApi,
  enableOpenApiKeyApi,
  rotateOpenApiKeyApi,
  completeOpenApiKeyRotationApi,
  getOpenApiKeyStatsApi,
  type OpenApiKeyItem,
  type OpenApiKeyCreated,
  type OpenApiKeyRotated,
  type OpenApiKeyStats,
} from '../../api/open-platform'
// 租户下拉复用现成租户列表接口（裁定 §二.1 A），本单未新增租户端点
import { listTenantsApi } from '../../api/tenant'

const router = useRouter()
const MODAL_W = 'var(--modal-width)'

// ====== 列表与页头计数（全部取自 GET /api/platform/open/api-keys，无数据即 0） ======
const loading = ref(false)
const loadError = ref(false)
const apiKeys = ref<OpenApiKeyItem[]>([])
const keyTotal = ref(0)
const activeTotal = ref(0)

/** 租户下拉与「租户」列展示名（来源 GET /api/platform/tenants；未命中时回落到接口原始 tenantId） */
const tenants = ref<Array<{ tenantCode: string | number; tenantName: string }>>([])
const tenantsLoading = ref(false)
const tenantNameMap = reactive<Record<string, string>>({})

async function loadKeys() {
  loading.value = true
  loadError.value = false
  try {
    const res: any = await listOpenApiKeysApi({ page: 1, pageSize: 20 })
    apiKeys.value = res?.data?.records ?? []
  } catch {
    apiKeys.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

/** 页头计数：一次不带过滤、一次 status=1，各取接口的 total（min pageSize=1） */
async function loadCounts() {
  try {
    const [all, active] = await Promise.all([
      listOpenApiKeysApi({ page: 1, pageSize: 1 }),
      listOpenApiKeysApi({ page: 1, pageSize: 1, status: 1 }),
    ])
    keyTotal.value = Number((all as any)?.data?.total ?? 0)
    activeTotal.value = Number((active as any)?.data?.total ?? 0)
  } catch {
    // 取不到计数时保持 0（不编造数字）；失败原因由 utils/request 拦截器统一中文提示
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

async function loadAll() {
  await Promise.all([loadKeys(), loadCounts()])
}

onMounted(() => {
  void loadAll()
  void loadTenants()
})

// ====== 展示工具（零假数据：接口没有的字段一律显示「—」，不填样例值） ======
function tenantLabel(tenantId?: string): string {
  const key = String(tenantId ?? '')
  if (!key) return '—'
  return tenantNameMap[key] || key
}

/**
 * AppKey 展示（安全硬要求）：
 * 后端列表/详情/统计已经**服务端打码**（4 位前缀 + **** + 4 位后缀），此处直接展示该值，
 * 不再打码一次（避免双重打码）；若返回值里**不含掩码符号**（异常/老契约），前端兜底真打码，
 * **任何情况都不把完整密钥渲染上屏**。
 */
function maskedKey(key?: string): string {
  const v = String(key ?? '')
  if (!v) return '—'
  if (v.includes('*') || v.includes('•')) return v
  if (v.length <= 8) return '••••'
  return `${v.slice(0, 4)}••••••••${v.slice(-4)}`
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 10)
}

function fmtDateTime(v?: string | null): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

/** 错误率：接口给 0~1 小数；无数据（null）显示「—」 */
function fmtRate(v?: number | null): string {
  if (v === null || v === undefined) return '—'
  return `${(Number(v) * 100).toFixed(2)}%`
}

/** 权限范围编码：`<域>:rw` / `<域>:read`（后端 scopes 为自由字符串数组，编码口径见回传卡「风险与自我报备」） */
const SCOPE_DEFS: Array<{ key: string; label: string; short: string }> = [
  { key: 'product', label: '商品域', short: '商品' },
  { key: 'stock', label: '库存域', short: '库存' },
  { key: 'sale', label: '销售单域', short: '销售单' },
  { key: 'member', label: '会员 / 对账域', short: '会员' },
]

function decodeScope(code: string): { key: string; rw: boolean } {
  const raw = String(code ?? '')
  const [key, mode] = raw.split(':')
  return { key: key || raw, rw: mode === 'rw' }
}

function scopeShortLabel(key: string): string {
  return SCOPE_DEFS.find((d) => d.key === key)?.short || key
}

/** 与设计稿一致：按读写/只读归并成两个 tag（读写 · 商品/库存；只读 · 会员） */
function scopeGroups(scopes?: string[]): Array<{ rw: boolean; label: string }> {
  const list = Array.isArray(scopes) ? scopes : []
  if (!list.length) return []
  const groups: Array<{ rw: boolean; label: string }> = []
  for (const rw of [true, false]) {
    const names = list
      .map(decodeScope)
      .filter((d) => d.rw === rw)
      .map((d) => scopeShortLabel(d.key))
    if (names.length) groups.push({ rw, label: `${rw ? '读写' : '只读'} · ${names.join('/')}` })
  }
  return groups
}

function encodeScopes(list: ScopeDomain[]): string[] {
  return list.filter((d) => d.checked).map((d) => `${d.key}:${d.rw ? 'rw' : 'read'}`)
}

function statusText(row: OpenApiKeyItem): string {
  if (isRotating(row)) return '轮换并行期 · 新旧各 7 天'
  return isDisabled(row) ? '已停用' : '在用'
}

function statusClass(row: OpenApiKeyItem): string {
  if (isRotating(row)) return 'tag-o'
  return isDisabled(row) ? 'tag-gy' : 'tag-g'
}

function isRotating(row: OpenApiKeyItem): boolean {
  return String(row?.rotateStatus ?? '').toUpperCase() === 'ROTATING'
}

function isDisabled(row: OpenApiKeyItem): boolean {
  return Number(row?.status) === 0
}

function copy(t: string) {
  navigator.clipboard?.writeText(t).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

// ====== 行操作（全部接真实端点） ======
/** 启用：POST /api/platform/open/api-keys/:id/enable */
async function onEnable(row: OpenApiKeyItem) {
  try {
    await enableOpenApiKeyApi(row.id)
    ElMessage.success('已启用')
    await loadAll()
  } catch {
    // 失败文案由 utils/request 的响应拦截器统一提示
  }
}

/** 吊销：DELETE /api/platform/open/api-keys/:id（立即生效，前端二次确认） */
async function onRevoke(row: OpenApiKeyItem) {
  try {
    await ElMessageBox.confirm(
      `吊销后 AppKey ${maskedKey(row.apiKey)} 立即失效且不可恢复，是否继续？`,
      '吊销确认',
      { type: 'warning', confirmButtonText: '确认吊销', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteOpenApiKeyApi(row.id)
    ElMessage.success('已吊销')
    await loadAll()
  } catch {
    // 失败文案由拦截器提示
  }
}

/** 轮换：POST /api/platform/open/api-keys/:id/rotate（新密钥明文仅此一次） */
async function onRotate(row: OpenApiKeyItem) {
  try {
    await ElMessageBox.confirm(
      '轮换会立即启用以新密钥签发的凭证，并在并行期内保留旧密钥，是否继续？',
      '轮换确认',
      { type: 'info', confirmButtonText: '确认轮换', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    const res: any = await rotateOpenApiKeyApi(row.id)
    rotateResult.value = (res?.data ?? null) as OpenApiKeyRotated | null
    rotateVisible.value = true
    await loadAll()
  } catch {
    // 409（已在轮换中）等失败文案由拦截器提示
  }
}

/** 完成轮换：POST /api/platform/open/api-keys/:id/rotate-complete（旧密钥立即失效） */
async function onFinishRotate(row: OpenApiKeyItem) {
  try {
    await ElMessageBox.confirm('完成后旧密钥立即失效，是否继续？', '完成轮换', {
      type: 'warning',
      confirmButtonText: '确认完成',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await completeOpenApiKeyRotationApi(row.id)
    ElMessage.success('已完成轮换，旧密钥已失效')
    await loadAll()
  } catch {
    // 失败文案由拦截器提示
  }
}

// ====== 调用量：GET /api/platform/open/api-keys/:id/stats ======
const statsVisible = ref(false)
const statsLoading = ref(false)
const statsError = ref(false)
const stats = ref<OpenApiKeyStats | null>(null)

async function onCalls(row: OpenApiKeyItem) {
  stats.value = null
  statsError.value = false
  statsVisible.value = true
  statsLoading.value = true
  try {
    const res: any = await getOpenApiKeyStatsApi(row.id, { days: 7 })
    stats.value = (res?.data ?? null) as OpenApiKeyStats | null
  } catch {
    statsError.value = true
  } finally {
    statsLoading.value = false
  }
}

// ====== Tab 切换 ======
function goWebhooks() { router.push('/open/webhooks') }

/** 设计稿 Tab3「接口目录与版本」本批不做（裁定 §二.4 A）⇒ 产品化说明，不显示占位口径 */
function openDoc() { ElMessage.info('接口目录与版本（含接口文档）规划中，本批暂未开放') }

// ====== 签发弹窗（POST /api/platform/open/api-keys） ======
const issueVisible = ref(false)
const issuing = ref(false)
interface ScopeDomain { key: string; label: string; checked: boolean; rw: boolean }
const scopes = reactive<ScopeDomain[]>(
  SCOPE_DEFS.map((d, i) => ({ key: d.key, label: d.label, checked: i <= 2, rw: i === 1 || i === 2 })),
)
function toggleRw(d: ScopeDomain) {
  if (!d.checked) d.checked = true
  d.rw = !d.rw
}
const qpsTiers = [10, 30, 50]
const form = reactive({ appName: '', tenantId: '', qps: 30, remark: '' })

const issuedResult = ref<OpenApiKeyCreated | null>(null)
function openIssue() {
  issuedResult.value = null
  form.appName = ''
  form.tenantId = ''
  form.qps = 30
  form.remark = ''
  for (const [i, d] of scopes.entries()) {
    d.checked = i <= 2
    d.rw = i === 1 || i === 2
  }
  issueVisible.value = true
}

async function confirmIssue() {
  if (issuedResult.value) {
    issueVisible.value = false
    return
  }
  if (!form.appName.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  if (!form.tenantId) {
    ElMessage.warning('请选择租户')
    return
  }
  issuing.value = true
  try {
    const res: any = await createOpenApiKeyApi({
      appName: form.appName.trim(),
      tenantId: form.tenantId,
      qps: form.qps,
      scopes: encodeScopes(scopes),
      remark: form.remark.trim() || undefined,
    })
    issuedResult.value = (res?.data ?? null) as OpenApiKeyCreated | null
    ElMessage.success('签发成功，请立即保存 AppSecret')
    await loadAll()
  } catch {
    // 失败文案由拦截器提示（400 校验 / 403 CSRF / 401 登录态）
  } finally {
    issuing.value = false
  }
}

/** 下载一次性密钥 .txt（仅在有签发结果时可点） */
function download() {
  const r = issuedResult.value
  if (!r) return
  const text = [
    '智享全链 · 开放平台 API 密钥',
    `应用名称：${r.appName}`,
    `租户：${tenantLabel(r.tenantId)}`,
    `AppKey：${r.apiKey}`,
    `AppSecret：${r.apiSecret}`,
    `签发时间：${new Date().toISOString()}`,
    '',
    '提示：AppSecret 仅在签发时展示一次，请妥善保存。',
  ].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `open-api-key-${r.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ====== 轮换结果弹窗 ======
const rotateVisible = ref(false)
const rotateResult = ref<OpenApiKeyRotated | null>(null)

// ====== 编辑弹窗（PUT /api/platform/open/api-keys/:id） ======
const editVisible = ref(false)
const editing = ref<OpenApiKeyItem | null>(null)
const editScopes = reactive<ScopeDomain[]>([])
const editForm = reactive({ dailyLimit: 0, qps: 10, allowedIpsText: '', remark: '' })

function onEdit(row: OpenApiKeyItem) {
  editing.value = row
  editForm.dailyLimit = Number(row.dailyLimit ?? 0)
  editForm.qps = Number(row.qps ?? 10)
  editForm.allowedIpsText = Array.isArray(row.allowedIps) ? row.allowedIps.join('\n') : ''
  editForm.remark = row.remark ?? ''
  const decoded = (Array.isArray(row.scopes) ? row.scopes : []).map(decodeScope)
  editScopes.splice(0, editScopes.length, ...SCOPE_DEFS.map((d) => {
    const hit = decoded.find((x) => x.key === d.key)
    return { key: d.key, label: d.label, checked: !!hit, rw: !!hit?.rw }
  }))
  editVisible.value = true
}

function toggleEditRw(d: ScopeDomain) {
  if (!d.checked) d.checked = true
  d.rw = !d.rw
}

async function confirmEdit() {
  const row = editing.value
  if (!row) return
  const allowedIps = editForm.allowedIpsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    await updateOpenApiKeyApi(row.id, {
      dailyLimit: Number(editForm.dailyLimit) || 0,
      qps: Number(editForm.qps),
      allowedIps: allowedIps.length ? allowedIps : null,
      scopes: encodeScopes(editScopes),
      remark: editForm.remark.trim(),
    })
    ElMessage.success('已保存')
    editVisible.value = false
    await loadAll()
  } catch {
    // 失败文案由拦截器提示
  }
}
</script>
