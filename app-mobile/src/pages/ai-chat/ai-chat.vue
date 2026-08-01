<template>
  <view class="ai-chat-page">
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
          <text class="mic-btn-text">{{ recording ? '停' : '音' }}</text>
        </view>
        <input
          class="chat-input"
          v-model="inputText"
          placeholder="例如：给红星商行送10箱五粮液"
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
          <text class="send-btn-text">{{ sending ? '…' : '发送' }}</text>
        </view>
      </view>
      <view v-if="recording" class="recording-hint">
        <view class="recording-dot"></view>
        <text class="recording-hint-text">录音中 {{ recordingTime }}s，再点一次结束</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  aiApi,
  type AiToolPreview,
  type AiChatToolResultEvent
} from '@/api/modules/ai'

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
let messageSeq = 0
let abortController: AbortController | null = null

/** 欢迎页快捷示例 */
const welcomeTips = [
  '给红星商行送10箱五粮液',
  '五粮液还有多少库存',
  '查看本月销售报表',
  '新建客户：兴旺超市'
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
    ? { message: text, conversationId: conversationId.value }
    : { message: text }

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

// ====================== 语音输入（骨架，TODO 对接语音转文字） ======================

const recording = ref(false)
const recordingTime = ref(0)
let recordingTimer: ReturnType<typeof setInterval> | null = null
/** 非 H5 端 RecorderManager 实例 */
let recorderManager: ReturnType<typeof uni.getRecorderManager> | null = null
/** H5 端 MediaRecorder 实例与分片 */
let h5Recorder: MediaRecorder | null = null
let h5Chunks: Blob[] = []

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
  return true
}

/** 非 H5 端：停止录音 */
function stopNativeRecording(): void {
  if (recorderManager) {
    recorderManager.stop()
  }
}

/**
 * 录音完成回调（骨架实现）
 *
 * TODO: 对接后端语音转文字接口：
 *   - H5：data 为 base64 DataURL（audio/webm）
 *   - 小程序/App：data 为录音文件临时路径 tempFilePath
 *   - 后端 AI 底座当前暂无语音转写（ASR）接口，
 *     待接口就绪后在此上传录音数据，取回识别文本填入 inputText
 */
function handleRecordComplete(data: string) {
  // TODO: 语音转文字对接点（见上方注释）
  console.log('[ai-chat] 录音完成，待转写数据:', data ? data.slice(0, 80) : '空')
  uni.showToast({ title: '语音转文字功能开发中', icon: 'none' })
}

// ====================== 页面卸载清理 ======================

onUnmounted(() => {
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
  background: #f5f7fa;
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
  background: linear-gradient(135deg, #5ba0ff, #1677ff);
  color: #fff;
  margin-right: 16rpx;
}

.bubble-wrap {
  max-width: 78%;
  display: flex;
  flex-direction: column;
}

.bubble {
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 1.6;
  word-break: break-all;
}

.bubble--ai {
  background: #fff;
  color: #1f2937;
  border-top-left-radius: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.bubble--user {
  background: linear-gradient(135deg, #5ba0ff, #1677ff);
  color: #fff;
  border-top-right-radius: 8rpx;
}

.bubble-text {
  white-space: pre-wrap;
}

.bubble-text--user {
  color: #fff;
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
  background: #b9c2cf;
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
  background: #f0f2f5;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  align-self: flex-start;
}

.tool-tag-spin {
  width: 20rpx;
  height: 20rpx;
  border: 4rpx solid #c9d2de;
  border-top-color: #1677ff;
  border-radius: 50%;
  animation: tool-spin 0.8s linear infinite;
}

@keyframes tool-spin {
  to { transform: rotate(360deg); }
}

.tool-tag-text {
  font-size: 22rpx;
  color: #6b7280;
}

/* 工具执行结果 */
.tool-result {
  margin-top: 14rpx;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  align-self: flex-start;
}

.tool-result--ok {
  background: #ecfdf5;
}

.tool-result--fail {
  background: #fef2f2;
}

.tool-result-text {
  font-size: 22rpx;
}

.tool-result--ok .tool-result-text {
  color: #0ea879;
}

.tool-result--fail .tool-result-text {
  color: #c0392b;
}

/* ====================== 欢迎语 ====================== */
.welcome-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.tip-chip {
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 32rpx;
  padding: 12rpx 24rpx;
}

.tip-chip-text {
  font-size: 24rpx;
  color: #1677ff;
}

/* ====================== 写操作预览卡片 ====================== */
.preview-card {
  margin-top: 16rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
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
  background: #fff7e6;
  color: #d48806;
  font-size: 20rpx;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
  flex-shrink: 0;
}

.preview-operation {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}

.preview-summary {
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.preview-summary-text {
  font-size: 24rpx;
  color: #444444;
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
  color: #999999;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.detail-value {
  font-size: 24rpx;
  color: #111111;
  text-align: right;
  word-break: break-all;
}

.detail-list {
  margin-top: 12rpx;
}

.detail-list-title {
  font-size: 24rpx;
  color: #999999;
  margin-bottom: 8rpx;
}

.detail-list-item {
  background: #f8f9fb;
  border-radius: 10rpx;
  padding: 10rpx 16rpx;
  margin-bottom: 8rpx;
}

.detail-list-item-text {
  font-size: 22rpx;
  color: #444444;
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
  background: #f0f2f5;
  color: #444444;
}

.preview-btn--confirm {
  background: linear-gradient(135deg, #5ba0ff, #1677ff);
  color: #fff;
}

.preview-btn[disabled] {
  opacity: 0.6;
}

/* ====================== 底部输入栏 ====================== */
.chat-footer {
  background: #fff;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.input-bar {
  display: flex;
  align-items: center;
}

.mic-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.mic-btn--recording {
  background: #c0392b;
}

.mic-btn-text {
  font-size: 24rpx;
  color: #666666;
}

.mic-btn--recording .mic-btn-text {
  color: #fff;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 40rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: #111111;
}

.chat-input-placeholder {
  color: #cccccc;
}

.send-btn {
  margin-left: 16rpx;
  height: 72rpx;
  padding: 0 32rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #5ba0ff, #1677ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.send-btn--disabled {
  opacity: 0.5;
}

.send-btn-text {
  font-size: 28rpx;
  color: #fff;
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
  background: #c0392b;
  animation: recording-blink 1s infinite;
}

@keyframes recording-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.recording-hint-text {
  font-size: 22rpx;
  color: #c0392b;
}
</style>
