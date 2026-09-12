<template>
  <!-- ═══════════════════════════════════════════════════════════════
       05 AI 中心 · 模型接入（设计稿 v1.6 #sec-ai · 行 899~963，Tab ① 模型接入）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       平台公共模型：设计稿示例（GLM-4-Plus / Qwen-Max / DeepSeek-V3）= 示例模型，严禁硬编码，
       以空数组 + 空态渲染；接入逻辑以 TODO 占位。
       租户自定义模型：复用现有外部模型 API（api/ai-config.listExternalModels 等）。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="ai-model-access">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">模型接入</div>
        <p class="pd">
          平台级密钥加密托管 · 租户永不接触模型密钥 · 请求统一经 AI 网关转发 · 免费版赠送额度仅可用于本区模型
        </p>
      </div>
      <div class="pg-act">
        <span class="btn btn-p" @click="todo('接入新模型')">+ 接入新模型</span>
      </div>
    </div>

    <!-- ════════ 平台公共模型 ════════ -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">
          平台公共模型
          <span class="tag tag-g">全部租户可用 · 含免费版</span>
          <span class="ver-tag">v1.1 分区</span>
        </span>
        <span class="ph-s">模型服务商已接入，平台统一托管密钥</span>
      </div>
      <div class="p-bd">
        <div class="g4" v-if="publicModels.length">
          <div class="panel flush" v-for="m in publicModels" :key="m.id">
            <div class="p-bd">
              <div class="model-top">
                <b class="model-name">{{ m.name }}</b>
                <span class="tag" :class="m.statusClass">{{ m.statusText }}</span>
              </div>
              <p class="small model-sub">{{ m.vendor }} · {{ m.scene }}</p>
              <div class="qrow">
                <span>输入单价</span>
                <div class="qfill"></div>
                <em>{{ m.inputPrice }}</em>
              </div>
              <div class="qrow">
                <span>输出单价</span>
                <div class="qfill"></div>
                <em>{{ m.outputPrice }}</em>
              </div>
              <p class="model-foot">
                今日调用 {{ m.todayCalls }} 次 · 成本 {{ m.todayCost }}
                <span class="lk fr" @click="todo('编辑模型 ' + m.name)">编辑 ›</span>
              </p>
            </div>
          </div>
          <div class="panel flush dashed add-card">
            <div class="center">
              <span class="add-ic">+</span>
              <b class="rule-title">接入新模型</b>
              <p class="small mt6">文本对话 / Embedding / 视觉理解<br />登记厂商·密钥·单价·限流并发</p>
            </div>
          </div>
        </div>
        <div class="empty" v-else>暂无平台公共模型配置，点击右上角「+ 接入新模型」登记厂商与单价</div>
      </div>
    </div>

    <!-- ════════ 租户自定义模型（v1.1 分区） ════════ -->
    <div class="v11-zone">
      <div class="pg-hd">
        <div>
          <div class="pt4">
            租户自定义模型
            <span class="tag tag-o">仅基础版及以上可开通</span>
            <span class="ver-tag">v1.1 新增分区</span>
          </div>
          <p class="pd">
            付费租户接入自有大模型 API 密钥（提交端点与密钥 → 平台安全合规审核 → 启用，密钥加密托管，调用经 AI 网关计量）·
            <b>免费版不支持自定义模型，仅可使用平台公共模型</b>
          </p>
        </div>
        <div class="pg-act">
          <span class="btn" @click="openCreate">+ 登记租户自定义模型</span>
        </div>
      </div>

      <div class="panel">
        <div class="p-bd">
          <div class="g4" v-if="customModels.length">
            <div class="panel flush custom-on" v-for="m in customModels" :key="m.id">
              <div class="p-bd">
                <div class="model-top">
                  <b class="model-name">{{ m.displayName }} <span class="ver-tag">v1.1</span></b>
                  <span class="tag" :class="m.enabled === 1 ? 'tag-g' : 'tag-gy'">
                    {{ m.enabled === 1 ? '已启用' : '待启用' }}
                  </span>
                </div>
                <p class="small model-sub">
                  租户：{{ m.tenantName || '—' }} · 场景：{{ m.scene || '—' }}
                </p>
                <div class="qrow">
                  <span>API 端点</span>
                  <div class="qfill"></div>
                  <em><span class="mask">{{ m.providerBaseUrl || '—' }}</span></em>
                </div>
                <div class="qrow">
                  <span>密钥托管</span>
                  <div class="qfill"></div>
                  <em><span class="mask">{{ m.apiKeyMasked || '未设置' }}</span></em>
                </div>
                <p class="model-foot">
                  审核状态：{{ m.auditStatus || '待复核' }}
                  <span class="lk fr" @click="openEdit(m)">详情 ›</span>
                </p>
              </div>
            </div>
            <div class="panel flush dashed rule-card">
              <div class="center">
                <b class="rule-title">自定义模型接入规则</b>
                <p class="small mt6">
                  租户提交端点与密钥 → 平台安全合规审核<br />
                  通过后启用 · 调用经 AI 网关计量计费<br />
                  <b class="warn-text">免费版租户不可申请（入口不展示）</b>
                </p>
              </div>
            </div>
          </div>
          <div class="empty" v-else>暂无租户自定义模型，点击「+ 登记租户自定义模型」提交端点与密钥</div>
        </div>
      </div>

      <!-- v1.1 付费墙示意 -->
      <div class="v11-gate mt12">
        <span class="ver-tag">v1.1 付费墙示意</span>
        <b class="gate-title">免费版租户访问时：</b>
        <span class="v11-dim">
          <span class="btn">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true" style="flex:none">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>接入自有模型
          </span>
          <span class="small">「租户自定义模型」入口灰显不可点</span>
        </span>
        <span class="v11-lock">
          <span class="lkic">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          免费版 · 仅平台公共模型
          <span class="v11-onlypay">仅付费</span>
        </span>
        <span class="gate-action">
          <span class="small">解锁自定义模型能力 →</span>
          <span class="btn btn-p" @click="todo('升级解锁')">升级解锁</span>
        </span>
      </div>
    </div>

    <!-- ════════ 登记 / 编辑租户自定义模型（zx-scope 弹窗） ════════ -->
    <div v-if="dialogVisible" class="ov" @click.self="dialogVisible = false"></div>
    <div v-if="dialogVisible" class="modal">
      <div class="m-hd">
        <span class="pt">{{ editingId ? '编辑租户自定义模型' : '登记租户自定义模型' }}</span>
        <span class="d-x" @click="dialogVisible = false">✕</span>
      </div>
      <div class="m-bd zx-scope">
        <div class="frow">
          <span class="fld fld-grow">
            <span>名称 <i class="req">*</i></span>
            <input v-model="modelForm.displayName" class="ipt" placeholder="如：青云优选大模型" />
          </span>
          <span class="fld fld-wide">
            <span>标识 <i class="req">*</i></span>
            <input v-model="modelForm.name" class="ipt" :disabled="!!editingId" placeholder="字母数字下划线，唯一" />
          </span>
        </div>
        <span class="fld">
          <span>租户 <i class="req">*</i></span>
          <input v-model="modelForm.tenantName" class="ipt" placeholder="绑定租户（商家账号 / 租户编码）" />
        </span>
        <span class="fld">
          <span>应用场景</span>
          <input v-model="modelForm.scene" class="ipt" placeholder="如：智能找货 / 选品建议" />
        </span>
        <span class="fld">
          <span>API 端点 <i class="req">*</i></span>
          <input v-model="modelForm.providerBaseUrl" class="ipt" placeholder="https://your-llm.example.com/v1" />
        </span>
        <span class="fld">
          <span>模型名称 <i class="req">*</i></span>
          <input v-model="modelForm.modelName" class="ipt" placeholder="如：your-model-name" />
        </span>
        <span class="fld">
          <span>API Key</span>
          <input v-model="modelForm.apiKey" type="password" show-password class="ipt" :placeholder="modelKeyPlaceholder" autocomplete="new-password" />
          <span class="small mt6">提交后密钥加密托管，前端永不接触明文</span>
        </span>
        <div class="frow">
          <span class="fld">
            <span>启用</span>
            <span class="tg" :class="{ off: modelForm.enabled !== 1 }" @click="modelForm.enabled = modelForm.enabled === 1 ? 0 : 1"></span>
          </span>
        </div>
        <div class="tipbar">
          <span class="ic">i</span>
          <span>提交后进入平台安全合规审核流程（约 1 个工作日），审核通过方可启用；调用统一经 AI 网关计量计费。</span>
        </div>
      </div>
      <div class="m-ft">
        <span class="btn" @click="dialogVisible = false">取消</span>
        <span class="btn" :class="{ 'btn-p': false }" @click="handleTestDialog">测试连接</span>
        <span class="btn btn-p" :class="{ 'btn-p': true }" :disabled="savingModel" @click="handleSaveModel">保存</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listExternalModels,
  listExternalModelOptions,
  createExternalModel,
  updateExternalModel,
  deleteExternalModel,
  testExternalModel,
  testExternalModelById,
  type ExternalModelView,
  type ExternalModelPayload,
} from '../../api/ai-config'

