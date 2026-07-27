<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  // 检查登录状态
  const token = uni.getStorageSync('merchant_token')
  if (!token) {
    // 未登录，跳转登录页
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

onShow(() => {
  // 应用切回前台
})

onHide(() => {
  // 应用切到后台
})
</script>

<style lang="scss">
/* 全局样式 */
@import '@/uni.scss';

page {
  background-color: #F5F5F5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
}
</style>