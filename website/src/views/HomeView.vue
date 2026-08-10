<template>
  <div class="page">
    <!-- Header -->
    <header class="header" :class="{ scrolled }" ref="headerRef">
      <div class="container">
        <a href="/" class="logo">
          <div class="logo-icon">智</div>
          智享全链
        </a>
        <nav class="nav" :class="{ open: menuOpen }">
          <a href="#features" @click="closeMenu">产品功能</a>
          <a href="#solutions" @click="closeMenu">解决方案</a>
          <a href="#about" @click="closeMenu">关于我们</a>
          <a href="#contact" @click="closeMenu">联系我们</a>
        </nav>
        <div class="nav-cta">
          <a href="https://admin.onepan.cn" target="_blank" class="btn btn-primary" style="padding:10px 20px;font-size:.9rem;">免费试用</a>
          <button class="menu-btn" @click="menuOpen = !menuOpen">☰</button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h1>让生意<span>更简单</span></h1>
          <p>智享全链管理系统，覆盖商品、采购、库存、销售、订单、客户、营销、财务全链路。多租户 SaaS 架构，一部手机管好生意。</p>
          <div class="hero-actions">
            <a href="https://admin.onepan.cn" target="_blank" class="btn btn-primary">免费试用</a>
            <a href="#features" class="btn btn-outline">了解更多</a>
          </div>
        </div>
        <div class="hero-visual">
          <img src="/hero-workbench.png" alt="智享全链管理系统工作台" />
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="section features">
      <div class="container">
        <h2 class="section-title">全链路数字化管理</h2>
        <p class="section-subtitle">从商品上架到财务结算，一站式覆盖企业经营管理全流程</p>
        <div class="features-grid">
          <div class="feature-card" v-for="f in features" :key="f.title">
            <div class="feature-icon" :style="{ background: f.bg, color: f.color }">{{ f.icon }}</div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Solutions -->
    <section id="solutions" class="section solutions">
      <div class="container">
        <h2 class="section-title">行业解决方案</h2>
        <p class="section-subtitle">深耕酒水零售行业，理解你的业务痛点</p>
        <div class="solutions-grid">
          <div class="solution-card" v-for="s in solutions" :key="s.title">
            <div class="solution-img" :style="{ background: s.bg }">{{ s.icon }}</div>
            <div class="solution-body">
              <h3>{{ s.title }}</h3>
              <p>{{ s.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section id="contact" class="section cta">
      <div class="container">
        <h2 class="section-title">准备好提升经营效率了吗？</h2>
        <p class="section-subtitle">立即注册，免费体验智享全链管理系统的强大功能</p>
        <a href="https://admin.onepan.cn" target="_blank" class="btn btn-white" style="font-size:1.1rem;padding:16px 40px;">免费注册试用 →</a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="logo" style="margin-bottom:16px;">
              <div class="logo-icon">智</div>
              智享全链管理系统
            </div>
            <p class="brand-company">深圳市宝安区智享全链软件工作室</p>
            <p>智享全链管理系统专注酒水行业数字化经营，提供覆盖商品、采购、库存、销售、财务、客户、营销、报表全链路的进销存管理与即时零售 SaaS 服务，帮助批零商家实现全流程数字化管理。</p>
          </div>
          <div class="footer-col">
            <h4>产品</h4>
            <a href="#features">产品功能</a>
            <a href="#solutions">解决方案</a>
            <a href="https://admin.onepan.cn" target="_blank">管理后台</a>
            <a href="https://m.onepan.cn" target="_blank">移动商家端</a>
          </div>
          <div class="footer-col">
            <h4>支持</h4>
            <a href="#contact">帮助中心</a>
            <a href="#contact">联系客服</a>
            <a href="#contact">意见反馈</a>
          </div>
          <div class="footer-col">
            <h4>关于</h4>
            <a href="/legal/用户协议.html" target="_blank">用户协议</a>
            <a href="/legal/隐私政策.html" target="_blank">隐私政策</a>
          </div>
          <div class="footer-col">
            <h4>联系方式</h4>
            <p class="footer-contact">联系电话：13410954557</p>
            <p class="footer-contact">电子邮箱：xbe868@126.com</p>
            <p class="footer-contact">办公地址：深圳市宝安区石岩街道三祝里社区三祝里村北区66号502</p>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; {{ year }} 智享全链管理系统 onepan.cn. All rights reserved.</p>
          <p>运营主体：深圳市宝安区智享全链软件工作室</p>
          <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="nofollow noopener">粤ICP备2026103101号-1</a></p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const year = new Date().getFullYear();
const menuOpen = ref(false);
const scrolled = ref(false);
const headerRef = ref<HTMLElement | null>(null);

function closeMenu() {
  menuOpen.value = false;
}

function handleScroll() {
  scrolled.value = window.scrollY > 10;
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});

const features = [
  { icon: "📦", title: "商品管理", desc: "多规格 SKU、品牌分类、单位管理，支持商品批量导入导出和价格等级设置", color: "#2563eb", bg: "#dbeafe" },
  { icon: "📋", title: "采购管理", desc: "采购订单、入库、退货全流程，供应商对账与采购计划智能生成", color: "#7c3aed", bg: "#ede9fe" },
  { icon: "🏪", title: "库存管理", desc: "实时库存查询、批次追踪、效期预警、盘点调拨，库存状态实时掌控", color: "#059669", bg: "#d1fae5" },
  { icon: "💰", title: "销售管理", desc: "销售单、退货单、收款记录，支持多种支付方式与客户对账", color: "#ea580c", bg: "#fff7ed" },
  { icon: "👥", title: "客户管理", desc: "客户档案、标签分组、授信额度、客户专属价，精细化客户运营", color: "#dc2626", bg: "#fee2e2" },
  { icon: "📊", title: "数据报表", desc: "销售报表、采购报表、库存报表、客户报表、财务报表，多维度数据分析", color: "#0891b2", bg: "#cffafe" },
  { icon: "📱", title: "即时零售", desc: "对接美团、饿了么等平台，自动接单、库存同步、订单处理一体化", color: "#d946ef", bg: "#fae8ff" },
  { icon: "🎯", title: "营销管理", desc: "优惠券、满减、团购、秒杀、积分商城等多种营销工具，助力销量增长", color: "#ca8a04", bg: "#fef9c3" },
  { icon: "💳", title: "财务管理", desc: "应收账款、应付账款、收支流水、对账核销，财务数据一目了然", color: "#4f46e5", bg: "#e0e7ff" },
];

const solutions = [
  { icon: "🍷", title: "酒水批发商", desc: "多品牌多规格管理，批次追踪与效期预警，客户授信与专属价，销售对账一键完成", bg: "linear-gradient(135deg, #fef3c7, #fde68a)" },
  { icon: "🏪", title: "连锁零售门店", desc: "多门店统一管理，库存实时同步，门店终端收银开单，总部统一采购调配", bg: "linear-gradient(135deg, #dbeafe, #bfdbfe)" },
  { icon: "📱", title: "社区团购 / 线上零售", desc: "微信小程序商城，即时零售平台对接，订单自动处理，库存实时同步", bg: "linear-gradient(135deg, #ede9fe, #ddd6fe)" },
];

</script>
