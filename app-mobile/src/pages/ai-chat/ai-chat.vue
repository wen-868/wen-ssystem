<template>
  <view
    class="ai-chat-page"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- 顶部：沉浸式悬浮操作栏（隐藏导航栏） -->
    <view class="ai-top-bar">
      <view class="ai-top-icon" @tap="openConversationPanel">
        <text class="ai-top-icon-text">☰</text>
      </view>
      <view class="ai-top-info">
        <text class="ai-top-title">AI<text class="ai-top-dot">·</text>实时对话</text>
      </view>
      <view class="ai-close-btn" @tap="closeAi">
        <text class="ai-close-icon">✕</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="chat-body"
      scroll-y
      :scroll-into-view="scrollIntoView"
      :scroll-with-animation="true"
    >
      <view class="chat-list">
        <!-- 欢迎语 + 快捷示例 -->
        <view v-if="messages.length === 0" class="msg-row msg-row--ai">
          <view class="avatar avatar--ai">AI</view>
          <view class="bubble-wrap">
            <view class="bubble bubble--ai">
              <text class="bubble-text">你好！我是你的 AI 经营助手 ✨ 你可以问我任何经营相关的问题，比如库存分析、销售预测、利润优化等。</text>
            </view>
            <view class="welcome-tips">
              <view class="tip-chip" v-for="tip in welcomeTips" :key="tip" @tap="quickSend(tip)">
                <text class="tip-chip-text">{{ tip }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 对话消息 -->
        <view v-for="msg in messages" :key="msg.id" :id="'msg-' + msg.id">
          <!-- 用户消息 -->
          <view v-if="msg.role === 'user'" class="msg-row msg-row--user">
            <view class="bubble bubble--user">
              <text class="bubble-text bubble-text--user">{{ msg.content }}</text>
            </view>
          </view>

          <!-- AI 消息 -->
          <view v-else class="msg-row msg-row--ai">
            <view class="avatar avatar--ai">AI</view>
            <view class="bubble-wrap">
              <view class="bubble bubble--ai">
                <text class="bubble-text">{{ msg.content }}</text>
                <view v-if="msg.streaming && !msg.content" class="typing">
                  <view class="typing-dot" v-for="n in 3" :key="n"></view>
                </view>
                <view
                  v-if="!msg.streaming && msg.content && !msg.preview"
                  class="ai-speak-btn"
                  @tap="speakText(msg.content)"
                >
                  <text class="ai-speak-btn-text">🔊 播报</text>
                </view>
              </view>

              <!-- 工具调用状态 -->
              <view v-if="msg.currentTool" class="tool-tag">
                <view class="tool-tag-spin"></view>
                <text class="tool-tag-text">正在调用工具：{{ msg.currentTool }}</text>
              </view>

              <!-- 工具执行结果摘要（只读工具或执行完成反馈） -->
              <view
                v-if="msg.toolMessage"
                class="tool-result"
                :class="msg.toolSuccess ? 'tool-result--ok' : 'tool-result--fail'"
              >
                <text class="tool-result-text">{{ msg.toolMessage }}</text>
              </view>

              <!-- 写操作预览卡片（确认/取消） -->
              <view v-if="msg.preview" class="preview-card">
                <view class="preview-header">
                  <view class="preview-operation-tag">待确认</view>
                  <text class="preview-operation">{{ msg.preview.operation }}</text>
                </view>
                <view class="preview-summary">
                  <text class="preview-summary-text">{{ msg.preview.summary }}</text>
                </view>
                <view v-if="msg.preview.details" class="preview-details">
                  <template v-for="(value, key) in msg.preview.details" :key="key">
                    <view v-if="!Array.isArray(value)" class="detail-row">
                      <text class="detail-key">{{ formatDetailKey(key) }}</text>
                      <text class="detail-value">{{ formatDetailValue(value) }}</text>
                    </view>
                    <view v-else-if="value.length > 0" class="detail-list">
                      <view class="detail-list-title">{{ formatDetailKey(key) }}</view>
                      <view
                        class="detail-list-item"
                        v-for="(item, idx) in value"
                        :key="idx"
                      >
                        <text class="detail-list-item-text">{{ formatDetailItem(item) }}</text>
                      </view>
                    </view>
                  </template>
                </view>
                <view class="preview-actions">
                  <button
                    class="preview-btn preview-btn--cancel"
                    :disabled="msg.pending"
                    @tap="handleCancel(msg)"
                  >
                    取消
                  </button>
                  <button
                    class="preview-btn preview-btn--confirm"
                    :disabled="msg.pending"
                    @tap="handleConfirm(msg)"
                  >
                    {{ msg.pending ? '处理中…' : '确认执行' }}
                  </button>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部输入栏（隐藏导航栏：沉浸式，宽度与导航栏一栏宽） -->
    <view class="chat-footer" :style="footerBottomStyle">
      <view v-if="attachmentImage" class="attach-preview">
        <image class="attach-preview-img" :src="attachmentImage" mode="aspectFill" />
        <view class="attach-preview-remove" @tap="removeAttachmentImage">
          <text class="attach-preview-remove-text">✕</text>
        </view>
      </view>
      <view class="input-bar">
        <view class="camera-btn" @tap="handleCameraForAi">
          <image class="camera-btn-img" src="/static/icons/ic/camera.svg" mode="aspectFit" />
        </view>
        <textarea
          class="chat-input"
          v-model="inputText"
          placeholder="输入你的问题..."
          placeholder-class="chat-input-placeholder"
          :auto-height="false"
          :maxlength="1000"
          :disabled="sending"
          confirm-type="send"
          @confirm="sendMessage"
          @keyboardheightchange="onKeyboardHeightChange"
        ></textarea>
        <view
          class="voice-send-btn"
          :class="{
            'voice-send-btn--voice': !inputText.trim(),
            'voice-send-btn--recording': recording,
            'voice-send-btn--disabled': sending && !inputText.trim()
          }"
          @tap="onVoiceOrSend"
        >
          <image
            v-if="!inputText.trim()"
            class="voice-send-btn-img"
            src="/static/icons/ic/mic.svg"
            mode="aspectFit"
          />
          <image v-else class="voice-send-btn-img" src="/static/icons/ic/send.svg" mode="aspectFit" />
        </view>
      </view>
      <view v-if="recording" class="recording-hint">
        <view class="recording-dot"></view>
        <text class="recording-hint-text">录音中 {{ recordingTime }}s，再点一次结束</text>
      </view>
    </view>

    <!-- 多对话选择弹窗（半屏） -->
    <view v-if="showConversationPanel" class="conv-mask" @tap="showConversationPanel = false">
      <view class="conv-panel" @tap.stop>
        <view class="conv-panel-head">
          <text class="conv-panel-title">对话列表</text>
          <view class="conv-new-btn" @tap="newConversation">
            <text class="conv-new-text">＋ 新建对话</text>
          </view>
        </view>
        <scroll-view class="conv-list" scroll-y>
          <view
            v-for="c in conversations"
            :key="c.id"
            class="conv-item"
            :class="{ 'conv-item--active': c.id === activeConvoId }"
            @tap="switchConversation(c.id)"
          >
            <text class="conv-item-title">{{ c.title }}</text>
            <text class="conv-item-time">{{ formatTime(c.updatedAt) }}</text>
          </view>
          <view v-if="conversations.length === 0" class="conv-empty">暂无对话</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  aiApi,
  type AiModelOption,
  type AiToolPreview,
  type AiChatToolResultEvent
} from '@/api/modules/ai'
import { voiceTts } from '@/api/modules/ai'

