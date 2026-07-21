<template>
  <div class="page">
    <PageCard title="消息中心">
      <template #extra>
        <el-button type="primary" text @click="handleMarkAllRead">全部标为已读</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <el-row :gutter="16">
        <!-- 左侧类型筛选 -->
        <el-col :span="5">
          <el-menu
            :default-active="activeType"
            class="msg-menu"
            @select="handleTypeSelect"
          >
            <el-menu-item index="">
              <template #title>
                <span>全部消息</span>
                <el-badge :value="totalUnread" :hidden="totalUnread === 0" class="menu-badge" />
              </template>
            </el-menu-item>
            <el-menu-item
              v-for="item in typeMenus"
              :key="item.type"
              :index="item.type"
            >
              <template #title>
                <span>{{ item.label }}</span>
                <el-badge :value="item.unread" :hidden="item.unread === 0" class="menu-badge" />
              </template>
            </el-menu-item>
          </el-menu>
        </el-col>

        <!-- 右侧消息列表 -->
        <el-col :span="19">
          <div class="msg-list-panel">
            <!-- 骨架屏 -->
            <template v-if="loading">
              <el-skeleton :rows="5" animated style="padding: 16px" />
            </template>

            <!-- 消息列表 -->
            <template v-else-if="list.length > 0">
              <div
                v-for="msg in list"
                :key="msg.id"
                class="msg-item"
                :class="{ unread: !msg.isRead }"
                @click="handleClickMsg(msg)"
              >
                <div class="msg-icon">
                  <el-icon :size="20" :style="{ color: getMsgIconColor(msg.type) }">
                    <component :is="getMsgIcon(msg.type)" />
                  </el-icon>
                </div>
                <div class="msg-body">
                  <div class="msg-header">
                    <span class="msg-title" :class="{ bold: !msg.isRead }">{{ msg.title }}</span>
                    <span v-if="!msg.isRead" class="unread-dot"></span>
                  </div>
                  <div class="msg-summary">{{ msg.summary || msg.content }}</div>
                  <div class="msg-time">{{ formatDate(msg.createdAt) }}</div>
                </div>
                <div class="msg-actions">
                  <el-button
                    size="small"
                    type="danger"
                    link
                    @click.stop="handleDeleteMsg(msg)"
                  >删除</el-button>
                </div>
              </div>
            </template>

            <!-- 空状态 -->
            <el-empty v-else description="暂无消息" :image-size="80" />

            <!-- 分页 -->
            <div v-if="total > 0" class="pagination">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="total"
                :page-size="pageSize"
                :current-page="page"
                @size-change="(s: number) => { pageSize = s; search(); }"
                @current-change="(p: number) => { page = p; search(); }"
              />
            </div>
          </div>
        </el-col>
      </el-row>
    </PageCard>

    <!-- 消息详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      title="消息详情"
      size="480px"
    >
      <template v-if="detailMsg">
        <div class="detail-header">
          <el-tag :type="getMsgTagType(detailMsg.type)" size="small">{{ getMsgTypeLabel(detailMsg.type) }}</el-tag>
          <span class="detail-time">{{ formatDate(detailMsg.createdAt) }}</span>
        </div>
        <h3 class="detail-title">{{ detailMsg.title }}</h3>
        <div class="detail-content">{{ detailMsg.content || detailMsg.summary || '暂无内容' }}</div>
        <div v-if="detailMsg.extra" class="detail-extra">
          <div v-for="(val, key) in detailMsg.extra" :key="key" class="extra-item">
            <span class="extra-key">{{ key }}：</span>
            <span>{{ val }}</span>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Bell, Warning, Document, Money, ShoppingCart, CreditCard, CircleClose
} from "@element-plus/icons-vue";
import axios from "axios";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const activeType = ref("");
const totalUnread = ref(0);

const typeMenus = ref([
  { type: "SYSTEM", label: "系统消息", unread: 0 },
  { type: "ORDER", label: "订单消息", unread: 0 },
  { type: "PAYMENT", label: "支付消息", unread: 0 },
  { type: "ALERT", label: "预警消息", unread: 0 },
  { type: "CREDIT", label: "信用消息", unread: 0 },
  { type: "RECALL", label: "召回消息", unread: 0 }
]);

const typeLabelMap: Record<string, string> = {
  SYSTEM: "系统消息",
  ORDER: "订单消息",
  PAYMENT: "支付消息",
  ALERT: "预警消息",
  CREDIT: "信用消息",
  RECALL: "召回消息"
};

