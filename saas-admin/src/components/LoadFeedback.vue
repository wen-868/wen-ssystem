<template>
  <!--
    页面反馈组件（TOTAL-PLATFORM-UI-FEEDBACK-POLISH-01）。
    五种呈现，全部页面内（不以 toast 替代）：
    - loading 且无旧数据（!stale）：整块加载提示，aria-busy=true（首载可感知）；
    - loading 且 stale：细横幅「数据刷新中…」（旧数据照常展示，不闪烁）；
    - ready 且 stale：警示横幅「刷新失败 + 数据可能已过期」+ 重试刷新（保留旧数据）；
    - empty：整块空态（与错误态不同形，独立文案）；
    - error：整块错误态 role=alert + 分类文案 + 重试按钮（原生 button 键盘可操作）；
      forbidden 额外给「返回运营大盘」边界入口，不泄漏内部权限码。
    ready 且 !stale 时不渲染任何反馈（数据区由页面自行渲染）。
  -->
  <div v-if="visible" class="fb-wrap" :aria-busy="busy ? 'true' : undefined">
    <!-- 刷新中横幅（有旧数据，不顶掉列表） -->
    <div v-if="state.phase === 'loading' && state.stale" class="fb-banner fb-banner--refresh" role="status" :aria-live="liveRole">
      <span class="fb-spin" aria-hidden="true"></span>
      <span>数据刷新中…</span>
    </div>

    <!-- 刷新失败横幅（旧数据保留，明确可能过期，禁止误报成功） -->
    <div v-else-if="state.phase === 'ready' && state.stale" class="fb-banner fb-banner--stale" role="alert" :aria-live="liveRole">
      <span class="fb-ico" aria-hidden="true">⚠</span>
      <span class="fb-msg">刷新失败：{{ state.message }}。当前展示的数据可能已过期。</span>
      <button type="button" class="fb-btn fb-btn--retry" @click="$emit('retry')">重试刷新</button>
    </div>

    <!-- 首次加载整块 -->
    <div v-else-if="state.phase === 'loading'" class="fb-block fb-loading" role="status" :aria-live="liveRole">
      <span class="fb-spin fb-spin--lg" aria-hidden="true"></span>
      <span class="fb-text">正在加载…</span>
    </div>

    <!-- 空态（与错误态不同形） -->
    <div v-else-if="state.phase === 'empty'" class="fb-block fb-empty" role="status" :aria-live="liveRole">
      <span class="fb-ico fb-ico--muted" aria-hidden="true">📭</span>
      <span class="fb-text">{{ emptyText || '暂无数据' }}</span>
    </div>

    <!-- 错误态（分类文案 + 页面内重试；403 明确边界与返回入口） -->
    <div v-else-if="state.phase === 'error'" class="fb-block fb-error" role="alert" :aria-live="liveRole">
      <span class="fb-ico" aria-hidden="true">{{ state.kind === 'forbidden' ? '⛔' : '⚠' }}</span>
      <span class="fb-text fb-text--err">{{ state.message }}</span>
      <span v-if="state.kind === 'forbidden'" class="fb-sub">如需开通，请联系平台超级管理员调整角色授权。</span>
      <span class="fb-actions">
        <button type="button" class="fb-btn fb-btn--retry" @click="$emit('retry')">重试</button>
        <button
          v-if="state.kind === 'forbidden'"
          type="button"
          class="fb-btn fb-btn--ghost"
          @click="$emit('back')"
        >返回运营大盘</button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { canRetryFeedback, feedbackBusyOf, feedbackLiveRoleOf, type LoadFeedbackState } from '../api/feedback'

const props = defineProps<{
  state: LoadFeedbackState
  /** 空态文案（按页面自定义，如「暂无租户」） */
  emptyText?: string
}>()

defineEmits<{ (e: 'retry'): void; (e: 'back'): void }>()

const visible = computed(() => {
  const s = props.state
  // ready 且数据已恢复（无 stale）→ 无任何反馈；其余阶段一律呈现
  return s.phase !== 'ready' || s.stale
})

const busy = computed(() => feedbackBusyOf(props.state))
const liveRole = computed(() => feedbackLiveRoleOf(props.state))

/** 供调用方判断 retry 是否会真正生效（loading 期间防重复点击） */
const retryable = computed(() => canRetryFeedback(props.state))
defineExpose({ retryable })
</script>

<style scoped>
.fb-wrap { width: 100%; }
.fb-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; margin-bottom: 12px;
  border-radius: 6px; font-size: 13px;
}
.fb-banner--refresh { background: var(--bg-soft); color: var(--text-secondary); border: 1px solid var(--border-normal); }
.fb-banner--stale { background: var(--color-warning-soft); color: var(--color-warning); border: 1px solid var(--border-normal); }
.fb-block {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 48px 16px; min-height: 220px; text-align: center;
}
.fb-text { font-size: 14px; color: var(--text-secondary); }
.fb-text--err { color: var(--color-danger); font-weight: 600; }
.fb-sub { font-size: 12px; color: var(--text-muted); max-width: 420px; }
.fb-ico { font-size: 28px; line-height: 1; }
.fb-ico--muted { opacity: 0.55; }
.fb-msg { flex: 1; text-align: left; }
.fb-actions { display: flex; gap: 8px; margin-top: 4px; }
.fb-btn {
  padding: 6px 18px; border-radius: 6px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--border-normal); background: var(--bg-card);
  color: var(--text-primary);
}
.fb-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.fb-btn--retry { border: none; background: var(--color-primary); color: var(--text-inverse); }
.fb-btn--ghost { background: var(--bg-card); }
.fb-spin {
  width: 14px; height: 14px; border-radius: 50%; flex: none;
  border: 2px solid var(--border-normal);
  border-top-color: var(--color-primary);
  animation: fb-spin 0.8s linear infinite;
}
.fb-spin--lg { width: 26px; height: 26px; border-width: 3px; }
@keyframes fb-spin { to { transform: rotate(360deg); } }
</style>
