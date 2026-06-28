declare global {
  interface Window {
    wx?: any;
    __wxConfig?: any;
  }
}

export function isWeChat(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  return ua.includes('micromessenger')
}

export function loadWxSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser'))
      return
    }
    if (window.wx) {
      resolve(window.wx)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
    script.onload = () => resolve(window.wx)
    script.onerror = () => reject(new Error('Failed to load WeChat JSSDK'))
    document.head.appendChild(script)
  })
}

export async function initWxConfig(signatureData: {
  appId: string
  timestamp: number
  nonceStr: string
  signature: string
}): Promise<void> {
  const wx = await loadWxSdk()
  return new Promise((resolve, reject) => {
    wx.config({
      debug: false,
      appId: signatureData.appId,
      timestamp: signatureData.timestamp,
      nonceStr: signatureData.nonceStr,
      signature: signatureData.signature,
      jsApiList: ['scanQRCode', 'chooseImage', 'getLocation']
    })
    wx.ready(() => resolve())
    wx.error((err: any) => reject(err))
  })
}

export async function wxScanQRCode(): Promise<string> {
  const wx = await loadWxSdk()
  return new Promise((resolve, reject) => {
    if (!wx.scanQRCode) {
      reject(new Error('scanQRCode not available'))
      return
    }
    wx.scanQRCode({
      needResult: 1,
      scanType: ['qrCode', 'barCode'],
      success: (res: any) => {
        const result = res.resultStr
        if (result && result.includes(',')) {
          const parts = result.split(',')
          resolve(parts[parts.length - 1])
        } else {
          resolve(result || '')
        }
      },
      fail: (err: any) => reject(err)
    })
  })
}

export {}