/** 对话消息 */
interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  content: string
  /** 是否正在流式接收 */
  streaming?: boolean
  /** 当前正在调用的工具名 */
  currentTool?: string
  /** 工具执行结果摘要（只读工具/执行完成反馈） */
  toolMessage?: string
  toolSuccess?: boolean
  /** 写操作预览卡片数据 */
  preview?: AiToolPreview | null
  /** 待确认记录 ID */
  confirmationId?: string
  /** 确认/取消请求进行中 */
  pending?: boolean
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const sending = ref(false)
const conversationId = ref('')
/** 待发送图片（base64/dataURL，后端视觉模型识别） */
const attachmentImage = ref('')
/** 语音模式：开启后 AI 回复自动语音播报 */
const voiceMode = ref(false)
const models = ref<AiModelOption[]>([])
const selectedModel = ref('')
let messageSeq = 0
let abortController: AbortController | null = null

// ====================== 多会话（本地会话管理，跨端仅本机） ======================
interface LocalConversation {
  id: number
  title: string
  messages: ChatMessage[]
  serverConversationId: string
  updatedAt: number
}
const conversations = ref<LocalConversation[]>([])
const activeConvoId = ref<number | null>(null)
const showConversationPanel = ref(false)
let convoSeq = 0

function snapshotActiveConversation() {
  const idx = conversations.value.findIndex((c) => c.id === activeConvoId.value)
  if (idx >= 0) {
    const c = conversations.value[idx]
    c.messages = [...messages.value]
    c.serverConversationId = conversationId.value
    const firstUser = messages.value.find((m) => m.role === 'user')
    if (firstUser) c.title = firstUser.content.slice(0, 20)
    c.updatedAt = Date.now()
  }
}

/** 本地会话持久化上限：防止无限增长撑爆 Storage（uni 各端 Storage 上限不一，H5 约 5MB） */
const MAX_PERSIST_CONVERSATIONS = 50
const MAX_PERSIST_MESSAGES = 100

function persistConversations() {
  try {
    const trimmed = [...conversations.value]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PERSIST_CONVERSATIONS)
      .map((c) => ({ ...c, messages: c.messages.slice(-MAX_PERSIST_MESSAGES) }))
    uni.setStorageSync('ai_conversations', trimmed)
  } catch {}
}

function loadConversations() {
  let saved: LocalConversation[] = []
  try {
    const s = uni.getStorageSync('ai_conversations')
    if (Array.isArray(s) && s.length) saved = s
  } catch {}
  if (saved.length) {
    conversations.value = saved
    convoSeq = saved.reduce((m, c) => Math.max(m, c.id), 0)
    const active = saved[0]
    activeConvoId.value = active.id
    messages.value = (active.messages || []) as ChatMessage[]
    conversationId.value = active.serverConversationId || ''
  } else {
    convoSeq += 1
    const fresh: LocalConversation = {
      id: convoSeq,
      title: '新对话',
      messages: [],
      serverConversationId: '',
      updatedAt: Date.now()
    }
    conversations.value = [fresh]
    activeConvoId.value = fresh.id
  }
}

