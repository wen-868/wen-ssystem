<template>
  <div class="mobile-preview-page">
    <!-- 顶部工具栏 -->
    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar">
        <!-- 设备选择 -->
        <div class="toolbar-group">
          <span class="toolbar-label">设备型号</span>
          <el-select v-model="currentDevice" placeholder="选择设备" style="width: 220px;" @change="onDeviceChange">
            <el-option-group v-for="group in deviceGroups" :key="group.label" :label="group.label">
              <el-option
                v-for="device in group.devices"
                :key="device.id"
                :label="device.name"
                :value="device.id"
              >
                <span style="float: left;">{{ device.name }}</span>
                <span style="float: right; color: #8492a6; font-size: 12px;">
                  {{ device.width }}×{{ device.height }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
        </div>

        <!-- 横竖屏切换 -->
 <div class="toolbar-group">
          <span class="toolbar-label">方向</span>
          <el-radio-group v-model="orientation" @change="onOrientationChange">
            <el-radio-button value="portrait">
              <el-icon><Iphone /></el-icon>
              竖屏
            </el-radio-button>
            <el-radio-button value="landscape">
              <el-icon><Monitor /></el-icon>
              横屏
            </el-radio-button>
          </el-radio-group>
        </div>

        <!-- 预览地址 -->
        <div class="toolbar-group">
          <span class="toolbar-label">预览地址</span>
          <el-input
            v-model="previewUrl"
            placeholder="输入移动端H5地址"
            style="width: 320px;"
            clearable
            @keyup.enter="refreshPreview"
          >
            <template #prepend>
              <el-select v-model="urlPreset" style="width: 110px;" @change="onUrlPresetChange">
                <el-option label="本地开发" value="local" />
                <el-option label="线上地址" value="production" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </template>
          </el-input>
          <el-button type="primary" @click="refreshPreview">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <!-- 缩放控制 -->
        <div class="toolbar-group">
          <span class="toolbar-label">缩放</span>
          <el-slider
            v-model="scalePercent"
            :min="50"
            :max="150"
            :step="10"
            style="width: 140px;"
            :format-tooltip="(val: number) => val + '%'"
            @change="onScaleChange"
          />
          <el-button text @click="resetScale">重置</el-button>
        </div>
      </div>
    </el-card>

    <!-- 预览主区域 -->
    <div class="preview-stage" ref="stageRef">
      <!-- 设备信息显示 -->
      <div class="device-info-bar">
        <el-tag type="info" effect="plain">
          {{ activeDevice.name }} · {{ displayWidth }}×{{ displayHeight }}
        </el-tag>
        <el-tag type="success" effect="plain">
          {{ orientation === 'portrait' ? '竖屏' : '横屏' }}
        </el-tag>
        <el-tag type="warning" effect="plain">
          DPR {{ activeDevice.dpr }}
        </el-tag>
        <el-tag v-if="activeDevice.userAgent" type="info" effect="plain">
          {{ activeDevice.userAgent.substring(0, 40) }}...
        </el-tag>
      </div>

      <!-- 设备外壳 -->
      <div
        class="device-frame"
        :class="[
          `device-frame--${activeDevice.brand.toLowerCase()}`,
          { 'device-frame--landscape': orientation === 'landscape' }
        ]"
        :style="frameStyle"
      >
        <!-- 听筒/刘海 -->
        <div class="device-notch" v-if="activeDevice.hasNotch">
          <div class="device-notch__speaker"></div>
        </div>

        <!-- 状态栏 -->
        <div class="device-status-bar">
          <span class="status-time">{{ currentTime }}</span>
          <div class="status-icons">
            <span style="font-size: 10px;">5G</span>
            <el-icon size="12"><Connection /></el-icon>
            <el-icon size="14"><Cellphone /></el-icon>
          </div>
        </div>

        <!-- 预览内容 iframe -->
        <div class="device-screen-wrapper">
          <iframe
            ref="previewFrame"
            :src="previewUrl"
            :style="iframeStyle"
            class="device-iframe"
            frameborder="0"
            scrolling="yes"
            allow="clipboard-read; clipboard-write"
            @load="onIframeLoad"
            @error="onIframeError"
          ></iframe>
          <!-- 加载遮罩 -->
          <div class="loading-overlay" v-if="loading">
            <el-icon class="is-loading" :size="32"><Loading /></el-icon>
            <span style="margin-top: 8px; color: #909399;">加载中...</span>
          </div>
          <!-- 错误遮罩 -->
          <div class="error-overlay" v-if="loadError">
            <el-icon :size="32" color="#F56C6C"><WarningFilled /></el-icon>
            <span style="margin-top: 8px; color: #F56C6C;">页面加载失败</span>
            <span style="margin-top: 4px; color: #909399; font-size: 12px;">请检查预览地址是否正确</span>
          </div>
        </div>

        <!-- Home 指示条 -->
        <div class="device-home-indicator" v-if="activeDevice.hasHomeIndicator"></div>
      </div>

      <!-- 快捷设备切换栏 -->
      <div class="quick-devices">
        <span class="quick-label">快捷切换：</span>
        <div
          v-for="device in quickDevices"
          :key="device.id"
          class="quick-device-item"
          :class="{ 'active': device.id === currentDevice }"
          @click="switchDevice(device.id)"
        >
          <span class="quick-device-icon">{{ device.icon }}</span>
          <span class="quick-device-name">{{ device.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Refresh, Iphone, Monitor, Loading, WarningFilled,
  Connection, Cellphone
} from '@element-plus/icons-vue'

// ===================== 设备预设 =====================
interface DevicePreset {
  id: string
  name: string
  brand: string
  icon: string
  width: number
  height: number
  dpr: number
  userAgent: string
  hasNotch: boolean
  hasHomeIndicator: boolean
}

const deviceGroups = [
  {
    label: 'iPhone 系列',
    devices: [
      {
        id: 'iphone-15-pro-max',
        name: 'iPhone 15 Pro Max',
        brand: 'iPhone',
        icon: '',
        width: 430,
        height: 932,
        dpr: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: true,
        hasHomeIndicator: true
      },
      {
        id: 'iphone-15',
        name: 'iPhone 15',
        brand: 'iPhone',
        icon: '',
        width: 393,
        height: 852,
        dpr: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: true,
        hasHomeIndicator: true
      },
      {
        id: 'iphone-se',
        name: 'iPhone SE (第三代)',
        brand: 'iPhone',
        icon: '',
        width: 375,
        height: 667,
        dpr: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: false,
        hasHomeIndicator: false
      },
      {
        id: 'iphone-12-mini',
        name: 'iPhone 12 mini',
        brand: 'iPhone',
        icon: '',
        width: 360,
        height: 780,
        dpr: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: true,
        hasHomeIndicator: true
      }
    ] as DevicePreset[]
  },
  {
    label: 'Android 系列',
    devices: [
      {
        id: 'pixel-8-pro',
        name: 'Google Pixel 8 Pro',
        brand: 'Android',
        icon: '',
        width: 412,
        height: 915,
        dpr: 3.5,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36',
        hasNotch: true,
        hasHomeIndicator: false
      },
      {
        id: 'samsung-s24-ultra',
        name: 'Samsung Galaxy S24 Ultra',
        brand: 'Android',
        icon: '',
        width: 412,
        height: 915,
        dpr: 3.5,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36',
        hasNotch: false,
        hasHomeIndicator: false
      },
      {
        id: 'huawei-mate60',
        name: '华为 Mate 60 Pro',
        brand: 'Android',
        icon: '',
        width: 392,
        height: 851,
        dpr: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; ALN-AL00) AppleWebKit/537.36',
        hasNotch: true,
        hasHomeIndicator: false
      },
      {
        id: 'xiaomi-14',
        name: '小米 14',
        brand: 'Android',
        icon: '',
        width: 393,
        height: 851,
        dpr: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; 23127PN0CC) AppleWebKit/537.36',
        hasNotch: true,
        hasHomeIndicator: false
      },
      {
        id: 'redmi-note13',
        name: 'Redmi Note 13',
        brand: 'Android',
        icon: '',
        width: 393,
        height: 873,
        dpr: 2.75,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; 23090RA98C) AppleWebKit/537.36',
        hasNotch: true,
        hasHomeIndicator: false
      }
    ] as DevicePreset[]
  },
  {
    label: '通用尺寸',
    devices: [
      {
        id: 'generic-375',
        name: '通用 375 (标准)',
        brand: 'Generic',
        icon: '',
        width: 375,
        height: 812,
        dpr: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: false,
        hasHomeIndicator: false
      },
      {
        id: 'generic-414',
        name: '通用 414 (大屏)',
        brand: 'Generic',
        icon: '',
        width: 414,
        height: 896,
        dpr: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: false,
        hasHomeIndicator: false
      },
      {
        id: 'generic-360',
        name: '通用 360 (小屏)',
        brand: 'Generic',
        icon: '',
        width: 360,
        height: 640,
        dpr: 2,
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        hasNotch: false,
        hasHomeIndicator: false
      },
      {
        id: 'ipad-mini',
        name: 'iPad Mini',
        brand: 'iPad',
        icon: '',
        width: 768,
        height: 1024,
        dpr: 2,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        hasNotch: false,
        hasHomeIndicator: false
      }
    ] as DevicePreset[]
  }
]

