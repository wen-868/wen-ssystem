/**
 * 实时同步客户端 (SyncManager)
 *
 * 功能：
 * 1. WebSocket 实时推送（优先）
 * 2. HTTP 轮询兜底（WebSocket 不可用时自动降级）
 * 3. 心跳维持 + 自动重连（指数退避）
 * 4. 事件发布订阅，页面可监听数据变更
 *
 * 用法：
 *   const sync = require('../../utils/sync')
 *   const manager = sync.getSyncManager()
 *   manager.on('products-updated', (data) => { ... })
 *   manager.on('price-changed', (data) => { ... })
 *   manager.on('stock-updated', (data) => { ... })
 *   manager.on('connection-status', (status) => { ... })
 *   manager.start()
 *   // 页面卸载时：manager.stop()
 */

// ========== 事件类型常量 ==========

const EVENT_TYPES = {
  PRODUCTS_UPDATED: 'products-updated',
  PRICE_CHANGED: 'price-changed',
  STOCK_UPDATED: 'stock-updated',
  ORDER_STATUS_CHANGED: 'order-status-changed',
  CONFIG_CHANGED: 'config-changed',
  CONNECTION_STATUS: 'connection-status'
}

// ========== 连接状态 ==========

const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DEGRADED: 'degraded' // 降级到轮询模式
}

/**
 * 获取平台配置
 */
function getSyncConfig() {
  try {
    const platformConfig = require('../config.template')
    return platformConfig.config.sync || {}
  } catch (e) {
    return {
      wsUrl: 'wss://ws.onepan.cn/sync',
      pollIntervalMs: 10000,
      enabled: true
    }
  }
}

/**
 * 同步管理器
 */
class SyncManager {
  constructor() {
    this._events = {}
    this._status = CONNECTION_STATUS.DISCONNECTED
    this._wsTask = null
    this._pollTimer = null
    this._heartbeatTimer = null
    this._reconnectTimer = null
    this._reconnectAttempts = 0
    this._maxReconnectAttempts = 10
    this._baseReconnectDelay = 1000
    this._token = ''
    this._usePolling = false
    this._env = 'mp-weixin'
    this._lastSyncTimestamp = 0
  }

  // ========== 事件系统 ==========

  on(event, handler) {
    if (!this._events[event]) this._events[event] = []
    this._events[event].push(handler)
    return this
  }

  off(event, handler) {
    if (!this._events[event]) return this
    this._events[event] = this._events[event].filter((h) => h !== handler)
    return this
  }

  emit(event, data) {
    if (!this._events[event]) return
    this._events[event].forEach((h) => {
      try { h(data) } catch (e) { console.error('[SyncManager] event handler error:', e) }
    })
  }

  // ========== 状态管理 ==========

  get status() {
    return this._status
  }

  setStatus(status) {
    if (this._status !== status) {
      this._status = status
      this.emit(EVENT_TYPES.CONNECTION_STATUS, { status })
    }
  }

  // ========== 启动/停止 ==========

  start() {
    const config = getSyncConfig()
    if (!config.enabled) {
      console.log('[SyncManager] 实时同步已禁用')
      return
    }

    this._token = wx.getStorageSync('miniapp_token') || ''

    // 检查微信环境是否支持 WebSocket
    if (typeof wx.connectSocket === 'function') {
      this._usePolling = false
      this._connectWebSocket()
    } else {
      console.warn('[SyncManager] 当前环境不支持 WebSocket，降级到轮询模式')
      this._usePolling = true
      this.setStatus(CONNECTION_STATUS.DEGRADED)
      this._startPolling()
    }
  }

  stop() {
    this._disconnectWebSocket()
    this._stopPolling()
    this._clearHeartbeat()
    this._clearReconnect()
    this.setStatus(CONNECTION_STATUS.DISCONNECTED)
  }

  restart() {
    this.stop()
    this._reconnectAttempts = 0
    this.start()
  }

  // ========== WebSocket 连接 ==========

