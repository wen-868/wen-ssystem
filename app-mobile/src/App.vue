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

/* 全局隐藏 H5 滚动条（原稿 reset：::-webkit-scrollbar display:none） */
::-webkit-scrollbar,
uni-scroll-view .uni-scroll-view::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 隐藏 H5 端原生 tabBar（custom:true 时仍渲染占位，避免与自定义悬浮胶囊形成双栏） */
uni-tabbar {
  display: none !important;
}

/* 线框图标（iconfont 字符全面替换后统一尺寸：跟随所在类名字号） */
image.ic {
  width: 1em;
  height: 1em;
}

/* 无障碍：用户开启「减少动态效果」时全局降级动画与过渡（spec06/12） */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
