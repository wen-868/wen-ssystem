<template>
  <div>
    <!-- 顶部 Tab 头：API 密钥 / Webhook 管理（两页共享，当前页 .on） -->
    <div class="tabs">
      <span class="tab on">API 密钥</span>
      <span class="tab" @click="goWebhooks">Webhook 管理</span>
    </div>

    <!-- 页头：标题 + 概览说明 + 操作 -->
    <div class="pg-hd mt12">
      <div>
        <div class="pt4">API 密钥</div>
        <p class="pd">已签发密钥 14 个 · 在用 11 · 沙箱环境独立隔离 · 免费版/基础版默认不开放</p>
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
        <span class="ph-s">租户级调用凭证 · AppKey 已打码</span>
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
                <th class="num">近7日调用</th>
                <th class="num">错误率</th>
                <th>状态</th>
                <th>签发时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in apiKeys" :key="row.id">
                <td>
                  <b>{{ row.tenant }}</b>
                  <span v-if="row.tenantSub" class="sub">{{ row.tenantSub }}</span>
                </td>
                <td><span class="mask">{{ maskKey(row.appKey) }}</span></td>
                <td>
                  <span v-for="(s, i) in row.scopes" :key="i" class="tag" :class="s.readonly ? 'tag-gy' : 'tag-b'">{{ s.label }}</span>
                </td>
                <td>{{ row.qps }} 次/秒</td>
                <td class="num">{{ row.calls7d }}</td>
                <td class="num">{{ row.errRate }}</td>
                <td><span class="tag" :class="statusClass(row.status)">{{ row.statusText }}</span></td>
                <td>{{ row.issuedAt }}</td>
                <td>
                  <span class="btn-t" @click="onRotate(row)">轮换</span>
                  <span class="btn-t" @click="onCalls(row)">调用量</span>
                  <span class="btn-t dgr" @click="onRevoke(row)">吊销</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!apiKeys.length" class="empty">暂无已签发密钥 · 待接入 GET /platform/open/api-keys</div>
      </div>
    </div>

    <!-- 签发密钥弹窗 -->
    <el-dialog
      v-model="issueVisible"
      title="签发 API 密钥"
      :width="MODAL_W"
      :close-on-click-modal="false"
    >
      <div style="display: grid; gap: var(--space-3)">
        <div class="fld">
          <span>选择租户 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <!-- TODO: 待接入 GET /platform/open/tenants（开放平台已开通租户） -->
          <span class="sel" style="justify-content: space-between; width: 100%">请选择租户<b style="color: var(--g4)">▾</b></span>
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
                :class="{ 'btn-p': tier === t }"
                @click="tier = t"
              >{{ t }} 次/秒</span>
            </div>
          </span>
          <span class="fld" style="flex: 1">
            <span>备注</span>
            <span class="ipt" style="width: 100%" @click="focusRemark">{{ remark || '对接租户自有 BI 系统' }}</span>
          </span>
        </div>

        <div class="tipbar w">
          <span class="ic">!</span>
          <span>AppSecret <b>仅在签发时展示一次</b>，遗失只能重置；扩权需租户管理员确认 + 平台侧留痕；吊销在用密钥需审批并提前 7 天通知租户。</span>
        </div>

        <div class="panel" style="box-shadow: none; background: var(--g0)">
          <div class="p-bd" style="font-size: var(--text-sm)">
            <span class="small">签发结果（示意）</span>
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
        <span class="btn btn-p" @click="confirmIssue">确认签发</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const router = useRouter()
const MODAL_W = 'var(--modal-width)'

// ====== 数据（无对应开放平台接口：空态渲染，禁止造假数据） ======
interface OpenApiKey {
  id: number
  tenant: string
  tenantSub?: string
  appKey: string
  scopes: { label: string; readonly: boolean }[]
  qps: number
  calls7d: number | string
  errRate: string
  status: 'ACTIVE' | 'ROTATING' | 'DISABLED'
  statusText: string
  issuedAt: string
}
const loading = ref(false)
const apiKeys = ref<OpenApiKey[]>([])

onMounted(() => {
  // TODO: 待接入 GET /platform/open/api-keys（开放平台密钥列表）
  // 现有 src/api/library.ts 的 listApiKeysApi 属于商品库，不在此复用
  loading.value = false
})

// ====== 工具 ======
function maskKey(key: string): string {
  if (!key) return '—'
  return key
}
function statusClass(s: OpenApiKey['status']): string {
  return s === 'ACTIVE' ? 'tag-g' : s === 'ROTATING' ? 'tag-o' : 'tag-gy'
}
function copy(t: string) {
  navigator.clipboard?.writeText(t).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败'),
  )
}
function download() {
  ElMessage.info('下载 .txt（待接入签发结果后可用）')
}

// ====== 行操作（占位，待接入对应接口） ======
function onRotate(_r: OpenApiKey) { ElMessage.info('轮换：待接入 POST /platform/open/api-keys/:id/rotate') }
function onCalls(_r: OpenApiKey) { ElMessage.info('调用量：待接入 GET /platform/open/api-keys/:id/stats') }
function onRevoke(_r: OpenApiKey) { ElMessage.warning('吊销：需审批并提前 7 天通知租户（待接入）') }

// ====== Tab 切换 ======
function goWebhooks() { router.push('/open/webhooks') }
function openDoc() { ElMessage.info('接口文档目录：待接入开放平台文档中心') }

// ====== 签发弹窗 ======
const issueVisible = ref(false)
interface ScopeDomain { key: string; label: string; checked: boolean; rw: boolean }
const scopes = reactive<ScopeDomain[]>([
  { key: 'product', label: '商品域', checked: true, rw: false },
  { key: 'stock', label: '库存域', checked: true, rw: true },
  { key: 'sale', label: '销售单域', checked: true, rw: true },
  { key: 'member', label: '会员 / 对账域', checked: false, rw: false },
])
function toggleRw(d: ScopeDomain) {
  if (!d.checked) d.checked = true
  d.rw = !d.rw
}
const qpsTiers = [10, 30, 50]
const tier = ref(30)
const remark = ref('')
function focusRemark() { ElMessage.info('备注：待接入输入控件') }

const issuedResult = ref<{ apiKey: string; apiSecret: string } | null>(null)
function openIssue() {
  issuedResult.value = null
  issueVisible.value = true
}
function confirmIssue() {
  // TODO: 待接入 POST /platform/open/api-keys（返回一次性 AppKey / AppSecret）
  ElMessage.success('已提交签发（接口待接入，结果将于对接后展示）')
  issueVisible.value = false
}
</script>
