import { get, post, put, buildSecureHeaders } from '../request'
import { API_BASE_H5, API_BASE_NATIVE } from '../../config/env'

export interface UserProfile {
  id: number
  username: string
  realName: string
  phone: string
  email: string
  avatar: string
  role: string
  roles?: string[]
  tenantId: number
  tenantName: string
  storeName?: string
}

export const profileApi = {
  async getProfile(): Promise<UserProfile> {
    return get('/admin/auth/me')
  },

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    // 后端没有专门的 profile 更新接口，使用 sys-users 接口
    const profile = await get('/admin/auth/me')
    return put(`/admin/sys-users/${profile.id}`, data)
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return post('/admin/auth/change-password', { oldPassword, newPassword })
  },

  async uploadAvatar(filePath: string): Promise<{ avatar: string }> {
    // 真实上传：POST /api/admin/auth/avatar（multer 单文件 avatar，返回完整头像 URL）
    const base = (() => {
      // #ifdef H5
      return API_BASE_H5
      // #endif
      // #ifndef H5
      return API_BASE_NATIVE
      // #endif
    })()
    return new Promise((resolve, reject) => {
      // 直接调用 uni.uploadFile（multipart）。
      // ★ MOBILE-29F1：只用安全头构建器——绝不下发 Content-Type，multipart boundary 由
      // uni / 微信 / 浏览器自行生成（★ QODER-29 MO-29：旧实现漏发 X-Tenant-Id；
      // QODER-29 驳回根因：复用 JSON 构建器会破坏 multipart）
      const header = buildSecureHeaders()
      uni.uploadFile({
        url: `${base}/admin/auth/avatar`,
        filePath,
        name: 'avatar',
        header,
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (res.statusCode === 200 && data.data) resolve(data.data)
            else reject(new Error(data.msg || `上传失败(${res.statusCode})`))
          } catch {
            reject(new Error('上传响应异常'))
          }
        },
        fail: (err) => reject(new Error(err.errMsg || '上传失败')),
      })
    })
  }
}