// 快捷设备（取每个组的第一个 + 部分）
const quickDevices = computed<DevicePreset[]>(() => {
  const all = deviceGroups.flatMap(g => g.devices)
  return [
    all.find(d => d.id === 'iphone-15-pro-max')!,
    all.find(d => d.id === 'iphone-15')!,
    all.find(d => d.id === 'pixel-8-pro')!,
    all.find(d => d.id === 'samsung-s24-ultra')!,
    all.find(d => d.id === 'huawei-mate60')!,
    all.find(d => d.id === 'generic-375')!,
  ]
})

// ===================== 响应式状态 =====================
const currentDevice = ref('iphone-15')
const orientation = ref<'portrait' | 'landscape'>('portrait')
const previewUrl = ref('')
const urlPreset = ref('local')
const scalePercent = ref(100)
const loading = ref(false)
const loadError = ref(false)
const currentTime = ref('')
const stageRef = ref<HTMLElement>()
const previewFrame = ref<HTMLIFrameElement>()

// URL 预设
const urlPresets: Record<string, string> = {
  local: 'http://localhost:5175',
  production: '',
  custom: ''
}

// ===================== 计算属性 =====================
const allDevices = computed(() => deviceGroups.flatMap(g => g.devices))

const activeDevice = computed<DevicePreset>(() => {
  return allDevices.value.find(d => d.id === currentDevice.value) || allDevices.value[0]
})

