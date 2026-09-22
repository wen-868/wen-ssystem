<template>
  <div>
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">租户详情</div>
        <p class="pd">{{ tenantName }} · 租户编码 {{ tenantCode }}</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="proxyVisible = true">模拟登录</span>
        <span class="btn" @click="resetVisible = true">数据重置</span>
        <span class="btn" @click="exportVisible = true">数据导出</span>
        <span class="btn" @click="onRenew">续费</span>
        <span class="btn btn-d" @click="onFreeze">冻结</span>
      </div>
    </div>

    <!-- ════════ 租户概况面板（原「租户概况」弹窗内容挪入） ════════ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">租户概况</span>
        <span class="btn-t" @click="toast('导出概况')">导出概况</span>
      </div>
      <div class="p-bd zx-scope">
        <!--
          C1-1 联调：GET /api/platform/tenants/:id/overview（C1-2 A3 已落地）
          后端逐字段给了真实数据源，无数据源的维度返回 null 并在 unavailable[] 写明原因：
            goods/goodsCap ← t_product_spu COUNT / t_subscription_plan.max_products
            orders/ordersMomPct ← 本月 vs 上月 t_sale_bill COUNT（上月为 0 时环比 null，不造 0）
            staff/staffActive7d ← t_sys_user COUNT / t_sys_user_login 近 7 日去重
            docCount ← 本月 t_sale_bill + 本月 t_purchase_order；docRate **无分母** → 后端恒 null
            store/storeRate ← t_upload_file.file_size 合计 / 配额上限
          ⇒ 前端一律用 ?? '—' 落空态，不做任何本地换算。
        -->
        <div v-if="overviewLoading" class="small mt8">加载中…</div>
        <div v-else-if="overviewError" class="small mt8 quota-err">
          概况指标加载失败 <span class="retry" @click="fetchOverview">重试</span>
        </div>
        <template v-else>
          <div class="g3">
            <div class="kpi">
              <div class="kt">商品数量</div>
              <div class="kv">{{ fmtInt(overview.goods) }}</div>
              <div class="kd">上限 {{ fmtInt(overview.goodsCap) }}</div>
            </div>
            <div class="kpi">
              <div class="kt">本月订单量</div>
              <div class="kv">{{ fmtInt(overview.orders) }}</div>
              <div class="kd">环比 <span class="up">{{ fmtPct(overview.ordersMomPct) }}</span></div>
            </div>
            <div class="kpi">
              <div class="kt">员工用户数</div>
              <div class="kv">{{ fmtInt(overview.staff) }}</div>
              <div class="kd">近7日活跃 {{ fmtInt(overview.staffActive7d) }} 人</div>
            </div>
          </div>
          <div class="qrow mt10">
            <span>本月单据量</span>
            <span class="bar"><i :style="{ width: overview.docRate ? overview.docRate + '%' : '0%' }"></i></span>
            <em>{{ fmtInt(overview.docCount) }}</em>
          </div>
          <div class="qrow">
            <span>存储水位</span>
            <span class="bar"><i :style="{ width: (overview.storeRate ?? 0) + '%' }"></i></span>
            <em>{{ storeText }}</em>
          </div>
          <p v-if="unavailableText" class="small mt8">{{ unavailableText }}</p>
        </template>
        <p class="small mt8 note">
          聚合统计口径：总后台仅可见概况指标，<b>不查看租户业务单据明细</b>；如需明细请走「模拟登录」审批流程。
        </p>
      </div>
    </div>

    <!-- ════════ 资源配额使用情况面板（批 4：接真实数据 GET /platform/tenants/:id/quota） ════════ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">资源配额使用情况</span>
        <span class="btn-t" @click="onExpandQuota">临时扩容</span>
      </div>
      <div class="p-bd">
        <template v-if="quotaLoading">
          <p class="small mt8">加载中…</p>
        </template>
        <template v-else-if="quotaError">
          <p class="small mt8 quota-err">配额加载失败 <span class="retry" @click="fetchQuota">重试</span></p>
        </template>
        <template v-else-if="!quotaRows.length">
          <p class="small mt8">暂无配额数据</p>
        </template>
        <template v-else>
          <div class="qrow" v-for="row in quotaRows" :key="row.key">
            <span>{{ row.label }}</span>
            <span class="bar" v-if="row.hasLimit" :class="{ o: row.over }"><i :style="{ width: row.pct + '%' }"></i></span>
            <em>{{ row.text }}</em>
          </div>
          <p class="small mt8">API 日额度：后端无 API 调用计数数据源（S3-21），该维度恒显示「—」</p>
        </template>
        <p class="small mt8 note">扩容走审批流（有效期&gt;30天）；配额达 100% 由计量引擎硬拦截。</p>
      </div>
    </div>

    <!-- ════════ 弹窗：模拟登录确认 ════════ -->
    <el-dialog v-model="proxyVisible" :show-header="false" :width="MODAL_W" :close-on-click-modal="true">
      <div class="zx-scope">
        <div class="m-hd">
          <span class="pt">模拟登录确认 · {{ tenantName }}<span class="v15-tag lt">v1.5</span></span>
          <span class="d-x" @click="proxyVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="fld">
            <span>登录事由（关联工单号）<i class="req">*</i></span>
            <input class="ipt" v-model="proxyForm.reason" placeholder="请输入关联工单号" />
          </div>
          <div class="fld">
            <span>模拟身份</span>
            <span class="sel sel-full" @click="cycleProxyRole">
              租户主管理员（敏感页只读脱敏）<b class="caret">▾</b>
            </span>
          </div>
          <div class="tipbar">
            <span class="ic">i</span>
            <span>仅<b>运营主管及以上授权角色</b>可发起，审批人 ≠ 申请人；签发<b>一次性临时 Token</b>，限时 30 分钟自动登出，不可续期。</span>
          </div>
          <div class="tipbar r">
            <span class="ic">!</span>
            <span><b>安全留痕（架构关键点 4）：</b>进入 / 操作 / 退出<b>全程日志留痕并录屏</b>，可在「运维 · 代登录审计」回放与月度抽检；支付配置 / 密钥等敏感页强制脱敏禁改。</span>
          </div>
        </div>
        <div class="m-ft">
          <span class="btn" @click="proxyVisible = false">取消</span>
          <span class="btn btn-p" @click="onSubmitProxy">提交审批</span>
        </div>
      </div>
    </el-dialog>

    <!-- ════════ 弹窗：数据重置（高危红顶） ════════ -->
    <el-dialog v-model="resetVisible" :show-header="false" :width="MODAL_W" :close-on-click-modal="true" class="danger-dialog">
      <div class="zx-scope">
        <div class="m-hd">
          <span class="pt">数据重置 · {{ tenantName }}<span class="tag tag-r">高危操作</span></span>
          <span class="d-x" @click="resetVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="tipbar r">
            <span class="ic">!</span>
            <span><b>该操作将永久清空该租户全部业务数据</b>（商品 / 客户 / 供应商 / 订单 / 库存 / 单据附件），<b>不可恢复</b>。重置前系统自动生成全量备份包（保留 30 天，仅可由超级管理员申请恢复）。</span>
          </div>
          <div class="fld">
            <span>输入租户名称以确认 <i class="req">*</i></span>
            <input class="ipt" v-model="resetForm.name" :placeholder="`请输入 ${tenantName} 以确认`" />
          </div>
          <div class="fld">
            <span>重置原因 <i class="req">*</i></span>
            <div class="reason-row">
              <span
                v-for="r in resetReasons"
                :key="r"
                class="btn"
                :class="{ 'btn-p': resetForm.reason === r }"
                @click="resetForm.reason = r"
              >{{ r }}</span>
            </div>
          </div>
          <div class="ck-line"><span class="ck on"></span> 我已知晓该操作不可逆，并已通知租户主管理员</div>
          <p class="small">双因子验证 + 操作留痕至管理员操作日志（谁 / 何时 / 对哪一租户 / 原因），数据导出建议在重置前完成。</p>
        </div>
        <div class="m-ft">
          <span class="btn" @click="resetVisible = false">取消</span>
          <span class="btn btn-d" @click="onConfirmReset">确认重置</span>
        </div>
      </div>
    </el-dialog>

    <!-- ════════ 弹窗：数据导出 ════════ -->
    <el-dialog v-model="exportVisible" :show-header="false" :width="MODAL_W" :close-on-click-modal="true">
      <div class="zx-scope">
        <div class="m-hd">
          <span class="pt">数据导出 · {{ tenantName }}<span class="v15-tag lt">v1.5</span></span>
          <span class="d-x" @click="exportVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="fld">
            <span>导出范围</span>
            <div class="range-row">
              <span
                v-for="r in exportRanges"
                :key="r.label"
                class="btn"
                :class="{ 'btn-p': r.on }"
                @click="r.on = !r.on"
              >{{ r.on ? '✓ ' : '' }}{{ r.label }}</span>
            </div>
          </div>
          <div class="fld">
            <span>导出格式</span>
            <div class="fmt-row">
              <span
                v-for="f in exportFormats"
                :key="f"
                class="btn"
                :class="{ 'btn-p': exportFormat === f }"
                @click="exportFormat = f"
              >{{ f }}</span>
            </div>
          </div>
          <div class="tipbar">
            <span class="ic">i</span>
            <span>异步任务生成<b>加密压缩包</b>，完成后在「下载中心」取件，<b>24 小时内有效</b>；手机号等敏感字段自动脱敏；导出任务全程留痕可审计。</span>
          </div>
        </div>
        <div class="m-ft">
          <span class="btn" @click="exportVisible = false">取消</span>
          <span class="btn btn-p" @click="onCreateExport">创建导出任务</span>
        </div>
      </div>
    </el-dialog>

    <!-- ════════ 弹窗：临时扩容（C1-1 新增最小表单：quota-expand 需 field/amount/days 三个必填） ════════ -->
    <el-dialog v-model="expandVisible" :show-header="false" :width="MODAL_W" :close-on-click-modal="true">
      <div class="zx-scope">
        <div class="m-hd">
          <span class="pt">临时扩容 · {{ tenantName }}</span>
          <span class="d-x" @click="expandVisible = false">✕</span>
        </div>
        <div class="m-bd">
          <div class="fld">
            <span>扩容维度 <i class="req">*</i></span>
            <div class="fmt-row">
              <span
                v-for="f in EXPAND_FIELDS"
                :key="f.value"
                class="btn"
                :class="{ 'btn-p': expandForm.field === f.value }"
                @click="expandForm.field = f.value"
              >{{ f.label }}</span>
            </div>
          </div>
          <div class="fld">
            <span>扩容幅度 <i class="req">*</i></span>
            <input class="ipt" v-model="expandForm.amount" placeholder="请输入正整数（如 500）" />
          </div>
          <div class="fld">
            <span>有效期（天）<i class="req">*</i></span>
            <input class="ipt" v-model="expandForm.days" placeholder="如 30" />
          </div>
          <div class="fld">
            <span>扩容原因</span>
            <input class="ipt" v-model="expandForm.reason" placeholder="选填" />
          </div>
          <div class="tipbar">
            <span class="ic">i</span>
            <span>扩容走审批流（有效期&gt;30天）；该操作写入 <b>t_platform_audit_log</b>，全程留痕可审计。</span>
          </div>
        </div>
        <div class="m-ft">
          <span class="btn" @click="expandVisible = false">取消</span>
          <span class="btn btn-p" @click="onSubmitExpand">提交扩容</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getTenantApi,
  getTenantQuotaApi,
  getTenantOverviewApi,
  toggleTenantApi,
  proxyLoginTenantApi,
  expandTenantQuotaApi,
} from '../../api/tenant'
import { buildQuotaRows, type QuotaRow } from './quota'

