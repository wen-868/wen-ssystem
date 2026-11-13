<template>
  <aside class="wb-subnav" :class="{ hidden: collapsed }" aria-label="二级导航" data-testid="second-nav">
    <div class="sn-brand">
      <button
        type="button"
        class="sn-collapse"
        data-testid="second-nav-collapse"
        :aria-label="collapsed ? '展开导航' : '收起导航'"
        :title="collapsed ? '展开导航' : '收起导航'"
        @click="$emit('collapse')"
      >
        <WorkbenchChromeToggleIcon :mirrored="collapsed" />
      </button>
      <div v-if="!collapsed" class="sn-mode-seg" role="group" aria-label="工作台/收银台切换" data-testid="mode-seg">
        <button
          type="button"
          class="sn-mode-seg-item"
          :class="{ on: !cashierActive }"
          data-mode-seg="desk"
          @click="$emit('go-desk')"
        >
          工作台
        </button>
        <button
          type="button"
          class="sn-mode-seg-item"
          :class="{ on: cashierActive }"
          data-mode-seg="pos"
          @click="$emit('go-pos')"
        >
          收银台
        </button>
      </div>
    </div>

    <!-- 折叠态：只留可点的一级模块缩略条（原型 .side 折叠后仍可见 56px） -->
    <div v-if="collapsed" class="sn-collapsed" data-testid="second-nav-collapsed-strip">
      <button
        v-for="row in stripModules"
        :key="row.code"
        type="button"
        class="sn-strip-item"
        :class="{ on: row.code === activeGroupCode }"
        :title="row.label"
        @click="$emit('pick-group', row.code)"
      >
        {{ row.short }}
      </button>
    </div>

    <template v-else>
      <!--
        ══ 常用功能区（原型 #subZone · L130）══
        原型 quick 态的列内次序是硬约束：
          常用功能卡（.qk-t + .sub-grid）→ 员工/对话栏（#alV21Sidehd）→ 目录（#sessList）
        因此这里只承载「标题 + 卡片网格」，不再兼作整列的滚动容器；
        滚动权交给 .sn-dir（目录），列高恒等于视口高（见 .wb-subnav / .sn-acct）。
      -->
      <div class="sn-subzone" data-testid="second-nav-sub-zone">
        <div class="sn-title" data-testid="second-nav-sub-title">{{ sectionTitle }}</div>

        <div class="sn-grid">
          <button
            v-for="entry in productionCards"
            :key="entry.routeName"
            type="button"
            class="sn-card"
            :class="{ active: isActive(entry) }"
            :data-subnav-route="entry.routeName"
            :title="entry.label"
            @click="emitEntry(entry)"
          >
            <el-icon class="sn-card-ic" :size="16"><component :is="cardIcon(entry.label)" /></el-icon>
            <span class="sn-card-tx">{{ entry.label }}</span>
          </button>
        </div>

        <p v-if="productionCards.length === 0 && (mode === 'quick' || realEntries.length === 0)" class="sn-empty">
          {{
            menuState === "loading"
              ? "正在读取导航…"
              : menuState === "error"
                ? "导航暂不可用"
                : mode === "quick"
                  ? "暂无常用功能，使用后会自动按频率排列"
                  : "当前角色暂无已接入入口"
          }}
        </p>
      </div>

      <!--
        ══ 已接线真实入口（manifest 派生的可用清单）══
        quick 态下它不属于原型列内结构（原型 quick 只有上面四段），会顶掉
        #subZone→#alV21Sidehd→#sessList 的实测坐标，所以这里只在 module / pos 渲染：
        模块态仍需「原型目录之外、本角色实际已接线的入口」可达，能力不因对齐原型结构而退化。
        区域与其 testid（second-nav-real-zone / second-nav-real-toggle）原样保留，未删除。
      -->
      <div v-if="mode !== 'quick' && realEntries.length > 0" class="sn-zone" data-testid="second-nav-real-zone">
        <div class="sn-grid sn-grid-real">
          <button
            v-for="entry in shownRealEntries"
            :key="entry.menuCode"
            type="button"
            class="sn-card sn-card-real"
            :class="{ active: isActive(entry) }"
            :data-subnav-route="entry.routeName"
            :title="entry.title"
            @click="$emit('open', entry)"
          >
            <el-icon class="sn-card-ic" :size="16"><component :is="cardIcon(entry.title)" /></el-icon>
            <span class="sn-card-tx">{{ entry.title }}</span>
          </button>
        </div>
        <button v-if="realEntries.length > 8" type="button" class="sn-more" data-testid="second-nav-real-toggle" @click="expanded = !expanded">
          {{ expanded ? "收起" : `展开全部 ${realEntries.length} 项` }}
        </button>
      </div>

      <!--
        ══ 员工 / 对话 横栏（原型 #alV21Sidehd · V36 重设计 L18304）══
        V36 把 .t「员工列表」改为 sr-only（节点在 DOM、读屏可达，视觉让位给分段控件），
        新对话按钮由全宽渐变条改成 32×32 描边图标钮并移到栏末位——本列同口径。
      -->
      <div class="sn-sidehd" data-testid="second-nav-tabs">
        <span class="sn-sidehd-t">员工列表</span>
        <div class="sn-seg" role="group" aria-label="员工/对话切换">
          <button
            v-for="tab in PROTOTYPE_SIDE_TABS"
            :key="tab"
            type="button"
            class="sn-seg-btn"
            :class="{ on: sideTab === tab }"
            :data-side-tab="tab"
            :aria-pressed="sideTab === tab ? 'true' : 'false'"
            :title="tab === '员工' ? '员工视图' : '对话视图'"
            @click="selectSideTab(tab)"
          >
            <el-icon class="sn-seg-ic" :size="13"><component :is="segIcon(tab)" /></el-icon><span>{{ tab }}</span>
          </button>
        </div>
        <button
          type="button"
          class="sn-tool"
          :class="{ on: searchOpen }"
          data-testid="second-nav-search-toggle"
          :aria-expanded="searchOpen ? 'true' : 'false'"
          :aria-label="searchOpen ? '收起搜索' : '搜索'"
          :title="searchOpen ? '收起搜索' : '搜索'"
          @click="toggleSearch"
        >
          <el-icon :size="14"><Search /></el-icon>
        </button>
        <button
          type="button"
          class="sn-newchat"
          data-testid="second-nav-new-chat"
          :aria-label="sideTab === '员工' ? '新增数字员工' : '新对话'"
          :title="sideTab === '员工' ? '新增数字员工' : '新对话'"
          @click="handlePlusAction"
        >
          <el-icon :size="16"><Plus /></el-icon>
          <span class="sn-sr">{{ sideTab === "员工" ? "新增数字员工" : "新对话" }}</span>
        </button>
      </div>

      <!-- 搜索框：原型 .al-v14-search 默认 display:none（V21 L10871），但节点与事件链保留，由上面的开关唤出 -->
      <input
        ref="searchInputEl"
        v-model="keyword"
        class="sn-search"
        :class="{ 'is-open': searchOpen }"
        type="search"
        :placeholder="sideTab === '员工' ? '搜索员工（姓名/岗位/部门）' : '搜索会话'"
        :aria-label="sideTab === '员工' ? '搜索员工' : '搜索会话'"
        data-testid="second-nav-search"
      />

      <!-- 目录区：本列唯一的滚动容器；无端点 ⇒ 明确 unavailable，不造数据 -->
      <div class="sn-dir" data-testid="second-nav-directory" :data-dir-state="directoryState">
        <!--
          生产口径下二级栏只渲染「已接线 ∧ 命中集合」的条目（S2 唯一口径投影），
          不存在 pending 项 ⇒ 原「接线度说明」（已接线 x/y · 其余 pending 文案）随之移除，
          生产 DOM 不出现黑名单占位词（S3 §三.6 / S5 COPY_BLACKLIST 口径）。
        -->
        <p v-if="directoryState === 'loading'" class="sn-empty">正在加载{{ dirNoun }}…</p>
        <p v-else-if="directoryState === 'unavailable'" class="sn-empty sn-unavailable">
          {{ directoryMessage }}
          <button type="button" class="sn-retry" data-testid="second-nav-dir-retry" @click="reloadDirectory">重试</button>
        </p>
        <p v-else-if="directoryState === 'error'" class="sn-empty sn-unavailable">
          {{ directoryMessage }}
          <button type="button" class="sn-retry" @click="reloadDirectory">重试</button>
        </p>
        <div v-else-if="visibleDirectory.length === 0" class="sn-empty">
          {{ keyword.trim() ? `没有匹配「${keyword.trim()}」的${dirNoun}` : `暂无${dirNoun}` }}
        </div>
        <div v-else class="sn-groups">
          <div v-for="g in visibleDirectory" :key="g.name" class="sn-group">
            <button type="button" class="sn-group-hd" :aria-expanded="!folded.has(g.name)" @click="toggleGroup(g.name)">
              <span class="sn-group-arr">{{ folded.has(g.name) ? "›" : "⌄" }}</span>
              <span>{{ g.name }}</span>
              <em>{{ g.staffs.length }}</em>
            </button>
            <div v-if="!folded.has(g.name)" class="sn-group-bd">
              <div
                v-for="s in g.staffs"
                :key="s.id"
                class="sn-staff"
                :class="{ clickable: Boolean(s.conversationId || s.employeeUid) }"
                :title="`${s.name} · ${s.post}`"
                :role="sideTab === '对话' || s.employeeUid ? 'button' : undefined"
                :tabindex="sideTab === '对话' || s.employeeUid ? 0 : undefined"
                @click="openDirectoryItem(s)"
                @keydown.enter.prevent="openDirectoryItem(s)"
              >
                <span class="sn-staff-av">{{ s.name.slice(0, 1) }}</span>
                <span class="sn-staff-mid">
                  <span class="sn-staff-nm">{{ s.name }}<i class="sn-staff-post">{{ s.post }}</i></span>
                  <span class="sn-staff-sub">{{ s.summary }}</span>
                </span>
                <span v-if="s.unread" class="sn-badge">{{ s.unread }}</span>
                <span v-if="s.online !== null" class="sn-dot" :class="{ off: !s.online }" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>

    <el-dialog
      v-model="employeeDialogOpen"
      title="新增数字员工"
      width="460px"
      append-to-body
      :close-on-click-modal="!employeeSaving"
    >
      <div class="sn-emp-form">
        <label>
          <span>姓名</span>
          <input v-model.trim="employeeForm.name" placeholder="例如：采购专员小周" />
        </label>
        <label>
          <span>岗位</span>
          <input v-model.trim="employeeForm.post" placeholder="例如：采购专员" />
        </label>
        <label>
          <span>部门</span>
          <input v-model.trim="employeeForm.department" placeholder="例如：采购部" />
        </label>
        <label>
          <span>职责说明</span>
          <textarea
            v-model.trim="employeeForm.personaPrompt"
            rows="3"
            placeholder="该员工负责什么、如何协同（可稍后在员工管理中完善）"
          />
        </label>
        <fieldset v-if="employeeOptions.length" class="sn-emp-team">
          <legend>可调度协同员工</legend>
          <label v-for="employee in employeeOptions" :key="employee.employeeUid">
            <input v-model="employeeForm.dispatchUids" type="checkbox" :value="employee.employeeUid" />
            <span>{{ employee.name }} · {{ employee.post }}</span>
          </label>
        </fieldset>
        <p v-if="employeeError" class="sn-emp-error" role="alert">{{ employeeError }}</p>
      </div>
      <template #footer>
        <button type="button" class="sn-emp-cancel" :disabled="employeeSaving" @click="employeeDialogOpen = false">
          取消
        </button>
        <button type="button" class="sn-emp-submit" :disabled="employeeSaving" @click="submitEmployee">
          {{ employeeSaving ? "创建中…" : "创建员工" }}
        </button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup lang="ts">
