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
        <span class="ph-s">回调地址与签名密钥已打码</span>
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
                <td><b>{{ row.tenant }}</b></td>
                <td>{{ row.eventType }}</td>
                <td><span class="mask">{{ row.callback }}</span></td>
                <td><span class="mask">{{ row.signKey }}</span></td>
                <td>{{ row.retry }}</td>
                <td class="num">{{ row.push7d }} / {{ row.successRate }}</td>
                <td><span class="tag" :class="triggerClass(row.trigger)">{{ row.triggerText }}</span></td>
                <td><span class="tag" :class="row.paused ? 'tag-r' : 'tag-g'">{{ row.paused ? '已暂停' : '生效中' }}</span></td>
                <td>
                  <span class="btn-t" @click="onTest(row)">测试推送</span>
                  <span class="btn-t" @click="onLog(row)">日志</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!subs.length" class="empty">暂无事件订阅 · 待接入 GET /platform/open/webhooks</div>
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
    >
      <div style="display: grid; gap: var(--space-3)">
        <div class="fld">
          <span>选择租户 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <!-- TODO: 待接入 GET /platform/open/tenants（开放平台已开通租户） -->
          <span class="sel" style="justify-content: space-between; width: 100%">请选择租户<b style="color: var(--g4)">▾</b></span>
        </div>
        <div class="fld">
          <span>事件类型 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <!-- TODO: 待接入 GET /platform/open/events（事件目录） -->
          <span class="sel" style="justify-content: space-between; width: 100%">请选择事件类型<b style="color: var(--g4)">▾</b></span>
        </div>
        <div class="fld">
          <span>回调地址 <i style="color: var(--color-danger); font-style: normal">*</i></span>
          <span class="ipt" style="width: 100%" @click="focusCallback">{{ callback || 'https://' }}</span>
        </div>
        <div class="fld">
          <span>重试策略</span>
          <span class="sel" style="justify-content: space-between; width: 100%">1min / 5min / 30min ×3<b style="color: var(--g4)">▾</b></span>
        </div>

        <div class="tipbar w">
          <span class="ic">!</span>
          <span>签名密钥 <b>仅在创建时展示一次</b>，遗失只能重置；连续失败 ≥10 次将自动暂停订阅并站内通知租户。</span>
        </div>

        <div class="panel" style="box-shadow: none; background: var(--g0)">
          <div class="p-bd" style="font-size: var(--text-sm)">
            <span class="small">创建结果（示意）</span>
            <div class="mt6">签名密钥：<span v-if="createdKey" class="mask" style="color: var(--color-primary-hover); border-color: var(--color-primary-soft)">{{ createdKey }}</span><span v-else class="muted">—</span></div>
            <p v-if="!createdKey" class="small mt6 muted">确认创建后自动展示，仅此一次</p>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="btn" @click="createVisible = false">取消</span>
        <span class="btn btn-p" @click="confirmCreate">确认创建</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const router = useRouter()
const MODAL_W = 'var(--modal-width)'

// ====== 数据（无对应开放平台接口：空态渲染，禁止造假数据） ======
interface WebhookSub {
  id: number
  tenant: string
  eventType: string
  callback: string
  signKey: string
  retry: string
  push7d: number | string
  successRate: string
  trigger: 'OK' | 'FAIL' | 'PAUSED'
  triggerText: string
  paused: boolean
}
const loading = ref(false)
const subs = ref<WebhookSub[]>([])

onMounted(() => {
  // TODO: 待接入 GET /platform/open/webhooks（开放平台事件订阅列表）
  loading.value = false
})

function triggerClass(t: WebhookSub['trigger']): string {
  return t === 'OK' ? 'tag-g' : t === 'FAIL' ? 'tag-o' : 'tag-r'
}

function onTest(_r: WebhookSub) { ElMessage.info('测试推送：待接入 POST /platform/open/webhooks/:id/test') }
function onLog(_r: WebhookSub) { ElMessage.info('日志：待接入 GET /platform/open/webhooks/:id/logs') }

// ====== Tab 切换 ======
function goApiKeys() { router.push('/open/api-keys') }

// ====== 新建订阅弹窗 ======
const createVisible = ref(false)
const callback = ref('')
const createdKey = ref('')
function focusCallback() { ElMessage.info('回调地址：待接入输入控件') }
function openCreate() {
  createdKey.value = ''
  createVisible.value = true
}
function confirmCreate() {
  // TODO: 待接入 POST /platform/open/webhooks（返回一次性签名密钥）
  ElMessage.success('已提交创建（接口待接入，结果将于对接后展示）')
  createVisible.value = false
}
</script>
