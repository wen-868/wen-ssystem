<template>
  <div class="page">
    <el-tabs v-model="activeTab" class="platform-tabs">
      <el-tab-pane label="京东秒送" name="jd">
        <PlatformPanel :platform="platforms.jd" />
      </el-tab-pane>
      <el-tab-pane label="美团外卖" name="meituan">
        <PlatformPanel :platform="platforms.meituan" />
      </el-tab-pane>
      <el-tab-pane label="饿了么" name="eleme">
        <PlatformPanel :platform="platforms.eleme" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import PlatformPanel from "./components/PlatformPanel.vue";

const activeTab = ref("jd");

const platforms = reactive({
  jd: {
    key: "jd",
    name: "京东秒送",
    icon: "🛒",
    color: "#E1251B",
    enabled: true,
    status: "connected",
    lastConnectTime: "2024-01-15 10:30:00",
    tokenExpireTime: "2025-01-15 10:30:00",
    appKey: "",
    appSecret: "",
    merchantId: "JD_MCH_001",
    storeId: "store_001",
    storeName: "旗舰店（总店）",
    advancedConfig: JSON.stringify(
      {
        deliveryType: "instant",
        timeout: 300,
        notifyUrl: "https://example.com/webhook/jd"
      },
      null,
      2
    ),
    webhookUrl: "https://api.example.com/webhook/instant/jd",
    signSecret: "",
    syncLogs: [
      { id: 1, type: "订单", time: "2024-01-15 10:25:00", status: "成功", count: 23 },
      { id: 2, type: "商品", time: "2024-01-15 10:20:00", status: "成功", count: 156 },
      { id: 3, type: "订单", time: "2024-01-15 09:25:00", status: "失败", count: 0, remark: "网络超时" }
    ]
  },
  meituan: {
    key: "meituan",
    name: "美团外卖",
    icon: "🍔",
    color: "#FFD101",
    enabled: true,
    status: "connected",
    lastConnectTime: "2024-01-15 10:28:00",
    tokenExpireTime: "2024-07-15 10:28:00",
    appKey: "",
    appSecret: "",
    merchantId: "MT_MCH_001",
    storeId: "store_002",
    storeName: "美团专属店",
    advancedConfig: JSON.stringify(
      {
        deliveryRadius: 3000,
        autoAccept: true,
        notifyUrl: "https://example.com/webhook/meituan"
      },
      null,
      2
    ),
    webhookUrl: "https://api.example.com/webhook/instant/meituan",
    signSecret: "",
    syncLogs: [
      { id: 1, type: "订单", time: "2024-01-15 10:26:00", status: "成功", count: 45 },
      { id: 2, type: "商品", time: "2024-01-15 10:22:00", status: "成功", count: 203 }
    ]
  },
  eleme: {
    key: "eleme",
    name: "饿了么",
    icon: "🥡",
    color: "#0097FF",
    enabled: false,
    status: "disconnected",
    lastConnectTime: "-",
    tokenExpireTime: "-",
    appKey: "",
    appSecret: "",
    merchantId: "",
    storeId: "",
    storeName: "",
    advancedConfig: JSON.stringify(
      {
        deliveryType: "standard",
        autoPrint: false
      },
      null,
      2
    ),
    webhookUrl: "https://api.example.com/webhook/instant/eleme",
    signSecret: "",
    syncLogs: []
  }
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.platform-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 0 20px;
}
</style>