const route = useRoute()
const MODAL_W = 'var(--modal-width)'

/* ───────────────────────────────────────────────────────────
   租户详情（沿用现有 getTenantApi，保留 loading / 空态 / 错误处理）
   ─────────────────────────────────────────────────────────── */
const detail = ref<any>(null)
const tenantName = computed(() => detail.value?.tenantName || '--')
const tenantCode = computed(() => detail.value?.tenantCode || '--')

async function fetchDetail() {
  try {
    const res: any = await getTenantApi(Number(route.params.id))
    detail.value = res.data
  } catch (e) {
    detail.value = null
  }
}

/* ───────────────────────────────────────────────────────────
   弹窗可见性（默认全部关闭，由 pg-act 按钮触发）
   ─────────────────────────────────────────────────────────── */
const proxyVisible = ref(false)
const proxySubmitting = ref(false)
const resetVisible = ref(false)
const exportVisible = ref(false)

/* 临时扩容：POST /api/platform/tenants/:id/quota-expand 需要 field/amount/days 三个必填参数，
   原页面只有一个裸按钮，无输入位 → 补最小弹窗（与页面既有三个弹窗同一套 .m-hd/.m-bd/.m-ft 结构）。
   可选维度取自后端常量 QUOTA_EXPAND_FIELDS（tenant-ops.controller.ts:61 报错文案）对应的一组维度。 */
