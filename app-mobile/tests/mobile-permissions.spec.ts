/**
 * QODER-16 · 移动端隐私权限配置断言（iOS privacyDescription + 微信小程序录音授权）
 *
 * 目标：把「隐私描述缺失 / 授权文案为空 / 登记了代码里没用到的隐私接口」这三类
 *       会被苹果与微信审核直接驳回的问题，变成可复跑的红/绿门。
 *
 * 读数来源（2026-10-20 全量 grep app-mobile/src，证据见 docs/evidence/qoder-16/README.md）：
 *  - 录音：src/pages/ai-chat/ai-chat.vue:870 `uni.getRecorderManager` 类型引用、
 *          :994 `recorderManager = recorderManager || uni.getRecorderManager()`、
 *          :1007 `recorderManager.start({ duration: 60000, format: 'mp3' })`
 *  - 相机：uni.chooseImage（ai-chat.vue:415 / product-detail.vue:1274 / profile/edit.vue:150 /
 *          product-edit.vue:415 / create-loss.vue:242）、uni.scanCode（native/scan.ts:457）
 *  - 蓝牙：src/native/print.ts（蓝牙热敏打印小票，search/connect/print 全链）
 *  - 语音识别：ai-chat.vue:930 Web SpeechRecognition、:1011 plus.speech.startRecognize
 *  - 地理位置：`uni.getLocation` / `getFuzzyLocation` / `onLocationChange` /
 *          `startLocationUpdate(Background)` / `chooseLocation` / `choosePoi` / `chooseAddress`
 *          在 app-mobile/src **全部 0 命中** ⇒ requiredPrivateInfos 不得登记任何一项。
 *          （src/api/modules/stores.ts:17-18 等的 latitude/longitude 是**门店档案字段**，
 *            由管理员手工录入，不是设备定位 API。）
 *
 * 配置落点的取证结论（任务书 §二.3 同源方法：改前/改后比对 build:mp-weixin 产物 app.json）：
 *  - `@dcloudio/uni-cli-shared/dist/json/mp/pages.js:129-133` 只把 pages.json 的
 *    `preloadRule|workers|plugins|entryPagePath` 透传进 app.json；顶层 `mp-weixin` 不被读取。
 *  - 同文件 `mergeMiniProgramAppJson`（:33-45）把 **manifest.json 的 `mp-weixin` 节点**逐键并入
 *    app.json，仅排除 projectKeys（appid/setting…）与 NON_APP_JSON_KEYS，`permission` 与
 *    `requiredPrivateInfos` 均不在排除表内 ⇒ 生效落点是 `src/manifest.json`。
 *  - 实测：探针写进 src/pages.json 顶层 mp-weixin ⇒ 产物 app.json 无 permission；
 *          探针写进 src/manifest.json 的 mp-weixin ⇒ 产物 app.json 出现该 desc 原文。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const readJson = (rel: string) => {
  const file = fileURLToPath(new URL(rel, import.meta.url))
  const text = readFileSync(file, 'utf-8')
  // JSON.parse 抛错即视为门红：配置文件必须是合法 JSON
  return JSON.parse(text) as Record<string, any>
}

const manifest = readJson('../src/manifest.json')
const pages = readJson('../src/pages.json')

/** 苹果审核要求的六个用途描述键（任务书 §二.1 点名，缺一不可） */
const IOS_PRIVACY_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSSpeechRecognitionUsageDescription',
] as const

/**
 * 微信 requiredPrivateInfos 的**封闭合法取值表**（地理位置类 8 项，表外名字会被
 * miniprogram-ci 直接判 app.json 非法）。
 */
const WECHAT_ALLOWED_PRIVATE_INFOS = [
  'getFuzzyLocation',
  'getLocation',
  'onLocationChange',
  'startLocationUpdate',
  'startLocationUpdateBackground',
  'chooseLocation',
  'choosePoi',
  'chooseAddress',
] as const

/**
 * 「代码实际使用清单」白名单常量——只允许出现上面 grep 过、且属于 requiredPrivateInfos
 * 合法表的接口。本基线 grep 结果：8 项**全部 0 命中** ⇒ 清单为空数组。
 * 将来若某页真的接入定位，必须同时在这里补一行并附 `文件:行号`，否则本用例判红。
 */
const PRIVACY_APIS_USED_IN_CODE: readonly string[] = [
  // 例：'getLocation', // src/pages/xxx/xxx.vue:000（当前无，保持为空）
]

const iosPrivacy = manifest?.['app-plus']?.distribute?.ios?.privacyDescription
const mpWeixin = manifest?.['mp-weixin']
const recordDesc = mpWeixin?.permission?.['scope.record']?.desc
const requiredPrivateInfos = mpWeixin?.requiredPrivateInfos