function openConversationPanel() {
  snapshotActiveConversation()
  persistConversations()
  showConversationPanel.value = true
}

function switchConversation(id: number) {
  if (id === activeConvoId.value) {
    showConversationPanel.value = false
    return
  }
  snapshotActiveConversation()
  persistConversations()
  const target = conversations.value.find((c) => c.id === id)
  if (target) {
    activeConvoId.value = target.id
    messages.value = [...(target.messages || [])]
    conversationId.value = target.serverConversationId || ''
  }
  showConversationPanel.value = false
}

function newConversation() {
  snapshotActiveConversation()
  persistConversations()
  convoSeq += 1
  const fresh: LocalConversation = {
    id: convoSeq,
    title: '新对话',
    messages: [],
    serverConversationId: '',
    updatedAt: Date.now()
  }
  conversations.value = [fresh, ...conversations.value]
  activeConvoId.value = fresh.id
  messages.value = []
  conversationId.value = ''
  inputText.value = ''
  showConversationPanel.value = false
}

function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function closeAi() {
  snapshotActiveConversation()
  persistConversations()
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/home/home' })
  }
}

/** 输入区：文本非空 → 发送；为空 → 语音识别 */
function onVoiceOrSend() {
  if (inputText.value.trim()) {
    sendMessage()
  } else {
    toggleRecording()
  }
}

/** 拍照/相册：选择图片 → 转 base64 dataURL → 随消息发送给后端视觉模型 */
function fileToDataUrl(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(filePath)
      .then((r) => r.blob())
      .then((blob) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result || ''))
        fr.onerror = () => reject(new Error('读取图片失败'))
        fr.readAsDataURL(blob)
      })
      .catch(() => reject(new Error('读取图片失败')))
    // #endif
    // #ifndef H5
    const fs = uni.getFileSystemManager()
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res: any) => resolve(`data:image/jpeg;base64,${res.data}`),
      fail: () => reject(new Error('读取图片失败'))
    })
    // #endif
  })
}

function handleCameraForAi() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    sizeType: ['compressed'],
    success: (res: any) => {
      const p = res.tempFilePaths && res.tempFilePaths[0]
      if (!p) return
      fileToDataUrl(p)
        .then((durl) => {
          attachmentImage.value = durl
          uni.showToast({ title: '已添加图片', icon: 'none' })
        })
        .catch(() => uni.showToast({ title: '图片读取失败', icon: 'none' }))
    },
    fail: () => {}
  })
}

function removeAttachmentImage() {
  attachmentImage.value = ''
}

// ====================== 全屏右滑 → 滑出多对话抽屉 ======================
interface TouchPoint { x: number; y: number; t: number }
let touchStartPoint: TouchPoint | null = null

function onTouchStart(e: any) {
  const t = e.touches?.[0] || e.changedTouches?.[0]
  if (!t) return
  touchStartPoint = { x: t.clientX, y: t.clientY, t: Date.now() }
}

function onTouchEnd(e: any) {
  if (!touchStartPoint) return
  const t = e.changedTouches?.[0]
  const start = touchStartPoint
  touchStartPoint = null
  if (!t) return
  const dx = t.clientX - start.x
  const dy = t.clientY - start.y
  const dt = Date.now() - start.t
  // 右滑打开多对话抽屉：横向>阈值、横向明显大于纵向、速度不拖沓、抽屉未开
  const isRightSwipe =
    dx > 70 &&
    Math.abs(dx) > Math.abs(dy) * 1.4 &&
    dt < 1200 &&
    !showConversationPanel.value
  if (isRightSwipe) {
    openConversationPanel()
  }
}

// 初始化会话
loadConversations()

// 手机键盘高度（输入栏 fixed 定位时动态上移，避免被键盘遮挡）
const keyboardHeight = ref(0)
const footerBaseBottomPx = uni.upx2px(20)
const footerBottomStyle = computed(() => ({
  bottom: `calc(${keyboardHeight.value + footerBaseBottomPx}px + env(safe-area-inset-bottom))`,
}))
function onKeyboardHeightChange(e: any) {
  keyboardHeight.value = Math.max(0, Number(e?.detail?.height || 0))
}

// 加载可用模型（内置 + 外部模型），默认选中租户/平台默认
aiApi
  .fetchModels()
  .then((data) => {
    models.value = data.models
    selectedModel.value = data.default
  })
  .catch(() => {
    // 模型列表加载失败不阻塞对话，静默降级
  })

/** 欢迎页快捷示例 */
const welcomeTips = [
  '今日经营分析',
  '库存异常诊断',
  '利润优化建议',
  '快速开单'
]

/** 自动滚动到最后一条消息 */
const scrollIntoView = computed(() => {
  if (messages.value.length === 0) return ''
  const last = messages.value[messages.value.length - 1]
  return `msg-${last.id}`
})

function nextId(): number {
  messageSeq += 1
  return messageSeq
}

