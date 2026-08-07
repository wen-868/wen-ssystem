<template>
  <view class="subscribe-page">
    <view class="form-card">
      <view class="form-item">
        <view class="form-label">公司名称</view>
        <input class="form-input" v-model="form.company" placeholder="请输入公司/店铺全称" />
      </view>
      <view class="form-item">
        <view class="form-label">联系人</view>
        <input class="form-input" v-model="form.contact" placeholder="请输入联系人姓名" />
      </view>
      <view class="form-item">
        <view class="form-label">手机号</view>
        <input class="form-input" v-model="form.mobile" type="number" maxlength="11" placeholder="请输入手机号" />
      </view>
      <view class="form-item">
        <view class="form-label">备注</view>
        <textarea class="form-textarea" v-model="form.remark" placeholder="选填：门店数量、业务规模等" />
      </view>
    </view>

    <view class="submit-btn" :class="{ disabled: submitting }" @tap="submit">{{ submitting ? '提交中...' : '提交订阅申请' }}</view>
    <view class="submit-tip">提交后由平台顾问审核，结果可在「我的申请」中查看</view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import Taro from '@tarojs/taro'
import { submitSubscription, getDeviceOpenid, saveLocalIdentity } from '../../api/platform'

const submitting = ref(false)
const form = reactive({
  planId: 0,
  company: '',
  contact: '',
  mobile: '',
  remark: ''
})

// 从路由参数读取 planId
try {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1] as any
  const planId = Number(current?.options?.planId || 0)
  if (planId) form.planId = planId
} catch {
  // 忽略
}

async function submit() {
  if (submitting.value) return
  if (!form.planId) {
    Taro.showToast({ title: '请先从套餐页选择套餐', icon: 'none' })
    return
  }
  if (!form.company.trim()) {
    Taro.showToast({ title: '请填写公司名称', icon: 'none' })
    return
  }
  if (!form.contact.trim()) {
    Taro.showToast({ title: '请填写联系人', icon: 'none' })
    return
  }
  if (!/^1\d{10}$/.test(form.mobile)) {
    Taro.showToast({ title: '请填写正确的手机号', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const openid = getDeviceOpenid()
    await submitSubscription({
      openid: openid || undefined,
      planId: form.planId,
      company: form.company.trim(),
      contact: form.contact.trim(),
      mobile: form.mobile,
      remark: form.remark.trim() || undefined
    })
    // 保存本地身份，供「我的申请」按 openid/手机号查询
    saveLocalIdentity({ openid, mobile: form.mobile })
    Taro.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => Taro.switchTab({ url: '/pages/my-applications/index' }), 1200)
  } catch (e: any) {
    Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss">
.subscribe-page {
  min-height: 100vh;
  background: $bg-page;
  padding: $spacing-xl $spacing-lg $spacing-xxl;
  box-sizing: border-box;
}
.form-card {
  background: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}
.form-item {
  margin-bottom: $spacing-lg;
}
.form-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}
.form-input {
  background: $bg-secondary;
  border-radius: $radius-sm;
  padding: $spacing-md;
  font-size: $font-size-base;
  color: $text-primary;
}
.form-textarea {
  background: $bg-secondary;
  border-radius: $radius-sm;
  padding: $spacing-md;
  font-size: $font-size-base;
  color: $text-primary;
  width: 100%;
  height: 160rpx;
  box-sizing: border-box;
}
.submit-btn {
  margin-top: $spacing-xl;
  background: $brand-gradient;
  color: #fff;
  text-align: center;
  padding: $spacing-md 0;
  border-radius: $radius-pill;
  font-size: $font-size-lg;
  font-weight: $font-semibold;
}
.submit-btn.disabled {
  opacity: 0.6;
}
.submit-tip {
  margin-top: $spacing-md;
  text-align: center;
  font-size: $font-size-sm;
  color: $text-tertiary;
}
</style>