/** 平台公共模型（设计稿示例值请勿硬编码 → 以空数组 + 空态渲染） */
// TODO: 待接入 GET /platform/ai/public-models —— 平台公共模型列表（含厂商 / 场景 / 输入 / 输出单价 / 今日调用）
interface PublicModel {
  id: number
  name: string
  vendor: string
  scene: string
  inputPrice: string
  outputPrice: string
  statusText: string
  statusClass: string
  todayCalls: string
  todayCost: string
}
const publicModels = ref<PublicModel[]>([])

/** 租户自定义模型：复用现有外部模型 API（api/ai-config.listExternalModels） */
interface CustomModelView extends ExternalModelView {
  tenantName?: string
  scene?: string
  auditStatus?: string
}
const customModels = ref<CustomModelView[]>([])
const externalOptions = ref<{ name: string; displayName: string; modelName: string }[]>([])

const loading = ref(false)
async function loadCustomModels() {
  loading.value = true
  try {
    const [list, options] = await Promise.all([listExternalModels(), listExternalModelOptions()])
    customModels.value = list as CustomModelView[]
    externalOptions.value = options
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  } finally {
    loading.value = false
  }
}

function todo(msg: string) {
  ElMessage.info(`${msg}（接口待接入）`)
}

/* ───────────── 登记 / 编辑弹窗（复用外部模型 CRUD API） ───────────── */
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const savingModel = ref(false)
const testing = ref(false)
const modelForm = reactive<ExternalModelPayload & { tenantName: string; scene: string; apiKeySet: boolean; apiKeyMasked: string | null; enabled: number }>({
  name: '',
  displayName: '',
  providerBaseUrl: '',
  apiKey: '',
  modelName: '',
  enabled: 1,
  sortOrder: 0,
  tenantName: '',
  scene: '',
  apiKeySet: false,
  apiKeyMasked: null,
})
const modelKeyPlaceholder = modelForm.apiKeySet ? `已设置（${modelForm.apiKeyMasked ?? '****'}），留空表示不修改` : '请输入 API Key'

