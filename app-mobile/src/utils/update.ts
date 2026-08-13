/**
 * 移动端 APP 更新检查（总台「版本发布」）
 *
 * - APP 端：发布 .wgt 热更新包 → 下载安装后重启；无 wgt 包 → 提示去下载新安装包
 * - H5 端：提示刷新页面
 */

// 与 app-mobile/package.json 同步，发版时更新（APP 端实际以 plus.runtime.version 为准）
const H5_LOCAL_VERSION = "1.0.0"

interface LatestAppVersion {
  versionName: string
  isForce: boolean
  updateUrl: string
  packageUrl: string
  updateNote: string
}

function resolveBase(): string {
  // #ifdef H5
  return import.meta.env.VITE_API_BASE || '/api'
  // #endif
  // #ifndef H5
  return 'https://api.onepan.cn/api'
  // #endif
}

function currentVersion(): string {
  // #ifdef APP-PLUS
  try {
    return (plus.runtime.version || H5_LOCAL_VERSION) as string
  } catch {
    return H5_LOCAL_VERSION
  }
  // #endif
  // #ifndef APP-PLUS
  return H5_LOCAL_VERSION
  // #endif
}

function installWgt(url: string): void {
  uni.showLoading({ title: '下载更新包…' })
  uni.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode !== 200) {
        uni.hideLoading()
        uni.showToast({ title: '更新包下载失败', icon: 'none' })
        return
      }
      // #ifdef APP-PLUS
      plus.runtime.install(
        res.tempFilePath,
        { force: true },
        () => {
          uni.hideLoading()
          uni.showModal({
            title: '更新完成',
            content: '新版本已安装，重启应用后生效',
            showCancel: false,
            confirmText: '重启',
            success: () => {
              plus.runtime.restart()
            },
          })
        },
        (err: any) => {
          uni.hideLoading()
          uni.showToast({ title: `安装失败：${err?.message || '未知错误'}`, icon: 'none' })
        }
      )
      // #endif
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '更新包下载失败', icon: 'none' })
    },
  })
}

function handleAppUpdate(data: LatestAppVersion): void {
  const content = `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}`
  const isWgt = !!data.packageUrl && data.packageUrl.toLowerCase().endsWith('.wgt')
  // #ifdef APP-PLUS
  if (isWgt) {
    uni.showModal({
      title: '发现新版本',
      content,
      showCancel: !data.isForce,
      cancelText: '稍后',
      confirmText: '立即更新',
      success: (r) => {
        if (r.confirm) installWgt(data.packageUrl)
      },
    })
    return
  }
  uni.showModal({
    title: '发现新版本',
    content: `${content}\n\n请前往下载最新安装包`,
    showCancel: !data.isForce,
    cancelText: '稍后',
    confirmText: '去下载',
    success: (r) => {
      if (r.confirm && data.updateUrl) plus.runtime.openURL(data.updateUrl)
    },
  })
  // #endif
}

/** 启动/回前台时调用：检查是否有新版本 */
export function checkAppUpdate(): void {
  const base = resolveBase()
  uni.request({
    url: `${base}/app/version/app_mobile`,
    method: 'GET',
    timeout: 8000,
    success: (res) => {
      const data = (res.data as any)?.data as LatestAppVersion | null
      if (!data || data.versionName === currentVersion()) return
      // #ifdef H5
      uni.showModal({
        title: '发现新版本',
        content: `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}`,
        showCancel: !data.isForce,
        cancelText: '稍后',
        confirmText: '刷新',
        success: (r) => {
          if (r.confirm) window.location.reload()
        },
      })
      // #endif
      // #ifdef APP-PLUS
      handleAppUpdate(data)
      // #endif
    },
  })
}