/**
 * 第二列上下文导航（WORKBENCH-10 · 原型 .side 列）
 *
 * 与 WORKBENCH-06 旧实现的**关键差别**（原型 §A-2/3/5 与 §动态交互 1/2）：
 * 1. 二级栏内容切换到 S2 合并版唯一口径（WORKBENCH-PROTOTYPE-12 门1 返工项）：
 *    渲染 `resolveEffectiveCapabilities` 产出的生产二级栏投影（snapshot.subnav，
 *    已接线 ∧ 服务端菜单 ∩ manifest ∩ 角色 命中集合）——原型目录中的未接线项
 *    **不渲染**（不是标 pending 徽标，生产 DOM 对 S5 文案黑名单零命中，S3 §三.6）；
 * 2. 「常用功能」是一个真实状态（= 未选中任何一级模块），由 rail 再次点击回归；
 * 3. 员工/对话横栏、部门分组展开收起、历史会话区按原型结构落地；
 *    **目录数据当前无端点**，按 §E-4 显示 unavailable + 重试，不伪造列表。
 * 4. 折叠态保留 56px 缩略条（原型实测），不再 display:none 整列消失。
 *
 * WORKBENCH-13-F2 视觉基线对齐（只做表现层，不加接口、不改可见性规则、不删能力）：
 * 列内坐标以原型融合版 1440×1000 实测为准 —— brand 54 → #subZone(y=66) →
 * #alV21Sidehd(y≈421.8) → #sessList(y≈459.8 · 唯一滚动区) → #acctZone(y=942 · 58px 贴底)，
 * 合计恰好 1000，列本身不滚动、页面不出现纵向滚动条。
 */