  _connectWebSocket() {
    const config = getSyncConfig()
    this.setStatus(CONNECTION_STATUS.CONNECTING)

    this._wsTask = wx.connectSocket({
      url: config.wsUrl,
      header: {
        'Authorization': 'Bearer ' + this._token
      },
      success: () => {
        console.log('[SyncManager] WebSocket 连接中...')
      },
      fail: (err) => {
        console.error('[SyncManager] WebSocket 连接失败:', err)
        this._fallbackToPolling()
      }
    })

    if (this._wsTask) {
      this._wsTask.onOpen(() => {
        console.log('[SyncManager] WebSocket 已连接')
        this.setStatus(CONNECTION_STATUS.CONNECTED)
        this._reconnectAttempts = 0
        this._startHeartbeat()
        // 发送认证消息
        this._send({ type: 'auth', token: this._token })
      })

      this._wsTask.onMessage((res) => {
        try {
          const msg = JSON.parse(res.data)
          this._handleMessage(msg)
        } catch (e) {
          console.error('[SyncManager] 消息解析失败:', e)
        }
      })

      this._wsTask.onClose((res) => {
        console.log('[SyncManager] WebSocket 已关闭:', res.code, res.reason)
        this.setStatus(CONNECTION_STATUS.DISCONNECTED)
        this._clearHeartbeat()
        this._tryReconnect()
      })

      this._wsTask.onError((err) => {
        console.error('[SyncManager] WebSocket 错误:', err)
        this._fallbackToPolling()
      })
    }
  }

  _disconnectWebSocket() {
    if (this._wsTask) {
      try {
        this._wsTask.close({ code: 1000, reason: 'client close' })
      } catch (e) {
        // ignore
      }
      this._wsTask = null
    }
  }

  _send(data) {
    if (this._wsTask && this._status === CONNECTION_STATUS.CONNECTED) {
      this._wsTask.send({
        data: JSON.stringify(data),
        success: () => {},
        fail: (err) => console.error('[SyncManager] 发送失败:', err)
      })
    }
  }

  // ========== 心跳机制 ==========

  _startHeartbeat() {
    this._clearHeartbeat()
    this._heartbeatTimer = setInterval(() => {
      this._send({ type: 'ping', ts: Date.now() })
    }, 30000)
  }

  _clearHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  // ========== 重连机制（指数退避） ==========

  _tryReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.warn('[SyncManager] 重连次数已达上限，降级到轮询模式')
      this._fallbackToPolling()
      return
    }
    this._reconnectAttempts++
    const delay = this._baseReconnectDelay * Math.pow(2, this._reconnectAttempts - 1)
    const jitter = Math.random() * 1000
    const totalDelay = Math.min(delay + jitter, 30000)

    this.setStatus(CONNECTION_STATUS.RECONNECTING)
    console.log(`[SyncManager] 第 ${this._reconnectAttempts} 次重连，等待 ${Math.round(totalDelay)}ms`)

    this._reconnectTimer = setTimeout(() => {
      this._connectWebSocket()
    }, totalDelay)
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  // ========== 降级到轮询 ==========

  _fallbackToPolling() {
    this._disconnectWebSocket()
    this._usePolling = true
    this.setStatus(CONNECTION_STATUS.DEGRADED)
    this._startPolling()
  }

  _startPolling() {
    this._stopPolling()
    const config = getSyncConfig()
    const interval = config.pollIntervalMs || 10000

    const poll = async () => {
      try {
        const app = getApp()
        const res = await app.request({
          url: `${app.globalData.apiBase}/miniapp/sync/events`,
          method: 'GET',
          data: { since: this._lastSyncTimestamp || undefined }
        })
        const body = res.data || {}
        if (body.code === '0' && body.data && body.data.events) {
          body.data.events.forEach((evt) => {
            this._handleMessage(evt)
          })
          this._lastSyncTimestamp = body.data.timestamp || Date.now()
        }
      } catch (e) {
        console.error('[SyncManager] 轮询失败:', e)
      }
    }

    // 立即执行一次
    poll()
    this._pollTimer = setInterval(poll, interval)
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }

  // ========== 消息处理 ==========

  _handleMessage(msg) {
    if (!msg || !msg.type) return

    switch (msg.type) {
      case 'pong':
        // 心跳响应，忽略
        break
      case 'products-updated':
        this.emit(EVENT_TYPES.PRODUCTS_UPDATED, msg.data)
        break
      case 'price-changed':
        this.emit(EVENT_TYPES.PRICE_CHANGED, msg.data)
        break
      case 'stock-updated':
        this.emit(EVENT_TYPES.STOCK_UPDATED, msg.data)
        break
      case 'order-status-changed':
        this.emit(EVENT_TYPES.ORDER_STATUS_CHANGED, msg.data)
        break
      case 'config-changed':
        this.emit(EVENT_TYPES.CONFIG_CHANGED, msg.data)
        break
      default:
        console.log('[SyncManager] 未知消息类型:', msg.type)
    }
  }
}

// ========== 单例 ==========

let _instance = null

function getSyncManager() {
  if (!_instance) {
    _instance = new SyncManager()
  }
  return _instance
}

module.exports = {
  SyncManager,
  getSyncManager,
  EVENT_TYPES,
  CONNECTION_STATUS
}