const expandVisible = ref(false)
const expandSubmitting = ref(false)
/** 维度必须来自后端常量 QUOTA_EXPAND_FIELDS（backend/src/services/platform/tenant-ops.service.ts），
 *  后端为 accounts / products / stores / storage / aiMonthly —— **不含 apiDaily**（后端无调用计数数据源）。 */
const EXPAND_FIELDS = [
  { value: 'accounts', label: '账号数' },
  { value: 'products', label: '商品上限' },
  { value: 'stores', label: '仓库数' },
  { value: 'storage', label: '存储容量' },
  { value: 'aiMonthly', label: 'AI 额度' },
]
const expandForm = reactive({ field: 'products', amount: '' as string, days: '30' as string, reason: '' })

/* ───────────────────────────────────────────────────────────
   模拟登录确认
   ─────────────────────────────────────────────────────────── */
const proxyRoles = ['租户主管理员（敏感页只读脱敏）', '租户财务管理员（只读）', '客服协查（只读）']
const proxyForm = reactive({ reason: '', roleIdx: 0 })
function cycleProxyRole() {
  proxyForm.roleIdx = (proxyForm.roleIdx + 1) % proxyRoles.length
}
async function onSubmitProxy() {
  // ✅ 已联调：POST /api/platform/tenants/:id/proxy-login（C1-2 A4 落地，写 t_platform_audit_log 留痕）
  // 原实现在此处直接弹「已提交代登录审批」——那是**谎报成功**（接口根本没调），本单改为真调用。
  if (!proxyForm.reason) {
    ElMessage.warning('请填写登录事由（关联工单号）')
    return
  }
  proxySubmitting.value = true
  try {
    await proxyLoginTenantApi(route.params.id, { reason: proxyForm.reason })
    ElMessage.success('已提交代登录审批（已留痕，可于「运维 · 代登录审计」回放）')
    proxyVisible.value = false
    proxyForm.reason = ''
  } catch {
    /* request 拦截器已统一弹中文错误；失败时保持弹窗不关，便于修改后重试 */
  } finally {
    proxySubmitting.value = false
  }
}