/** 快捷示例一键发送 */
function quickSend(text: string) {
  inputText.value = text
  sendMessage()
}

/** 发送消息：追加用户消息 → 创建 AI 流式消息 → 发起 SSE 对话 */
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  // 停止上一次未完成的流式请求
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  inputText.value = ''
  messages.value.push({ id: nextId(), role: 'user', content: text })
  const imagePayload = attachmentImage.value || undefined
  attachmentImage.value = ''

  const aiMsg: ChatMessage = {
    id: nextId(),
    role: 'ai',
    content: '',
    streaming: true
  }
  messages.value.push(aiMsg)
  sending.value = true
  abortController = new AbortController()

  const params = conversationId.value
    ? {
        message: text,
        conversationId: conversationId.value,
        scope: 'mgmt',
        ...(selectedModel.value ? { model: selectedModel.value } : {}),
        ...(imagePayload ? { image: imagePayload } : {})
      }
    : {
        message: text,
        scope: 'mgmt',
        ...(selectedModel.value ? { model: selectedModel.value } : {}),
        ...(imagePayload ? { image: imagePayload } : {})
      }

  try {
    await aiApi.streamChat(
      params,
      {
        onText: (content) => {
          aiMsg.content += content
        },
        onToolStart: (tool) => {
          aiMsg.currentTool = tool
        },
        onToolResult: (event) => {
          handleToolResult(aiMsg, event)
        },
        onDone: (id) => {
          conversationId.value = id
          // 语音模式：AI 回复自动语音播报（文字对话输出文字，语音对话输出语音）
          if (voiceMode.value && aiMsg.content && aiMsg.content.trim()) {
            speakText(aiMsg.content)
          }
        },
        onError: (message) => {
          aiMsg.content = aiMsg.content || '抱歉，请求出错了'
          aiMsg.toolMessage = message
          aiMsg.toolSuccess = false
        }
      },
      abortController.signal
    )
  } catch (err) {
    // 主动中止流不视为错误
    const isAbort = (err as { name?: string } | null)?.name === 'AbortError'
    if (!isAbort) {
      const message = err instanceof Error ? err.message : '请求失败，请稍后重试'
      aiMsg.content = aiMsg.content || '抱歉，请求出错了'
      aiMsg.toolMessage = message
      aiMsg.toolSuccess = false
    }
  } finally {
    aiMsg.streaming = false
    aiMsg.currentTool = ''
    sending.value = false
    abortController = null
    snapshotActiveConversation()
    persistConversations()
  }
}

/** 处理工具执行结果事件 */
function handleToolResult(msg: ChatMessage, event: AiChatToolResultEvent) {
  msg.currentTool = ''

  // 写操作预览 → 渲染确认卡片
  if (event.preview && event.confirmationId) {
    msg.preview = event.preview
    msg.confirmationId = event.confirmationId
    return
  }

  // 只读工具结果 → 展示简短反馈（详细内容由 LLM 总结为文本流）
  if (event.success) {
    msg.toolMessage = summarizeToolData(event.data)
    msg.toolSuccess = true
  } else {
    msg.toolMessage = '工具执行失败，请重新描述需求'
    msg.toolSuccess = false
  }
}

/** 只读工具成功结果的简短摘要 */
function summarizeToolData(data: unknown): string {
  if (!data) return '查询完成'
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (obj.message) return String(obj.message)
    if (obj.summary) return String(obj.summary)
  }
  return '查询完成'
}