import { computed, nextTick, ref, watch, type Component } from "vue";
import { ElMessage } from "element-plus";
import {
  Bell,
  Box,
  CircleCheck,
  Clock,
  CollectionTag,
  Comment,
  CreditCard,
  DataAnalysis,
  Discount,
  Document,
  DocumentChecked,
  Download,
  EditPen,
  Goods,
  Grid,
  Histogram,
  Iphone,
  Memo,
  Money,
  OfficeBuilding,
  PriceTag,
  Printer,
  Plus,
  Promotion,
  RefreshLeft,
  Search,
  Setting,
  Sort,
  Star,
  Sunny,
  Tickets,
  Timer,
  TrendCharts,
  Upload,
  User,
  UserFilled,
  Van,
  Wallet,
  Warning,
} from "@element-plus/icons-vue";
import type { ManifestItem } from "../shared/workbench/route-manifest";
import type { MenuLoadState } from "../shared/workbench/menu-access";
import type { EffectiveCapabilitySnapshot } from "../shared/workbench/effective-capabilities";
import { PROTOTYPE_COMMON_LABEL, PROTOTYPE_RAIL_ITEMS, PROTOTYPE_SIDE_TABS } from "../shared/workbench/prototype-nav";
import {
  loadAgentDirectory,
  loadHistoryConversations,
  type AgentDirectory,
  type DirectoryGroup,
  type DirectoryStaff,
} from "../shared/workbench/agent-directory";
import { rankFrequentMenuItems, type MenuUsageMap } from "../shared/workbench/menu-usage";
import WorkbenchChromeToggleIcon from "../components/workbench/WorkbenchChromeToggleIcon.vue";
import { createAiEmployee } from "../api/ai";

