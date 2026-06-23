<template>
  <div class="layout">
    <aside class="side">
      <h1>智享营销系统</h1>
      <div class="nav-section">
        <div class="nav-title">工作台</div>
        <router-link to="/" class="nav-item" active-class="active">
          <span class="nav-icon">📊</span> 首页概览
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">商品库存</div>
        <router-link to="/products" class="nav-item" active-class="active">
          <span class="nav-icon">📦</span> 商品中心
        </router-link>
        <router-link to="/inventory" class="nav-item" active-class="active">
          <span class="nav-icon">📈</span> 库存管理
        </router-link>
        <router-link to="/inventory-alerts" class="nav-item" active-class="active">
          <span class="nav-icon">⚠️</span> 库存预警
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">采购管理</div>
        <router-link to="/suppliers" class="nav-item" active-class="active">
          <span class="nav-icon">🏭</span> 供应商管理
        </router-link>
        <router-link to="/purchase-orders" class="nav-item" active-class="active">
          <span class="nav-icon">📝</span> 采购订单
        </router-link>
        <router-link to="/purchase-in-stocks" class="nav-item" active-class="active">
          <span class="nav-icon">📥</span> 采购入库
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">销售管理</div>
        <router-link to="/orders" class="nav-item" active-class="active">
          <span class="nav-icon">🛒</span> 小程序订单
        </router-link>
        <router-link to="/sale-bills" class="nav-item" active-class="active">
          <span class="nav-icon">🧾</span> 销售单
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">客户往来</div>
        <router-link to="/customer-statements" class="nav-item" active-class="active">
          <span class="nav-icon">💼</span> 客户对账
        </router-link>
        <router-link to="/collection" class="nav-item" active-class="active">
          <span class="nav-icon">💰</span> 收款管理
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">报表系统</div>
        <router-link to="/reports" class="nav-item" active-class="active">
          <span class="nav-icon">📑</span> 统计报表
        </router-link>
      </div>
      <div class="nav-section">
        <div class="nav-title">系统设置</div>
        <router-link to="/system" class="nav-item" active-class="active">
          <span class="nav-icon">⚙️</span> 系统配置
        </router-link>
      </div>
    </aside>
    <main class="main">
      <header class="top-bar">
        <div class="breadcrumb">{{ currentPageTitle }}</div>
        <div class="user-info">
          <span v-if="token" class="welcome">欢迎，管理员</span>
          <el-button v-if="!token" size="small" type="primary" @click="loginDialogVisible = true">登录</el-button>
          <el-button v-else size="small" text @click="handleLogout">退出</el-button>
        </div>
      </header>
      <div class="content">
        <router-view />
      </div>
    </main>

    <el-dialog v-model="loginDialogVisible" title="管理员登录" width="400px">
      <el-form :model="loginForm" label-width="80px">
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="loginDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleLogin">登录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { adminLogin } from "./api";

const route = useRoute();
const token = ref(localStorage.getItem("admin_token") || "");
const loading = ref(false);
const loginDialogVisible = ref(false);
const loginForm = reactive({ username: "admin", password: "admin123" });

const pageTitles: Record<string, string> = {
  Dashboard: "首页概览",
  Products: "商品中心",
  Suppliers: "供应商管理",
  PurchaseOrders: "采购订单",
  PurchaseInStocks: "采购入库",
  Orders: "小程序订单",
  SaleBills: "销售单",
  CustomerStatements: "客户对账",
  Inventory: "库存管理",
  InventoryAlerts: "库存预警",
  Collection: "收款管理",
  Reports: "统计报表",
  System: "系统配置"
};

const currentPageTitle = computed(() => {
  const name = route.name as string;
  return pageTitles[name] || "首页";
});

async function handleLogin() {
  loading.value = true;
  try {
    const result = await adminLogin(loginForm.username, loginForm.password);
    localStorage.setItem("admin_token", result.token);
    token.value = result.token;
    loginDialogVisible.value = false;
    ElMessage.success("登录成功");
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "登录失败");
  } finally {
    loading.value = false;
  }
}

function handleLogout() {
  localStorage.removeItem("admin_token");
  token.value = "";
  ElMessage.success("已退出登录");
}

onMounted(() => {
  if (!token.value) {
    loginDialogVisible.value = true;
  }
});
</script>