/** 确认执行写操作 */
async function handleConfirm(msg: ChatMessage) {
  if (!msg.confirmationId || msg.pending) return
  msg.pending = true
  try {
    const result = await aiApi.confirm(msg.confirmationId)
    msg.preview = null
    msg.confirmationId = ''
    let messageText = '操作执行成功'
    if (result.message) {
      messageText = result.message
    } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
      messageText = String((result.data as { message: unknown }).message)
    }
    msg.toolMessage = messageText
    msg.toolSuccess = true
    uni.showToast({ title: '操作已执行', icon: 'success' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作执行失败'
    msg.toolMessage = message
    msg.toolSuccess = false
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    msg.pending = false
  }
}

/** 取消写操作 */
async function handleCancel(msg: ChatMessage) {
  if (!msg.confirmationId || msg.pending) return
  msg.pending = true
  try {
    await aiApi.cancel(msg.confirmationId)
    msg.preview = null
    msg.confirmationId = ''
    msg.toolMessage = '已取消该操作'
    msg.toolSuccess = false
  } catch (err) {
    const message = err instanceof Error ? err.message : '取消失败'
    msg.toolMessage = message
    msg.toolSuccess = false
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    msg.pending = false
  }
}

// ====================== 预览卡片字段格式化 ======================

/** 常见字段中文名映射（未收录的字段原样显示） */
const DETAIL_KEY_MAP: Record<string, string> = {
  customerId: '客户ID',
  customerName: '客户',
  customerType: '客户类型',
  saleType: '销售类型',
  items: '商品明细',
  totalAmount: '合计金额',
  warnings: '警告',
  skuId: '商品ID',
  skuName: '商品',
  boxQty: '箱数',
  bottleQty: '瓶数',
  totalBottleQty: '总瓶数',
  unitPrice: '单价(元)',
  priceSource: '价格来源',
  totalPrice: '小计(元)',
  supplierName: '供应商',
  storeName: '仓库',
  fromStoreName: '调出仓库',
  toStoreName: '调入仓库',
  remark: '备注'
}

function formatDetailKey(key: string): string {
  return DETAIL_KEY_MAP[key] ?? key
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 数组明细项的缩略展示（优先提取常用可读字段） */
function formatDetailItem(item: unknown): string {
  if (item === null || item === undefined) return '-'
  if (typeof item !== 'object') return String(item)
  const obj = item as Record<string, unknown>
  const name = obj.skuName ?? obj.productName ?? obj.name ?? obj.customerName ?? ''
  const qty = obj.totalBottleQty ?? obj.bottleQty ?? obj.boxQty ?? obj.quantity
  const price = obj.unitPrice ?? obj.price ?? obj.totalPrice
  const parts: string[] = []
  if (name) parts.push(String(name))
  if (qty !== undefined && qty !== null) parts.push(`数量 ${qty}`)
  if (price !== undefined && price !== null) parts.push(`¥${price}`)
  if (parts.length > 0) return parts.join(' · ')
  return JSON.stringify(item)
}

// ====================== 语音输入（H5 Web Speech / APP 原生识别，真实对接） ======================

/**
 * 语音播报（输出·说）：
 * 1) 后端 TTS（微软 Edge TTS，统一音质，mp3 base64）→ H5 data URL 播放 / App 写临时文件播放
 * 2) 失败降级：H5 speechSynthesis / APP plus.speech.startSpeak（系统 TTS）
 */
let speakingAudio: any = null

async function speakText(text: string) {
  if (!text || !text.trim()) return
  stopSpeak()
  const clean = text.replace(/\[CHART\][\s\S]*?\[\/CHART\]/g, '').trim()
  if (!clean) return

  // 1. 后端 TTS（统一音色）
  try {
    const res = await voiceTts(clean.slice(0, 500))
    if (res && res.code === '0' && res.data?.audio) {
      const base64 = res.data.audio
      // #ifdef H5
      const audio = new Audio(`data:audio/mp3;base64,${base64}`)
      speakingAudio = audio
      audio.play().catch(() => { /* 自动播放受限时静默 */ })
      // #endif
      // #ifndef H5
      const fs = uni.getFileSystemManager()
      const tmpPath = `${wx.env.USER_DATA_PATH || ''}/ai_speak_${Date.now()}.mp3`
      fs.writeFile({
        filePath: tmpPath,
        data: base64,
        encoding: 'base64',
        success: () => {
          const inner = uni.createInnerAudioContext()
          speakingAudio = inner
          inner.src = tmpPath
          inner.play()
          inner.onEnded(() => inner.destroy())
          inner.onError(() => {
            inner.destroy()
            speakSystem(clean)
          })
        },
        fail: () => speakSystem(clean)
      })
      // #endif
      return
    }
  } catch { /* 降级 */ }

  speakSystem(clean)
}

/** 系统级 TTS 兜底（H5 浏览器 / APP 原生语音） */
function speakSystem(text: string) {
  // #ifdef H5
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    window.speechSynthesis.speak(u)
    return
  }
  // #endif
  // #ifdef APP-PLUS
  try {
    ;(plus as any).speech.startSpeak(
      { text, lang: 'zh-CN' },
      () => {},
      () => {}
    )
  } catch { /* 忽略 */ }
  // #endif
}

function stopSpeak() {
  if (speakingAudio) {
    try {
      speakingAudio.stop?.()
      speakingAudio.destroy?.()
      speakingAudio.pause?.()
    } catch { /* 忽略 */ }
    speakingAudio = null
  }
  // #ifdef H5
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  // #endif
  // #ifdef APP-PLUS
  try {
    ;(plus as any).speech.stopSpeak?.()
  } catch { /* 忽略 */ }
  // #endif
}

const recording = ref(false)
const recordingTime = ref(0)
let recordingTimer: ReturnType<typeof setInterval> | null = null
/** 非 H5 端 RecorderManager 实例 */
let recorderManager: ReturnType<typeof uni.getRecorderManager> | null = null
/** H5 端 MediaRecorder 实例与分片 */
let h5Recorder: MediaRecorder | null = null
let h5Chunks: Blob[] = []
/** H5 端语音识别实例（Web SpeechRecognition） */
let h5Recognition: any = null

function toggleRecording() {
  if (recording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function startRecording() {
  if (recording.value) return
  const started = (() => {
    // #ifdef H5
    return startH5Recording()
    // #endif
    // #ifndef H5
    return startNativeRecording()
    // #endif
  })()
  if (!started) return
  recording.value = true
  recordingTime.value = 0
  recordingTimer = setInterval(() => {
    recordingTime.value += 1
  }, 1000)
}

function stopRecording() {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  recording.value = false
  ;(() => {
    // #ifdef H5
    stopH5Recording()
    // #endif
    // #ifndef H5
    stopNativeRecording()
    // #endif
  })()
}

/** H5 端：浏览器 MediaRecorder 录音（输出 base64 DataURL） */
function startH5Recording(): boolean {
  if (
    typeof window === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    uni.showToast({ title: '当前浏览器不支持录音', icon: 'none' })
    return false
  }
  h5Chunks = []
  // 语音转文字：Web SpeechRecognition（Chrome/Edge 支持中文）
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SR) {
    h5Recognition = new SR()
    h5Recognition.lang = 'zh-CN'
    h5Recognition.interimResults = false
    h5Recognition.continuous = false
    h5Recognition.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0]?.transcript || '')
        .join('')
        .trim()
      if (text) {
        inputText.value = text
        uni.showToast({ title: '已识别语音', icon: 'success' })
      }
    }
    h5Recognition.onerror = () => { /* 识别失败静默，不影响录音 */ }
    try {
      h5Recognition.start()
    } catch {
      h5Recognition = null
    }
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      h5Recorder = new MediaRecorder(stream)
      h5Recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) h5Chunks.push(e.data)
      }
      h5Recorder.onstop = () => {
        const blob = new Blob(h5Chunks, {
          type: h5Recorder?.mimeType || 'audio/webm'
        })
        const reader = new FileReader()
        reader.onloadend = () => {
          handleRecordComplete(String(reader.result || ''))
        }
        reader.readAsDataURL(blob)
      }
      h5Recorder.start()
    })
    .catch(() => {
      uni.showToast({ title: '无法访问麦克风，请检查权限', icon: 'none' })
    })
  return true
}