const props = defineProps<{
  mode: "quick" | "module" | "pos";
  groups: { groupCode: string; title: string; items: ManifestItem[] }[];
  activeGroupCode: string;
  activePath: string;
  cashierItems: ManifestItem[];
  menuState: MenuLoadState;
  sessionActive: boolean;
  cashierActive: boolean;
  /** S2 唯一口径生产快照（Shell 以 resolveEffectiveCapabilities 统一解析后传入；subnav 投影 + routeNames 集合） */
  productionSnapshot: EffectiveCapabilitySnapshot;
  /** 当前账号的本机功能使用频率；无记录时不预置常用项 */
  menuUsage?: MenuUsageMap;
  collapsed?: boolean;
  /** 当前 AI 会话 ID；新对话一生成即由 Shell 传入，用于“对话”目录的当前会话行 */
  activeConversationId?: string;
  /** 每轮对话完成后递增，驱动历史归档刷新 */
  historyRevision?: number;
}>();

const emit = defineEmits<{
  (event: "open", entry: ManifestItem): void;
  (event: "openCashier", entry: ManifestItem): void;
  (event: "new-chat"): void;
  (event: "open-conversation", conversationId: string): void;
  (event: "open-employee", employee: {
    employeeUid: string;
    name: string;
    post: string;
    department?: string;
    collaborators: Array<{ employeeUid: string; name: string; post: string }>;
  }): void;
  (event: "collapse"): void;
  (event: "pick-group", groupCode: string): void;
  (event: "go-desk"): void;
  (event: "go-pos"): void;
}>();

// ── 一级模块 ↔ 原型 key ──
const activePrototypeKey = computed(() => {
  if (props.mode !== "module") return "desk";
  return PROTOTYPE_RAIL_ITEMS.find((item) => item.groupCode === props.activeGroupCode)?.key ?? "desk";
});

const activeGroup = computed(() => props.groups.find((g) => g.groupCode === props.activeGroupCode) ?? null);

/** 渲染卡片形状（label = manifest 标题，routeName 唯一键） */
interface ProductionCard {
  label: string;
  routeName: string;
  path: string | null;
}

/**
 * 生产二级栏卡片（S2 唯一口径，门1 返工）：
 *   - quick（常用功能）= 真实使用频率排序（filtered by 生产集合）
 *   - module = snapshot.subnav 的当前模块切片（S2 生产二级栏投影）；
 *   - pos = 收银走 cashierItems（本区不渲染）。
 */
const productionCards = computed<ProductionCard[]>(() => {
  if (props.mode === "pos") return [];
  if (props.mode === "module") {
    return props.productionSnapshot.subnav
      .filter((entry) => entry.moduleKey === activePrototypeKey.value)
      .map((entry) => ({ label: entry.label, routeName: entry.routeName, path: entry.path }));
  }
  const eligible = props.groups
    .flatMap((group) => group.items)
    .filter((item) => Boolean(item.routeName && props.productionSnapshot.routeNames.has(item.routeName)));
  return rankFrequentMenuItems(eligible, props.menuUsage ?? {}).map((item) => ({
    label: item.title,
    routeName: item.routeName as string,
    path: item.path ?? null,
  }));
});

const sectionTitle = computed(() => {
  if (props.mode === "pos") return "收银功能";
  if (props.mode === "module") return activeGroup.value?.title ?? "模块功能";
  return PROTOTYPE_COMMON_LABEL;
});

/** 已接线真实入口（保留原功能，不因原型结构上线而退化） */
const realEntries = computed<ManifestItem[]>(() => {
  if (props.mode === "pos") return props.cashierItems;
  if (props.mode === "module") return activeGroup.value?.items ?? [];
  return props.groups.flatMap((g) => g.items);
});
const expanded = ref(false);
const shownRealEntries = computed(() => (expanded.value ? realEntries.value : realEntries.value.slice(0, 8)));