function openCreate() {
  editingId.value = null
  Object.assign(modelForm, {
    name: '', displayName: '', providerBaseUrl: '', apiKey: '', modelName: '', enabled: 1, sortOrder: 0,
    tenantName: '', scene: '', apiKeySet: false, apiKeyMasked: null,
  })
  dialogVisible.value = true
}
function openEdit(row: CustomModelView) {
  editingId.value = row.id
  Object.assign(modelForm, {
    name: row.name, displayName: row.displayName, providerBaseUrl: row.providerBaseUrl, apiKey: '',
    modelName: row.modelName, enabled: row.enabled, sortOrder: row.sortOrder,
    tenantName: row.tenantName ?? '', scene: row.scene ?? '', apiKeySet: row.apiKeySet, apiKeyMasked: row.apiKeyMasked,
  })
  dialogVisible.value = true
}
async function handleSaveModel() {
  if (!modelForm.displayName || !modelForm.name || !modelForm.providerBaseUrl || !modelForm.modelName) {
    ElMessage.warning('请填写名称、标识、API 端点与模型名称')
    return
  }
  savingModel.value = true
  try {
    const payload: ExternalModelPayload = {
      name: modelForm.name, displayName: modelForm.displayName, providerBaseUrl: modelForm.providerBaseUrl,
      modelName: modelForm.modelName, enabled: modelForm.enabled, sortOrder: modelForm.sortOrder,
    }
    if (modelForm.apiKey) payload.apiKey = modelForm.apiKey
    if (editingId.value) {
      await updateExternalModel(editingId.value, payload)
      ElMessage.success('租户自定义模型已更新')
    } else {
      await createExternalModel(payload)
      ElMessage.success('已提交，进入安全合规审核')
    }
    dialogVisible.value = false
    await loadCustomModels()
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  } finally {
    savingModel.value = false
  }
}
async function handleTestDialog() {
  if (!modelForm.providerBaseUrl || !modelForm.modelName) {
    ElMessage.warning('请先填写 API 地址与模型名称')
    return
  }
  if (!modelForm.apiKey && !modelForm.apiKeySet) {
    ElMessage.warning('请先填写 API Key')
    return
  }
  testing.value = true
  try {
    const result = await testExternalModel({ providerBaseUrl: modelForm.providerBaseUrl || '', apiKey: modelForm.apiKey || '', modelName: modelForm.modelName || '' })
    if (result.success) ElMessage.success(`连接成功（${result.latencyMs}ms）：${result.message}`)
    else ElMessage.error(`连接失败：${result.message}`)
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  } finally {
    testing.value = false
  }
}
// 列表行的「详情 ›」内可触发按 ID 测试（保留现有接口 testExternalModelById）
async function testById(id: number) {
  try {
    const result = await testExternalModelById(id)
    if (result.success) ElMessage.success(`连接成功（${result.latencyMs}ms）：${result.message}`)
    else ElMessage.error(`连接失败：${result.message}`)
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  }
}
// 删除外部模型（保留现有接口 deleteExternalModel，设计稿以编辑/审核为主，删除作为合规下线入口）
async function removeModel(row: CustomModelView) {
  try {
    await ElMessageBox.confirm(`确认下线租户自定义模型「${row.displayName}」？下线后注销运行时`, '下线确认', { type: 'warning', confirmButtonText: '下线', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    await deleteExternalModel(row.id)
    ElMessage.success('已下线')
    await loadCustomModels()
  } catch {
    // 错误提示已由 ai-config 请求拦截器统一处理
  }
}

onMounted(loadCustomModels)
</script>

<style scoped>
.ai-model-access {
  /* 根容器，仅作作用域锚点；样式由 .pf-main 下的通用组件类承载 */
}
.flush {
  box-shadow: none;
}
.dashed {
  border-style: dashed;
}
.qfill {
  flex: 1 1 auto;
  min-width: 8px;
}
.model-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.model-name {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.model-sub {
  margin: 3px 0 8px;
}
.custom-on {
  border-color: var(--color-primary-soft);
}
.model-foot {
  border-top: 1px dashed var(--g2);
  padding-top: 6px;
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--g4);
}
.lk.fr {
  float: right;
  cursor: pointer;
}
.rule-title {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.warn-text {
  color: var(--color-warning);
}
.center {
  text-align: center;
  min-height: var(--tpl-card-min-h);
  display: grid;
  place-items: center;
}
.add-ic {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: var(--font-normal);
  margin: 0 auto;
}
.add-card .center {
  min-height: 150px;
}
.v11-zone {
  margin-top: var(--space-3);
}
.v11-gate {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border: 1px dashed var(--g3);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  background: repeating-linear-gradient(-45deg, var(--g0), var(--g0) 8px, var(--g1), var(--g1) 16px);
}
.gate-title {
  font-size: var(--text-md);
  color: var(--g6);
  flex: none;
}
.v11-dim {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  opacity: 0.55;
  filter: grayscale(1);
}
.v11-dim .btn {
  pointer-events: none;
  color: var(--g4);
  border-style: dashed;
}
.v11-lock {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  padding: 2px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--g2);
  background: var(--g0);
  color: var(--g5);
}
.v11-lock .lkic {
  display: inline-grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: 4px;
  background: var(--g3);
  color: var(--g6);
  flex: none;
}
.v11-onlypay {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  border: 1px solid var(--warning-line);
  color: var(--color-warning);
  font-weight: var(--font-semibold);
  margin-left: 4px;
}
.gate-action {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fld-grow {
  flex: 1;
}
.fld-wide {
  flex: 1.4;
}
.req {
  color: var(--color-danger);
  font-style: normal;
}

/* 弹窗（设计稿 .ov / .modal / .m-hd / .m-bd / .m-ft / .d-x，components.css 未移植，按令牌实现） */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 30;
}
.modal {
  position: fixed;
  z-index: 31;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--modal-width);
  max-width: 92%;
  max-height: 88%;
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.m-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  overflow-y: auto;
  display: grid;
  gap: var(--space-3);
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
</style>