const typeIconMap: Record<string, any> = {
  SYSTEM: Bell,
  ORDER: Document,
  PAYMENT: Money,
  ALERT: Warning,
  CREDIT: CreditCard,
  RECALL: CircleClose
};

const typeIconColorMap: Record<string, string> = {
  SYSTEM: "#409EFF",
  ORDER: "#67C23A",
  PAYMENT: "#E6A23C",
  ALERT: "#F56C6C",
  CREDIT: "#722ED1",
  RECALL: "#909399"
};

function getMsgTypeLabel(type: string) { return typeLabelMap[type] || type; }
function getMsgIcon(type: string) { return typeIconMap[type] || Bell; }
function getMsgIconColor(type: string) { return typeIconColorMap[type] || "#909399"; }
function getMsgTagType(type: string) {
  if (type === "ALERT") return "danger";
  if (type === "PAYMENT") return "warning";
  if (type === "ORDER") return "success";
  if (type === "SYSTEM") return "";
  if (type === "CREDIT") return "";
  return "info";
}

async function loadUnreadCount() {
  try {
    const { data: res } = await axios.get("/api/admin/wb-notifications/unread-count");
    const data = res.data || res;
    totalUnread.value = typeof data === "object" ? (data.total || 0) : (data || 0);
  } catch { /* ignore */ }
}

async function loadTypeStats() {
  try {
    const { data: res } = await axios.get("/api/admin/wb-notifications/type-stats");
    const stats = res.data || res || {};
    typeMenus.value.forEach(menu => {
      menu.unread = stats[menu.type] || 0;
    });
  } catch { /* ignore */ }
}

async function search() {
  loading.value = true;
  try {
    const { data: res } = await axios.get("/api/admin/wb-notifications", {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        type: activeType.value || undefined,
        isRead: undefined
      }
    });
    const data = res.data || res;
    list.value = data.records || data.list || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadData() {
  await Promise.all([search(), loadUnreadCount(), loadTypeStats()]);
}

function handleTypeSelect(type: string) {
  activeType.value = type;
  page.value = 1;
  search();
}

async function handleClickMsg(msg: any) {
  if (!msg.isRead) {
    try {
      await axios.put(`/api/admin/wb-notifications/${msg.id}/read`);
      msg.isRead = true;
      await loadUnreadCount();
      await loadTypeStats();
    } catch { /* ignore */ }
  }
  detailMsg.value = msg;
  drawerVisible.value = true;
}

async function handleMarkAllRead() {
  try {
    await ElMessageBox.confirm("确认将所有消息标记为已读？", "提示", { type: "info" });
    await axios.post("/api/admin/wb-notifications/read-all");
    ElMessage.success("已全部标为已读");
    await loadData();
  } catch { /* cancelled */ }
}

async function handleDeleteMsg(msg: any) {
  try {
    await ElMessageBox.confirm("确认删除该消息？", "提示", { type: "warning" });
    await axios.delete(`/api/admin/wb-notifications/${msg.id}`);
    ElMessage.success("删除成功");
    await loadData();
  } catch { /* cancelled */ }
}

// 消息详情
const drawerVisible = ref(false);
const detailMsg = ref<any>(null);

onMounted(() => { loadData(); });
</script>

<style scoped>
.page { padding: 0; }

.msg-menu {
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.menu-badge {
  margin-left: auto;
  margin-right: 8px;
}

.msg-list-panel {
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  min-height: 400px;
}

.msg-item {
  display: flex;
  align-items: flex-start;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.2s;
  gap: 12px;
}
.msg-item:hover {
  background: var(--bg-soft);
}
.msg-item.unread {
  background: var(--color-primary-bg);
}

.msg-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-soft);
  border-radius: 50%;
  margin-top: 2px;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.msg-title {
  font-size: 14px;
  color: var(--text-primary);
}
.msg-title.bold {
  font-weight: 600;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409EFF;
  flex-shrink: 0;
}

.msg-summary {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-time {
  font-size: 12px;
  color: var(--text-muted);
}

.msg-actions {
  flex-shrink: 0;
  padding-top: 2px;
}

.pagination {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-time {
  font-size: 13px;
  color: var(--text-muted);
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

.detail-content {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.8;
  white-space: pre-wrap;
}

.detail-extra {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.extra-item {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.extra-key {
  color: var(--text-muted);
}
</style>