// ── 折叠态缩略条 ──
const stripModules = computed(() =>
  props.groups.map((g) => ({ code: g.groupCode, label: g.title, short: g.title.slice(0, 2) })),
);

/**
 * 常用功能卡图标：原型 QUICK 每项带 16px 图标（融合版 L2268 起 · renderSubZone L2313），
 * 而 manifest 条目没有图标字段（见 shared/workbench/route-manifest 的 ManifestItem），
 * 故按**原型文案**建静态映射，取到不到就用通用网格图标兜底——不引入任何新业务数据。
 */
const CARD_ICONS: Record<string, Component> = {
  建销售单: Document,
  库存查询: Search,
  销售汇总: TrendCharts,
  今日晨报: Sunny,
  批量对账: Tickets,
  打印模板: Printer,
  工作台: Sunny,
  订单列表: Tickets,
  订单看板: DataAnalysis,
  订单售后: RefreshLeft,
  订单异常: Warning,
  销售开单: EditPen,
  销售单据: Document,
  销售退货: RefreshLeft,
  收款管理: Wallet,
  客户价格: PriceTag,
  提成规则: Money,
  销售报表: TrendCharts,
  商品列表: Goods,
  商品分类: CollectionTag,
  品牌管理: Star,
  价格管理: PriceTag,
  商品导入: Upload,
  套装与组合品: Box,
  商品审核: CircleCheck,
  库存盘点: Box,
  库存调拨: Sort,
  库存预警: Bell,
  批量调价: Money,
  客户列表: User,
  会员体系: UserFilled,
  储值卡: CreditCard,
  信用管理: Money,
  积分规则: Star,
  等级配置: Promotion,
  收付款管理: Wallet,
  应收应付: Money,
  客户对账: Tickets,
  财务对账: Tickets,
  利润核算: TrendCharts,
  资金报表: DataAnalysis,
  单据管理: Document,
  采购订单: Tickets,
  采购入库: Download,
  供应商管理: User,
  采购付款: Wallet,
  平台配置: Setting,
  接单工作台: EditPen,
  小程序订单: Tickets,
  商品货架: Goods,
  库存同步: RefreshLeft,
  配送管理: Van,
  平台管理: Setting,
  平台对账: Tickets,
  平台公告: Bell,
  零售看板: DataAnalysis,
  零售报表: TrendCharts,
  营销活动: Promotion,
  优惠券管理: Discount,
  限时折扣: Clock,
  秒杀活动: Timer,
  满减满赠: Discount,
  售后管理: RefreshLeft,
  销售统计: TrendCharts,
  销售分析: DataAnalysis,
  商品排行: Histogram,
  员工业绩: User,
  组织架构: OfficeBuilding,
  系统配置: Setting,
  审批管理: DocumentChecked,
  报表权限: Setting,
  支付配置: Wallet,
  小程序配置: Iphone,
  日志与反馈: Memo,
};
function cardIcon(label: string): Component {
  return CARD_ICONS[label] ?? Grid;
}

/** 分段控件图标 = 原型 IC_CREW / IC_CHAT（融合版 L15632） */
const SIDE_TAB_ICONS: Record<string, Component> = {
  员工: User,
  对话: Comment,
};
function segIcon(tab: string): Component {
  return SIDE_TAB_ICONS[tab] ?? Grid;
}

// ── 员工/对话切换 ──
type SideTab = (typeof PROTOTYPE_SIDE_TABS)[number];
const sideTab = ref<SideTab>("员工");
const keyword = ref("");
const folded = ref<Set<string>>(new Set());
const employeeDialogOpen = ref(false);
const employeeSaving = ref(false);
const employeeError = ref("");
const employeeForm = ref({
  name: "",
  post: "",
  department: "",
  personaPrompt: "",
  dispatchUids: [] as string[],
});
const employeeOptions = computed(() =>
  directory.value
    .flatMap((group) => group.staffs)
    .filter(
      (employee): employee is DirectoryStaff & { employeeUid: string } =>
        Boolean(employee.employeeUid),
    ),
);

function handlePlusAction(): void {
  if (sideTab.value === "员工") {
    employeeError.value = "";
    employeeDialogOpen.value = true;
    return;
  }
  emit("new-chat");
}

