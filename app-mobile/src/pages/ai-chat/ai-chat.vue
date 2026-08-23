<template>
  <view class="ai-chat-page">
    <!-- 顶部：AI · 实时对话（设计 R95-02：单行简洁，去除模型下拉） -->
    <view class="ai-top-bar">
      <view class="ai-top-icon">
        <text class="ai-top-icon-text">✦</text>
      </view>
      <view class="ai-top-info">
        <text class="ai-top-title">AI<text class="ai-top-dot">·</text>实时对话</text>
      </view>
      <view class="ai-scan-btn" @tap="handleScanForAi">
        <image class="ai-scan-btn-img" src="/static/icons/hd-scan.svg" mode="aspectFit" />
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
              <text class="bubble-text">你好，我是智享 AI 助手。你可以让我帮你开单、查库存、看报表，试试下面这些：</text>
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

    <!-- 底部输入栏 -->
    <view class="chat-footer">
      <view class="input-bar">
        <view
          class="mic-btn"
          :class="{ 'mic-btn--recording': recording }"
          @tap="toggleRecording"
        >
          <image class="mic-btn-img" src="/static/icons/ic/mic.svg" mode="aspectFit" />
        </view>
        <input
          class="chat-input"
          v-model="inputText"
          placeholder="输入你的问题..."
          placeholder-class="chat-input-placeholder"
          confirm-type="send"
          :disabled="sending"
          @confirm="sendMessage"
        />
        <view
          class="send-btn"
          :class="{ 'send-btn--disabled': sending || !inputText.trim() }"
          @tap="sendMessage"
        >
          <image class="send-btn-img" src="/static/icons/ic/send.svg" mode="aspectFit" />
        </view>
      </view>
      <view v-if="recording" class="recording-hint">
        <view class="recording-dot"></view>
        <text class="recording-hint-text">录音中 {{ recordingTime }}s，再点一次结束</text>
      </view>
    </view>
    <view class="tabbar-placeholder"></view>
    <custom-tab-bar :current="'ai'" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import CustomTabBar from '@/components/custom-tab-bar.vue'
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
/** 语音模式：开启后 AI 回复自动语音播报 */
const voiceMode = ref(false)
const models = ref<AiModelOption[]>([])
const selectedModel = ref('')
let messageSeq = 0
let abortController: AbortController | null = null

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

/** 顶部扫一扫：扫码后让 AI 查该商品/条码（App 端扫码，H5 降级提示） */
function handleScanForAi() {
  try {
    uni.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: (res: any) => {
        quickSend(`查一下商品：${res.result || ''}`)
      },
      fail: () => {
        uni.showToast({ title: '已取消扫码', icon: 'none' })
      },
    })
  } catch (e) {
    uni.showToast({ title: '扫码需在 App 端使用', icon: 'none' })
  }
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
    ? { message: text, conversationId: conversationId.value, ...(selectedModel.value ? { model: selectedModel.value } : {}) }
    : { message: text, ...(selectedModel.value ? { model: selectedModel.value } : {}) }

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
function startNativeRecording(): boolean {
  recorderManager = recorderManager || uni.getRecorderManager()
  recorderManager.onStart(() => {})
  recorderManager.onStop((res: any) => {
    handleRecordComplete(String(res?.tempFilePath || ''))
  })
  recorderManager.onError(() => {
    uni.showToast({ title: '录音失败', icon: 'none' })
  })
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
  padding: 22rpx 32rpx;
  padding-top: calc(22rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.ai-top-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 24rpx;
  background: $uni-gradient-blue;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(37, 99, 235, 0.2);
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

/* 顶部扫一扫按钮 */
.ai-scan-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.05);
  margin-left: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-scan-btn-img {
  width: 36rpx;
  height: 36rpx;
}

/* AI 回复播报按钮 */
.ai-speak-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 12rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(37, 99, 235, 0.08);
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
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  margin-right: 16rpx;
  transition: all 0.2s ease;
}

.ai-tag:active {
  background: #EDE9FE;
  border-color: rgba(91, 33, 185, 0.1);
}

.ai-tag:active .ai-tag-text {
  color: #5B21B6;
}

.ai-tag-text {
  font-size: 22rpx;
  color: $uni-gray-600;
}

/* ====================== 消息列表 ====================== */
.chat-body {
  flex: 1;
  overflow: hidden;
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
  border: 1rpx solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.bubble--user {
  background: $uni-color-primary;
  color: #FFFFFF;
  border-bottom-right-radius: 12rpx;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(37, 99, 235, 0.18);
}

.bubble-text {
  white-space: pre-wrap;
}

.bubble-text--user {
  color: $ai-text-body;
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
  background: rgba(255, 255, 255, 0.92);
  margin: 0 24rpx;
  border-radius: 40rpx;
  padding: 16rpx 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(48rpx) saturate(1.5);
  -webkit-backdrop-filter: blur(48rpx) saturate(1.5);
}

.tabbar-placeholder {
  height: calc(150rpx + env(safe-area-inset-bottom));
  background: transparent;
}

/* 自定义 tabBar 占位：让输入栏不被底部导航遮挡 */

.input-bar {
  display: flex;
  align-items: center;
}

.mic-btn {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.mic-btn:active {
  transform: scale(0.88);
  background: rgba(37, 99, 235, 0.08);
}

.mic-btn-img {
  width: 40rpx;
  height: 40rpx;
}

.mic-btn--recording {
  background: $uni-color-primary;
}

.chat-input {
  flex: 1;
  height: 84rpx;
  background: $uni-bg-color-page;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: 999rpx;
  padding: 0 36rpx;
  font-size: 26rpx;
  color: $uni-gray-900;
  transition: all 0.25s ease;
}

.chat-input:focus {
  background: $uni-bg-color;
  border-color: #7C3AED;
  box-shadow: 0 0 0 6rpx rgba(124, 58, 237, 0.08);
}

.chat-input-placeholder {
  color: $uni-gray-500;
}

.send-btn {
  margin-left: 20rpx;
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  box-shadow: 0 6rpx 24rpx rgba(37, 99, 235, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.send-btn:active {
  transform: scale(0.9);
}

.send-btn-img {
  width: 36rpx;
  height: 36rpx;
}

.send-btn--disabled {
  opacity: 0.5;
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
</style>
