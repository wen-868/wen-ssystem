/**
 * 移动端 APP 更新检查（总台「版本发布」）
 *
 * - APP 端：发布 .wgt 热更新包 → 下载并**实算 SHA-256 校验通过**后重启；无 wgt 包 → 提示去下载新安装包
 * - H5 端：提示刷新页面
 *
 * ★ QODER-24（MO-14）热更新安全卡改造要点（判据全部集中在 `src/config/update-security.ts`，本文件只接线）：
 *  1. 版本提示改为**纯函数 semver 判据**：远端必须是合法 semver 且严格高于本地才提示；
 *     等值、降级、非法（含 `v` 前缀）一律不提示（旧实现只做 `versionName === currentVersion` 等值比较）。
 *  2. `packageUrl` 只接受 `https:` + 无 userinfo + 非 IP + 标准端口 + **主机与运行时 API 基址同源** +
 *     路径以 `.wgt` 结尾；其余拒装。
 *  3. `packageSha256` **缺失 / 非 64 位 hex / 下载后实算不一致 ⇒ 删除临时文件并拒绝安装**（失败关闭）。
 *     后端 `LatestAppVersion` 当前**没有摘要字段**（`backend/src/services/platform/app-version.service.ts:20-27`，只读），
 *     ⇒ 因此**本单落地后 `.wgt` 自动直装通道是关闭的**，改走白名单下载页；这是本单的**预期结果**，
 *     不是"联调通过"。后端补 `package_sha256` 字段属外部前置，记在回传卡「未完成与阻塞」。
 *  4. 摘要**实算下载文件的原始字节**（`plus.io.resolveLocalFileSystemURL` + `plus.io.FileReader.readAsDataURL`
 *     ⇒ `dataUrlToBytes` ⇒ 复用 `utils/crypto.ts` 的纯 JS `sha256`），不校验长度、不校验首尾片段；
 *     读不到字节的端（H5 / 小程序 / 任何 plus.io 失败分支）**一律不安装**，不用 toast"提示不支持"冒充校验完成。
 *  5. `updateUrl` 必须 `https:` 且主机命中集中白名单（`update-security.ts` 的 OFFICIAL_UPDATE_HOSTS ∪ 运行时 API 主机）
 *     才允许 `plus.runtime.openURL`。
 *  6. 安装不再使用 force 直装：`plus.runtime.install` 的 options 改为 `{ force: false }`，
 *     且只有实算摘要与下发摘要一致后才会走到安装（semver 闸已保证只装严格更高的版本）。
 */
import { API_BASE_H5, API_BASE_NATIVE } from '../config/env'
import { request, buildRequestHeaders } from '../api/request'
import {
  dataUrlToBytes,
  decideUpdateAction,
  verifyPackageBytes,
  type UpdateDecision,
} from '../config/update-security'

// 与 app-mobile/package.json 同步，发版时更新（APP 端实际以 plus.runtime.version 为准）
const H5_LOCAL_VERSION = "1.0.0"

/**
 * 后端 `/app/version/app_mobile` 下发的最新版本对象。
 * `packageSha256` 是**本卡要求后端补齐**的字段（后端当前无此字段，见文件头第 3 条）：
 * 声明为可选只表示"读得到就用"，**不代表缺失时可通过校验**——缺失一律失败关闭。
 */
interface LatestAppVersion {
  versionName: string
  isForce: boolean
  updateUrl: string
  packageUrl: string
  updateNote: string
  packageSha256?: string | null
}

function resolveBase(): string {
  let base = API_BASE_NATIVE
  // #ifdef H5
  base = API_BASE_H5
  // #endif
  return base
}

function currentVersion(): string {
  let version = H5_LOCAL_VERSION
  // #ifdef APP-PLUS
  try {
    version = (plus.runtime.version || H5_LOCAL_VERSION) as string
  } catch {
    version = H5_LOCAL_VERSION
  }
  // #endif
  return version
}

/** H5 端同源判定所需的运行时来源；App / 小程序端由绝对 API 基址解析主机，返回空串即可 */
function runtimeOrigin(): string {
  let origin = ''
  // #ifdef H5
  try {
    origin = window.location.origin
  } catch {
    origin = ''
  }
  // #endif
  return origin
}

