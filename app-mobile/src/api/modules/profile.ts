import { get, post, put } from '../request'

export interface UserProfile {
  id: number
  username: string
  realName: string
  phone: string
  email: string
  avatar: string
  role: string
  tenantId: number
  tenantName: string
}

export const profileApi = {
  async getProfile(): Promise<UserProfile> {
    return get('/auth/profile')
  },

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return put('/auth/profile', data)
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return post('/auth/change-password', { oldPassword, newPassword })
  },

  async uploadAvatar(file: File): Promise<{ avatar: string }> {
    const formData = new FormData()
    formData.append('file', file)
    return post('/auth/avatar', formData)
  }
}
