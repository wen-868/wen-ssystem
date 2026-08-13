<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { checkAppUpdate } from '@/utils/update'

onLaunch(() => {
  // 启动检查更新（有新版本及时提示）
  checkAppUpdate()
  // 检查登录状态
  const token = uni.getStorageSync('merchant_token')
  if (!token) {
    // 未登录，跳转登录页
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

onShow(() => {
})

onHide(() => {
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
