import request from '../utils/request'

export interface MonitorData {
  uptime: number
  connections: number
  qps: number
  memory: { rss: string; heapTotal: string; heapUsed: string; external: string }
  cpu: { user: number; system: number }
  nodeVersion: string
  platform: string
  lastError: string | null
}

export function fetchMonitorData() {
  return request.get<MonitorData>('/platform/monitor')
}