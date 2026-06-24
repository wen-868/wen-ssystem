<template>
  <div class="layout">
    <aside class="side">
      <h1>门店操作端</h1>
      <button
        v-for="item in nav"
        :key="item"
        class="nav-item"
        :class="{ active: item === activeNav }"
        type="button"
        @click="handleNavClick(item)"
      >
        {{ item }}
      </button>
    </aside>
    <main class="main">
      <section class="store-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ storeNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <el-tag
            v-if="storeStatus"
            :type="storeStatus==='OPEN'?'success':storeStatus==='SUSPENDED'?'warning':'info'"
            size="small"
            style="margin-right:8px"
          >
            {{storeStatus==='OPEN'?'营业中':storeStatus==='SUSPENDED'?'已暂停':'已关闭'}}
          </el-tag>
          <span>门店操作员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
      <div
        v-if="storeStatus && storeStatus !== 'OPEN'"
        style="margin:0 0 16px;padding:12px 16px;border-radius:8px;font-weight:600;text-align:center"
        :style="{background:storeStatus==='SUSPENDED'?'#FEF0E7':'#F5F7FA',color:storeStatus==='SUSPENDED'?'#E6A23C':'#909399'}"
      >
        {{storeStatus==='SUSPENDED'?'门店已暂停营业，暂停原因：'+(storeControlConfig?.suspendedReason||'未知'):'门店已关闭，暂不可接单'}}
      </div>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchStoreControlStatus } from "../api";

const route = useRoute();
const router = useRouter();

const nav = ["工作台", "快速收银", "销售单", "接单履约", "库存查询", "调拨", "盘点", "分享收款", "日结", "门店管控"];

const navToPathMap: Record<string, string> = {
  "工作台": "/dashboard",
  "快速收银": "/cashier",
  "销售单": "/sale-bills",
  "接单履约": "/order-fulfill",
  "库存查询": "/inventory",
  "调拨": "/transfer",
  "盘点": "/stock-check",
  "分享收款": "/collection",
  "日结": "/daily-settle",
  "门店管控": "/store-control"
};

const storeNavDescriptions: Record<string, string> = {
  工作台: "查看门店销售、订单和库存概览。",
  快速收银: "搜索商品和客户，创建销售单并线下收款。",
  销售单: "查看销售单、详情和分享收款。",
  接单履约: "处理小程序订单接单和完成。",
  库存查询: "查看库存、调整库存和库存流水。",
  调拨: "查看在途调拨单和已发货调拨单，进行收货确认。",
  盘点: "查看盘点单列表，录入实盘数量并提交。",
  分享收款: "查看分享收款、支付和退款记录。",
  日结: "选择日期范围进行日结对账，打印日结单。",
  门店管控: "查看门店当前状态、管控配置和状态变更日志。"
};

const activeNav = computed(() => {
  return (route.meta.nav as string) || "工作台";
});

const storeStatus = ref("");
const storeControlConfig = ref<any>(null);

async function loadStoreControlStatus() {
  try {
    const data = await fetchStoreControlStatus();
    storeStatus.value = data?.status || "OPEN";
    storeControlConfig.value = data?.config || null;
  } catch { /* silent */ }
}

function handleNavClick(item: string) {
  const path = navToPathMap[item];
  if (path) {
    router.push(path);
  }
}

async function handleLogout() {
  const confirmed = await ElMessageBox.confirm("确认退出当前登录?", "确认退出", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  localStorage.removeItem("store_token");
  localStorage.removeItem("admin_token");
  window.dispatchEvent(new Event("auth:logout"));
  ElMessage.success("已退出登录");
  router.push("/login");
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("auth:logout", () => {
      ElMessage.warning("登录已过期，请重新登录");
      router.push("/login");
    });
  }
  loadStoreControlStatus();
});
</script>