async function submitEmployee(): Promise<void> {
  employeeError.value = "";
  if (!employeeForm.value.name || !employeeForm.value.post || !employeeForm.value.department) {
    employeeError.value = "姓名、岗位、部门均为必填项";
    return;
  }
  employeeSaving.value = true;
  try {
    await createAiEmployee({
      name: employeeForm.value.name,
      post: employeeForm.value.post,
      department: employeeForm.value.department,
      ...(employeeForm.value.personaPrompt
        ? { personaPrompt: employeeForm.value.personaPrompt }
        : {}),
      ...(employeeForm.value.dispatchUids.length
        ? { dispatchUids: [...employeeForm.value.dispatchUids] }
        : {}),
    });
    employeeDialogOpen.value = false;
    employeeForm.value = {
      name: "",
      post: "",
      department: "",
      personaPrompt: "",
      dispatchUids: [],
    };
    sideTab.value = "员工";
    await reloadDirectory();
    ElMessage.success("数字员工已创建");
  } catch (err) {
    employeeError.value = err instanceof Error ? err.message : "创建数字员工失败";
  } finally {
    employeeSaving.value = false;
  }
}

function selectSideTab(tab: SideTab): void {
  sideTab.value = tab;
  void reloadDirectory();
}

/** 搜索框：默认隐藏（原型口径），由横栏的图标钮唤出并聚焦 */
const searchOpen = ref(false);
const searchInputEl = ref<HTMLInputElement | null>(null);
function toggleSearch(): void {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) void nextTick(() => searchInputEl.value?.focus());
}

const directory = ref<AgentDirectory["groups"]>([]);
const directoryState = ref<AgentDirectory["state"]>("loading");
const directoryMessage = ref("");
const dirNoun = computed(() => (sideTab.value === "员工" ? "数字员工" : "历史会话"));

/**
 * 目录的本地过滤：只在上限内已加载的分组/条目里做字符串匹配，
 * 不发新请求、不补任何服务端没有的条目；关键词为空时原样返回。
 */
/** “对话”目录：把当前刚创建的会话置顶；其余来自底座 session-archive。 */
const effectiveDirectory = computed<DirectoryGroup[]>(() => {
  if (sideTab.value !== "对话") return directory.value;
  const activeId = props.activeConversationId?.trim();
  if (!activeId) return directory.value;
  const exists = directory.value.some((g) =>
    g.staffs.some((s) => s.conversationId === activeId),
  );
  if (exists) return directory.value;
  const current: DirectoryStaff = {
    id: activeId,
    conversationId: activeId,
    name: "当前新对话",
    post: "当前会话",
    summary: "等待第一条消息，发送后自动归档",
    online: null,
    unread: null,
  };
  return [{ name: "当前会话", staffs: [current] }, ...directory.value];
});

const visibleDirectory = computed<DirectoryGroup[]>(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return effectiveDirectory.value;
  return effectiveDirectory.value
    .map((g) => ({
      ...g,
      staffs: g.staffs.filter((s) => `${g.name} ${s.name} ${s.post} ${s.summary}`.toLowerCase().includes(q)),
    }))
    .filter((g) => g.staffs.length > 0);
});

async function reloadDirectory(): Promise<void> {
  directoryState.value = "loading";
  const result = sideTab.value === "员工" ? await loadAgentDirectory() : await loadHistoryConversations();
  directory.value = result.groups;
  directoryState.value = result.state;
  directoryMessage.value = result.message;
}
void reloadDirectory();

watch(
  () => props.historyRevision,
  () => {
    if (sideTab.value === "对话") void reloadDirectory();
  },
);

watch(
  () => props.activeConversationId,
  () => {
    if (sideTab.value === "对话") keyword.value = "";
  },
);

function openDirectoryItem(staff: DirectoryStaff): void {
  if (sideTab.value === "对话" && staff.conversationId) {
    emit("open-conversation", staff.conversationId);
    return;
  }
  if (!staff.employeeUid) return;
  const allEmployees = directory.value.flatMap((g) => g.staffs);
  const collaborators = (staff.dispatchUids ?? [])
    .map((uid) => allEmployees.find((e) => e.employeeUid === uid))
    .filter((e): e is DirectoryStaff => Boolean(e))
    .map((e) => ({
      employeeUid: e.employeeUid as string,
      name: e.name,
      post: e.post,
    }));
  emit("open-employee", {
    employeeUid: staff.employeeUid,
    name: staff.name,
    post: staff.post,
    department: staff.summary,
    collaborators,
  });
}

