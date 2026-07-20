import { get, post, put } from '../request'

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

  async uploadAvatar(file: File): Promise<{ avatar: string }> {
    // 后端没有头像上传接口，暂时返回模拟数据
    console.warn('头像上传接口未实现')
    return { avatar: '' }
  }
}