/**
 * 删除下载下来的临时包（任何校验失败分支都必须调用，失败也不阻断拒装结论）。
 */
function removeTempPackage(filePath: string, done: () => void): void {
  let handled = false
  // #ifdef APP-PLUS
  handled = true
  try {
    plus.io.resolveLocalFileSystemURL(
      filePath,
      (entry: any) => {
        entry.remove(
          () => done(),
          () => done()
        )
      },
      () => done()
    )
  } catch {
    done()
  }
  // #endif
  if (!handled) done()
}

/**
 * 读下载文件的**原始字节**（非首尾片段、非长度）。
 * 任何一步失败 ⇒ 回调 `null`，调用方据此**失败关闭不安装**；
 * 非 APP 端（H5 / 小程序）没有该原生能力，同样返回 `null` ⇒ 不安装。
 */
function readPackageBytes(tempFilePath: string, onBytes: (bytes: Uint8Array | null) => void): void {
  let handled = false
  // #ifdef APP-PLUS
  handled = true
  try {
    plus.io.resolveLocalFileSystemURL(
      tempFilePath,
      (entry: any) => {
        entry.file(
          (file: any) => {
            const reader = new plus.io.FileReader()
            reader.onload = () => {
              onBytes(dataUrlToBytes(String(reader.result ?? '')))
            }
            reader.onerror = () => onBytes(null)
            reader.readAsDataURL(file)
          },
          () => onBytes(null)
        )
      },
      () => onBytes(null)
    )
  } catch {
    onBytes(null)
  }
  // #endif
  if (!handled) onBytes(null)
}

/** 只有通过 `verifyPackageBytes`（实算摘要与下发摘要一致）后才会走到这里 */
function installVerifiedWgt(tempFilePath: string): void {
  let handled = false
  // #ifdef APP-PLUS
  handled = true
  plus.runtime.install(
    tempFilePath,
    // 未验包不再直装：本函数只在校验通过后被调用；force 关闭，同版本/降级包由运行时直接拒装
    { force: false },
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
  if (!handled) {
    uni.hideLoading()
    uni.showToast({ title: '当前端无安装能力，已取消安装', icon: 'none' })
  }
}

function downloadAndVerify(url: string, expectedSha256: string): void {
  uni.showLoading({ title: '下载更新包…' })
  uni.downloadFile({
    url,
    // ★ QODER-29 MO-29：更新包下载确需直接调用 uni.downloadFile（二进制流，非 Promise 型统一入口），
    // 但必须复用统一安全头，鉴权 / 租户头 / CSRF 与 request.ts 同源
    header: buildRequestHeaders(),
    success: (res) => {
      const tempFilePath = res.tempFilePath
      if (res.statusCode !== 200 || !tempFilePath) {
        uni.hideLoading()
        uni.showToast({ title: '更新包下载失败', icon: 'none' })
        return
      }
      readPackageBytes(tempFilePath, (bytes) => {
        const verdict = verifyPackageBytes(bytes, expectedSha256)
        if (verdict.ok) {
          installVerifiedWgt(tempFilePath)
          return
        }
        // 失败关闭：删临时文件 + 拒绝安装（verdict.reason 已点名是"缺摘要/读不到字节/实算不一致"哪一种）
        removeTempPackage(tempFilePath, () => {
          uni.hideLoading()
          uni.showToast({ title: '更新包校验未通过，已取消安装', icon: 'none' })
        })
      })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '更新包下载失败', icon: 'none' })
    },
  })
}

/** 提示并（在校验通过后）安装 .wgt；摘要通道在本卡之后是关闭的，除非后端已下发合法 packageSha256 */
function promptInstallWgt(data: LatestAppVersion, decision: UpdateDecision): void {
  const content = `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}`
  // #ifdef APP-PLUS
  uni.showModal({
    title: '发现新版本',
    content,
    showCancel: !data.isForce,
    cancelText: '稍后',
    confirmText: '立即更新',
    success: (r) => {
      if (r.confirm) downloadAndVerify(decision.packageUrl, decision.expectedSha256)
    },
  })
  // #endif
}