/** H5 端：停止 MediaRecorder 并释放麦克风 */
function stopH5Recording(): void {
  if (h5Recorder && h5Recorder.state !== 'inactive') {
    h5Recorder.stop()
    h5Recorder.stream.getTracks().forEach((track) => track.stop())
  }
  h5Recorder = null
  if (h5Recognition) {
    try { h5Recognition.stop() } catch { /* 忽略 */ }
    h5Recognition = null
  }
}

/** 非 H5 端：uni.getRecorderManager 录音（输出临时文件路径） */
let recorderBound = false
function startNativeRecording(): boolean {
  recorderManager = recorderManager || uni.getRecorderManager()
  // recorderManager 是全局单例，回调只需注册一次；
  // 每次录音都重复注册在不同实现下可能叠加监听，导致一次停止触发多次 handleRecordComplete
  if (!recorderBound) {
    recorderBound = true
    recorderManager.onStart(() => {})
    recorderManager.onStop((res: any) => {
      handleRecordComplete(String(res?.tempFilePath || ''))
    })
    recorderManager.onError(() => {
      uni.showToast({ title: '录音失败', icon: 'none' })
    })
  }
  recorderManager.start({ duration: 60000, format: 'mp3' })
  // #ifdef APP-PLUS
  // 原生语音识别（Android 需系统语音引擎；识别失败/无引擎时静默，不影响录音）
  try {
    ;(plus as any).speech.startRecognize(
      { lang: 'zh-CN', continuous: false },
      (text: string) => {
        const t = String(text || '').trim()
        if (t) {
          inputText.value = t
          uni.showToast({ title: '已识别语音', icon: 'success' })
        }
      },
      () => { /* 识别失败静默 */ }
    )
  } catch {
    /* 无语音引擎时忽略 */
  }
  // #endif
  return true
}

/** 非 H5 端：停止录音 */
function stopNativeRecording(): void {
  if (recorderManager) {
    recorderManager.stop()
  }
}

/**
 * 录音完成回调
 *   - H5：data 为 base64 DataURL（audio/webm），语音识别由 Web SpeechRecognition 实时完成
 *   - 小程序/App：data 为录音文件临时路径 tempFilePath，语音识别由 plus.speech 完成
 *   识别文本已实时填入 inputText，此处仅兜底提示未识别情况
 */
function handleRecordComplete(data: string) {
  // 录音数据回调：语音识别已在录音过程中进行（H5 Web Speech / APP 原生识别），
  // 识别结果已填入 inputText；此处仅兜底提示
  console.log('[ai-chat] 录音完成:', data ? data.slice(0, 80) : '空')
  if (!inputText.value.trim()) {
    uni.showToast({ title: '未识别到语音，请重试', icon: 'none' })
  }
}

// ====================== 页面卸载清理 ======================

onUnmounted(() => {
  stopSpeak()
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  ;(() => {
    // #ifdef H5
    if (h5Recorder && h5Recorder.state !== 'inactive') {
      h5Recorder.stop()
      h5Recorder.stream.getTracks().forEach((track) => track.stop())
    }
    h5Recorder = null
    // #endif
    // #ifndef H5
    if (recorderManager) {
      recorderManager.stop()
    }
    // #endif
  })()
})
</script>

<style scoped lang="scss">
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $uni-bg-color-page;
}

/* ====================== 顶部 AI 助手 ====================== */
.ai-top-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 28rpx;
  padding-top: calc(22rpx + var(--safe-top));
  background: $zx-grayf7-550;
  backdrop-filter: blur(24rpx) saturate(1.4);
  -webkit-backdrop-filter: blur(24rpx) saturate(1.4);
  border-bottom: 1rpx solid $zx-black-20;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
}

.ai-top-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 24rpx;
  background: $uni-gradient-blue;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx $zx-primary-200;
}

