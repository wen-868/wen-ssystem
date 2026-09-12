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
        <!-- TODO: 待接入 GET /platform/tenants/:id/overview —— 聚合统计口径 -->
        <div class="g3">
          <div class="kpi">
            <div class="kt">商品数量</div>
            <div class="kv">{{ overview.goods || '—' }}</div>
            <div class="kd">上限 {{ overview.goodsCap || '—' }}</div>
          </div>
          <div class="kpi">
            <div class="kt">本月订单量</div>
            <div class="kv">{{ overview.orders || '—' }}</div>
            <div class="kd">环比 <span class="up">—</span></div>
          </div>
          <div class="kpi">
            <div class="kt">员工用户数</div>
            <div class="kv">{{ overview.staff || '—' }}</div>
            <div class="kd">近7日活跃 — 人</div>
          </div>
        </div>
        <div class="qrow mt10">
          <span>本月单据量</span>
          <span class="bar"><i :style="{ width: overview.docRate ? overview.docRate + '%' : '0%' }"></i></span>
          <em>{{ overview.docCount || '—' }}</em>
        </div>
        <div class="qrow">
          <span>存储水位</span>
          <span class="bar"><i :style="{ width: overview.storeRate ? overview.storeRate + '%' : '0%' }"></i></span>
          <em>{{ overview.store || '—' }}</em>
        </div>
        <p class="small mt8 note">
          聚合统计口径：总后台仅可见概况指标，<b>不查看租户业务单据明细</b>；如需明细请走「模拟登录」审批流程。
        </p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getTenantApi } from '../../api/tenant'

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
const resetVisible = ref(false)
const exportVisible = ref(false)

/* ───────────────────────────────────────────────────────────
   模拟登录确认
   ─────────────────────────────────────────────────────────── */
const proxyRoles = ['租户主管理员（敏感页只读脱敏）', '租户财务管理员（只读）', '客服协查（只读）']
const proxyForm = reactive({ reason: '', roleIdx: 0 })
function cycleProxyRole() {
  proxyForm.roleIdx = (proxyForm.roleIdx + 1) % proxyRoles.length
}
function onSubmitProxy() {
  // TODO: 待接入 POST /platform/tenants/:id/proxy-login（提交审批流）
  if (!proxyForm.reason) {
    ElMessage.warning('请填写登录事由（关联工单号）')
    return
  }
  ElMessage.success('已提交代登录审批（接口待接入）')
  proxyVisible.value = false
}

/* ───────────────────────────────────────────────────────────
   数据重置
   ─────────────────────────────────────────────────────────── */
const resetReasons = ['租户主动申请', '测试数据清理', '数据错乱恢复']
const resetForm = reactive({ name: '', reason: '' })
function onConfirmReset() {
  // TODO: 待接入 POST /platform/tenants/:id/reset（双因子 + 操作留痕）
  if (resetForm.name !== tenantName.value) {
    ElMessage.warning('输入的租户名称与确认不一致')
    return
  }
  if (!resetForm.reason) {
    ElMessage.warning('请选择重置原因')
    return
  }
  ElMessage.success('已提交数据重置（接口待接入）')
  resetVisible.value = false
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
  // TODO: 待接入 POST /platform/tenants/:id/export（异步加密任务）
  ElMessage.success('已创建导出任务（接口待接入）')
  exportVisible.value = false
}

/* ───────────────────────────────────────────────────────────
   续费 / 冻结（无对应弹窗内容，演示态）
   ─────────────────────────────────────────────────────────── */
function onRenew() { ElMessage.info('立即续费：待接入 POST /platform/tenants/:id/renew') }
function onFreeze() { ElMessage.info('冻结：待接入 POST /platform/tenants/:id/freeze') }

/* ───────────────────────────────────────────────────────────
   租户概况（聚合指标，待接入）
   ─────────────────────────────────────────────────────────── */
const overview = ref<any>({
  goods: '', goodsCap: '', orders: '', staff: '',
  docRate: 0, docCount: '', storeRate: 0, store: ''
})

function toast(msg: string) {
  ElMessage.info(msg)
}

onMounted(fetchDetail)
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