// 显示宽高（根据横竖屏切换）
const displayWidth = computed(() => {
  return orientation.value === 'portrait' ? activeDevice.value.width : activeDevice.value.height
})
const displayHeight = computed(() => {
  return orientation.value === 'portrait' ? activeDevice.value.height : activeDevice.value.width
})

// 缩放比例
const scale = computed(() => scalePercent.value / 100)

// 设备外壳样式
const frameStyle = computed(() => {
  const w = displayWidth.value
  const h = displayHeight.value
  const s = scale.value
  return {
    width: `${w * s + 24}px`,   // +24 padding
    height: `${h * s + 60}px`,  // +60 状态栏+底部
    transform: `scale(${s})`,
    transformOrigin: 'top center'
  }
})

// iframe 样式
const iframeStyle = computed(() => {
  return {
    width: `${displayWidth.value}px`,
    height: `${displayHeight.value}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: 'top left'
  }
})

// ===================== 方法 =====================
function onDeviceChange() {
  loading.value = true
  loadError.value = false
}

function onOrientationChange() {
  // 横竖屏切换时重新渲染
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 300)
}

function onUrlPresetChange(val: string) {
  if (val === 'local') {
    previewUrl.value = urlPresets.local
  } else if (val === 'production') {
    // 从当前域名推断移动端地址
    const host = window.location.hostname
    if (host.includes('onepan.cn')) {
      previewUrl.value = `https://app.${host.split('.').slice(-2).join('.')}`
    } else {
      previewUrl.value = ''
    }
  }
}

function onScaleChange() {
  // 缩放变化时更新
}