.ai-top-icon-text {
  font-size: 34rpx;
  color: $uni-text-color-inverse;
  font-weight: 700;
}

.ai-top-info {
  flex: 1;
}

.ai-top-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
  letter-spacing: -0.6rpx;
}

.ai-top-sub {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
}

.ai-top-dot {
  display: inline-block;
  margin: 0 8rpx;
  color: $uni-color-primary;
  font-weight: 800;
}

/* 顶部关闭按钮 */
.ai-close-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $zx-black-60;
  margin-left: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}
.ai-close-btn:active {
  transform: scale(0.88);
  background: $zx-black-120;
}
.ai-close-icon {
  font-size: 30rpx;
  line-height: 1;
  color: $uni-gray-700;
}

/* AI 回复播报按钮 */
.ai-speak-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 12rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: $zx-primary-80;
}
.ai-speak-btn-text {
  font-size: 22rpx;
  color: $uni-color-primary;
}

/* ====================== 快捷指令 ====================== */
.ai-quick-tags {
  white-space: nowrap;
  padding: 0 24rpx;
  margin-bottom: 12rpx;
}

.ai-tag {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: transparent;
  border: 1rpx solid $zx-black-80;
  margin-right: 16rpx;
  transition: all 0.2s ease;
}

.ai-tag:active {
  background: $zx-violet-100;
  border-color: $zx-violet4-100;
}

.ai-tag:active .ai-tag-text {
  color: $zx-violet-800;
}

.ai-tag-text {
  font-size: 22rpx;
  color: $uni-gray-600;
}

/* ====================== 消息列表 ====================== */
.chat-body {
  flex: 1;
  overflow: hidden;
  padding-top: calc(120rpx + var(--safe-top));
  padding-bottom: calc(170rpx + env(safe-area-inset-bottom));
}

.chat-list {
  padding: 24rpx 24rpx 32rpx;
}

.msg-row {
  display: flex;
  margin-bottom: 28rpx;
}

.msg-row--user {
  justify-content: flex-end;
}

.msg-row--ai {
  align-items: flex-start;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 28rpx;
  font-weight: 700;
}

.avatar--ai {
  background: linear-gradient(135deg, $ai-tab-active, $ai-primary);
  color: $uni-text-color-inverse;
  margin-right: 16rpx;
}

.bubble-wrap {
  max-width: calc(100% - 96rpx);
  display: flex;
  flex-direction: column;
}

.bubble {
  padding: 24rpx 32rpx;
  border-radius: 36rpx;
  font-size: 26rpx;
  line-height: 1.75;
  letter-spacing: -0.2rpx;
  word-break: break-all;
}

/* 原稿：AI 气泡白底描边小阴影，用户气泡蓝底白字 */
.bubble--ai {
  background: $uni-bg-color;
  color: $ai-text-body;
  border-bottom-left-radius: 12rpx;
  border: 1rpx solid $zx-black-50;
  box-shadow: 0 2rpx 8rpx $zx-black-30;
}

.bubble--user {
  background: $uni-color-primary;
  color: $ai-bg-page;
  border-bottom-right-radius: 12rpx;
  border: none;
  box-shadow: 0 4rpx 16rpx $zx-primary-180;
}

.bubble-text {
  white-space: pre-wrap;
}

.bubble-text--user {
  color: $ai-bg-page;
}

/* 打字动画 */
.typing {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0 4rpx;
}

.typing-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $uni-gray-300;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-8rpx); opacity: 1; }
}

/* 工具调用状态 */
.tool-tag {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  align-self: flex-start;
}

.tool-tag-spin {
  width: 20rpx;
  height: 20rpx;
  border: 4rpx solid $uni-gray-300;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: tool-spin 0.8s linear infinite;
}

@keyframes tool-spin {
  to { transform: rotate(360deg); }
}

.tool-tag-text {
  font-size: 22rpx;
  color: $ai-text-mid;
}

/* 工具执行结果 */
.tool-result {
  margin-top: 14rpx;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  align-self: flex-start;
}

.tool-result--ok {
  background: $ai-success-bg;
}

.tool-result--fail {
  background: $ai-danger-bg;
}

.tool-result-text {
  font-size: 22rpx;
}

.tool-result--ok .tool-result-text {
  color: $uni-color-success;
}

.tool-result--fail .tool-result-text {
  color: $uni-color-error;
}

/* ====================== 欢迎语 ====================== */
.welcome-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.tip-chip {
  background: $uni-bg-color;
  border: 2rpx solid $uni-gray-200;
  border-radius: 32rpx;
  padding: 12rpx 24rpx;
}

.tip-chip-text {
  font-size: 24rpx;
  color: $uni-color-primary;
}

