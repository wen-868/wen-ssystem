<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, showSuccessToast, closeToast, showToast } from 'vant'
import { updateUserProfile } from '../api'

const router = useRouter()

const realName = ref('')
const mobile = ref('')
const avatar = ref<{ file: File; url: string } | null>(null)

const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}

  if (!realName.value.trim()) {
    errors.value.realName = '请输入姓名'
  }

  if (mobile.value && !/^1\d{10}$/.test(mobile.value)) {
    errors.value.mobile = '请输入正确的手机号'
  }

  return Object.keys(errors.value).length === 0
}

async function handleSave() {
  if (!validate()) {
    showToast('请检查表单信息')
    return
  }

  showLoadingToast({ message: '保存中...', forbidClick: true })
  try {
    await updateUserProfile({
      realName: realName.value.trim(),
      mobile: mobile.value.trim() || undefined,
      avatar: avatar.value?.url
    })
    closeToast()
    showSuccessToast('保存成功')
    router.back()
  } catch (e: any) {
    closeToast()
    showToast(e?.response?.data?.message || '保存失败')
  }
}

function handleAvatarUpload(file: File) {
  const url = URL.createObjectURL(file)
  avatar.value = { file, url }
  return false
}

function handleAvatarClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
  }
  input.click()
}
</script>

<template>
  <section class="page">
    <van-nav-bar
      title="编辑资料"
      left-arrow
      @click-left="router.back"
    />

    <!-- 头像编辑区 -->
    <div class="avatar-edit-section" @click="handleAvatarClick">
      <div class="avatar-preview">
        <van-icon
          v-if="!avatar"
          name="manager-o"
          size="64"
          color="var(--color-primary)"
        />
        <img
          v-else
          :src="avatar.url"
          alt="头像"
          class="avatar-img"
        />
      </div>
      <span class="avatar-hint">点击更换头像</span>
    </div>

    <!-- 表单 -->
    <div class="form-section">
      <van-cell-group inset>
        <van-field
          v-model="realName"
          label="姓名"
          placeholder="请输入姓名"
          required
          :error="!!errors.realName"
          :error-message="errors.realName"
        />
        <van-field
          v-model="mobile"
          label="手机号"
          type="tel"
          placeholder="请输入手机号"
          required
          :error-message="errors.mobile"
        />
      </van-cell-group>
    </div>

    <!-- 保存按钮 -->
    <div class="submit-section">
      <van-button
        block
        type="primary"
        @click="handleSave"
      >
        保存
      </van-button>
    </div>
  </section>
</template>

<style scoped>
.avatar-edit-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0 20px;
  cursor: pointer;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--van-gray-2);
  margin-bottom: 8px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.form-section {
  margin: 0 0 24px;
}

.submit-section {
  padding: 0 16px;
}
</style>