function resetScale() {
  scalePercent.value = 100
}

function switchDevice(id: string) {
  currentDevice.value = id
  onDeviceChange()
}

function refreshPreview() {
  if (!previewUrl.value) {
    loadError.value = true
    return
  }
  loadError.value = false
  loading.value = true
  // 重新加载 iframe
  if (previewFrame.value) {
    const src = previewFrame.value.src
    previewFrame.value.src = ''
    setTimeout(() => {
      if (previewFrame.value) {
        previewFrame.value.src = src || previewUrl.value
      }
    }, 100)
  }
}

function onIframeLoad() {
  loading.value = false
  loadError.value = false
}

function onIframeError() {
  loading.value = false
  loadError.value = true
}

function updateTime() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${h}:${m}`
}

let timeTimer: ReturnType<typeof setInterval>

// ===================== 生命周期 =====================
onMounted(() => {
  // 初始化默认地址
  previewUrl.value = urlPresets.local
  updateTime()
  timeTimer = setInterval(updateTime, 30000)
})

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
})

// 监听URL变化
watch(previewUrl, (val) => {
  if (val) {
    loadError.value = false
    loading.value = true
  }
})
</script>

<style scoped>
.mobile-preview-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
}

/* ===== 工具栏 ===== */
.toolbar-card {
  border: none;
  border-bottom: 1px solid #e4e7ed;
  border-radius: 0;
}
.toolbar-card :deep(.el-card__body) {
  padding: 12px 20px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  font-weight: 500;
}

/* ===== 预览舞台 ===== */
.preview-stage {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  position: relative;
}

/* 设备信息条 */
.device-info-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ===== 设备外壳 ===== */
.device-frame {
  position: relative;
  background: #1a1a1a;
  border-radius: 36px;
  padding: 12px;
  box-shadow:
    0 0 0 2px #333,
    0 8px 40px rgba(0, 0, 0, 0.3);
  transition: width 0.3s ease, height 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* iPhone 专属样式 */
.device-frame--iphone {
  border-radius: 44px;
  padding: 14px;
}

/* Android 专属样式 */
.device-frame--android {
  border-radius: 28px;
  padding: 10px;
}

/* iPad 专属样式 */
.device-frame--ipad {
  border-radius: 24px;
  padding: 14px;
}

/* 刘海 */
.device-notch {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 28px;
  background: #1a1a1a;
  border-radius: 14px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.device-notch__speaker {
  width: 50px;
  height: 5px;
  background: #333;
  border-radius: 3px;
}

/* 状态栏 */
.device-status-bar {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-radius: 8px 8px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #000;
  flex-shrink: 0;
}
.status-time {
  font-size: 13px;
}
.status-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 横屏时状态栏调整 */
.device-frame--landscape .device-status-bar {
  height: 24px;
  padding: 0 12px;
}
.device-frame--landscape .device-notch {
  display: none;
}

/* 屏幕区域 */
.device-screen-wrapper {
  position: relative;
  overflow: hidden;
  background: #fff;
  border-radius: 0 0 8px 8px;
  flex-shrink: 0;
}

.device-iframe {
  border: none;
  display: block;
  background: #fff;
}

/* 加载/错误遮罩 */
.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 5;
}

/* Home 指示条 */
.device-home-indicator {
  width: 120px;
  height: 5px;
  background: #1a1a1a;
  border-radius: 3px;
  margin: 8px 0 4px;
}

/* ===== 快捷设备栏 ===== */
.quick-devices {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding: 12px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
  justify-content: center;
}
.quick-label {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}
.quick-device-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e4e7ed;
  font-size: 13px;
  color: #606266;
}
.quick-device-item:hover {
  border-color: #409eff;
  color: #409eff;
}
.quick-device-item.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.quick-device-icon {
  font-size: 16px;
}
.quick-device-name {
  white-space: nowrap;
}

/* ===== 响应式 ===== */
@media screen and (max-width: 768px) {
  .toolbar {
    gap: 8px;
  }
  .toolbar-group {
    flex-wrap: wrap;
  }
  .toolbar-label {
    font-size: 12px;
  }
}
</style>
