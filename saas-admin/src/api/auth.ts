import request from '../utils/request'

/** 登录（R101-S2-01 裁定 4.1：图形验证码为必填校验项） */
export function loginApi(data: {
  username: string
  password: string
  captchaId: string
  captcha: string
}) {
  return request.post('/platform/auth/login', data)
}

export function getAdminInfoApi() {
  return request.get('/platform/auth/me')
}

/** 获取图形验证码（后端下发 SVG data URI，5 分钟有效、一次性） */
export function getCaptchaApi() {
  return request.get('/platform/auth/captcha')
}