describe('QODER-16 · 隐私权限配置门', () => {
  it('两份配置文件必须是合法 JSON 且关键父节点存在', () => {
    expect(() => readJson('../src/manifest.json')).not.toThrow()
    expect(() => readJson('../src/pages.json')).not.toThrow()
    expect(manifest['app-plus']).toBeTypeOf('object')
    expect(manifest['app-plus'].distribute.ios).toBeTypeOf('object')
    expect(iosPrivacy, 'app-plus.distribute.ios.privacyDescription 缺失').toBeTypeOf('object')
    expect(mpWeixin, 'manifest.json 顶层 mp-weixin 缺失').toBeTypeOf('object')
  })

  it('iOS 六个隐私描述键齐备且描述非空、不是「用于XX功能」式空话', () => {
    for (const key of IOS_PRIVACY_KEYS) {
      const desc = iosPrivacy?.[key]
      expect(desc, `缺少 ${key}`).toBeTypeOf('string')
      expect((desc || '').trim().length, `${key} 描述为空`).toBeGreaterThan(0)
      // 苹果审核口径：必须写清具体场景，不能只给「用于相机功能」这类占位
      expect(desc, `${key} 描述过于笼统（应写明具体业务场景）`).not.toMatch(/^用于[^，。；]{0,8}功能[。.]?$/)
      expect(desc.length, `${key} 描述长度不足以上架审核，实际=${desc.length}`).toBeGreaterThanOrEqual(15)
    }
  })

  it('每条隐私描述与其真实功能对得上（代码里能找到对应能力）', () => {
    // 逐条绑定代码证据，防止「登记了代码里没有的能力」或「有能力却漏描述」
    expect(iosPrivacy.NSCameraUsageDescription).toMatch(/条码|二维码|扫码/)
    expect(iosPrivacy.NSCameraUsageDescription).toMatch(/拍摄|照片/)
    expect(iosPrivacy.NSMicrophoneUsageDescription).toMatch(/录音|录制/)
    expect(iosPrivacy.NSPhotoLibraryUsageDescription).toMatch(/相册/)
    expect(iosPrivacy.NSLocationWhenInUseUsageDescription).toMatch(/门店/)
    expect(iosPrivacy.NSBluetoothAlwaysUsageDescription).toMatch(/打印/)
    expect(iosPrivacy.NSSpeechRecognitionUsageDescription).toMatch(/语音/)
  })

  it('小程序录音授权 scope.record.desc 必须存在且非空', () => {
    expect(mpWeixin?.permission, 'mp-weixin.permission 缺失').toBeTypeOf('object')
    expect(mpWeixin.permission['scope.record'], '缺少 scope.record 授权说明').toBeTypeOf('object')
    expect(recordDesc, 'scope.record.desc 缺失').toBeTypeOf('string')
    expect(recordDesc.trim().length, 'scope.record.desc 为空').toBeGreaterThan(0)
    // 授权弹窗文案必须说明「录音用来做什么」，与 ai-chat.vue 的录音能力对齐
    expect(recordDesc).toMatch(/录音|录制/)
  })

  it('requiredPrivateInfos 每一项都必须是合法值且在代码实际使用清单里', () => {
    expect(Array.isArray(requiredPrivateInfos), 'mp-weixin.requiredPrivateInfos 必须是数组').toBe(true)
    for (const api of requiredPrivateInfos as string[]) {
      expect(WECHAT_ALLOWED_PRIVATE_INFOS, `requiredPrivateInfos 含表外接口：${api}`).toContain(api)
      expect(
        PRIVACY_APIS_USED_IN_CODE,
        `requiredPrivateInfos 登记了代码中未使用的隐私接口：${api}（app-mobile/src grep 0 命中，禁止整表照抄）`
      ).toContain(api)
    }
  })

  it('录音接口不属于 requiredPrivateInfos 合法表（防误登记 startRecord）', () => {
    expect(WECHAT_ALLOWED_PRIVATE_INFOS).not.toContain('startRecord')
    expect(requiredPrivateInfos as string[]).not.toContain('startRecord')
  })

  it('页面配置文件保持原结构：mp-weixin 授权不放 pages.json（已取证为死配置）', () => {
    // 取证：src/pages.json 顶层 mp-weixin 不会进产物 app.json
    // （@dcloudio/uni-cli-shared/dist/json/mp/pages.js:129-133 只透传 preloadRule/workers/plugins/entryPagePath）。
    // 这里锁住该结论，避免后续有人在 pages.json 补一份**不生效**的重复授权配置造成两处真相源。
    expect(pages).toBeTypeOf('object')
    expect(Array.isArray(pages.pages)).toBe(true)
    expect(pages.tabBar).toBeTypeOf('object')
    expect(pages['mp-weixin'], 'pages.json 不应承载不生效的 mp-weixin 授权配置（生效落点=src/manifest.json）').toBeUndefined()
  })

  it('红线自证：appid / 支付 / 推送 / SDK / 插件等字段保持基线取值不动', () => {
    expect(manifest.appid, 'appid 被改动').toBe('__UNI__E395BAE')
    expect(manifest['mp-weixin'].appid, '小程序 appid 被改动').toBe('wx3ea76428aa15cec7')
    expect(manifest['app-plus'].distribute.android.packagename).toBe('com.zhixiang.app')
    expect(manifest['app-plus'].distribute.ios.appid).toBe('com.zhixiang.app')
    expect(Object.keys(manifest['app-plus'].distribute.sdkConfigs).sort()).toEqual(['share', 'speech'])
    expect(Object.keys(manifest['app-plus'].distribute.plugins).sort()).toEqual(['PrintManager', 'ZXing-Scanner'])
    // 基线未配置支付与推送节点：本单不得新增
    expect(manifest['app-plus'].distribute.payment, '不得新增支付配置').toBeUndefined()
    expect(manifest['app-plus'].distribute.unipush, '不得新增推送配置').toBeUndefined()
    expect(manifest['app-plus'].modules && Object.keys(manifest['app-plus'].modules).sort())
      .toEqual(['Barcode', 'Share', 'Speech'])
  })
})