/* ───────────────────────────────────────────────────────────
   数据重置
   ─────────────────────────────────────────────────────────── */
const resetReasons = ['租户主动申请', '测试数据清理', '数据错乱恢复']
const resetForm = reactive({ name: '', reason: '' })
function onConfirmReset() {
  // ⛔ C1-2 后端未实现：POST /platform/tenants/:id/reset（双因子 + 操作留痕）
  // 原实现弹「已提交数据重置」——属**谎报成功**，本单改为如实提示并保持弹窗不关。
  if (resetForm.name !== tenantName.value) {
    ElMessage.warning('输入的租户名称与确认不一致')
    return
  }
  if (!resetForm.reason) {
    ElMessage.warning('请选择重置原因')
    return
  }
  ElMessage.warning('数据重置：POST /platform/tenants/:id/reset 后端接口未就绪，已转 C1-2，本次未提交')
}

/* ───────────────────────────────────────────────────────────
   数据导出
   ─────────────────────────────────────────────────────────── */
const exportRanges = reactive([
  { label: '基础档案', on: true },
  { label: '近 12 个月单据', on: false },
  { label: '附件（可选）', on: false }
])
const exportFormats = ['Excel', 'CSV']
const exportFormat = ref('Excel')
function onCreateExport() {
  // ⛔ C1-2 后端未实现：POST /platform/tenants/:id/export（异步加密任务）
  // 原实现弹「已创建导出任务」——属**谎报成功**，本单改为如实提示并保持弹窗不关。
  ElMessage.warning('数据导出：POST /platform/tenants/:id/export 后端接口未就绪，已转 C1-2，本次未创建')
}

