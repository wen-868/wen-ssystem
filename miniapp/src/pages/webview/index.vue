<template>
  <web-view :src="src" />
</template>

<script setup lang="ts">
import Taro from '@tarojs/taro'
import { ref } from 'vue'

// 通用 web-view 页：通过 ?url= 传入完整地址（需 encodeURIComponent）
const params = Taro.getCurrentInstance().router?.params
const src = ref(params?.url ? decodeURIComponent(params.url) : '')
</script>
