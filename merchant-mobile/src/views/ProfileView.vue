<script setup lang="ts">
function logout() {
  localStorage.removeItem('merchant_token')
  window.dispatchEvent(new Event('auth:logout'))
}
</script>

<template>
  <section class="page">
    <div class="card">
      <h2>商家用户</h2>
      <van-button block type="danger" plain @click="logout">退出登录</van-button>
    </div>
  </section>
</template>
