import axios from 'axios'
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

/**
 * 会话恢复专用（REHYDRATE-01）：绕过统一实例的响应拦截器。
 * 原因：统一实例对 401 会自动 logout 并改写 hash 跳登录页，而「恢复会话」场景
 * 需要 auth store 自主区分三类结果（成功 / 401 过期 fail-closed / 网络失败保留 token 可重试），
 * 拦截器的自动副作用会与守卫的 async 流程竞争。Authorization 显式传入而非依赖拦截器注入。
 * 注：'/api' 前缀与 request 实例 baseURL 同源（vite proxy 契约常量）。
 */
export function getAdminInfoRaw(token: string) {
  return axios.get('/api/platform/auth/me', {
    timeout: 15000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/** 获取图形验证码（后端下发 SVG data URI，5 分钟有效、一次性） */
export function getCaptchaApi() {
  return request.get('/platform/auth/captcha')
}