/* ───────────────────────────────────────────────────────────
   续费 / 冻结
   ─────────────────────────────────────────────────────────── */
// ⛔ C1-2 后端未实现：POST /platform/tenants/:id/renew
function onRenew() {
  ElMessage.warning('立即续费：POST /platform/tenants/:id/renew 后端接口未就绪，已转 C1-2')
}
// ✅ 已联调：POST /platform/tenants/:id/toggle（platform-tenant.routes.ts:34，已存在）
//    后端真实语义是「启用/禁用」，设计稿文案为「冻结」，本处按后端语义给提示，避免谎报动作名。
async function onFreeze() {
  const id = Number(route.params.id)
  const target = detail.value?.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
  try {
    await toggleTenantApi(id, target)
    ElMessage.success(target === 'ACTIVE' ? '已启用该租户' : '已停用该租户')
    await fetchDetail()
  } catch {
    /* request 拦截器已统一弹中文错误，页面不重复提示 */
  }
}

/* ───────────────────────────────────────────────────────────
   租户概况
   ✅ 已联调：GET /api/platform/tenants/:id/overview（C1-2 A3 落地，只读聚合）
      ⚠️ 与 GET /platform/tenants/usage-stats 不是同一件事：
         usage-stats 是**平台侧全租户**使用量（totalUsers/totalOrders/totalSales/totalProducts），
         overview 是**单租户**口径且含环比/近 7 日活跃/单据量/存储水位。本面板要的是后者。
   后端字段：goods/goodsCap/orders/ordersPrevMonth/ordersMomPct/staff/staffActive7d/
            docCount/docBreakdown/docRate(恒 null)/store/storeUnit/storeRate/unavailable[]
   无数据源的维度后端返回 null 并在 unavailable[] 给原因，前端原样落「—」，不做本地换算。
   ─────────────────────────────────────────────────────────── */
const overviewLoading = ref(false)
const overviewError = ref(false)
const EMPTY_OVERVIEW = {
  goods: null, goodsCap: null, orders: null, ordersMomPct: null, staff: null,
  staffActive7d: null, docCount: null, docRate: null,
  store: null, storeUnit: 'GB', storeRate: null, unavailable: [] as { key: string; reason: string }[],
}
const overview = ref<any>({ ...EMPTY_OVERVIEW })

/** null → '—'；0 是真实值，必须照显示（不能用 || 兜底把 0 吞成 '—'） */
function fmtInt(n: unknown): string {
  return n == null ? '—' : Number(n).toLocaleString('en-US')
}
/** 环比：null 表示上月为 0 无分母（后端不造 0），显示 '—' */
function fmtPct(n: unknown): string {
  if (n == null) return '—'
  const v = Number(n)
  return `${v > 0 ? '+' : ''}${v}%`
}
const unavailableText = computed(() => {
  const list = overview.value?.unavailable
  if (!Array.isArray(list) || !list.length) return ''
  return `无数据源维度（后端如实标注）：${list.map((u: any) => `${u.key} — ${u.reason}`).join('；')}`
})

async function fetchOverview() {
  const tenantId = route.params.id
  if (!tenantId) return
  overviewLoading.value = true
  overviewError.value = false
  try {
    const res: any = await getTenantOverviewApi(tenantId)
    overview.value = { ...EMPTY_OVERVIEW, ...(res?.data || {}) }
  } catch {
    overview.value = { ...EMPTY_OVERVIEW }
    overviewError.value = true
  } finally {
    overviewLoading.value = false
  }
}

function toast(msg: string) {
  ElMessage.info(msg)
}

/* ───────────────────────────────────────────────────────────
   资源配额使用情况（批 4：接真实数据，禁止模拟数据上屏）
   仅做「百分比用于画条」，数值换算/除法展示一律不在此处发生（后端已换算）
   ─────────────────────────────────────────────────────────── */
