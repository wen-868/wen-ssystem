import request from '../utils/request'

export function loginApi(data: { username: string; password: string }) {
  return request.post('/platform/auth/login', data)
}

export function getAdminInfoApi() {
  return request.get('/platform/auth/me')
}