import { get } from '../request'
import type { Activity, Banner } from '@/types'

export const getBanners = (): Promise<Banner[]> => {
  return get('/store/banners')
}

export const getActivityList = (): Promise<Activity[]> => {
  return get('/store/activities')
}

export const getActivityDetail = (id: number): Promise<Activity> => {
  return get(`/store/activities/${id}`)
}