const quota = ref<any>(null)
const quotaLoading = ref(false)
const quotaError = ref(false)
const quotaRows = computed<QuotaRow[]>(() => buildQuotaRows(quota.value))

/* 存储水位文案：取自 overview（后端已换算好 used，单位由 storeUnit 给出），前端不做除法 */
const storeText = computed(() => {
  const used = overview.value?.store
  if (used == null) return '—'
  const unit = overview.value?.storeUnit || 'GB'
  const rate = overview.value?.storeRate
  return rate == null ? `${Number(used).toLocaleString('en-US')} ${unit}` : `${Number(used).toLocaleString('en-US')} ${unit}（${rate}%）`
})

async function fetchQuota() {
  quotaLoading.value = true
  quotaError.value = false
  try {
    // 新客户端已自动 toast，页面层只做内容区错误态，不重复弹
    const res: any = await getTenantQuotaApi(Number(route.params.id))
    quota.value = res.data
  } catch (e) {
    quota.value = null
    quotaError.value = true
  } finally {
    quotaLoading.value = false
  }
}

// ✅ 已联调：POST /api/platform/tenants/:id/quota-expand（C1-2 A5 落地，写 t_platform_audit_log 留痕）
function onExpandQuota() {
  expandForm.amount = ''
  expandForm.days = '30'
  expandForm.reason = ''
  expandVisible.value = true
}

async function onSubmitExpand() {
  const amount = Number(expandForm.amount)
  const days = Number(expandForm.days)
  if (!Number.isInteger(amount) || amount <= 0) {
    ElMessage.warning('扩容幅度必须为正整数')
    return
  }
  if (!Number.isInteger(days) || days <= 0) {
    ElMessage.warning('有效期（天）必须为正整数')
    return
  }
  expandSubmitting.value = true
  try {
    await expandTenantQuotaApi(route.params.id, {
      field: expandForm.field,
      amount,
      days,
      reason: expandForm.reason || undefined,
    })
    ElMessage.success('临时扩容已提交（已留痕）')
    expandVisible.value = false
    await fetchQuota()
    await fetchOverview()
  } catch {
    /* request 拦截器已统一弹中文错误；失败保持弹窗不关 */
  } finally {
    expandSubmitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
  fetchQuota()
  fetchOverview()
})
</script>

<style scoped>
/* ───── 弹窗内容结构（设计稿 .m-hd / .m-bd / .m-ft） ───── */
.m-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.m-hd .pt {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
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
.m-bd {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-3); /* 设计稿 11px 无对应 token，取 --space-3(12px) 近似 */
  overflow-y: auto;
}
.m-ft {
  border-top: 1px solid var(--g2);
  padding: var(--space-3) var(--space-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  background: var(--g0);
  flex: none;
}

/* ───── el-dialog 盒样式对齐设计稿（圆角 16 / 阴影 / 去默认内边距） ───── */
:deep(.el-dialog) {
  border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow);
  overflow: hidden;
}
:deep(.el-dialog__body) {
  padding: 0;
}
/* 高危弹窗顶部红色描边（设计稿行 627：border-top 3px solid --red） */
:deep(.danger-dialog) {
  border-top: 3px solid var(--color-danger); /* 3px 描边宽度无对应 token，列入缺失清单 */
}

/* ───── 控件辅助 ───── */
.sel-full {
  width: 100%;
  justify-content: space-between;
}
.caret {
  color: var(--g4);
  font-style: normal;
  font-size: var(--ctrl-caret-size);
}
.req {
  color: var(--color-danger);
  font-style: normal;
}
.reason-row,
.range-row,
.fmt-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ck-line {
  font-size: var(--text-sm);
}
.note {
  border-top: 1px dashed var(--g2);
  padding-top: var(--space-2);
}
.quota-err {
  color: var(--color-danger);
}
/* 错误态「重试」入口（C1-1：与空态分开） */
.retry {
  margin-left: var(--space-2);
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}

/* ───── v1.5 修订标记（设计稿 .v15-tag.lt，components.css 未移植，按令牌实现） ───── */
.v15-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--ctrl-caret-size);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  white-space: nowrap;
  vertical-align: var(--ver-tag-valign);
}
.v15-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
</style>
