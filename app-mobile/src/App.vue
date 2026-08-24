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

/* 根治：uni-app H5 大量容器用 width:100% + 水平 padding 但未设 box-sizing，
   默认 content-box 导致 宽度+padding 超出视口、右边距/右缘被裁。全局补 border-box，
   让所有 padding 计入 width（绝大多数页都预期 border-box 语义）。 */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* 根治：uni-app H5 把 <form> 编译成 <uni-form>（未知自定义元素），
   浏览器默认 display:inline，导致其内部块级子元素突破容器、左右 padding/边距失效、
   内容满宽贴边并与上方元素重叠。补 display:block 恢复原生 <form> 的盒模型语义。 */
uni-form {
  display: block;
}

/* 全局隐藏 H5 滚动条（原稿 reset：::-webkit-scrollbar display:none） */
::-webkit-scrollbar,
uni-scroll-view .uni-scroll-view::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 全局根治：长值文本允许换行+收缩，避免右侧溢出裁剪（uni-app <text> 为行内 uni-text，
   需 min-width:0 + word-break 才能在 flex row 内收缩，否则长值贴右溢出） */
.info-value,
.filter-value,
.picker-text,
.mf-li-desc,
.li-desc,
.info-value text {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
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