function toggleGroup(name: string): void {
  const next = new Set(folded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  folded.value = next;
}

function isActive(entry: { path?: string | null } | null): boolean {
  if (!entry || !entry.path) return false;
  return props.activePath === entry.path || props.activePath.startsWith(`${entry.path}/`);
}

/** 生产条目 → manifest 条目（投影源自 manifest，按 routeName 回查；回查不到不发事件） */
function emitEntry(entry: { routeName: string }): void {
  const item = props.groups.flatMap((group) => group.items).find((candidate) => candidate.routeName === entry.routeName);
  if (!item) return;
  emit("open", item);
}

defineExpose({ keyword });
</script>

<style scoped>
/* ══ 列骨架（原型 aside.side：x=60 w=230 h=1000 · #F9FAFB · 右边线 #ECEEF1）══ */
.wb-subnav {
  --wb-ink2: #626f82;
  width: 100%;
  min-width: 0;
  /* 运行态取证实测：content-box + border-right 1px 会让侧栏实测 231/57，
     比原型 230/56 各偏 +1。改 border-box 后边框计入列宽，实测回到 230/56。 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--wb-chrome-bg, #f2f5f9);
  border-right: 0;
  overflow: hidden;
}
/* 折叠态不使用 display:none（会瞬隐并让入口彻底不可达），改为裁掉溢出后渲染缩略条 */
.wb-subnav.hidden {
  overflow: hidden;
}

/* ══ 品牌区（原型 .brand-side · V30 终值 L15207）══ */
.sn-brand {
  box-sizing: border-box;
  margin: 0;
  height: 62px;
  min-height: 62px;
  padding: 12px 8px;
  border: 0;
  border-bottom: 0;
  border-radius: 0;
  background: var(--wb-chrome-bg, #f2f5f9);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.sn-collapse {
  border: 0;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  cursor: pointer;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sn-collapse:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-mode-seg {
  flex: 0 1 164px;
  width: 164px;
  max-width: 164px;
  margin-inline: auto;
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--wb-line, #e5e5e5);
  border-radius: 999px;
  background: var(--wb-hover, #f4f6f8);
  box-sizing: border-box;
}
.sn-mode-seg-item {
  flex: 1;
  min-width: 0;
  padding: 6px 9px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.sn-mode-seg-item:hover {
  color: var(--wb-ink, #16181d);
}
.sn-mode-seg-item.on {
  background: var(--wb-panel, #fff);
  color: var(--wb-primary, #4f46e5);
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(10, 12, 16, 0.08);
}

/* ══ 折叠缩略条 ══ */
.sn-collapsed {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-strip-item {
  border: 0;
  background: transparent;
  border-radius: 6px;
  padding: 8px 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
}
.sn-strip-item:hover,
.sn-strip-item.on {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}

/* ══ 常用功能区（原型 #subZone · L130）：非滚动块，顶边 = brand 54 + margin 12 = y 66 ══ */
.sn-subzone {
  box-sizing: border-box;
  flex-shrink: 0;
  margin: 12px 14px 6px;
  padding: 0 4px 14px;
  border-bottom: 1px solid var(--wb-line-strong, #dde2e9);
}

/* 小标题（原型 .sub-zone .qk-t · L131，V37 起为 flex 行） */
.sn-title {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 15px;
  margin: 0 4px 9px;
  font-size: 11px;
  line-height: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--wb-ink2, #8a8f98);
}

/* 卡网格（原型 .sub-grid · L132：1fr 1fr · gap 7） */
.sn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
/* 功能卡（原型终层 .sub-card：37px 横向卡 · 16px 图标 + 8px gap + 左对齐文案） */
.sn-card {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 37px;
  min-height: 37px;
  max-height: 37px;
  padding: 0 10px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 9px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-card-ic {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  color: var(--wb-ink2, #8a8f98);
}
.sn-card-tx {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sn-card:hover:not(:disabled) {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
}
.sn-card:hover:not(:disabled) .sn-card-ic {
  color: var(--wb-primary, #2563eb);
}
.sn-card.active {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}

/* ══ 已接线入口区（模块/收银态）══ */
.sn-zone {
  box-sizing: border-box;
  flex-shrink: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 14px 6px;
  padding: 6px 4px 0;
}
.sn-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-row {
  text-align: left;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 12px;
  color: var(--wb-ink, #16181d);
  cursor: pointer;
}
.sn-row:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-row.active {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.sn-more {
  margin-top: 6px;
  border: 0;
  background: transparent;
  font-family: inherit;
  color: var(--wb-primary, #2563eb);
  font-size: 11px;
  cursor: pointer;
}

/* ══ 员工/对话横栏（原型 #alV21Sidehd · V36 L18304）：y≈421.8 · h=32 ══ */
.sn-sidehd {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 32px;
  margin: 10px 14px 6px;
}
/* 原型 V36 把 .t 改成 sr-only：节点留在 DOM（读屏/测试可达），视觉让位给分段控件 */
.sn-sidehd-t {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
/* 分段控件（原型 .v31-segbar L15552 + .v31-seg L15553：钮 53×26 · 栏 32） */
.sn-seg {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 2px;
  background: var(--wb-hover, #f4f6f8);
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
}
.sn-seg-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  padding: 5px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.sn-seg-btn:hover {
  color: var(--wb-ink, #16181d);
}
.sn-seg-btn.on {
  background: var(--wb-panel, #ffffff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.sn-seg-ic {
  color: inherit;
}
/* 栏内图标钮（搜索开关 · 尺寸沿用原型 .v31-taskbtn L15557 的 26×26 档） */
.sn-tool {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink2, #8a8f98);
  font-size: 0;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-tool:hover {
  color: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-hover, #f4f6f8);
}
.sn-tool.on {
  color: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
}
/* 新对话（原型 V36 .al-v21-sidehd .newchat：32×32 描边图标钮 · 栏末位） */
.sn-newchat {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 0;
  margin: 0;
  padding: 0;
  gap: 0;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--wb-line, #eceef1);
  /* 原型终层实测量值（1440×1000 真实渲染，2026-11-03 探针）：`#newChatBtn` = 32×32 / radius **10px** / 白底 #ECEEF1 描边。
     源码 L18307 的 `border-radius:8px` 是 V36 注入前的字面串，运行时被后续层改写为 10px——
     卡 §六 要求以原型真实渲染为真相源，故取 10px（并排读数一致才算对齐）。 */
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 0;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.sn-newchat:hover {
  background: var(--wb-hover, #f4f6f8);
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}

.sn-emp-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sn-emp-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--text-secondary, #4b5563);
  font-size: 12px;
}
.sn-emp-form input,
.sn-emp-form textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-normal, #d1d5db);
  border-radius: 7px;
  background: #fff;
  color: var(--text-primary, #111827);
  font: inherit;
}
.sn-emp-form textarea {
  resize: vertical;
}
.sn-emp-team {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 8px 10px 10px;
  border: 1px solid var(--border-normal, #d1d5db);
  border-radius: 7px;
}
.sn-emp-team legend {
  padding: 0 4px;
  color: var(--text-secondary, #4b5563);
  font-size: 12px;
}
.sn-emp-team label {
  flex-direction: row;
  align-items: center;
  gap: 7px;
}
.sn-emp-team input {
  width: auto;
}
.sn-emp-error {
  margin: 0;
  color: #b42318;
  font-size: 12px;
}
.sn-emp-cancel,
.sn-emp-submit {
  padding: 7px 14px;
  border: 1px solid var(--border-normal, #d1d5db);
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}
.sn-emp-submit {
  border-color: var(--wb-primary, #4f46e5);
  background: var(--wb-primary, #4f46e5);
  color: #fff;
}
.sn-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 搜索框（原型 .al-v14-search：V21 L10871 起 display:none，节点与事件链原样保留） */
.sn-search {
  box-sizing: border-box;
  display: none;
  flex-shrink: 0;
  width: auto;
  margin: 6px 14px 2px;
  padding: 8px 10px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.sn-search.is-open {
  display: block;
}
.sn-search:focus {
  border-color: var(--wb-primary, #2563eb);
}

/* ══ 目录（原型 #sessList）：本列唯一滚动容器 · y≈459.8 · 贴到 acct 上沿 942 ══ */
.sn-dir {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 6px 10px;
}
.sn-empty {
  margin: 8px 2px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.sn-unavailable {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.sn-retry {
  border: 1px solid var(--wb-line, #eceef1);
  background: var(--wb-panel, #fff);
  border-radius: 5px;
  padding: 1px 6px;
  font-family: inherit;
  font-size: 11px;
  color: var(--wb-primary, #2563eb);
  cursor: pointer;
}
.sn-groups {
  display: flex;
  flex-direction: column;
}
/* 分组头（原型 .al-v14-hd L9012：padding 10px 12px 6px · 11px · --sub） */
.sn-group-hd {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: 0;
  border-top: 1px solid var(--wb-line, #eceef1);
  background: transparent;
  padding: 10px 12px 6px;
  margin-top: 2px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
  text-align: left;
  user-select: none;
}
.sn-groups > .sn-group:first-child .sn-group-hd {
  border-top: 0;
  margin-top: 0;
}
.sn-group-arr {
  width: 10px;
  flex-shrink: 0;
}
.sn-group-hd em {
  font-style: normal;
  color: var(--wb-muted, #b0b6c0);
}
/* 员工行（原型 .al-v14-ct L9018 + .al-v14-av L9021：209×45 · radius 10 · padding 7px 10px） */
.sn-staff {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 45px;
  padding: 7px 10px;
  border-radius: 10px;
  cursor: pointer;
}
.sn-staff:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-staff.clickable:focus-visible {
  outline: 2px solid var(--wb-primary, #4f46e5);
  outline-offset: -2px;
}
.sn-staff-av {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-size: 15px;
  font-weight: 700;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sn-staff-mid {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.sn-staff-nm {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  line-height: 15px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
}
.sn-staff-post {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sn-staff-sub {
  font-size: 10.5px;
  line-height: 13px;
  margin-top: 1px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sn-badge {
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--wb-danger, #dc2626);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  flex-shrink: 0;
}
.sn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-success, #16a34a);
  flex-shrink: 0;
}
.sn-dot.off {
  background: var(--wb-muted, #b0b6c0);
}

</style>