/* ====================== 写操作预览卡片 ====================== */
.preview-card {
  margin-top: 16rpx;
  background: $uni-bg-color;
  border: 2rpx solid $uni-gray-200;
  border-radius: 20rpx;
  padding: 24rpx;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.preview-operation-tag {
  background: $uni-color-warning-soft;
  color: $uni-color-warning;
  font-size: 20rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
  flex-shrink: 0;
}

.preview-operation {
  font-size: 30rpx;
  font-weight: 600;
  color: $ai-text-body;
}

.preview-summary {
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.preview-summary-text {
  font-size: 24rpx;
  color: $uni-gray-600;
  line-height: 1.5;
}

.preview-details {
  margin-bottom: 20rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}

.detail-key {
  font-size: 24rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.detail-value {
  font-size: 24rpx;
  color: $uni-gray-900;
  text-align: right;
  word-break: break-all;
}

.detail-list {
  margin-top: 12rpx;
}

.detail-list-title {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: 8rpx;
}

.detail-list-item {
  background: $uni-gray-50;
  border-radius: 10rpx;
  padding: 10rpx 16rpx;
  margin-bottom: 8rpx;
}

.detail-list-item-text {
  font-size: 22rpx;
  color: $uni-gray-600;
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  gap: 16rpx;
}

.preview-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  padding: 0;
  margin: 0;
}

.preview-btn::after {
  border: none;
}

.preview-btn--cancel {
  background: $uni-bg-color-page;
  color: $uni-gray-600;
}

.preview-btn--confirm {
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  color: $uni-text-color-inverse;
}

.preview-btn[disabled] {
  opacity: 0.6;
}

/* ====================== 底部输入栏 ====================== */
.chat-footer {
  background: $zx-white-920;
  margin: 0 16rpx;
  border-radius: 40rpx;
  padding: 16rpx 18rpx;
  box-shadow: 0 4rpx 20rpx $zx-black-80;
  backdrop-filter: blur(48rpx) saturate(1.5);
  -webkit-backdrop-filter: blur(48rpx) saturate(1.5);
  position: fixed;
  left: 16rpx;
  right: 16rpx;
  z-index: 20;
}

/* 自定义 tabBar 占位：让输入栏不被底部导航遮挡 */

.input-bar {
  display: flex;
  align-items: center;
}

/* 待发送图片预览 */
.attach-preview {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  margin-bottom: 14rpx;
  border-radius: 20rpx;
  overflow: hidden;
  border: 1rpx solid $zx-black-60;
}
.attach-preview-img {
  width: 100%;
  height: 100%;
}
.attach-preview-remove {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $zx-black-550;
  display: flex;
  align-items: center;
  justify-content: center;
}
.attach-preview-remove-text {
  color: $ai-bg-page;
  font-size: 24rpx;
  line-height: 1;
}

.camera-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: $zx-primary-80;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.camera-btn:active {
  transform: scale(0.88);
}

.camera-btn-img {
  width: 40rpx;
  height: 40rpx;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  min-height: 0;
  max-height: 72rpx;
  overflow: hidden;
  box-sizing: border-box;
  line-height: 72rpx;
  background: $uni-bg-color-page;
  border: 1rpx solid $zx-black-60;
  border-radius: 28rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
  color: $uni-gray-900;
  transition: all 0.25s ease;
}

.chat-input:focus {
  background: $uni-bg-color;
  border-color: $zx-violet-600;
  box-shadow: 0 0 0 6rpx $zx-violet2-80;
}

.chat-input-placeholder {
  color: $uni-gray-500;
}

.voice-send-btn {
  margin-left: 16rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  box-shadow: 0 6rpx 24rpx $zx-primary-200;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.voice-send-btn:active {
  transform: scale(0.9);
}

.voice-send-btn-img {
  width: 36rpx;
  height: 36rpx;
}

.voice-send-btn--voice {
  background: $zx-black-60;
  box-shadow: none;
}

.voice-send-btn--recording {
  background: $uni-color-error;
  box-shadow: 0 6rpx 24rpx $zx-red2-300;
  animation: recording-pulse 1.2s infinite ease-in-out;
}

.voice-send-btn--disabled {
  opacity: 0.5;
}

@keyframes recording-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.recording-hint {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
  padding-left: 8rpx;
}

.recording-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $uni-color-error;
  animation: recording-blink 1s infinite;
}

@keyframes recording-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.recording-hint-text {
  font-size: 22rpx;
  color: $uni-color-error;
}

/* ====================== 多对话选择弹窗（半屏） ====================== */
.conv-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: $zx-black-400;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
}

.conv-panel {
  width: 56vw;
  height: 100%;
  background: $ai-bg-page;
  border-radius: 0 32rpx 32rpx 0;
  padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  box-shadow: 8rpx 0 40rpx $zx-black-120;
  animation: conv-left 0.25s ease;
}

@keyframes conv-left {
  from { transform: translateX(-100%); opacity: 0.6; }
  to { transform: translateX(0); opacity: 1; }
}

.conv-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.conv-panel-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-gray-900;
}

.conv-new-btn {
  background: $zx-primary-80;
  border-radius: 999rpx;
  padding: 10rpx 24rpx;
}

.conv-new-text {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.conv-list {
  flex: 1;
  min-height: 0;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 20rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  background: $uni-bg-color-page;
  border: 1rpx solid transparent;
}

.conv-item--active {
  background: $zx-primary-80;
  border-color: $zx-primary-200;
}

.conv-item-title {
  flex: 1;
  margin-right: 16rpx;
  font-size: 26rpx;
  color: $uni-gray-900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: $uni-gray-400;
}

.conv-empty {
  text-align: center;
  color: $uni-gray-400;
  padding: 60rpx 0;
  font-size: 24rpx;
}
</style>