/** 无可信 .wgt 通道时：只允许打开**白名单内**的下载页 */
function promptOpenUrl(data: LatestAppVersion, decision: UpdateDecision): void {
  const content = `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}\n\n请前往下载最新安装包`
  let handled = false
  // #ifdef APP-PLUS
  handled = true
  uni.showModal({
    title: '发现新版本',
    content,
    showCancel: !data.isForce,
    cancelText: '稍后',
    confirmText: '去下载',
    success: (r) => {
      // decision.openUrl 已过 https + 无凭据 + 非 IP + 标准端口 + 集中白名单五道闸（update-security.ts）
      if (r.confirm) plus.runtime.openURL(decision.openUrl)
    },
  })
  // #endif
  if (!handled) promptRefresh(data)
}

/** 有新版本但没有任何可信更新通道：只告知，不做任何自动动作（不 openURL、不 install） */
function promptBlocked(data: LatestAppVersion): void {
  const content = `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}\n\n当前无法安全校验更新包，请稍后重试或前往官网下载`
  // #ifdef APP-PLUS
  uni.showModal({
    title: '发现新版本',
    content,
    showCancel: !data.isForce,
    cancelText: '稍后',
    confirmText: '知道了',
  })
  // #endif
}

function promptRefresh(data: LatestAppVersion): void {
  // #ifdef H5
  uni.showModal({
    title: '发现新版本',
    content: `新版本 v${data.versionName}${data.updateNote ? `\n${data.updateNote}` : ''}`,
    showCancel: false,
    confirmText: '刷新',
    success: (r) => {
      if (r.confirm) window.location.reload()
    },
  })
  // #endif
  // 小程序端没有 .wgt 热更新与原生安装能力、读不到下载文件原始字节 ⇒ 不提示不安装（失败关闭）
  void data
}

function handleAppUpdate(data: unknown): void {
  const decision = decideUpdateAction(data, {
    currentVersion: currentVersion(),
    apiBase: resolveBase(),
    runtimeOrigin: runtimeOrigin(),
  })
  // ① semver 判据：等值 / 降级 / 非法 ⇒ 不提示（旧实现在这里是"名字不等就提示"）
  if (!decision.prompt) return
  const row = data as LatestAppVersion
  if (decision.kind === 'wgt') {
    promptInstallWgt(row, decision)
    return
  }
  if (decision.kind === 'open-url') {
    promptOpenUrl(row, decision)
    return
  }
  promptBlocked(row)
}

/** 启动/回前台时调用：检查是否有新版本 */
export function checkAppUpdate(): void {
  // 按操作系统平台请求对应安装包地址（android / ios / harmony）
  let arch = ''
  // #ifdef APP-PLUS
  try {
    const osName: string = (plus.os as any)?.name || ''
    if (osName.indexOf('Android') >= 0) arch = 'android'
    else if (osName.indexOf('iOS') >= 0 || osName.indexOf('iPhone') >= 0) arch = 'ios'
    else if (osName.indexOf('Harmony') >= 0 || osName.indexOf('鸿蒙') >= 0) arch = 'harmony'
  } catch { /* 忽略 */ }
  // #endif
  // ★ QODER-29 MO-29：版本检查是普通 GET，收口到统一请求入口（自动带鉴权 / 租户头 / CSRF，
  // 且经 HTTP 2xx 业务码判定）。属非关键后台请求 ⇒ silent：出错不打扰用户；
  // 网络错误 / 超时 / 非成功业务码 ⇒ reject 被 catch 静默吞掉，与旧实现"取不到 data 就不提示"结果等价。
  // 统一入口内部把成功信封的 data 解出后透传给 then，等价于旧代码的 `res.data.data`。
  const query = arch ? `?arch=${arch}` : ''
  request<LatestAppVersion | null>({
    url: `/app/version/app_mobile${query}`,
    method: 'GET',
    timeout: 8000,
    silent: true
  })
    .then((data) => {
      // 判据全部交给纯函数 decideUpdateAction（含版本、包地址同源、摘要、白名单四组闸）
      handleAppUpdate(data)
    })
    .catch(() => {
      /* 静默：版本检查失败不影响正常使用，也不清除登录态（silent 已抑制跳登录） */
    })
}
