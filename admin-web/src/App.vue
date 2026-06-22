<template>
  <div v-if="!token" class="admin-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>智享营销系统管理后台</h1>
          <p class="muted">请先登录，登录后进入正式后台工作台。</p>
        </div>
      </template>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入后台</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side" :class="{ 'is-collapsed': isMenuCollapsed && !isCashierMode, 'is-hidden': isCashierMode }">
      <div class="sidebar-header">
        <h1 v-show="!isMenuCollapsed">智享营销系统</h1>
        <h1 v-show="isMenuCollapsed">智享</h1>
        <el-button
          class="collapse-btn"
          :icon="isMenuCollapsed ? 'Expand' : 'Fold'"
          @click="isMenuCollapsed = !isMenuCollapsed"
          size="small"
        />
      </div>
      <el-menu
        :default-active="activeNav"
        :collapse="isMenuCollapsed"
        :collapse-transition="false"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <el-menu-item index="首页">
          <el-icon><HomeFilled /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>

        <el-sub-menu index="商品管理">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品管理</span>
          </template>
          <el-menu-item index="商品">商品列表</el-menu-item>
          <el-menu-item index="价格中心">价格中心</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="订单管理">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>订单管理</span>
          </template>
          <el-menu-item index="订单">订单列表</el-menu-item>
          <el-menu-item index="订单超时">超时处理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="销售管理">
          <template #title>
            <el-icon><ShoppingCart /></el-icon>
            <span>销售管理</span>
          </template>
          <el-menu-item index="销售单">销售单</el-menu-item>
          <el-menu-item index="销售退货">销售退货</el-menu-item>
          <el-menu-item index="收款">收款记录</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="采购管理">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>采购管理</span>
          </template>
          <el-menu-item index="采购">采购管理</el-menu-item>
          <el-menu-item index="供应商">供应商</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="客户管理">
          <template #title>
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </template>
          <el-menu-item index="客户">客户列表</el-menu-item>
          <el-menu-item index="客户对账">客户对账</el-menu-item>
          <el-menu-item index="授信管理">授信管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="库存管理">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>库存管理</span>
          </template>
          <el-menu-item index="库存">库存总览</el-menu-item>
          <el-menu-item index="预警中心">预警中心</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="门店管理">
          <template #title>
            <el-icon><OfficeBuilding /></el-icon>
            <span>门店管理</span>
          </template>
          <el-menu-item index="门店">门店列表</el-menu-item>
          <el-menu-item index="员工">员工管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="营销中心">
          <template #title>
            <el-icon><Present /></el-icon>
            <span>营销中心</span>
          </template>
          <el-menu-item index="营销中心">营销活动</el-menu-item>
          <el-menu-item index="售后管理">售后管理</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="报表">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>报表中心</template>
        </el-menu-item>

        <el-sub-menu index="系统管理">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="操作日志">操作日志</el-menu-item>
          <el-menu-item index="系统设置">系统设置</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="消息中心">
          <el-icon><Bell /></el-icon>
          <template #title>消息中心</template>
        </el-menu-item>
      </el-menu>
    </aside>
    <main class="main" v-loading="pageLoading">
      <!-- 收银台模式 -->
      <div v-if="isCashierMode" class="cashier-container">
        <!-- 左侧：商品搜索 -->
        <div class="cashier-left">
          <div class="cashier-search">
            <el-input
              v-model="cashierProductKeyword"
              placeholder="搜索商品名称/SKU"
              clearable
              @input="searchCashierProducts"
            />
          </div>
          <div class="cashier-product-list">
            <div
              v-for="product in cashierProducts"
              :key="product.skuId"
              class="cashier-product-item"
              @click="addToCart(product)"
            >
              <div class="product-name">{{ product.name }}</div>
              <div class="product-sku">{{ product.skuName }}</div>
              <div class="product-price">¥{{ formatYuan(product.retailPrice) }}</div>
            </div>
          </div>
        </div>

        <!-- 中间：购物车 -->
        <div class="cashier-center">
          <div class="cart-header">
            <h3>购物车</h3>
            <el-button size="small" type="danger" @click="clearCart" :disabled="cashierCart.length === 0">清空</el-button>
          </div>
          <div class="cart-list">
            <div v-if="cashierCart.length === 0" class="cart-empty">购物车为空</div>
            <div v-for="(item, index) in cashierCart" :key="index" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ item.name }}</div>
                <div class="cart-item-sku">{{ item.skuName }}</div>
              </div>
              <div class="cart-item-quantity">
                <el-input-number
                  v-model="item.quantity"
                  :min="1"
                  :max="999"
                  size="small"
                  @change="updateCartTotal"
                />
              </div>
              <div class="cart-item-price">¥{{ formatYuan(item.retailPrice * item.quantity) }}</div>
              <el-button size="small" type="danger" link @click="removeFromCart(index)">删除</el-button>
            </div>
          </div>
        </div>

        <!-- 右侧：结算区 -->
        <div class="cashier-right">
          <div class="settlement-section">
            <h3>结算</h3>

            <!-- 客户选择 -->
            <div class="settlement-item">
              <label>客户：</label>
              <el-select
                v-model="cashierSelectedCustomer"
                placeholder="选择客户（可选）"
                clearable
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="member in members"
                  :key="member.id"
                  :label="member.name"
                  :value="member"
                />
              </el-select>
            </div>

            <!-- 金额汇总 -->
            <div class="settlement-summary">
              <div class="summary-row">
                <span>商品总额：</span>
                <span>¥{{ formatYuan(cashierSubtotal) }}</span>
              </div>
              <div class="summary-row">
                <label>折扣：</label>
                <el-input-number
                  v-model="cashierDiscount"
                  :min="0"
                  :max="cashierSubtotal"
                  :precision="2"
                  size="small"
                  style="width: 100px"
                  @change="updateCartTotal"
                />
              </div>
              <div class="summary-row">
                <label>抹零：</label>
                <el-input-number
                  v-model="cashierRoundDown"
                  :min="0"
                  :max="10"
                  :precision="2"
                  size="small"
                  style="width: 100px"
                  @change="updateCartTotal"
                />
              </div>
              <div class="summary-row total">
                <span>应收金额：</span>
                <span class="total-amount">¥{{ formatYuan(cashierTotal) }}</span>
              </div>
            </div>

            <!-- 支付方式 -->
            <div class="settlement-item">
              <label>支付方式：</label>
              <el-radio-group v-model="cashierPaymentMethod">
                <el-radio label="CASH">现金</el-radio>
                <el-radio label="WECHAT">微信</el-radio>
                <el-radio label="ALIPAY">支付宝</el-radio>
              </el-radio-group>
            </div>

            <!-- 收款金额（现金时显示） -->
            <div v-if="cashierPaymentMethod === 'CASH'" class="settlement-item">
              <label>收款金额：</label>
              <el-input-number
                v-model="cashierReceivedAmount"
                :min="cashierTotal"
                :precision="2"
                style="width: 100%"
              />
              <div class="change-amount">
                找零：¥{{ formatYuan(cashierChange) }}
              </div>
            </div>

            <!-- 提交按钮 -->
            <el-button
              type="primary"
              size="large"
              style="width: 100%; margin-top: 20px"
              :disabled="cashierCart.length === 0"
              @click="submitSale"
            >
              提交订单
            </el-button>
          </div>
        </div>
      </div>

      <!-- 管理后台模式 -->
      <template v-else>
      <section class="dashboard-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ adminNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <el-switch
            v-model="isCashierMode"
            active-text="收银台"
            inactive-text="管理后台"
            style="margin-right: 16px;"
          />
          <el-popover placement="bottom-end" :width="360" trigger="click" @show="loadRecentNotifications">
            <template #reference>
              <el-badge :value="notificationUnreadCount || undefined" :hidden="!notificationUnreadCount" :max="99">
                <el-button size="small" circle><span style="font-size:16px">&#x1F514;</span></el-button>
              </el-badge>
            </template>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-weight:600;font-size:14px">通知消息</span>
              <el-button size="small" link type="primary" @click="activeNav='消息中心'">查看全部</el-button>
            </div>
            <div v-if="recentNotifications.length===0" style="text-align:center;padding:20px;color:#999;font-size:13px">暂无通知</div>
            <div v-for="n in recentNotifications" :key="n.id" style="padding:8px 0;border-bottom:1px solid #f0f0f0;cursor:pointer" @click="handleNotificationClick(n)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span :style="{fontWeight:n.isRead?400:600,fontSize:'13px',color:n.isRead?'#666':'#1F2328'}">{{ n.title }}</span>
                <span style="font-size:11px;color:#999">{{ n.sentAt?.slice(5,16) }}</span>
              </div>
              <div style="font-size:12px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ n.content }}</div>
            </div>
          </el-popover>
          <span>系统管理员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
      <section v-if='activeNav === "首页"'>
        <!-- 核心指标卡片 -->
        <div class="dashboard-cards">
          <div class="dash-card" v-for="card in dashCards" :key="card.label">
            <div class="dash-card-header">
              <span class="dash-card-label">{{ card.label }}</span>
              <span class="dash-card-change" :class="card.changeType">{{ card.changeText }}</span>
            </div>
            <div class="dash-card-value">{{ card.value }}</div>
            <div class="dash-card-desc">{{ card.desc }}</div>
          </div>
        </div>
        <!-- 图表行 -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-top:20px">
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">销售趋势（近12个月）</h4>
            <div ref="dashSalesTrendChart" style="width:100%;height:280px"></div>
          </div>
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">品类销售占比</h4>
            <div ref="dashCategoryPieChart" style="width:100%;height:280px"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">热销商品 TOP10</h4>
            <div ref="dashHotProductChart" style="width:100%;height:280px"></div>
          </div>
          <div class="table-card" style="padding:20px">
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">客户贡献 TOP10</h4>
            <div ref="dashCustomerTopChart" style="width:100%;height:280px"></div>
          </div>
        </div>
        <!-- 最近预警 -->
        <div class="table-card" style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 16px 0">
            <h4 style="margin:0;font-size:14px;color:var(--text-secondary)">最近预警</h4>
            <el-button size="small" link type="primary" @click="activeNav='预警中心'">查看全部</el-button>
          </div>
          <el-table :data="dashAlerts" size="small" empty-text="暂无预警" style="margin-top:8px">
            <el-table-column prop="type" label="类型" width="100"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
            <el-table-column prop="content" label="预警内容" />
            <el-table-column prop="level" label="级别" width="80"><template #default="{row}"><span class="status-tag" :class="row.level==='HIGH'?'danger':row.level==='MEDIUM'?'warning':'info'">{{ row.level==='HIGH'?'高':row.level==='MEDIUM'?'中':'低' }}</span></template></el-table-column>
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
        </div>
      </section>
      <el-card v-if='activeNav === "商品"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>商品列表</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input v-model="productsKeyword" placeholder="商品名/SKU" size="small" style="width: 180px" clearable @clear="searchProducts" @keyup.enter="searchProducts" />
              <el-button size="small" @click="searchProducts">搜索</el-button>
              <el-button size="small" @click="loadProducts">刷新商品</el-button>
              <el-button size="small" type="primary" @click="productDialogVisible = true">新增商品</el-button>
              <el-button size="small" type="success" @click="handleExportProducts"><el-icon><Download /></el-icon> 导出</el-button>
            </div>
          </div>
        </template>
        <el-table :data="products">
          <el-table-column label="图片" width="82">
            <template #default="{ row }">
              <el-image
                v-if="row.mainImage"
                :src="row.mainImage"
                fit="cover"
                style="width: 44px; height: 44px; border-radius: 6px; background: #f5f5f5"
                :preview-src-list="[row.mainImage]"
                preview-teleported
              />
              <span v-else class="muted">无</span>
            </template>
          </el-table-column>
          <el-table-column prop="skuCode" label="SKU编码" width="180" />
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="skuName" label="规格" />
          <el-table-column label="零售价" width="100">
            <template #default="{ row }">{{ formatYuan(row.retailPrice) }}</template>
          </el-table-column>
          <el-table-column label="批发价" width="100">
            <template #default="{ row }">{{ formatYuan(row.wholesalePrice) }}</template>
          </el-table-column>
          <el-table-column label="门店价" width="100">
            <template #default="{ row }">{{ row.storePrice != null ? formatYuan(row.storePrice) : '-' }}</template>
          </el-table-column>
          <el-table-column label="小程序价" width="100">
            <template #default="{ row }">{{ row.miniappPrice != null ? formatYuan(row.miniappPrice) : '-' }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="120"><template #default="{ row }">{{ mapProductStatus(row.status) }}</template></el-table-column>
          <el-table-column label="操作" width="280">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openProductEditDialog(row)">编辑</el-button>
              <el-button size="small" link type="success" :disabled="row.status === 'ON_SALE'" @click="handleProductStatus(row, 'ON_SALE')">上架</el-button>
              <el-button size="small" link type="warning" :disabled="row.status === 'OFF_SALE'" @click="handleProductStatus(row, 'OFF_SALE')">下架</el-button>
              <el-button size="small" link type="primary" @click="openPriceDialog(row)">改价</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px; border-left: 4px solid #e6a23c">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="color: #e6a23c; font-weight: bold">⚠ 库存预警（可用库存 ≤ 5）</span>
            <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
          </div>
        </template>
        <template v-if="inventoryAlerts.length > 0">
          <el-table :data="inventoryAlerts" size="small">
          <el-table-column prop="storeName" label="门店" width="140" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="availableQty" label="可用库存" width="100">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
            </template>
          </el-table-column>
        </el-table>
        </template>
        <div v-else style="padding:20px;text-align:center;color:#10B981;font-size:14px">库存状态良好，暂无预警</div>
      </el-card>
      <el-card v-if='activeNav === "门店"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>门店管理</span>
            <div>
              <el-button size="small" @click="loadStores">刷新门店</el-button>
              <el-button size="small" type="primary" @click="storeDialogVisible = true">新增门店</el-button>
            </div>
          </div>
        </template>
        <el-table :data="stores">
          <el-table-column prop="storeCode" label="门店编码" width="160" />
          <el-table-column prop="name" label="门店名称" />
          <el-table-column prop="address" label="地址" />
          <el-table-column prop="phone" label="联系电话" width="160" />
          <el-table-column prop="businessStatus" label="营业状态" width="120"><template #default="{ row }">{{ mapStoreBusinessStatus(row.businessStatus) }}</template></el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openStoreEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 门店管控 -->
      <el-card v-if='activeNav === "门店"' style="margin-top: 20px; border-left: 4px solid #1677FF">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="color: #1677FF; font-weight: bold">门店管控</span>
            <el-button size="small" @click="loadStoreControlConfigs">刷新</el-button>
          </div>
        </template>
        <el-table :data="storeControlConfigs" empty-text="暂无管控配置">
          <el-table-column prop="storeName" label="门店名称" width="140" />
          <el-table-column prop="storeStatus" label="当前状态" width="100">
            <template #default="{row}">
              <el-tag :type="row.storeStatus==='OPEN'?'success':row.storeStatus==='SUSPENDED'?'warning':'info'" size="small">{{row.storeStatus==='OPEN'?'营业中':row.storeStatus==='SUSPENDED'?'已暂停':'已关闭'}}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="自动开门" width="100"><template #default="{row}">{{row.autoOpenTime||'-'}}</template></el-table-column>
          <el-table-column label="自动关门" width="100"><template #default="{row}">{{row.autoCloseTime||'-'}}</template></el-table-column>
          <el-table-column label="日订单上限" width="100"><template #default="{row}">{{row.maxDailyOrders||'-'}}</template></el-table-column>
          <el-table-column label="日金额上限" width="120"><template #default="{row}">{{row.maxOrderAmount||'-'}}</template></el-table-column>
          <el-table-column label="操作" width="280">
            <template #default="{row}">
              <el-button size="small" link type="success" @click="handleStoreOpen(row)">开门</el-button>
              <el-button size="small" link type="info" @click="handleStoreClose(row)">关门</el-button>
              <el-button size="small" link type="warning" @click="handleStoreSuspend(row)">暂停</el-button>
              <el-button size="small" link type="primary" @click="handleStoreResume(row)">恢复</el-button>
              <el-button size="small" link @click="openStoreControlEdit(row)">配置</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 门店状态变更日志 -->
      <el-card v-if='activeNav === "门店"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>状态变更日志</span>
            <el-button size="small" @click="loadStoreControlLogs">刷新</el-button>
          </div>
        </template>
        <el-table :data="storeControlLogs" size="small" empty-text="暂无日志">
          <el-table-column prop="storeName" label="门店" width="140" />
          <el-table-column prop="fromStatus" label="变更前" width="90" />
          <el-table-column prop="toStatus" label="变更后" width="90" />
          <el-table-column prop="changeType" label="类型" width="90">
            <template #default="{row}"><el-tag size="small" :type="row.changeType==='MANUAL'?'':row.changeType==='SCHEDULED'?'warning':'danger'">{{row.changeType==='MANUAL'?'手动':row.changeType==='SCHEDULED'?'定时':'自动'}}</el-tag></template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" />
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <!-- 客户管理（深度页面） -->
      <template v-if="activeNav === '客户'">
        <div v-if="!customerDetailVisible">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ customerStats.total }}</div><div class="stat-label">客户总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.newThisMonth }}</div><div class="stat-label">本月新增</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.active }}</div><div class="stat-label">活跃客户</div></div>
            <div class="stat-item"><div class="stat-value">{{ customerStats.owing }}</div><div class="stat-label">欠款客户</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(customerStats.totalReceivable) }}</div><div class="stat-label">总应收</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="membersKeyword" placeholder="客户名/手机号" style="width:180px" clearable @clear="searchMembers" @keyup.enter="searchMembers" />
            <el-select v-model="memberFilterType" placeholder="客户类型" style="width:130px" clearable @change="searchMembers"><el-option label="零售客户" value="RETAIL" /><el-option label="批发客户" value="WHOLESALE" /></el-select>
            <el-select v-model="memberFilterLevel" placeholder="客户等级" style="width:130px" clearable @change="searchMembers"><el-option label="普通" value="NORMAL" /><el-option label="银卡" value="SILVER" /><el-option label="金卡" value="GOLD" /><el-option label="钻石" value="DIAMOND" /></el-select>
            <el-select v-model="memberFilterArea" placeholder="区域" style="width:130px" clearable @change="searchMembers"><el-option label="东区" value="EAST" /><el-option label="西区" value="WEST" /><el-option label="南区" value="SOUTH" /><el-option label="北区" value="NORTH" /></el-select>
            <el-select v-model="memberFilterOwing" placeholder="欠款状态" style="width:130px" clearable @change="searchMembers"><el-option label="有欠款" value="YES" /><el-option label="无欠款" value="NO" /></el-select>
            <el-button @click="searchMembers">搜索</el-button><el-button @click="loadMembers">刷新</el-button><el-button type="primary" @click="memberDialogVisible=true">新增客户</el-button><el-button type="success" @click="handleExportCustomers"><el-icon><Download /></el-icon> 导出</el-button>
          </div>
          <div class="table-card">
            <el-table :data="members" empty-text="暂无客户">
              <el-table-column prop="memberId" label="客户ID" width="90" /><el-table-column prop="name" label="客户名称" /><el-table-column prop="mobile" label="手机号" width="140" /><el-table-column prop="customerType" label="客户类型" width="120"><template #default="{row}">{{ mapCustomerType(row.customerType) }}</template></el-table-column>
              <el-table-column label="客户等级" width="100"><template #default="{row}"><span class="status-tag" :class="getLevelClass(row.level)">{{ getLevelText(row.level) }}</span></template></el-table-column>
              <el-table-column prop="staffName" label="归属销售员" width="140" />
              <el-table-column label="欠款" width="110"><template #default="{row}"><span :style="{color: Number(row.owingAmount)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.owingAmount||0) }}</span></template></el-table-column>
              <el-table-column label="操作" width="280"><template #default="{row}"><el-button size="small" link type="primary" @click="openCustomerDetail(row)">详情</el-button><el-button size="small" link type="success" @click="handleQuickAction(row,'开单')">开单</el-button><el-button size="small" link type="warning" @click="handleQuickAction(row,'收款')">收款</el-button><el-button size="small" link @click="handleQuickAction(row,'拜访')">拜访</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="memberPage" :page-size="memberPageSize" :total="memberTotal" layout="total, prev, pager, next" @current-change="loadMembers" />
            </div>
          </div>
        </div>
        <div v-if="customerDetailVisible">
          <div style="margin-bottom:16px"><el-button @click="customerDetailVisible=false">返回客户列表</el-button></div>
          <div class="detail-header">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h3>{{ currentCustomer.name }} - 客户详情</h3>
                <el-descriptions :column="4" size="small" style="margin-top:12px">
                  <el-descriptions-item label="客户ID">{{ currentCustomer.memberId }}</el-descriptions-item><el-descriptions-item label="手机号">{{ currentCustomer.mobile }}</el-descriptions-item><el-descriptions-item label="客户类型">{{ mapCustomerType(currentCustomer.customerType) }}</el-descriptions-item><el-descriptions-item label="等级"><span class="status-tag" :class="getLevelClass(currentCustomer.level)">{{ getLevelText(currentCustomer.level) }}</span></el-descriptions-item>
                  <el-descriptions-item label="归属销售员">{{ currentCustomer.staffName||'-' }}</el-descriptions-item><el-descriptions-item label="区域">{{ currentCustomer.area||'-' }}</el-descriptions-item><el-descriptions-item label="累计消费">{{ formatYuan(currentCustomer.totalPurchase||0) }}</el-descriptions-item><el-descriptions-item label="当前欠款"><span :style="{color:Number(currentCustomer.owingAmount||0)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(currentCustomer.owingAmount||0) }}</span></el-descriptions-item>
                </el-descriptions>
              </div>
              <div class="quick-actions"><el-button type="primary" size="small" @click="handleQuickAction(currentCustomer,'开单')">开单</el-button><el-button size="small" @click="handleQuickAction(currentCustomer,'收款')">收款</el-button><el-button size="small" @click="handleQuickAction(currentCustomer,'拜访')">拜访</el-button><el-button size="small" @click="handleAssignMember(currentCustomer)">分配销售员</el-button></div>
            </div>
          </div>
          <div class="detail-tabs">
            <el-tabs v-model="customerDetailTab">
              <el-tab-pane label="销售订单" name="orders"><el-table :data="customerSaleBills" empty-text="暂无销售订单" size="small"><el-table-column prop="billNo" label="销售单号" width="200" /><el-table-column label="应收金额" width="120"><template #default="{row}">{{ formatYuan(row.receivableAmount) }}</template></el-table-column><el-table-column label="已收金额" width="120"><template #default="{row}">{{ formatYuan(row.receivedAmount) }}</template></el-table-column><el-table-column label="未收金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unreceivedAmount)>0?'#EF4444':'#10B981'}">{{ formatYuan(row.unreceivedAmount) }}</span></template></el-table-column><el-table-column prop="collectionStatus" label="收款状态" width="110" /><el-table-column prop="businessStatus" label="履约状态" width="110" /><el-table-column prop="createdAt" label="创建时间" width="170" /><el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openSaleBillDetail(row.billNo)">详情</el-button></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="回款记录" name="payments"><el-table :data="customerPayments" empty-text="暂无回款记录" size="small"><el-table-column prop="payNo" label="支付单号" width="200" /><el-table-column prop="sourceNo" label="关联来源" width="200" /><el-table-column label="金额" width="120"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column><el-table-column prop="paymentMethod" label="支付方式" width="120" /><el-table-column prop="status" label="状态" width="100" /><el-table-column prop="createdAt" label="支付时间" width="170" /></el-table></el-tab-pane>
              <el-tab-pane label="往来账务" name="ledger"><el-table :data="customerLedger" empty-text="暂无往来记录" size="small"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应收)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已收)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额(欠款)" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="购买统计" name="stats">
                <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ customerPurchaseStats.orderCount }}</div><div class="stat-label">订单总数</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalAmount) }}</div><div class="stat-label">订单总金额</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalPaid) }}</div><div class="stat-label">累计回款</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(customerPurchaseStats.totalOwing) }}</div><div class="stat-label">当前欠款</div></div></div>
                <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">TOP购买商品</h4>
                <el-table :data="customerPurchaseStats.topProducts" empty-text="暂无数据" size="small"><el-table-column type="index" label="排名" width="60" /><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="totalQty" label="购买数量" width="120" /><el-table-column label="购买金额" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column prop="lastPurchaseAt" label="最近购买" width="170" /></el-table>
              </el-tab-pane>
              <el-tab-pane label="拜访记录" name="visits"><el-table :data="customerVisits" empty-text="暂无拜访记录" size="small"><el-table-column prop="visitDate" label="拜访日期" width="130" /><el-table-column prop="staffName" label="拜访人" width="120" /><el-table-column prop="visitType" label="拜访类型" width="120" /><el-table-column prop="result" label="拜访结果" /><el-table-column prop="nextPlan" label="下次计划" /><el-table-column prop="remark" label="备注" /></el-table></el-tab-pane>
              <el-tab-pane label="价格策略" name="prices"><el-table :data="customerPrices" empty-text="暂无专属价格" size="small"><el-table-column prop="skuName" label="商品名称" /><el-table-column label="零售价" width="110"><template #default="{row}">{{ formatYuan(row.retailPrice) }}</template></el-table-column><el-table-column label="批发价" width="110"><template #default="{row}">{{ formatYuan(row.wholesalePrice) }}</template></el-table-column><el-table-column label="专属价" width="110"><template #default="{row}"><span style="color:var(--color-primary);font-weight:600">{{ formatYuan(row.specialPrice) }}</span></template></el-table-column><el-table-column label="折扣" width="80"><template #default="{row}">{{ row.discount?row.discount+'%':'-' }}</template></el-table-column><el-table-column prop="effectiveDate" label="生效日期" width="120" /><el-table-column prop="expireDate" label="到期日期" width="120" /></el-table></el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </template>
      <el-card v-if='activeNav === "员工"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>员工管理</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-button size="small" @click="loadStaff">刷新员工</el-button>
              <el-button size="small" type="primary" @click="openStaffDialog(null)">新增员工</el-button>
            </div>
          </div>
        </template>
        <el-table :data="staffList" empty-text="暂无员工">
          <el-table-column prop="staffId" label="员工ID" width="100" />
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="realName" label="姓名" />
          <el-table-column prop="mobile" label="手机号" width="140" />
          <el-table-column prop="role" label="角色" width="120" />
          <el-table-column prop="storeId" label="门店ID" width="100" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <span :style="{color: Number(row.status) === 1 ? '#10B981' : '#EF4444', fontWeight: 600}">{{ Number(row.status) === 1 ? '启用' : '停用' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openStaffDialog(row)">编辑</el-button>
              <el-button size="small" link :type="Number(row.status) === 1 ? 'warning' : 'success'" @click="handleToggleStaffStatus(row)">{{ Number(row.status) === 1 ? '停用' : '启用' }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 角色管理 -->
      <el-card v-if='activeNav === "员工"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>角色管理</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-button size="small" @click="loadRoles">刷新</el-button>
              <el-button size="small" type="primary" @click="openRoleDialog(null)">新增角色</el-button>
            </div>
          </div>
        </template>
        <el-table :data="roles" empty-text="暂无角色">
          <el-table-column prop="roleName" label="角色名称" width="140" />
          <el-table-column prop="roleCode" label="角色编码" width="140" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="dataScope" label="数据权限" width="120"><template #default="{row}">{{ mapDataScope(row.dataScope) }}</template></el-table-column>
          <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='ACTIVE'?'success':'danger'">{{ row.status==='ACTIVE'?'启用':'停用' }}</span></template></el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openRoleDialog(row)">编辑</el-button>
              <el-button size="small" link type="danger" :disabled="row.roleCode==='SUPER_ADMIN'" @click="handleDeleteRole(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 消息中心 -->
      <template v-if="activeNav === '消息中心'">
        <div class="stat-row">
          <div class="stat-item"><div class="stat-value">{{ notificationUnreadCount }}</div><div class="stat-label">未读通知</div></div>
          <div class="stat-item"><div class="stat-value">{{ notificationsTotal }}</div><div class="stat-label">通知总数</div></div>
        </div>
        <div class="filter-area">
          <el-select v-model="notificationFilterType" placeholder="通知类型" style="width:130px" clearable @change="loadNotifications"><el-option label="系统" value="SYSTEM" /><el-option label="订单" value="ORDER" /><el-option label="支付" value="PAYMENT" /><el-option label="预警" value="ALERT" /><el-option label="授信" value="CREDIT" /><el-option label="召回" value="RECALL" /></el-select>
          <el-select v-model="notificationFilterRead" placeholder="已读/未读" style="width:130px" clearable @change="loadNotifications"><el-option label="未读" value="0" /><el-option label="已读" value="1" /></el-select>
          <el-button @click="loadNotifications">搜索</el-button>
          <el-button @click="loadNotifications">刷新</el-button>
          <el-button type="primary" @click="openSendNotificationDialog">发送通知</el-button>
          <el-button type="success" @click="handleMarkAllRead">全部已读</el-button>
        </div>
        <div class="table-card">
          <el-table :data="notifications" empty-text="暂无通知">
            <el-table-column prop="title" label="标题" width="200" />
            <el-table-column prop="content" label="内容" show-overflow-tooltip />
            <el-table-column prop="type" label="类型" width="100"><template #default="{row}">{{ mapNotificationType(row.type) }}</template></el-table-column>
            <el-table-column prop="isRead" label="状态" width="80"><template #default="{row}"><span :style="{color:row.isRead?'#10B981':'#EF4444',fontWeight:600}">{{ row.isRead?'已读':'未读' }}</span></template></el-table-column>
            <el-table-column prop="sentAt" label="时间" width="170" />
            <el-table-column label="操作" width="100"><template #default="{row}"><el-button v-if="!row.isRead" size="small" link type="primary" @click="handleMarkRead(row)">标记已读</el-button></template></el-table-column>
          </el-table>
          <div style="display:flex;justify-content:flex-end;margin-top:12px">
            <el-pagination v-model:current-page="notificationPage" :page-size="notificationPageSize" :total="notificationsTotal" layout="total, prev, pager, next" @current-change="loadNotifications" />
          </div>
        </div>
      </template>
      <el-card v-if='activeNav === "订单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px">
            <span>小程序订单</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input v-model="ordersKeyword" placeholder="订单号/收货人/电话" size="small" style="width: 180px" clearable @clear="searchOrders" @keyup.enter="searchOrders" />
              <el-select v-model="ordersStatus" placeholder="全部状态" size="small" style="width: 140px" clearable @change="searchOrders">
                <el-option label="待支付" value="PENDING_PAYMENT" />
                <el-option label="已接单" value="ACCEPTED" />
                <el-option label="已完成" value="COMPLETED" />
                <el-option label="已取消" value="CANCELLED" />
              </el-select>
              <el-date-picker
                v-model="ordersDateRange"
                type="daterange"
                size="small"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px"
                @change="searchOrders"
              />
              <el-button size="small" @click="searchOrders">搜索</el-button>
              <el-button size="small" type="success" @click="exportOrders">导出CSV</el-button>
              <el-button size="small" @click="loadOrders(1)">刷新</el-button>
            </div>
          </div>
        </template>
        <el-table :data="orders" empty-text="暂无订单">
          <el-table-column prop="orderNo" label="订单号" width="200" />
          <el-table-column prop="customerType" label="客户类型" width="100"><template #default="{ row }">{{ mapCustomerType(row.customerType) }}</template></el-table-column>
          <el-table-column prop="orderStatus" label="订单状态" width="130"><template #default="{ row }">{{ mapOrderStatus(row.orderStatus) }}</template></el-table-column>
          <el-table-column prop="payStatus" label="支付状态" width="100"><template #default="{ row }">{{ mapPayStatus(row.payStatus) }}</template></el-table-column>
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.payableAmount) }}</template>
          </el-table-column>
          <el-table-column prop="receiverName" label="收货人" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openOrderDetail(row.orderNo)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 12px; gap: 8px">
          <span style="font-size: 13px; color: #666">共 {{ ordersTotal }} 条，第 {{ ordersPage }} / {{ Math.ceil(ordersTotal / 10) || 1 }} 页</span>
          <el-button size="small" :disabled="ordersPage <= 1" @click="prevOrdersPage">上一页</el-button>
          <el-button size="small" :disabled="ordersPage >= Math.ceil(ordersTotal / 10)" @click="nextOrdersPage">下一页</el-button>
        </div>
      </el-card>
      <el-card v-if='activeNav === "销售单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px">
            <span>销售单</span>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
              <el-button size="small" type="primary" @click="openCreateSaleBillDialog">新建销售单</el-button>
              <el-input v-model="saleBillsKeyword" placeholder="单号/客户名" size="small" style="width: 180px" clearable @clear="searchSaleBills" @keyup.enter="searchSaleBills" />
              <el-select v-model="saleBillsStatus" placeholder="全部状态" size="small" style="width: 130px" clearable @change="searchSaleBills">
                <el-option label="待收款" value="UNPAID" />
                <el-option label="部分收款" value="PARTIAL" />
                <el-option label="已收款" value="PAID" />
              </el-select>
              <el-date-picker
                v-model="saleBillsDateRange"
                type="daterange"
                size="small"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px"
                @change="searchSaleBills"
              />
              <el-button size="small" @click="searchSaleBills">搜索</el-button>
              <el-button size="small" @click="loadSaleBills">刷新</el-button>
            </div>
          </div>
        </template>
        <el-table :data="saleBills" empty-text="暂无销售单">
          <el-table-column prop="billNo" label="销售单号" width="200" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column label="应收" width="110">
            <template #default="{ row }">{{ formatYuan(row.receivableAmount) }}</template>
          </el-table-column>
          <el-table-column label="已收" width="110">
            <template #default="{ row }">{{ formatYuan(row.receivedAmount) }}</template>
          </el-table-column>
          <el-table-column label="未收" width="110">
            <template #default="{ row }">{{ formatYuan(row.unreceivedAmount) }}</template>
          </el-table-column>
          <el-table-column prop="collectionStatus" label="收款" width="120"><template #default="{ row }">{{ mapCollectionStatus(row.collectionStatus) }}</template></el-table-column>
          <el-table-column prop="businessStatus" label="履约" width="120"><template #default="{ row }">{{ mapBusinessStatus(row.businessStatus) }}</template></el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="170" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openSaleBillDetail(row.billNo)">详情</el-button>
              <el-button size="small" link type="success" @click="openCollectionLinkDialog(row)">收款链接</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 12px">
          <el-pagination
            v-model:current-page="saleBillsPage"
            v-model:page-size="saleBillsPageSize"
            :total="saleBillsTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            size="small"
            @current-change="onSaleBillsPageChange"
            @size-change="onSaleBillsPageSizeChange"
          />
        </div>
      </el-card>
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存流水</span>
            <el-button size="small" type="success" @click="handleExportInventory"><el-icon><Download /></el-icon> 导出</el-button>
            <el-button size="small" @click="loadInventoryLogs">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryLogs" empty-text="暂无流水">
          <el-table-column prop="logNo" label="流水号" width="200" />
          <el-table-column prop="skuName" label="商品" width="140" />
          <el-table-column prop="changeQty" label="变动" width="80" />
          <el-table-column prop="beforeQty" label="调整前" width="80" />
          <el-table-column prop="afterQty" label="调整后" width="80" />
          <el-table-column prop="reason" label="原因" />
          <el-table-column prop="operatorName" label="操作人" width="120" />
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>分享收款</span>
            <el-button size="small" type="success" @click="handleExportPayments"><el-icon><Download /></el-icon> 导出</el-button>
            <el-button size="small" @click="loadCollectionLinks">刷新</el-button>
          </div>
        </template>
        <el-table :data="collectionLinks" empty-text="暂无记录">
          <el-table-column prop="linkNo" label="收款单号" width="200" />
          <el-table-column prop="sourceNo" label="关联销售单" width="200" />
          <el-table-column label="收款金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="已付" width="100">
            <template #default="{ row }">{{ formatYuan(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="shareChannel" label="分享渠道" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>支付记录</span>
            <el-button size="small" @click="loadPaymentOrders">刷新</el-button>
          </div>
        </template>
        <el-table :data="paymentOrders" empty-text="暂无记录">
          <el-table-column prop="payNo" label="支付单号" width="200" />
          <el-table-column prop="sourceNo" label="关联来源" width="200" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="paymentMethod" label="方式" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>退款记录</span>
            <el-button size="small" @click="loadRefundOrders">刷新</el-button>
          </div>
        </template>
        <el-table :data="refundOrders" empty-text="暂无退款">
          <el-table-column prop="refundNo" label="退款单号" width="200" />
          <el-table-column prop="payNo" label="支付单号" width="200" />
          <el-table-column prop="sourceNo" label="关联来源" width="180" />
          <el-table-column label="退款金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存总览</span>
            <el-button size="small" @click="loadInventoryBalances">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryBalances" empty-text="暂无库存">
          <el-table-column prop="storeName" label="门店" width="140" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="physicalQty" label="物理库存" width="100" />
          <el-table-column prop="availableQty" label="可售库存" width="100" />
          <el-table-column prop="lockedQty" label="锁定库存" width="100" />
        </el-table>
      </el-card>
      <!-- 批次管理 & 效期预警 Tabs -->
      <el-card v-if='activeNav === "库存"' style="margin-top: 20px">
        <el-tabs v-model="inventoryBatchTab">
          <el-tab-pane label="批次管理" name="batches">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="display:flex;gap:8px;align-items:center">
                <el-select v-model="batchFilterStoreId" placeholder="门店" size="small" style="width:120px" clearable @change="loadInventoryBatches">
                  <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
                <el-select v-model="batchFilterExpiry" placeholder="效期状态" size="small" style="width:120px" clearable @change="loadInventoryBatches">
                  <el-option label="正常" value="normal" /><el-option label="临近效期" value="warning" /><el-option label="即将过期" value="danger" /><el-option label="已过期" value="expired" />
                </el-select>
                <el-button size="small" type="primary" @click="loadInventoryBatches">查询</el-button>
              </div>
              <div style="display:flex;gap:8px">
                <el-button size="small" type="primary" @click="batchCreateDialogVisible=true">创建批次</el-button>
              </div>
            </div>
            <el-table :data="inventoryBatches" size="small" empty-text="暂无批次">
              <el-table-column prop="batchNo" label="批次号" width="160" />
              <el-table-column prop="storeName" label="门店" width="120" />
              <el-table-column prop="skuName" label="商品" />
              <el-table-column prop="quantity" label="数量" width="80" />
              <el-table-column prop="lockedQuantity" label="锁定" width="70" />
              <el-table-column prop="productionDate" label="生产日期" width="110" />
              <el-table-column prop="expiryDate" label="过期日期" width="110" />
              <el-table-column label="效期状态" width="100">
                <template #default="{row}">
                  <span :style="{color:row.expiryColor,fontWeight:600}">{{row.expiryStatusText}}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openBatchSplit(row)">拆分</el-button>
                  <el-button size="small" link type="primary" @click="openFifoSuggestion(row)">FIFO</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:12px;text-align:right">
              <el-pagination small layout="prev,pager,next" :total="batchTotal" :page-size="20" v-model:current-page="batchPage" @current-change="loadInventoryBatches" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="效期预警" name="expiryAlerts">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
              <div class="stat-item" style="border-left:4px solid #10B981"><div class="stat-value">{{expiryAlertStats.level1Count||0}}</div><div class="stat-label">一级预警(30天)</div></div>
              <div class="stat-item" style="border-left:4px solid #F59E0B"><div class="stat-value">{{expiryAlertStats.level2Count||0}}</div><div class="stat-label">二级预警(15天)</div></div>
              <div class="stat-item" style="border-left:4px solid #EF4444"><div class="stat-value">{{expiryAlertStats.level3Count||0}}</div><div class="stat-label">三级预警(7天)</div></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
              <el-select v-model="expiryAlertFilterLevel" placeholder="级别" size="small" style="width:120px" clearable @change="loadExpiryAlerts">
                <el-option label="一级" :value="1" /><el-option label="二级" :value="2" /><el-option label="三级" :value="3" />
              </el-select>
              <el-select v-model="expiryAlertFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadExpiryAlerts">
                <el-option label="待处理" value="PENDING" /><el-option label="已处理" value="HANDLED" /><el-option label="已过期" value="EXPIRED" />
              </el-select>
              <el-button size="small" @click="loadExpiryAlerts">查询</el-button>
              <el-button size="small" @click="loadExpiryAlertStatistics">刷新统计</el-button>
            </div>
            <el-table :data="expiryAlerts" size="small" empty-text="暂无预警">
              <el-table-column prop="skuName" label="商品" />
              <el-table-column prop="batchNo" label="批次号" width="160" />
              <el-table-column prop="expiryDate" label="过期日期" width="110" />
              <el-table-column prop="daysRemaining" label="剩余天数" width="90">
                <template #default="{row}"><span :style="{color:row.alertLevel===3?'#EF4444':row.alertLevel===2?'#F59E0B':'#10B981',fontWeight:600}">{{row.daysRemaining}}</span></template>
              </el-table-column>
              <el-table-column label="级别" width="90">
                <template #default="{row}">
                  <el-tag :color="row.alertLevel===3?'#EF4444':row.alertLevel===2?'#F59E0B':'#10B981'" size="small" style="color:#fff;border:none">{{row.alertLevel===1?'一级':row.alertLevel===2?'二级':'三级'}}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="动作" width="80">
                <template #default="{row}">{{row.actionTaken==='BLOCK'?'锁定':row.actionTaken==='RESTRICT'?'限制':'提醒'}}</template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{row}"><el-tag size="small" :type="row.status==='PENDING'?'danger':row.status==='HANDLED'?'success':'info'">{{row.status==='PENDING'?'待处理':row.status==='HANDLED'?'已处理':'已过期'}}</el-tag></template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{row}">
                  <el-button v-if="row.status==='PENDING'" size="small" link type="primary" @click="handleExpiryAlertItem(row)">处理</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:12px;text-align:right">
              <el-pagination small layout="prev,pager,next" :total="expiryAlertTotal" :page-size="20" v-model:current-page="expiryAlertPage" @current-change="loadExpiryAlerts" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="预警配置" name="expiryConfigs">
            <el-table :data="expiryConfigs" size="small" empty-text="暂无配置">
              <el-table-column prop="levelName" label="级别名称" width="120" />
              <el-table-column prop="daysBeforeExpiry" label="提前天数" width="100" />
              <el-table-column prop="action" label="动作" width="80">
                <template #default="{row}">{{row.action==='BLOCK'?'锁定':row.action==='RESTRICT'?'限制':'提醒'}}</template>
              </el-table-column>
              <el-table-column label="颜色" width="80">
                <template #default="{row}"><span :style="{display:'inline-block',width:'16px',height:'16px',borderRadius:'4px',background:row.color,verticalAlign:'middle'}"></span></template>
              </el-table-column>
              <el-table-column prop="enabled" label="启用" width="70">
                <template #default="{row}"><el-tag :type="row.enabled?'success':'info'" size="small">{{row.enabled?'是':'否'}}</el-tag></template>
              </el-table-column>
              <el-table-column prop="description" label="描述" />
            </el-table>
          </el-tab-pane>
          <!-- 商品追溯 -->
          <el-tab-pane label="商品追溯" name="trace">
            <el-tabs v-model="traceTab" type="border-card">
              <el-tab-pane label="追溯配置" name="configs">
                <div class="action-bar">
                  <el-button type="primary" size="small" @click="openTraceConfigDialog()">新增配置</el-button>
                </div>
                <div class="table-card">
                  <el-table :data="traceConfigs" v-loading="traceConfigsLoading" empty-text="暂无追溯配置">
                    <el-table-column prop="level" label="级别" width="100" />
                    <el-table-column prop="target" label="目标" width="160" />
                    <el-table-column prop="enabled" label="启用状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.enabled?'success':'default'">{{ row.enabled?'启用':'禁用' }}</span></template></el-table-column>
                    <el-table-column prop="codeMode" label="赋码模式" width="120" />
                    <el-table-column prop="shelfLife" label="保质期(天)" width="120" />
                    <el-table-column label="操作" width="160">
                      <template #default="{row}">
                        <el-button size="small" link type="primary" @click="openTraceConfigDialog(row)">编辑</el-button>
                        <el-button size="small" link type="danger" @click="handleDeleteTraceConfig(row)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </el-tab-pane>
              <el-tab-pane label="追溯码管理" name="codes">
                <div class="filter-area">
                  <el-input v-model="traceCodeKeyword" placeholder="搜索追溯码/SKU/批次" size="small" style="width:200px" clearable />
                  <el-select v-model="traceCodeStatusFilter" placeholder="状态" size="small" style="width:120px" clearable><el-option label="未激活" value="INACTIVE" /><el-option label="已激活" value="ACTIVE" /><el-option label="已使用" value="USED" /><el-option label="已过期" value="EXPIRED" /></el-select>
                  <el-button size="small" @click="loadTraceCodes">搜索</el-button>
                  <el-button size="small" type="primary" @click="traceCodeGenerateDialogVisible=true">批量生成</el-button>
                </div>
                <div class="table-card">
                  <el-table :data="traceCodeList" v-loading="traceCodeListLoading" empty-text="暂无追溯码">
                    <el-table-column prop="traceCode" label="追溯码" width="200" />
                    <el-table-column prop="skuName" label="SKU" width="180" />
                    <el-table-column prop="batchNo" label="批次" width="140" />
                    <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="traceCodeStatusClass(row.status)">{{ traceCodeStatusText(row.status) }}</span></template></el-table-column>
                    <el-table-column label="生产日期" width="120"><template #default="{row}">{{ formatDate(row.productionDate) }}</template></el-table-column>
                    <el-table-column label="到期日期" width="120"><template #default="{row}">{{ formatDate(row.expiryDate) }}</template></el-table-column>
                    <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" link type="primary" @click="openTraceCodeDetail(row)">详情</el-button></template></el-table-column>
                  </el-table>
                </div>
                <div class="pagination-bar">
                  <el-pagination v-model:current-page="traceCodePage" :page-size="traceCodePageSize" :total="traceCodeTotal" layout="total, prev, pager, next" @current-change="loadTraceCodes" />
                </div>
              </el-tab-pane>
              <el-tab-pane label="召回管理" name="recalls">
                <div class="action-bar">
                  <el-button type="primary" size="small" @click="openNewRecall">创建召回</el-button>
                </div>
                <div class="table-card">
                  <el-table :data="recallList" v-loading="recallListLoading" empty-text="暂无召回记录">
                    <el-table-column prop="recallNo" label="召回编号" width="180" />
                    <el-table-column prop="skuName" label="SKU" width="160" />
                    <el-table-column prop="batchNo" label="批次" width="140" />
                    <el-table-column prop="reason" label="原因" />
                    <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="recallStatusClass(row.status)">{{ recallStatusText(row.status) }}</span></template></el-table-column>
                    <el-table-column label="操作" width="200">
                      <template #default="{row}">
                        <el-button v-if="row.status==='PENDING'" size="small" link type="warning" @click="handleExecuteRecall(row)">执行召回</el-button>
                        <el-button v-if="row.status==='EXECUTING'" size="small" link type="success" @click="handleCompleteRecall(row)">完成召回</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </el-tab-pane>
              <el-tab-pane label="扫码统计" name="scanStats">
                <div class="stat-row">
                  <div class="stat-item"><div class="stat-value">{{ traceCodeStats.totalCount||0 }}</div><div class="stat-label">总追溯码数</div></div>
                  <div class="stat-item"><div class="stat-value">{{ traceCodeStats.activeCount||0 }}</div><div class="stat-label">已激活</div></div>
                  <div class="stat-item"><div class="stat-value">{{ traceCodeStats.usedCount||0 }}</div><div class="stat-label">已使用</div></div>
                  <div class="stat-item"><div class="stat-value">{{ traceCodeStats.expiredCount||0 }}</div><div class="stat-label">已过期</div></div>
                  <div class="stat-item"><div class="stat-value">{{ traceCodeStats.scanCount||0 }}</div><div class="stat-label">总扫码量</div></div>
                </div>
                <div class="table-card" style="margin-top:16px">
                  <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary);padding:16px 16px 0">扫码量 TOP10</h4>
                  <el-table :data="traceCodeStats.topScanSkus||[]" empty-text="暂无数据" size="small">
                    <el-table-column type="index" label="排名" width="60" />
                    <el-table-column prop="skuName" label="SKU名称" />
                    <el-table-column prop="scanCount" label="扫码量" width="120" />
                  </el-table>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>
          <!-- 多仓调拨 -->
          <el-tab-pane label="调拨管理" name="transfers">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
              <div class="stat-item" style="border-left:4px solid #1677FF"><div class="stat-value">{{transferStats.monthTotal||0}}</div><div class="stat-label">本月调拨单数</div></div>
              <div class="stat-item" style="border-left:4px solid #F59E0B"><div class="stat-value">{{transferStats.transitCount||0}}</div><div class="stat-label">在途数量</div></div>
              <div class="stat-item" style="border-left:4px solid #10B981"><div class="stat-value">{{transferStats.receivedCount||0}}</div><div class="stat-label">已完成</div></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
              <el-select v-model="transferFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadTransfers">
                <el-option label="草稿" value="DRAFT" /><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="在途" value="TRANSIT" /><el-option label="已收货" value="RECEIVED" /><el-option label="已取消" value="CANCELLED" />
              </el-select>
              <el-select v-model="transferFilterStoreId" placeholder="门店" size="small" style="width:120px" clearable @change="loadTransfers">
                <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
              <el-button size="small" @click="loadTransfers">查询</el-button>
              <el-button size="small" type="primary" @click="openTransferCreateDialog">创建调拨单</el-button>
            </div>
            <el-table :data="transferList" size="small" empty-text="暂无调拨单">
              <el-table-column prop="transferNo" label="调拨单号" width="180" />
              <el-table-column prop="fromStoreName" label="调出门店" width="120" />
              <el-table-column prop="toStoreName" label="调入门店" width="120" />
              <el-table-column label="状态" width="90">
                <template #default="{row}"><el-tag size="small" :type="transferStatusType(row.status)">{{transferStatusText(row.status)}}</el-tag></template>
              </el-table-column>
              <el-table-column label="总金额" width="100"><template #default="{row}">{{formatYuan(row.totalAmount)}}</template></el-table-column>
              <el-table-column prop="expectedDate" label="期望日期" width="110" />
              <el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="240">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openTransferDetail(row)">详情</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="primary" @click="handleTransferSubmit(row)">提交</el-button>
                  <el-button v-if="row.status==='PENDING'" size="small" link type="success" @click="handleTransferApprove(row)">审核</el-button>
                  <el-button v-if="row.status==='PENDING'" size="small" link type="warning" @click="handleTransferReject(row)">拒绝</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='PENDING'" size="small" link type="danger" @click="handleTransferCancel(row)">取消</el-button>
                  <el-button v-if="row.status==='APPROVED'" size="small" link type="primary" @click="handleTransferShip(row)">发货</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:12px;text-align:right">
              <el-pagination small layout="prev,pager,next" :total="transferTotal" :page-size="20" v-model:current-page="transferPage" @current-change="loadTransfers" />
            </div>
          </el-tab-pane>
          <!-- 库存盘点 -->
          <el-tab-pane label="库存盘点" name="stockChecks">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
              <div class="stat-item" style="border-left:4px solid #1677FF"><div class="stat-value">{{stockCheckStats.monthTotal||0}}</div><div class="stat-label">本月盘点次数</div></div>
              <div class="stat-item" style="border-left:4px solid #F59E0B"><div class="stat-value">{{stockCheckStats.diffCount||0}}</div><div class="stat-label">差异数</div></div>
              <div class="stat-item" style="border-left:4px solid #EF4444"><div class="stat-value">{{formatYuan(stockCheckStats.diffAmount||0)}}</div><div class="stat-label">差异金额</div></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
              <el-select v-model="scFilterStoreId" placeholder="门店" size="small" style="width:120px" clearable @change="loadStockChecks">
                <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
              <el-select v-model="scFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadStockChecks">
                <el-option label="草稿" value="DRAFT" /><el-option label="盘点中" value="CHECKING" /><el-option label="已完成" value="COMPLETED" /><el-option label="已取消" value="CANCELLED" />
              </el-select>
              <el-button size="small" @click="loadStockChecks">查询</el-button>
              <el-button size="small" type="primary" @click="openStockCheckCreateDialog">创建盘点单</el-button>
            </div>
            <el-table :data="stockCheckList" size="small" empty-text="暂无盘点单">
              <el-table-column prop="checkNo" label="盘点单号" width="180" />
              <el-table-column prop="storeName" label="门店" width="120" />
              <el-table-column label="状态" width="90">
                <template #default="{row}"><el-tag size="small" :type="scStatusType(row.status)">{{scStatusText(row.status)}}</el-tag></template>
              </el-table-column>
              <el-table-column prop="totalSku" label="SKU数" width="80" />
              <el-table-column prop="diffSku" label="差异数" width="80" />
              <el-table-column label="差异金额" width="100"><template #default="{row}">{{formatYuan(row.diffAmount)}}</template></el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="200">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openStockCheckDetail(row)">详情</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="primary" @click="handleStartStockCheck(row)">开始盘点</el-button>
                  <el-button v-if="row.status==='CHECKING'" size="small" link type="success" @click="handleCompleteStockCheck(row)">完成盘点</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='CHECKING'" size="small" link type="danger" @click="handleCancelStockCheck(row)">取消</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:12px;text-align:right">
              <el-pagination small layout="prev,pager,next" :total="scTotal" :page-size="20" v-model:current-page="scPage" @current-change="loadStockChecks" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
      <!-- 批次创建对话框 -->
      <el-dialog v-model="batchCreateDialogVisible" title="创建批次" width="500px">
        <el-form :model="batchCreateForm" label-width="80px">
          <el-form-item label="门店"><el-select v-model="batchCreateForm.storeId" style="width:100%"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
          <el-form-item label="SKU ID"><el-input-number v-model="batchCreateForm.skuId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="批次号"><el-input v-model="batchCreateForm.batchNo" /></el-form-item>
          <el-form-item label="数量"><el-input-number v-model="batchCreateForm.quantity" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="生产日期"><el-date-picker v-model="batchCreateForm.productionDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
          <el-form-item label="过期日期"><el-date-picker v-model="batchCreateForm.expiryDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
          <el-form-item label="成本价"><el-input-number v-model="batchCreateForm.costPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="batchCreateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreateBatch">确认创建</el-button></template>
      </el-dialog>
      <!-- 批次拆分对话框 -->
      <el-dialog v-model="batchSplitDialogVisible" title="批次拆分" width="450px">
        <el-form :model="batchSplitForm" label-width="80px">
          <el-form-item label="原批次号"><el-input :model-value="batchSplitForm.originalBatchNo" disabled /></el-form-item>
          <el-form-item label="拆分数量"><el-input-number v-model="batchSplitForm.splitQuantity" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="新批次号"><el-input v-model="batchSplitForm.newBatchNo" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="batchSplitDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSplitBatch">确认拆分</el-button></template>
      </el-dialog>
      <!-- FIFO建议弹窗 -->
      <el-dialog v-model="fifoDialogVisible" title="FIFO出库建议" width="600px">
        <el-table :data="fifoSuggestions" size="small" empty-text="暂无可用批次">
          <el-table-column prop="batchNo" label="批次号" width="160" />
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="可用数量" width="100" />
          <el-table-column prop="expiryDate" label="过期日期" width="110" />
          <el-table-column prop="daysRemaining" label="剩余天数" width="90" />
        </el-table>
      </el-dialog>
      <!-- 门店管控配置对话框 -->
      <el-dialog v-model="storeControlEditVisible" title="门店管控配置" width="500px">
        <el-form :model="storeControlEditForm" label-width="100px">
          <el-form-item label="自动开门时间"><el-time-picker v-model="storeControlEditForm.autoOpenTime" format="HH:mm" value-format="HH:mm" placeholder="不设置则不自动开门" style="width:100%" /></el-form-item>
          <el-form-item label="自动关门时间"><el-time-picker v-model="storeControlEditForm.autoCloseTime" format="HH:mm" value-format="HH:mm" placeholder="不设置则不自动关门" style="width:100%" /></el-form-item>
          <el-form-item label="日订单上限"><el-input-number v-model="storeControlEditForm.maxDailyOrders" :min="1" style="width:100%" placeholder="不限制" /></el-form-item>
          <el-form-item label="日金额上限"><el-input-number v-model="storeControlEditForm.maxOrderAmount" :min="0" :precision="2" style="width:100%" placeholder="不限制" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="storeControlEditVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveStoreControlConfig">保存</el-button></template>
      </el-dialog>
      <!-- 调拨单创建对话框 -->
      <el-dialog v-model="transferCreateDialogVisible" title="创建调拨单" width="700px">
        <el-form :model="transferCreateForm" label-width="80px">
          <el-form-item label="调出门店"><el-select v-model="transferCreateForm.fromStoreId" style="width:100%"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
          <el-form-item label="调入门店"><el-select v-model="transferCreateForm.toStoreId" style="width:100%"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
          <el-form-item label="期望日期"><el-date-picker v-model="transferCreateForm.expectedDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="transferCreateForm.remark" /></el-form-item>
          <el-form-item label="商品明细">
            <el-button size="small" @click="transferCreateForm.items.push({skuId:0,skuName:'',quantity:1,unitPrice:0})">添加行</el-button>
            <el-table :data="transferCreateForm.items" size="small" style="margin-top:8px" empty-text="暂无明细">
              <el-table-column label="SKU ID" width="100"><template #default="{row}"><el-input-number v-model="row.skuId" :min="1" size="small" style="width:100%" /></template></el-table-column>
              <el-table-column label="商品名称" width="160"><template #default="{row}"><el-input v-model="row.skuName" size="small" /></template></el-table-column>
              <el-table-column label="数量" width="100"><template #default="{row}"><el-input-number v-model="row.quantity" :min="1" size="small" style="width:100%" /></template></el-table-column>
              <el-table-column label="单价" width="120"><template #default="{row}"><el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
              <el-table-column label="操作" width="60"><template #default="{$index}"><el-button size="small" link type="danger" @click="transferCreateForm.items.splice($index,1)">删除</el-button></template></el-table-column>
            </el-table>
          </el-form-item>
        </el-form>
        <template #footer><el-button @click="transferCreateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreateTransfer">确认创建</el-button></template>
      </el-dialog>
      <!-- 调拨单详情弹窗 -->
      <el-dialog v-model="transferDetailDialogVisible" title="调拨单详情" width="750px">
        <el-descriptions :column="2" border size="small" style="margin-bottom:16px">
          <el-descriptions-item label="调拨单号">{{transferDetailData?.transferNo}}</el-descriptions-item>
          <el-descriptions-item label="状态"><el-tag size="small" :type="transferStatusType(transferDetailData?.status)">{{transferStatusText(transferDetailData?.status)}}</el-tag></el-descriptions-item>
          <el-descriptions-item label="调出门店">{{transferDetailData?.fromStoreName}}</el-descriptions-item>
          <el-descriptions-item label="调入门店">{{transferDetailData?.toStoreName}}</el-descriptions-item>
          <el-descriptions-item label="总金额">{{formatYuan(transferDetailData?.totalAmount)}}</el-descriptions-item>
          <el-descriptions-item label="期望日期">{{transferDetailData?.expectedDate||'-'}}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{transferDetailData?.createdAt}}</el-descriptions-item>
          <el-descriptions-item label="备注">{{transferDetailData?.remark||'-'}}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin:0 0 8px;font-size:14px">调拨明细</h4>
        <el-table :data="transferDetailData?.items||[]" size="small" empty-text="暂无明细">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="调拨数量" width="90" />
          <el-table-column label="单价" width="90"><template #default="{row}">{{formatYuan(row.unitPrice)}}</template></el-table-column>
          <el-table-column label="小计" width="100"><template #default="{row}">{{formatYuan(row.subtotal)}}</template></el-table-column>
          <el-table-column prop="transferredQty" label="已发货" width="80" />
          <el-table-column prop="receivedQty" label="已收货" width="80" />
        </el-table>
      </el-dialog>
      <!-- 盘点单创建对话框 -->
      <el-dialog v-model="scCreateDialogVisible" title="创建盘点单" width="500px">
        <el-form :model="scCreateForm" label-width="80px">
          <el-form-item label="门店"><el-select v-model="scCreateForm.storeId" style="width:100%"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
          <el-form-item label="备注"><el-input v-model="scCreateForm.remark" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="scCreateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreateStockCheck">确认创建</el-button></template>
      </el-dialog>
      <!-- 盘点单详情弹窗 -->
      <el-dialog v-model="scDetailDialogVisible" title="盘点单详情" width="800px">
        <el-descriptions :column="2" border size="small" style="margin-bottom:16px">
          <el-descriptions-item label="盘点单号">{{scDetailData?.checkNo}}</el-descriptions-item>
          <el-descriptions-item label="状态"><el-tag size="small" :type="scStatusType(scDetailData?.status)">{{scStatusText(scDetailData?.status)}}</el-tag></el-descriptions-item>
          <el-descriptions-item label="门店">{{scDetailData?.storeName}}</el-descriptions-item>
          <el-descriptions-item label="SKU总数">{{scDetailData?.totalSku}}</el-descriptions-item>
          <el-descriptions-item label="差异数">{{scDetailData?.diffSku}}</el-descriptions-item>
          <el-descriptions-item label="差异金额">{{formatYuan(scDetailData?.diffAmount)}}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin:0 0 8px;font-size:14px">盘点明细</h4>
        <el-table :data="scDetailData?.items||[]" size="small" empty-text="暂无明细" max-height="400">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="batchNo" label="批次号" width="120" />
          <el-table-column prop="systemQty" label="系统数量" width="90" />
          <el-table-column prop="actualQty" label="实盘数量" width="90" />
          <el-table-column prop="diffQty" label="差异数" width="80">
            <template #default="{row}"><span :style="{color:row.diffQty>0?'#10B981':row.diffQty<0?'#EF4444':'#333',fontWeight:600}">{{row.diffQty>0?'+':''}}{{row.diffQty}}</span></template>
          </el-table-column>
          <el-table-column label="差异金额" width="100"><template #default="{row}">{{formatYuan(row.diffAmount)}}</template></el-table-column>
          <el-table-column prop="reason" label="差异原因" width="140" />
          <el-table-column label="已处理" width="70">
            <template #default="{row}"><el-tag :type="row.handled?'success':'info'" size="small">{{row.handled?'是':'否'}}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{row}">
              <el-button v-if="scDetailData?.status==='COMPLETED' && row.diffQty!==0 && !row.handled" size="small" link type="primary" @click="handleScDiff(row)">处理差异</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>
      <!-- 报表模块 - ECharts可视化 -->
      <template v-if='activeNav === "报表"'>
        <el-tabs v-model="reportTab" style="margin-top: 20px">
          <el-tab-pane label="销售日报/月报" name="daily">
            <div class="filter-area" style="margin-bottom:16px">
              <el-radio-group v-model="reportDateType" @change="loadReportData">
                <el-radio-button value="daily">日报</el-radio-button>
                <el-radio-button value="monthly">月报</el-radio-button>
              </el-radio-group>
              <el-date-picker v-model="reportDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px;margin-left:12px" @change="loadReportData" />
              <el-button size="small" type="primary" style="margin-left:8px" @click="loadReportData">查询</el-button>
            </div>
            <div ref="salesTrendChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="reportDailyData" size="small" empty-text="暂无数据">
                <el-table-column prop="date" label="日期" width="120" />
                <el-table-column prop="orderCount" label="订单数" width="100" />
                <el-table-column label="销售金额" width="120"><template #default="{row}">{{ formatYuan(row.salesAmount || row.amount) }}</template></el-table-column>
                <el-table-column label="收款金额" width="120"><template #default="{row}">{{ formatYuan(row.receivedAmount) }}</template></el-table-column>
                <el-table-column label="退款金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount || row.refundAmount) }}</template></el-table-column>
                <el-table-column prop="customerCount" label="客户数" width="100" />
                <el-table-column label="客单价" width="120"><template #default="{row}">{{ formatYuan(row.avgOrderAmount) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="销售排行" name="ranking">
            <div class="filter-area" style="margin-bottom:16px">
              <el-radio-group v-model="rankingDimension" @change="loadRankingData">
                <el-radio-button value="product">按商品</el-radio-button>
                <el-radio-button value="customer">按客户</el-radio-button>
                <el-radio-button value="staff">按业务员</el-radio-button>
              </el-radio-group>
              <el-date-picker v-model="rankingDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px;margin-left:12px" @change="loadRankingData" />
            </div>
            <div ref="rankingChart" style="width:100%;height:350px;margin-bottom:20px"></div>
          </el-tab-pane>
          <el-tab-pane label="客户贡献分析" name="customerContribution">
            <div ref="customerContributionChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="customerContributionData" size="small" empty-text="暂无数据">
                <el-table-column type="index" label="排名" width="60" />
                <el-table-column prop="customerName" label="客户名称" />
                <el-table-column label="累计消费" width="140"><template #default="{row}">{{ formatYuan(row.totalPurchase) }}</template></el-table-column>
                <el-table-column label="累计回款" width="140"><template #default="{row}">{{ formatYuan(row.totalPaid) }}</template></el-table-column>
                <el-table-column label="当前欠款" width="120"><template #default="{row}"><span :style="{color:Number(row.owingAmount)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.owingAmount) }}</span></template></el-table-column>
                <el-table-column prop="orderCount" label="订单数" width="100" />
                <el-table-column label="贡献占比" width="100"><template #default="{row}">{{ row.contributionRate }}%</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="采购汇总" name="purchaseSummary">
            <div ref="purchaseSummaryChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="purchaseSummaryData" size="small" empty-text="暂无数据">
                <el-table-column prop="supplierName" label="供应商" />
                <el-table-column prop="purchaseCount" label="采购单数" width="100" />
                <el-table-column label="采购金额" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column>
                <el-table-column label="已付金额" width="140"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
                <el-table-column label="待付金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unpaidAmount)>0?'#EF4444':'#10B981'}">{{ formatYuan(row.unpaidAmount) }}</span></template></el-table-column>
                <el-table-column prop="lastPurchaseDate" label="最近采购" width="140" />
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="库存周转分析" name="inventoryTurnover">
            <div ref="inventoryTurnoverChart" style="width:100%;height:320px;margin-bottom:20px"></div>
            <div class="table-card">
              <el-table :data="inventoryTurnoverData" size="small" empty-text="暂无数据">
                <el-table-column prop="skuName" label="商品" />
                <el-table-column prop="category" label="品类" width="100" />
                <el-table-column prop="stockQty" label="当前库存" width="100" />
                <el-table-column label="月均销量" width="120"><template #default="{row}">{{ row.avgMonthlySales }}</template></el-table-column>
                <el-table-column label="周转天数" width="100"><template #default="{row}"><span :style="{color:Number(row.turnoverDays)>90?'#EF4444':Number(row.turnoverDays)>60?'#F59E0B':'#10B981',fontWeight:600}">{{ row.turnoverDays }}天</span></template></el-table-column>
                <el-table-column label="周转率" width="100"><template #default="{row}">{{ row.turnoverRate }}</template></el-table-column>
                <el-table-column label="库存金额" width="140"><template #default="{row}">{{ formatYuan(row.stockAmount) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="应收应付汇总" name="receivablePayable">
            <div class="filter-area" style="margin-bottom:16px">
              <el-date-picker v-model="rpDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px" @change="loadRPData" />
              <el-button size="small" type="primary" style="margin-left:8px" @click="loadRPData">查询</el-button>
            </div>
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalReceivable) }}</div><div class="stat-label">应收总额</div></div>
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalReceived) }}</div><div class="stat-label">已收总额</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#EF4444">{{ formatYuan(rpStats.totalUnreceived) }}</div><div class="stat-label">未收总额</div></div>
              <div class="stat-item"><div class="stat-value">{{ formatYuan(rpStats.totalPayable) }}</div><div class="stat-label">应付总额</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#EF4444">{{ formatYuan(rpStats.totalUnpaid) }}</div><div class="stat-label">未付总额</div></div>
            </div>
            <div class="table-card">
              <el-table :data="rpData" size="small" empty-text="暂无数据">
                <el-table-column prop="name" label="往来单位" />
                <el-table-column prop="type" label="类型" width="80" />
                <el-table-column label="应收/应付" width="140"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column>
                <el-table-column label="已收/已付" width="140"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
                <el-table-column label="未结金额" width="120"><template #default="{row}"><span :style="{color:Number(row.unpaidAmount)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.unpaidAmount) }}</span></template></el-table-column>
                <el-table-column prop="lastDate" label="最近往来" width="140" />
                <el-table-column prop="overdueDays" label="逾期天数" width="100"><template #default="{row}"><span v-if="row.overdueDays>0" style="color:#EF4444;font-weight:600">{{ row.overdueDays }}天</span><span v-else>-</span></template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="利润表" name="profit">
            <div class="filter-area" style="margin-bottom:16px">
              <el-date-picker v-model="profitDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px" @change="loadProfitData" />
              <el-button size="small" type="primary" style="margin-left:8px" @click="loadProfitData">查询</el-button>
            </div>
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value" style="color:#10B981">{{ formatYuan(profitStats.grossProfit) }}</div><div class="stat-label">毛利润</div></div>
              <div class="stat-item"><div class="stat-value">{{ profitStats.grossMargin }}%</div><div class="stat-label">毛利率</div></div>
              <div class="stat-item">
                <div class="stat-value" :style="{color: profitStats.salesGrowthRate >= 0 ? '#10B981' : '#EF4444'}">{{ profitStats.salesGrowthRate >= 0 ? '+' : '' }}{{ profitStats.salesGrowthRate }}%</div>
                <div class="stat-label">销售额环比</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" :style="{color: profitStats.profitGrowthRate >= 0 ? '#10B981' : '#EF4444'}">{{ profitStats.profitGrowthRate >= 0 ? '+' : '' }}{{ profitStats.profitGrowthRate }}%</div>
                <div class="stat-label">毛利环比</div>
              </div>
            </div>
            <div class="table-card">
              <el-table :data="profitData" size="small" empty-text="暂无数据">
                <el-table-column prop="item" label="项目" width="200" />
                <el-table-column label="本期金额" width="160" align="right"><template #default="{row}">{{ formatYuan(row.currentMonth) }}</template></el-table-column>
                <el-table-column label="上期金额" width="160" align="right"><template #default="{row}">{{ formatYuan(row.lastMonth) }}</template></el-table-column>
                <el-table-column label="环比变化" width="140" align="right">
                  <template #default="{row}">
                    <span :style="{color: Number(row.change) >= 0 ? '#10B981' : '#EF4444', fontWeight: 600}">
                      {{ Number(row.change) >= 0 ? '&#9650; ' : '&#9660; ' }}{{ Number(row.change) >= 0 ? '+' : '' }}{{ row.change }}%
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
        <template v-if="orderDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ mapCustomerType(orderDetail.customerType) }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ mapOrderStatus(orderDetail.orderStatus) }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ mapPayStatus(orderDetail.payStatus) }}</el-descriptions-item>
            <el-descriptions-item label="应付金额">{{ formatYuan(orderDetail.payableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ orderDetail.receiverMobile || "-" }}</el-descriptions-item>
            <el-descriptions-item label="收货地址">{{ orderDetail.receiverAddress || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="orderDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="orderDetail.orderStatus" style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap">
            <el-button v-if="orderDetail.orderStatus === 'PENDING_PAYMENT' || orderDetail.orderStatus === 'PENDING'" type="success" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'accept')">接单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'PENDING_PAYMENT' || orderDetail.orderStatus === 'PENDING'" type="danger" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'reject')">拒单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'ACCEPTED' || orderDetail.orderStatus === 'WAIT_DELIVERY'" type="primary" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'deliver')">开始配送</el-button>
            <el-button v-if="orderDetail.orderStatus === 'DELIVERING'" type="success" size="small" :loading="loading" @click="handleOrderAction(orderDetail.orderNo, 'complete')">完成配送</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="productDialogVisible" title="新增商品" width="520px">
        <el-form ref="productFormRef" :model="productForm" :rules="productRules" label-width="110px">
          <el-form-item label="商品名称" prop="name">
            <el-input v-model="productForm.name" />
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model="productForm.mainImage" placeholder="可填写商品图片链接" />
          </el-form-item>
          <el-form-item label="SKU名称" prop="skuName">
            <el-input v-model="productForm.skuName" />
          </el-form-item>
          <el-form-item label="条码">
            <el-input v-model="productForm.barcode" />
          </el-form-item>
          <el-form-item label="箱瓶换算">
            <el-input-number v-model="productForm.boxRatio" :min="1" />
          </el-form-item>
          <el-form-item label="零售价" prop="retailPrice">
            <el-input-number v-model="productForm.retailPrice" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="批发价" prop="wholesalePrice">
            <el-input-number v-model="productForm.wholesalePrice" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="productDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateProduct">保存</el-button>
        </template>
      </el-dialog>
      <!-- 员工新增/编辑对话框 -->
      <el-dialog v-model="staffDialogVisible" :title="staffDialogTitle" width="520px">
        <el-form ref="staffFormRef" :model="staffForm" :rules="staffRules" label-width="100px">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="staffForm.username" :disabled="staffEditingId > 0" placeholder="登录用户名" />
          </el-form-item>
          <el-form-item label="姓名" prop="realName">
            <el-input v-model="staffForm.realName" placeholder="真实姓名" />
          </el-form-item>
          <el-form-item label="手机号" prop="mobile">
            <el-input v-model="staffForm.mobile" placeholder="手机号码" />
          </el-form-item>
          <el-form-item label="角色" prop="role">
            <el-select v-model="staffForm.role" style="width: 100%">
              <el-option label="管理员" value="ADMIN" />
              <el-option label="店长" value="STORE_MANAGER" />
              <el-option label="销售员" value="SALESMAN" />
              <el-option label="仓管" value="WAREHOUSE" />
            </el-select>
          </el-form-item>
          <el-form-item label="门店" prop="storeId">
            <el-select v-model="staffForm.storeId" placeholder="选择门店" clearable style="width: 100%">
              <el-option v-for="s in stores" :key="s.id || s.storeId" :label="s.name" :value="Number(s.id || s.storeId)" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="staffDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleSaveStaff">保存</el-button>
        </template>
      </el-dialog>
      <!-- 商品编辑对话框 -->
      <el-dialog v-model="productEditDialogVisible" title="编辑商品" width="520px">
        <el-form ref="productEditFormRef" :model="productEditForm" label-width="100px">
          <el-form-item label="商品名称" prop="name">
            <el-input v-model="productEditForm.name" />
          </el-form-item>
          <el-form-item label="条码">
            <el-input v-model="productEditForm.barcode" />
          </el-form-item>
          <el-form-item label="品类">
            <el-input v-model="productEditForm.category" placeholder="如：白酒/红酒/啤酒" />
          </el-form-item>
          <el-form-item label="品牌">
            <el-input v-model="productEditForm.brand" />
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model="productEditForm.unit" placeholder="如：瓶/箱/盒" />
          </el-form-item>
          <el-form-item label="箱瓶换算">
            <el-input-number v-model="productEditForm.boxRatio" :min="1" />
          </el-form-item>
          <el-form-item label="规格">
            <el-input v-model="productEditForm.specs" placeholder="如：500ml/瓶" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="productEditDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleSaveProductEdit">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="storeDialogVisible" title="新增门店" width="480px">
        <el-form ref="storeFormRef" :model="storeForm" :rules="storeRules" label-width="100px">
          <el-form-item label="门店编码" prop="code">
            <el-input v-model="storeForm.code" />
          </el-form-item>
          <el-form-item label="门店名称" prop="name">
            <el-input v-model="storeForm.name" />
          </el-form-item>
          <el-form-item label="门店地址">
            <el-input v-model="storeForm.address" />
          </el-form-item>
          <el-form-item label="联系电话" prop="phone">
            <el-input v-model="storeForm.phone" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="storeDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateStore">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="storeEditDialogVisible" title="编辑门店" width="520px">
        <el-form :model="storeEditForm" label-width="110px">
          <el-form-item label="门店名称">
            <el-input v-model="storeEditForm.name" />
          </el-form-item>
          <el-form-item label="地址">
            <el-input v-model="storeEditForm.address" />
          </el-form-item>
          <el-form-item label="联系人">
            <el-input v-model="storeEditForm.contact" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="storeEditForm.phone" />
          </el-form-item>
          <el-form-item label="配送半径(km)">
            <el-input-number v-model="storeEditForm.deliveryRadius" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="营业状态">
            <el-select v-model="storeEditForm.businessStatus" style="width: 100%">
              <el-option label="营业中" value="OPEN" />
              <el-option label="已关闭" value="CLOSED" />
            </el-select>
          </el-form-item>
          <el-form-item label="小程序 AppID">
            <div style="display: flex; gap: 8px; width: 100%">
              <el-input v-model="storeEditForm.miniappAppid" placeholder="输入微信小程序 AppID" style="flex: 1" />
              <el-button type="primary" :loading="wxFetchLoading" @click="handleFetchWxInfo">拉取商户信息</el-button>
            </div>
          </el-form-item>
          <el-form-item label="微信商户名称">
            <el-input v-model="storeEditForm.wxMerchantName" readonly placeholder="从微信拉取" />
          </el-form-item>
          <el-form-item label="客服电话">
            <el-input v-model="storeEditForm.wxServicePhone" readonly placeholder="从微信拉取" />
          </el-form-item>
          <el-form-item label="小程序头像">
            <el-image
              v-if="storeEditForm.wxHeadImg"
              :src="storeEditForm.wxHeadImg"
              fit="cover"
              style="width: 64px; height: 64px; border-radius: 8px"
              :preview-src-list="[storeEditForm.wxHeadImg]"
              preview-teleported
            />
            <span v-else class="muted">暂无头像</span>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="storeEditDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="storeEditLoading" @click="submitStoreEdit">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="memberDialogVisible" title="新增客户" width="480px">
        <el-form ref="memberFormRef" :model="memberForm" :rules="memberRules" label-width="100px">
          <el-form-item label="客户名称" prop="name">
            <el-input v-model="memberForm.name" />
          </el-form-item>
          <el-form-item label="手机号" prop="mobile">
            <el-input v-model="memberForm.mobile" />
          </el-form-item>
          <el-form-item label="客户类型">
            <el-select v-model="memberForm.customerType">
              <el-option label="零售客户" value="RETAIL" />
              <el-option label="批发客户" value="WHOLESALE" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="memberDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateMember">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="priceDialogVisible" title="调整商品价格" width="420px">
        <el-form ref="priceFormRef" :model="priceForm" :rules="priceRules" label-width="100px">
          <el-form-item label="SKU">
            <span>{{ priceForm.skuName }}</span>
          </el-form-item>
          <el-form-item label="价格类型">
            <el-select v-model="priceForm.type">
              <el-option label="零售价" value="retail" />
              <el-option label="批发价" value="wholesale" />
              <el-option label="小程序价" value="miniapp" />
            </el-select>
          </el-form-item>
          <el-form-item label="新价格" prop="price">
            <el-input-number v-model="priceForm.price" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="priceDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleUpdatePrice">保存</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="saleBillDetailVisible" title="销售单详情" width="600px">
        <template v-if="saleBillDetail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="销售单号" :span="2">{{ saleBillDetail.billNo }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ saleBillDetail.customerName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ mapCollectionStatus(saleBillDetail.collectionStatus) }} / {{ mapBusinessStatus(saleBillDetail.businessStatus) }}</el-descriptions-item>
            <el-descriptions-item label="应收金额">{{ formatYuan(saleBillDetail.receivableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已收金额">{{ formatYuan(saleBillDetail.receivedAmount) }}</el-descriptions-item>
            <el-descriptions-item label="未收金额">{{ formatYuan(saleBillDetail.unreceivedAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="saleBillDetail.items || []" style="margin-top: 16px" empty-text="暂无商品明细">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="totalBottleQty" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="120">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
        </template>
      </el-dialog>
      <el-dialog v-model="collectionLinkDialogVisible" title="创建收款链接" width="480px">
        <el-form label-width="100px">
          <el-form-item label="关联销售单">
            <span>{{ collectionLinkForm.billNo }}</span>
          </el-form-item>
          <el-form-item label="收款金额">
            <el-input-number v-model="collectionLinkForm.amount" :min="0.01" :precision="2" style="width: 200px" />
          </el-form-item>
          <el-form-item label="有效期(小时)">
            <el-input-number v-model="collectionLinkForm.expireHours" :min="1" :max="720" style="width: 200px" />
          </el-form-item>
          <el-form-item label="分享渠道">
            <el-select v-model="collectionLinkForm.shareChannel" style="width: 200px">
              <el-option label="链接" value="LINK" />
              <el-option label="小程序卡片" value="MINIAPP_CARD" />
              <el-option label="图片" value="IMAGE" />
              <el-option label="二维码" value="QR_CODE" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="collectionLinkDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateCollectionLink">创建</el-button>
        </template>
      </el-dialog>

      <!-- 供应商管理 -->
      <template v-if="activeNav === '供应商'">
        <div v-if="!supplierDetailVisible">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ supplierStats.total }}</div><div class="stat-label">供应商总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ supplierStats.active }}</div><div class="stat-label">合作中</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalPurchase) }}</div><div class="stat-label">采购总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalPaid) }}</div><div class="stat-label">已付款</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(supplierStats.totalOwing) }}</div><div class="stat-label">待付款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="supplierKeyword" placeholder="供应商名/编码" style="width:200px" clearable @clear="loadSuppliers" @keyup.enter="loadSuppliers" />
            <el-select v-model="supplierFilterType" placeholder="供应类型" style="width:140px" clearable><el-option label="白酒" value="BAIJIU" /><el-option label="啤酒" value="BEER" /><el-option label="红酒" value="WINE" /><el-option label="综合" value="GENERAL" /></el-select>
            <el-select v-model="supplierFilterStatus" placeholder="合作状态" style="width:140px" clearable><el-option label="合作中" value="ACTIVE" /><el-option label="已暂停" value="SUSPENDED" /><el-option label="已终止" value="TERMINATED" /></el-select>
            <el-button @click="loadSuppliers">搜索</el-button><el-button @click="loadSuppliers">刷新</el-button><el-button type="primary" @click="supplierDialogVisible=true">新增供应商</el-button><el-button type="success" @click="handleExportSuppliers"><el-icon><Download /></el-icon> 导出</el-button>
          </div>
          <div class="table-card">
            <el-table :data="suppliers" empty-text="暂无供应商">
              <el-table-column prop="supplierCode" label="供应商编码" width="140" /><el-table-column prop="name" label="供应商名称" /><el-table-column prop="contactPerson" label="联系人" width="120" /><el-table-column prop="phone" label="联系电话" width="140" /><el-table-column prop="supplyType" label="供应类型" width="120"><template #default="{row}">{{ mapSupplyType(row.supplyType) }}</template></el-table-column>
              <el-table-column label="合作状态" width="100"><template #default="{row}"><span class="status-tag" :class="getSupplierStatusClass(row.status)">{{ getSupplierStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="待付款" width="120"><template #default="{row}"><span :style="{color:Number(row.owingAmount)>0?'#EF4444':'#10B981'}">{{ formatYuan(row.owingAmount||0) }}</span></template></el-table-column>
              <el-table-column label="操作" width="180"><template #default="{row}"><el-button size="small" link type="primary" @click="openSupplierDetail(row)">详情</el-button><el-button size="small" link type="success" @click="handleQuickAction(row,'采购')">采购</el-button><el-button size="small" link type="warning" @click="handleQuickAction(row,'付款')">付款</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="supplierPage" :page-size="supplierPageSize" :total="supplierTotal" layout="total, prev, pager, next" @current-change="loadSuppliers" />
            </div>
          </div>
        </div>
        <div v-if="supplierDetailVisible">
          <div style="margin-bottom:16px"><el-button @click="supplierDetailVisible=false">返回供应商列表</el-button></div>
          <div class="detail-header">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h3>{{ currentSupplier.name }} - 供应商详情</h3>
                <el-descriptions :column="4" size="small" style="margin-top:12px">
                  <el-descriptions-item label="供应商编码">{{ currentSupplier.supplierCode }}</el-descriptions-item><el-descriptions-item label="联系人">{{ currentSupplier.contactPerson }}</el-descriptions-item><el-descriptions-item label="联系电话">{{ currentSupplier.phone }}</el-descriptions-item><el-descriptions-item label="供应类型">{{ mapSupplyType(currentSupplier.supplyType) }}</el-descriptions-item>
                  <el-descriptions-item label="地址">{{ currentSupplier.address||'-' }}</el-descriptions-item><el-descriptions-item label="开户银行">{{ currentSupplier.bankName||'-' }}</el-descriptions-item><el-descriptions-item label="银行账号">{{ currentSupplier.bankAccount||'-' }}</el-descriptions-item><el-descriptions-item label="合作状态"><span class="status-tag" :class="getSupplierStatusClass(currentSupplier.status)">{{ getSupplierStatusText(currentSupplier.status) }}</span></el-descriptions-item>
                </el-descriptions>
              </div>
              <div class="quick-actions"><el-button type="primary" size="small" @click="handleQuickAction(currentSupplier,'新建采购')">新建采购</el-button><el-button size="small" @click="handleQuickAction(currentSupplier,'付款')">付款</el-button></div>
            </div>
          </div>
          <div class="detail-tabs">
            <el-tabs v-model="supplierDetailTab">
              <el-tab-pane label="采购订单" name="purchaseOrders"><el-table :data="supplierPurchaseOrders" empty-text="暂无采购订单" size="small"><el-table-column prop="purchaseNo" label="采购单号" width="200" /><el-table-column label="采购金额" width="120"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column label="已付金额" width="120"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column><el-table-column prop="status" label="状态" width="120" /><el-table-column prop="createdAt" label="创建时间" width="170" /><el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openPurchaseDetail(row.purchaseNo)">详情</el-button></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="付款管理" name="payments">
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
                  <el-button size="small" type="primary" @click="openPaymentCreateDialog">新建付款单</el-button>
                  <el-button size="small" @click="loadSupplierPayments">刷新</el-button>
                </div>
                <el-table :data="supplierPayments" empty-text="暂无付款记录" size="small">
                  <el-table-column prop="paymentNo" label="付款单号" width="180" />
                  <el-table-column label="付款金额" width="120"><template #default="{row}">{{ formatYuan(row.paymentAmount) }}</template></el-table-column>
                  <el-table-column prop="paymentMethod" label="付款方式" width="120"><template #default="{row}">{{ mapPaymentMethod(row.paymentMethod) }}</template></el-table-column>
                  <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='PAID'?'success':row.status==='APPROVED'?'warning':row.status==='CANCELLED'?'danger':'info'">{{ mapPaymentStatus(row.status) }}</span></template></el-table-column>
                  <el-table-column prop="createdAt" label="创建时间" width="170" />
                  <el-table-column label="操作" width="200">
                    <template #default="{row}">
                      <el-button v-if="row.status==='PENDING'" size="small" link type="warning" @click="handleApprovePayment(row)">审核</el-button>
                      <el-button v-if="row.status==='APPROVED'" size="small" link type="success" @click="handlePayPayment(row)">确认付款</el-button>
                      <el-button v-if="row.status!=='PAID'&&row.status!=='CANCELLED'" size="small" link type="danger" @click="handleCancelPayment(row)">取消</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
              <el-tab-pane label="供应商对账" name="statements">
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
                  <el-button size="small" type="primary" @click="openStatementGenerateDialog">生成对账单</el-button>
                  <el-button size="small" @click="loadSupplierStatements">刷新</el-button>
                </div>
                <el-table :data="supplierStatements" empty-text="暂无对账单" size="small">
                  <el-table-column prop="statementNo" label="对账单号" width="180" />
                  <el-table-column label="期间" width="200"><template #default="{row}">{{ row.periodStart }} ~ {{ row.periodEnd }}</template></el-table-column>
                  <el-table-column label="采购总额" width="120"><template #default="{row}">{{ formatYuan(row.totalPurchaseAmount) }}</template></el-table-column>
                  <el-table-column label="已付金额" width="120"><template #default="{row}">{{ formatYuan(row.totalPaidAmount) }}</template></el-table-column>
                  <el-table-column label="余额" width="120"><template #default="{row}"><span :style="{color:Number(row.balanceAmount)>0?'#EF4444':'#10B981'}">{{ formatYuan(row.balanceAmount) }}</span></template></el-table-column>
                  <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='CONFIRMED'?'success':row.status==='DISPUTED'?'danger':'info'">{{ row.status==='CONFIRMED'?'已确认':row.status==='DISPUTED'?'争议':'草稿' }}</span></template></el-table-column>
                  <el-table-column label="操作" width="200">
                    <template #default="{row}">
                      <el-button size="small" link type="primary" @click="openSupplierStatementDetail(row)">详情</el-button>
                      <el-button v-if="row.status==='DRAFT'" size="small" link type="success" @click="handleConfirmSupplierStatement(row)">确认</el-button>
                      <el-button v-if="row.status!=='CONFIRMED'" size="small" link type="warning" @click="handleDisputeSupplierStatement(row)">争议</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
              <el-tab-pane label="往来账务" name="ledger"><el-table :data="supplierLedger" empty-text="暂无往来记录" size="small"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应付)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已付)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额(应付)" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="供货商品" name="products"><el-table :data="supplierProducts" empty-text="暂无供货商品" size="small"><el-table-column prop="skuCode" label="SKU编码" width="160" /><el-table-column prop="skuName" label="商品名称" /><el-table-column label="供应价" width="110"><template #default="{row}">{{ formatYuan(row.supplyPrice) }}</template></el-table-column><el-table-column prop="unit" label="单位" width="80" /><el-table-column prop="minOrderQty" label="起订量" width="80" /><el-table-column prop="deliveryDays" label="交货天数" width="100" /><el-table-column label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="row.active?'success':'default'">{{ row.active?'在供':'停供' }}</span></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="绩效评估" name="performance">
                <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ supplierPerformance.onTimeRate }}%</div><div class="stat-label">准时交货率</div></div><div class="stat-item"><div class="stat-value">{{ supplierPerformance.qualityRate }}%</div><div class="stat-label">质量合格率</div></div><div class="stat-item"><div class="stat-value">{{ supplierPerformance.orderCount }}</div><div class="stat-label">采购订单数</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(supplierPerformance.totalAmount) }}</div><div class="stat-label">采购总额</div></div></div>
                <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">评分明细</h4>
                <el-table :data="supplierPerformance.details" empty-text="暂无评分数据" size="small"><el-table-column prop="item" label="评估项" /><el-table-column prop="score" label="得分" width="100" /><el-table-column prop="fullScore" label="满分" width="80" /><el-table-column prop="remark" label="备注" /></el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </template>

      <!-- 采购管理 -->
      <template v-if="activeNav === '采购'">
        <div v-if="purchaseView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ purchaseStats.total }}</div><div class="stat-label">采购单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ purchaseStats.pending }}</div><div class="stat-label">待入库</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalAmount) }}</div><div class="stat-label">采购总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalPaid) }}</div><div class="stat-label">已付款</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(purchaseStats.totalOwing) }}</div><div class="stat-label">待付款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="purchaseKeyword" placeholder="采购单号/供应商" style="width:200px" clearable @clear="loadPurchaseOrders" @keyup.enter="loadPurchaseOrders" />
            <el-select v-model="purchaseFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="已入库" value="WAREHOUSED" /><el-option label="已取消" value="CANCELLED" /></el-select>
            <el-button @click="loadPurchaseOrders">搜索</el-button><el-button @click="loadPurchaseOrders">刷新</el-button><el-button type="primary" @click="openPurchaseCreate">新建采购单</el-button><el-button @click="purchaseView='return'">采购退货</el-button><el-button type="success" @click="handleExportPurchaseOrders"><el-icon><Download /></el-icon> 导出</el-button>
          </div>
          <div class="table-card">
            <el-table :data="purchaseOrders" empty-text="暂无采购订单">
              <el-table-column prop="purchaseNo" label="采购单号" width="200" /><el-table-column prop="supplierName" label="供应商" />
              <el-table-column label="采购金额" width="120"><template #default="{row}">{{ formatYuan(row.totalAmount) }}</template></el-table-column><el-table-column label="已付金额" width="120"><template #default="{row}">{{ formatYuan(row.paidAmount) }}</template></el-table-column>
              <el-table-column prop="status" label="状态" width="120"><template #default="{row}"><span class="status-tag" :class="getPurchaseStatusClass(row.status)">{{ getPurchaseStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="warehouseStatus" label="入库状态" width="100" /><el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="200"><template #default="{row}"><el-button size="small" link type="primary" @click="openPurchaseDetail(row.purchaseNo)">详情</el-button><el-button v-if="row.status==='APPROVED'&&row.warehouseStatus!=='WAREHOUSED'" size="small" link type="success" @click="openPurchaseWarehousing(row)">入库</el-button><el-button v-if="row.status==='PENDING'" size="small" link type="warning" @click="handleApprovePurchase(row)">审核</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="poPage" :page-size="poPageSize" :total="poTotal" layout="total, prev, pager, next" @current-change="loadPurchaseOrders" />
            </div>
          </div>
        </div>
        <div v-if="purchaseView==='create'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>新建采购单</h3></div>
          <el-form ref="purchaseFormRef" :model="purchaseForm" :rules="purchaseRules" label-width="100px" style="max-width:800px">
            <el-form-item label="供应商"><el-select v-model="purchaseForm.supplierId" placeholder="请选择供应商" filterable style="width:100%"><el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
            <el-form-item label="仓库"><el-select v-model="purchaseForm.warehouseId" placeholder="请选择仓库" style="width:100%"><el-option v-for="s in stores" :key="s.id||s.storeId" :label="s.name" :value="s.id||s.storeId" /></el-select></el-form-item>
            <el-form-item label="预计到货日"><el-date-picker v-model="purchaseForm.expectedDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="purchaseForm.remark" type="textarea" :rows="2" placeholder="采购备注" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">商品明细</h4>
          <el-table :data="purchaseForm.items" empty-text="请添加商品" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" width="200"><template #default="{row}"><el-select v-model="row.skuId" placeholder="选择商品" filterable style="width:100%" @change="(val:any)=>onPurchaseItemSelect(row,val)"><el-option v-for="p in products" :key="p.skuId||p.id" :label="p.skuName||p.name" :value="p.skuId||p.id" /></el-select></template></el-table-column>
            <el-table-column label="数量" width="120"><template #default="{row}"><el-input-number v-model="row.quantity" :min="1" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="单价" width="140"><template #default="{row}"><el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="小计" width="120"><template #default="{row}">{{ formatYuan((row.quantity||0)*(row.unitPrice||0)) }}</template></el-table-column>
            <el-table-column label="操作" width="80"><template #default="{$index}"><el-button size="small" link type="danger" @click="purchaseForm.items.splice($index,1)">删除</el-button></template></el-table-column>
          </el-table>
          <el-button size="small" @click="addPurchaseItem">添加商品行</el-button>
          <div style="margin-top:16px;padding:16px;background:var(--bg-soft);border-radius:var(--radius-sm)"><div style="display:flex;justify-content:space-between;align-items:center"><span>商品数量: {{ purchaseForm.items.length }} 项</span><span style="font-size:18px;font-weight:700;color:var(--color-primary)">合计: {{ formatYuan(purchaseTotalAmount) }}</span></div></div>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitPurchase">提交采购单</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
        <div v-if="purchaseView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购单详情 - {{ purchaseDetail?.purchaseNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="供应商">{{ purchaseDetail?.supplierName }}</el-descriptions-item><el-descriptions-item label="仓库">{{ purchaseDetail?.warehouseName }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getPurchaseStatusClass(purchaseDetail?.status)">{{ getPurchaseStatusText(purchaseDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="入库状态">{{ purchaseDetail?.warehouseStatus||'-' }}</el-descriptions-item><el-descriptions-item label="采购金额">{{ formatYuan(purchaseDetail?.totalAmount) }}</el-descriptions-item><el-descriptions-item label="已付金额">{{ formatYuan(purchaseDetail?.paidAmount) }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ purchaseDetail?.createdAt }}</el-descriptions-item><el-descriptions-item label="备注">{{ purchaseDetail?.remark||'-' }}</el-descriptions-item></el-descriptions></div>
          <div class="table-card" style="margin-bottom:16px"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">商品明细</h4><el-table :data="purchaseDetail?.items||[]" size="small" style="margin-top:8px"><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="quantity" label="数量" width="100" /><el-table-column label="单价" width="120"><template #default="{row}">{{ formatYuan(row.unitPrice) }}</template></el-table-column><el-table-column label="小计" width="120"><template #default="{row}">{{ formatYuan(row.subtotal) }}</template></el-table-column><el-table-column prop="warehousedQty" label="已入库" width="100" /><el-table-column prop="batchNo" label="批次号" width="160" /></el-table></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">操作记录</h4><el-table :data="purchaseDetail?.operationLogs||[]" size="small" style="margin-top:8px"><el-table-column prop="action" label="操作" width="120" /><el-table-column prop="operator" label="操作人" width="120" /><el-table-column prop="remark" label="备注" /><el-table-column prop="createdAt" label="时间" width="170" /></el-table></div>
        </div>
        <div v-if="purchaseView==='warehousing'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购入库 - {{ warehousingForm.purchaseNo }}</h3><el-descriptions :column="3" size="small" style="margin-top:12px"><el-descriptions-item label="供应商">{{ warehousingForm.supplierName }}</el-descriptions-item><el-descriptions-item label="仓库">{{ warehousingForm.warehouseName }}</el-descriptions-item><el-descriptions-item label="采购金额">{{ formatYuan(warehousingForm.totalAmount) }}</el-descriptions-item></el-descriptions></div>
          <el-table :data="warehousingForm.items" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="orderQty" label="采购数量" width="100" /><el-table-column prop="warehousedQty" label="已入库" width="100" />
            <el-table-column label="本次入库" width="140"><template #default="{row}"><el-input-number v-model="row.thisQty" :min="0" :max="row.orderQty-row.warehousedQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="批次号" width="180"><template #default="{row}"><el-input v-model="row.batchNo" size="small" placeholder="批次号" /></template></el-table-column>
            <el-table-column label="生产日期" width="160"><template #default="{row}"><el-date-picker v-model="row.productionDate" type="date" value-format="YYYY-MM-DD" size="small" placeholder="生产日期" style="width:100%" /></template></el-table-column>
            <el-table-column label="质检结果" width="140"><template #default="{row}"><el-select v-model="row.qualityResult" size="small" style="width:100%"><el-option label="合格" value="PASS" /><el-option label="不合格" value="FAIL" /></el-select></template></el-table-column>
          </el-table>
          <div style="margin-top:16px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitWarehousing">确认入库</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
        <div v-if="purchaseView==='return'">
          <div style="margin-bottom:16px"><el-button @click="purchaseView='list'">返回采购列表</el-button></div>
          <div class="detail-header"><h3>采购退货</h3></div>
          <el-form :model="purchaseReturnForm" label-width="100px" style="max-width:800px">
            <el-form-item label="关联采购单"><el-select v-model="purchaseReturnForm.purchaseNo" placeholder="选择采购单" filterable style="width:100%" @change="onPurchaseReturnSelect"><el-option v-for="po in purchaseOrders" :key="po.purchaseNo" :label="`${po.purchaseNo} - ${po.supplierName}`" :value="po.purchaseNo" /></el-select></el-form-item>
            <el-form-item label="退货原因"><el-select v-model="purchaseReturnForm.reason" style="width:100%"><el-option label="质量问题" value="QUALITY" /><el-option label="数量多余" value="OVER_QUANTITY" /><el-option label="商品损坏" value="DAMAGED" /><el-option label="其他原因" value="OTHER" /></el-select></el-form-item>
            <el-form-item label="备注"><el-input v-model="purchaseReturnForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">退货商品</h4>
          <el-table :data="purchaseReturnForm.items" empty-text="请先选择采购单" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="warehousedQty" label="已入库数量" width="120" />
            <el-table-column label="退货数量" width="140"><template #default="{row}"><el-input-number v-model="row.returnQty" :min="0" :max="row.warehousedQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货单价" width="140"><template #default="{row}"><el-input-number v-model="row.returnPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan((row.returnQty||0)*(row.returnPrice||0)) }}</template></el-table-column>
          </el-table>
          <div style="margin-top:16px;display:flex;gap:12px"><el-button type="danger" :loading="loading" @click="handleSubmitPurchaseReturn">提交退货单</el-button><el-button @click="purchaseView='list'">取消</el-button></div>
        </div>
      </template>

      <!-- 销售退货 -->
      <template v-if="activeNav === '销售退货'">
        <div v-if="saleReturnView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.total }}</div><div class="stat-label">退货单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.pending }}</div><div class="stat-label">待处理</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.completed }}</div><div class="stat-label">已完成</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(saleReturnStats.totalAmount) }}</div><div class="stat-label">退货总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ saleReturnStats.thisMonth }}</div><div class="stat-label">本月退货</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="saleReturnKeyword" placeholder="退货单号/客户名" style="width:200px" clearable @clear="loadSaleReturns" @keyup.enter="loadSaleReturns" />
            <el-select v-model="saleReturnFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="已退款" value="REFUNDED" /><el-option label="已取消" value="CANCELLED" /></el-select>
            <el-button @click="loadSaleReturns">搜索</el-button><el-button @click="loadSaleReturns">刷新</el-button><el-button type="primary" @click="openSaleReturnCreate">新建退货单</el-button>
          </div>
          <div class="table-card">
            <el-table :data="saleReturns" empty-text="暂无退货记录">
              <el-table-column prop="returnNo" label="退货单号" width="200" /><el-table-column prop="sourceBillNo" label="原销售单号" width="200" /><el-table-column prop="customerName" label="客户名称" />
              <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount) }}</template></el-table-column><el-table-column prop="reason" label="退货原因" width="120" />
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="getSaleReturnStatusClass(row.status)">{{ getSaleReturnStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="createdAt" label="创建时间" width="170" />
              <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" link type="primary" @click="openSaleReturnDetail(row)">详情</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="srPage" :page-size="srPageSize" :total="srTotal" layout="total, prev, pager, next" @current-change="loadSaleReturns" />
            </div>
          </div>
        </div>
        <div v-if="saleReturnView==='create'">
          <div style="margin-bottom:16px"><el-button @click="saleReturnView='list'">返回退货列表</el-button></div>
          <div class="detail-header"><h3>新建销售退货单</h3></div>
          <el-form :model="saleReturnForm" label-width="100px" style="max-width:800px">
            <el-form-item label="关联销售单"><el-select v-model="saleReturnForm.sourceBillNo" placeholder="选择原销售单" filterable style="width:100%" @change="onSaleReturnSelect"><el-option v-for="sb in saleBills" :key="sb.billNo" :label="`${sb.billNo} - ${sb.customerName}`" :value="sb.billNo" /></el-select></el-form-item>
            <el-form-item label="客户名称"><el-input :model-value="saleReturnForm.customerName" readonly /></el-form-item>
            <el-form-item label="退货原因"><el-select v-model="saleReturnForm.reason" style="width:100%"><el-option label="质量问题" value="QUALITY" /><el-option label="发错货" value="WRONG_ITEM" /><el-option label="客户不满意" value="DISSATISFIED" /><el-option label="其他原因" value="OTHER" /></el-select></el-form-item>
            <el-form-item label="备注"><el-input v-model="saleReturnForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">退货商品</h4>
          <el-table :data="saleReturnForm.items" empty-text="请先选择销售单" size="small" style="margin-bottom:16px">
            <el-table-column prop="skuName" label="商品名称" /><el-table-column prop="originalQty" label="原购买数量" width="120" />
            <el-table-column label="退货数量" width="140"><template #default="{row}"><el-input-number v-model="row.returnQty" :min="0" :max="row.originalQty" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货单价" width="140"><template #default="{row}"><el-input-number v-model="row.returnPrice" :min="0" :precision="2" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan((row.returnQty||0)*(row.returnPrice||0)) }}</template></el-table-column>
          </el-table>
          <div style="margin-top:16px;padding:16px;background:var(--bg-soft);border-radius:var(--radius-sm)"><div style="display:flex;justify-content:space-between;align-items:center"><span>退货商品: {{ saleReturnForm.items.length }} 项</span><span style="font-size:18px;font-weight:700;color:var(--color-danger)">退货总额: {{ formatYuan(saleReturnTotalAmount) }}</span></div></div>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="danger" :loading="loading" @click="handleSubmitSaleReturn">提交退货单</el-button><el-button @click="saleReturnView='list'">取消</el-button></div>
        </div>
        <div v-if="saleReturnView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="saleReturnView='list'">返回退货列表</el-button></div>
          <div class="detail-header"><h3>退货单详情 - {{ saleReturnDetail?.returnNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="原销售单号">{{ saleReturnDetail?.sourceBillNo }}</el-descriptions-item><el-descriptions-item label="客户名称">{{ saleReturnDetail?.customerName }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getSaleReturnStatusClass(saleReturnDetail?.status)">{{ getSaleReturnStatusText(saleReturnDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="退货金额">{{ formatYuan(saleReturnDetail?.returnAmount) }}</el-descriptions-item><el-descriptions-item label="退货原因">{{ saleReturnDetail?.reason }}</el-descriptions-item><el-descriptions-item label="创建时间">{{ saleReturnDetail?.createdAt }}</el-descriptions-item><el-descriptions-item label="处理人">{{ saleReturnDetail?.handler||'-' }}</el-descriptions-item><el-descriptions-item label="备注">{{ saleReturnDetail?.remark||'-' }}</el-descriptions-item></el-descriptions></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">退货商品明细</h4><el-table :data="saleReturnDetail?.items||[]" size="small" style="margin-top:8px"><el-table-column prop="skuName" label="商品名称" /><el-table-column prop="originalQty" label="原购买数量" width="120" /><el-table-column prop="returnQty" label="退货数量" width="100" /><el-table-column label="退货单价" width="120"><template #default="{row}">{{ formatYuan(row.returnPrice) }}</template></el-table-column><el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount) }}</template></el-table-column></el-table></div>
        </div>
      </template>

      <!-- 客户对账 -->
      <template v-if="activeNav === '客户对账'">
        <div v-if="statementView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value">{{ statementStats.total }}</div><div class="stat-label">对账单总数</div></div>
            <div class="stat-item"><div class="stat-value">{{ statementStats.confirmed }}</div><div class="stat-label">已确认</div></div>
            <div class="stat-item"><div class="stat-value">{{ statementStats.pending }}</div><div class="stat-label">待确认</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(statementStats.totalAmount) }}</div><div class="stat-label">对账总额</div></div>
            <div class="stat-item"><div class="stat-value">{{ formatYuan(statementStats.totalOwing) }}</div><div class="stat-label">待收款</div></div>
          </div>
          <div class="filter-area">
            <el-input v-model="statementKeyword" placeholder="对账单号/客户名" style="width:200px" clearable @clear="loadStatements" @keyup.enter="loadStatements" />
            <el-select v-model="statementFilterStatus" placeholder="状态" style="width:140px" clearable><el-option label="待确认" value="PENDING" /><el-option label="已确认" value="CONFIRMED" /><el-option label="有异议" value="DISPUTED" /></el-select>
            <el-button @click="loadStatements">搜索</el-button><el-button @click="loadStatements">刷新</el-button><el-button type="primary" @click="openStatementCreate">生成对账单</el-button>
          </div>
          <div class="table-card">
            <el-table :data="statements" empty-text="暂无对账单">
              <el-table-column prop="statementNo" label="对账单号" width="200" /><el-table-column prop="customerName" label="客户名称" /><el-table-column prop="periodStart" label="账期开始" width="120" /><el-table-column prop="periodEnd" label="账期结束" width="120" />
              <el-table-column label="期初余额" width="120"><template #default="{row}">{{ formatYuan(row.openingBalance) }}</template></el-table-column><el-table-column label="本期应收" width="120"><template #default="{row}">{{ formatYuan(row.periodReceivable) }}</template></el-table-column><el-table-column label="本期已收" width="120"><template #default="{row}">{{ formatYuan(row.periodReceived) }}</template></el-table-column>
              <el-table-column label="期末余额" width="120"><template #default="{row}"><span :style="{color:Number(row.closingBalance)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.closingBalance) }}</span></template></el-table-column>
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="getStatementStatusClass(row.status)">{{ getStatementStatusText(row.status) }}</span></template></el-table-column><el-table-column prop="createdAt" label="生成时间" width="170" />
              <el-table-column label="操作" width="160"><template #default="{row}"><el-button size="small" link type="primary" @click="openStatementDetail(row)">详情</el-button><el-button size="small" link type="success" @click="openStatementPayment(row)">登记付款</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="stmtPage" :page-size="stmtPageSize" :total="stmtTotal" layout="total, prev, pager, next" @current-change="loadStatements" />
            </div>
          </div>
        </div>
        <div v-if="statementView==='detail'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>对账单详情 - {{ statementDetail?.statementNo }}</h3><el-descriptions :column="4" size="small" style="margin-top:12px"><el-descriptions-item label="客户名称">{{ statementDetail?.customerName }}</el-descriptions-item><el-descriptions-item label="账期">{{ statementDetail?.periodStart }} ~ {{ statementDetail?.periodEnd }}</el-descriptions-item><el-descriptions-item label="状态"><span class="status-tag" :class="getStatementStatusClass(statementDetail?.status)">{{ getStatementStatusText(statementDetail?.status) }}</span></el-descriptions-item><el-descriptions-item label="生成时间">{{ statementDetail?.createdAt }}</el-descriptions-item></el-descriptions></div>
          <div class="stat-row" style="grid-template-columns:repeat(4,1fr)"><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.openingBalance) }}</div><div class="stat-label">期初余额</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.periodReceivable) }}</div><div class="stat-label">本期应收</div></div><div class="stat-item"><div class="stat-value">{{ formatYuan(statementDetail?.periodReceived) }}</div><div class="stat-label">本期已收</div></div><div class="stat-item"><div class="stat-value" :style="{color:Number(statementDetail?.closingBalance)>0?'#EF4444':'#10B981'}">{{ formatYuan(statementDetail?.closingBalance) }}</div><div class="stat-label">期末余额</div></div></div>
          <div class="table-card"><h4 style="padding:16px 16px 0;font-size:14px;color:var(--text-secondary)">往来明细</h4><el-table :data="statementDetail?.details||[]" empty-text="暂无明细" size="small" style="margin-top:8px"><el-table-column prop="date" label="日期" width="130" /><el-table-column prop="type" label="类型" width="100" /><el-table-column prop="billNo" label="单据号" width="200" /><el-table-column prop="summary" label="摘要" /><el-table-column label="借方(应收)" width="120" align="right"><template #default="{row}">{{ row.debit?formatYuan(row.debit):'' }}</template></el-table-column><el-table-column label="贷方(已收)" width="120" align="right"><template #default="{row}">{{ row.credit?formatYuan(row.credit):'' }}</template></el-table-column><el-table-column label="余额" width="120" align="right"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(row.balance) }}</span></template></el-table-column></el-table></div>
        </div>
        <div v-if="statementView==='create'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>生成对账单</h3></div>
          <el-form ref="statementCreateFormRef" :model="statementCreateForm" :rules="statementCreateRules" label-width="100px" style="max-width:600px">
            <el-form-item label="客户"><el-select v-model="statementCreateForm.memberId" placeholder="请选择客户" filterable style="width:100%"><el-option v-for="m in members" :key="m.memberId" :label="m.name" :value="m.memberId" /></el-select></el-form-item>
            <el-form-item label="账期开始"><el-date-picker v-model="statementCreateForm.periodStart" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width:100%" /></el-form-item>
            <el-form-item label="账期结束"><el-date-picker v-model="statementCreateForm.periodEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width:100%" /></el-form-item>
          </el-form>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleGenerateStatement">生成对账单</el-button><el-button @click="statementView='list'">取消</el-button></div>
        </div>
        <div v-if="statementView==='payment'">
          <div style="margin-bottom:16px"><el-button @click="statementView='list'">返回对账单列表</el-button></div>
          <div class="detail-header"><h3>登记付款 - {{ statementPaymentForm.statementNo }}</h3><el-descriptions :column="3" size="small" style="margin-top:12px"><el-descriptions-item label="客户名称">{{ statementPaymentForm.customerName }}</el-descriptions-item><el-descriptions-item label="期末余额">{{ formatYuan(statementPaymentForm.closingBalance) }}</el-descriptions-item><el-descriptions-item label="对账单号">{{ statementPaymentForm.statementNo }}</el-descriptions-item></el-descriptions></div>
          <el-form ref="statementPaymentFormRef" :model="statementPaymentForm" :rules="statementPaymentRules" label-width="100px" style="max-width:600px">
            <el-form-item label="付款金额"><el-input-number v-model="statementPaymentForm.amount" :min="0.01" :precision="2" style="width:100%" /></el-form-item>
            <el-form-item label="付款方式"><el-select v-model="statementPaymentForm.paymentMethod" style="width:100%"><el-option label="银行转账" value="BANK_TRANSFER" /><el-option label="现金" value="CASH" /><el-option label="微信支付" value="WECHAT" /><el-option label="支付宝" value="ALIPAY" /><el-option label="支票" value="CHECK" /></el-select></el-form-item>
            <el-form-item label="付款日期"><el-date-picker v-model="statementPaymentForm.paymentDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="statementPaymentForm.remark" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <div style="margin-top:20px;display:flex;gap:12px"><el-button type="primary" :loading="loading" @click="handleSubmitStatementPayment">确认登记</el-button><el-button @click="statementView='list'">取消</el-button></div>
        </div>
      </template>


      <!-- 预警中心 -->
      <template v-if="activeNav === '预警中心'">
        <div v-if="alertView==='list'">
          <div class="stat-row">
            <div class="stat-item"><div class="stat-value" style="color:#EF4444">{{ alertStats.total }}</div><div class="stat-label">预警总数</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#EF4444">{{ alertStats.pending }}</div><div class="stat-label">待处理</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#10B981">{{ alertStats.handled }}</div><div class="stat-label">已处理</div></div>
            <div class="stat-item"><div class="stat-value">{{ alertStats.ignored }}</div><div class="stat-label">已忽略</div></div>
            <div class="stat-item"><div class="stat-value" style="color:#F59E0B">{{ alertStats.high }}</div><div class="stat-label">高级别</div></div>
          </div>
          <div class="filter-area">
            <el-select v-model="alertFilterType" placeholder="预警类型" style="width:140px" clearable @change="loadAlerts"><el-option label="库存预警" value="STOCK" /><el-option label="保质期预警" value="EXPIRY" /><el-option label="信用预警" value="CREDIT" /><el-option label="回款预警" value="PAYMENT" /></el-select>
            <el-select v-model="alertFilterLevel" placeholder="预警级别" style="width:140px" clearable @change="loadAlerts"><el-option label="高" value="HIGH" /><el-option label="中" value="MEDIUM" /><el-option label="低" value="LOW" /></el-select>
            <el-select v-model="alertFilterStatus" placeholder="处理状态" style="width:140px" clearable @change="loadAlerts"><el-option label="待处理" value="PENDING" /><el-option label="已处理" value="HANDLED" /><el-option label="已忽略" value="IGNORED" /></el-select>
            <el-button @click="loadAlerts">搜索</el-button><el-button @click="loadAlerts">刷新</el-button><el-button type="warning" @click="alertView='rules'">预警规则配置</el-button>
          </div>
          <div class="table-card">
            <el-table :data="alerts" empty-text="暂无预警">
              <el-table-column prop="alertNo" label="预警编号" width="180" />
              <el-table-column prop="type" label="类型" width="100"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
              <el-table-column prop="content" label="预警内容" />
              <el-table-column prop="level" label="级别" width="80"><template #default="{row}"><span class="status-tag" :class="row.level==='HIGH'?'danger':row.level==='MEDIUM'?'warning':'info'">{{ row.level==='HIGH'?'高':row.level==='MEDIUM'?'中':'低' }}</span></template></el-table-column>
              <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='PENDING'?'warning':row.status==='HANDLED'?'success':'default'">{{ row.status==='PENDING'?'待处理':row.status==='HANDLED'?'已处理':'已忽略' }}</span></template></el-table-column>
              <el-table-column prop="createdAt" label="触发时间" width="170" />
              <el-table-column label="操作" width="180"><template #default="{row}"><el-button v-if="row.status==='PENDING'" size="small" link type="success" @click="handleAlert(row,'HANDLED')">标记已处理</el-button><el-button v-if="row.status==='PENDING'" size="small" link @click="handleAlert(row,'IGNORED')">忽略</el-button></template></el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination v-model:current-page="alertPage" :page-size="alertPageSize" :total="alertTotal" layout="total, prev, pager, next" @current-change="loadAlerts" />
            </div>
          </div>
        </div>
        <div v-if="alertView==='rules'">
          <div style="margin-bottom:16px"><el-button @click="alertView='list'">返回预警列表</el-button></div>
          <div class="detail-header"><h3>预警规则配置</h3></div>
          <div class="table-card">
            <el-table :data="alertRules" size="small">
              <el-table-column prop="ruleName" label="规则名称" width="200" />
              <el-table-column prop="type" label="预警类型" width="120"><template #default="{row}"><span class="status-tag" :class="getAlertTypeClass(row.type)">{{ getAlertTypeText(row.type) }}</span></template></el-table-column>
              <el-table-column prop="description" label="规则描述" />
              <el-table-column label="阈值" width="140"><template #default="{row}"><el-input-number v-model="row.threshold" :min="0" size="small" style="width:120px" /></template></el-table-column>
              <el-table-column prop="enabled" label="状态" width="100"><template #default="{row}"><el-switch v-model="row.enabled" size="small" /></template></el-table-column>
              <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" link type="primary" @click="saveAlertRule(row)">保存</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
      </template>

      <!-- ==================== 价格中心 ==================== -->
      <template v-if="activeNav === '价格中心'">
        <el-tabs v-model="priceTab" type="border-card">
          <!-- 价格等级管理 -->
          <el-tab-pane label="价格等级管理" name="levels">
            <div class="action-bar">
              <el-button type="primary" size="small" @click="openPriceLevelDialog()">新增等级</el-button>
            </div>
            <div class="table-card">
              <el-table :data="priceLevels" v-loading="priceLevelsLoading" empty-text="暂无价格等级">
                <el-table-column prop="code" label="等级编码" width="120" />
                <el-table-column prop="name" label="等级名称" width="140" />
                <el-table-column label="折扣率" width="100"><template #default="{row}">{{ row.discountRate != null ? row.discountRate + '%' : '-' }}</template></el-table-column>
                <el-table-column label="最低金额" width="120"><template #default="{row}">{{ formatYuan(row.minAmount) }}</template></el-table-column>
                <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='ENABLED'?'success':'default'">{{ row.status==='ENABLED'?'启用':'禁用' }}</span></template></el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{row}">
                    <el-button size="small" link type="primary" @click="openPriceLevelDialog(row)">编辑</el-button>
                    <el-button size="small" link type="danger" @click="handleDeletePriceLevel(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <!-- 阶梯价格管理 -->
          <el-tab-pane label="阶梯价格管理" name="tierPrices">
            <div class="filter-area">
              <el-input v-model="priceSkuKeyword" placeholder="搜索SKU编码/名称" size="small" style="width:200px" clearable />
              <el-button size="small" type="primary" @click="searchPriceSku">搜索SKU</el-button>
              <el-select v-if="priceSkuList.length" v-model="priceSelectedSkuId" placeholder="选择SKU" size="small" style="width:280px" filterable @change="loadSkuTierPrices">
                <el-option v-for="s in priceSkuList" :key="s.id" :label="`${s.skuCode} - ${s.name}`" :value="s.id" />
              </el-select>
            </div>
            <div v-if="priceSelectedSkuId" class="action-bar">
              <el-button type="primary" size="small" @click="openNewTierPrice">新增阶梯价</el-button>
            </div>
            <div class="table-card">
              <el-table :data="skuTierPrices" v-loading="skuTierPricesLoading" empty-text="请先选择SKU查看阶梯价格">
                <el-table-column prop="levelName" label="价格等级" width="140" />
                <el-table-column label="起订量" width="100"><template #default="{row}">{{ row.minQty }}</template></el-table-column>
                <el-table-column label="价格" width="120"><template #default="{row}">{{ formatYuan(row.price) }}</template></el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{row}">
                    <el-button size="small" link type="primary" @click="openEditTierPrice(row)">编辑</el-button>
                    <el-button size="small" link type="danger" @click="handleDeleteTierPrice(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <!-- 客户价格绑定 -->
          <el-tab-pane label="客户价格绑定" name="bindings">
            <div class="table-card">
              <el-table :data="customerBindings" v-loading="customerBindingsLoading" empty-text="暂无绑定记录">
                <el-table-column prop="customerName" label="客户名称" />
                <el-table-column prop="levelName" label="价格等级" width="140" />
                <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='APPROVED'?'success':row.status==='PENDING'?'warning':row.status==='REJECTED'?'danger':'default'">{{ row.status==='APPROVED'?'已审批':row.status==='PENDING'?'待审批':row.status==='REJECTED'?'已拒绝':'-' }}</span></template></el-table-column>
                <el-table-column label="到期时间" width="170"><template #default="{row}">{{ formatDate(row.expireTime) }}</template></el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{row}">
                    <el-button v-if="row.status==='PENDING'" size="small" link type="success" @click="handleApproveBinding(row)">审批</el-button>
                    <el-button v-if="row.status==='PENDING'" size="small" link type="danger" @click="handleRejectBinding(row)">拒绝</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <!-- 最优价试算 -->
          <el-tab-pane label="最优价试算" name="bestPrice">
            <div class="table-card" style="padding:24px">
              <el-form :model="bestPriceForm" label-width="80px" style="max-width:500px">
                <el-form-item label="客户"><el-input v-model="bestPriceForm.customerKeyword" placeholder="客户名称/编码" /></el-form-item>
                <el-form-item label="SKU"><el-input v-model="bestPriceForm.skuKeyword" placeholder="SKU编码/名称" /></el-form-item>
                <el-form-item label="数量"><el-input-number v-model="bestPriceForm.quantity" :min="1" style="width:100%" /></el-form-item>
                <el-form-item><el-button type="primary" :loading="bestPriceLoading" @click="handleCalcBestPrice">试算最优价</el-button></el-form-item>
              </el-form>
              <div v-if="bestPriceResult" class="detail-header" style="margin-top:16px">
                <h3>试算结果</h3>
                <el-descriptions :column="3" size="small" style="margin-top:12px">
                  <el-descriptions-item label="匹配等级">{{ bestPriceResult.levelName||'-' }}</el-descriptions-item>
                  <el-descriptions-item label="最优价格"><span style="color:var(--color-primary);font-weight:700;font-size:18px">{{ formatYuan(bestPriceResult.bestPrice) }}</span></el-descriptions-item>
                  <el-descriptions-item label="单价">{{ formatYuan(bestPriceResult.unitPrice) }}</el-descriptions-item>
                  <el-descriptions-item label="折扣率">{{ bestPriceResult.discountRate != null ? bestPriceResult.discountRate + '%' : '-' }}</el-descriptions-item>
                  <el-descriptions-item label="总金额">{{ formatYuan(bestPriceResult.totalAmount) }}</el-descriptions-item>
                </el-descriptions>
              </div>
            </div>
          </el-tab-pane>
          <!-- 价格变更历史 -->
          <el-tab-pane label="价格变更历史" name="changeLogs">
            <div class="table-card">
              <el-table :data="priceChangeLogs" v-loading="priceChangeLogsLoading" empty-text="暂无变更记录">
                <el-table-column prop="skuName" label="SKU" width="180" />
                <el-table-column prop="levelName" label="等级" width="120" />
                <el-table-column label="旧价格" width="120"><template #default="{row}">{{ formatYuan(row.oldPrice) }}</template></el-table-column>
                <el-table-column label="新价格" width="120"><template #default="{row}">{{ formatYuan(row.newPrice) }}</template></el-table-column>
                <el-table-column prop="operatorName" label="操作人" width="120" />
                <el-table-column label="变更时间" width="170"><template #default="{row}">{{ formatDate(row.createdAt) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- ==================== 授信管理 ==================== -->
      <template v-if="activeNav === '授信管理'">
        <el-tabs v-model="creditTab" type="border-card">
          <!-- 授信额度列表 -->
          <el-tab-pane label="授信额度列表" name="credits">
            <div class="filter-area">
              <el-input v-model="creditKeyword" placeholder="搜索客户名" size="small" style="width:180px" clearable />
              <el-select v-model="creditStatusFilter" placeholder="状态" size="small" style="width:120px" clearable><el-option label="正常" value="NORMAL" /><el-option label="冻结" value="FROZEN" /><el-option label="逾期" value="OVERDUE" /></el-select>
              <el-button size="small" @click="loadCredits">搜索</el-button>
              <el-button size="small" @click="loadCredits">刷新</el-button>
            </div>
            <div class="table-card">
              <el-table :data="creditList" v-loading="creditListLoading" empty-text="暂无授信记录">
                <el-table-column prop="customerName" label="客户名" width="160" />
                <el-table-column label="授信额度" width="120"><template #default="{row}">{{ formatYuan(row.creditLimit) }}</template></el-table-column>
                <el-table-column label="已用" width="120"><template #default="{row}">{{ formatYuan(row.usedAmount) }}</template></el-table-column>
                <el-table-column label="冻结" width="120"><template #default="{row}">{{ formatYuan(row.frozenAmount) }}</template></el-table-column>
                <el-table-column label="可用" width="120"><template #default="{row}">{{ formatYuan(row.availableAmount) }}</template></el-table-column>
                <el-table-column prop="paymentTerm" label="账期" width="80" />
                <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="row.status==='NORMAL'?'success':row.status==='FROZEN'?'danger':'warning'">{{ row.status==='NORMAL'?'正常':row.status==='FROZEN'?'冻结':'逾期' }}</span></template></el-table-column>
                <el-table-column label="操作" width="320">
                  <template #default="{row}">
                    <el-button size="small" link type="primary" @click="openCreditDetail(row)">详情</el-button>
                    <el-button size="small" link type="warning" @click="openAdjustLimitDialog(row)">调整额度</el-button>
                    <el-button size="small" link type="info" @click="openAdjustTermDialog(row)">调整账期</el-button>
                    <el-button v-if="row.status==='NORMAL'" size="small" link type="danger" @click="handleFreezeCredit(row)">冻结</el-button>
                    <el-button v-if="row.status==='FROZEN'" size="small" link type="success" @click="handleUnfreezeCredit(row)">解冻</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div class="pagination-bar">
              <el-pagination v-model:current-page="creditPage" :page-size="creditPageSize" :total="creditTotal" layout="total, prev, pager, next" @current-change="loadCredits" />
            </div>
          </el-tab-pane>
          <!-- 催收管理 -->
          <el-tab-pane label="催收管理" name="collections">
            <div class="table-card">
              <el-table :data="collectionList" v-loading="collectionListLoading" empty-text="暂无催收记录">
                <el-table-column prop="customerName" label="客户名" width="160" />
                <el-table-column prop="level" label="等级" width="100" />
                <el-table-column prop="method" label="催收方式" width="100" />
                <el-table-column prop="result" label="结果" width="100" />
                <el-table-column prop="promise" label="承诺" width="140" />
                <el-table-column label="跟进日期" width="120"><template #default="{row}">{{ formatDate(row.followUpDate) }}</template></el-table-column>
                <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" link type="primary" @click="openEditCollection(row)">编辑</el-button></template></el-table-column>
              </el-table>
            </div>
            <div style="margin-top:12px"><el-button type="primary" size="small" @click="openNewCollection">新增催收记录</el-button></div>
          </el-tab-pane>
          <!-- 逾期列表 -->
          <el-tab-pane label="逾期列表" name="overdue">
            <div class="action-bar">
              <el-button type="warning" size="small" :loading="batchRemindLoading" @click="handleBatchRemind">批量提醒</el-button>
            </div>
            <div class="table-card">
              <el-table :data="overdueList" v-loading="overdueListLoading" empty-text="暂无逾期记录">
                <el-table-column prop="customerName" label="客户名" width="160" />
                <el-table-column label="逾期金额" width="120"><template #default="{row}"><span style="color:#EF4444;font-weight:600">{{ formatYuan(row.overdueAmount) }}</span></template></el-table-column>
                <el-table-column label="逾期天数" width="100"><template #default="{row}"><span class="status-tag danger">{{ row.overdueDays }}天</span></template></el-table-column>
                <el-table-column prop="paymentTerm" label="账期" width="80" />
                <el-table-column label="到期日期" width="120"><template #default="{row}">{{ formatDate(row.dueDate) }}</template></el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <!-- 催收统计 -->
          <el-tab-pane label="催收统计" name="collectionStats">
            <div class="stat-row">
              <div class="stat-item"><div class="stat-value">{{ collectionStats.totalCount||0 }}</div><div class="stat-label">催收总数</div></div>
              <div class="stat-item"><div class="stat-value">{{ collectionStats.recoveryRate||'0%' }}</div><div class="stat-label">回款率</div></div>
              <div class="stat-item"><div class="stat-value">{{ collectionStats.pendingCount||0 }}</div><div class="stat-label">待跟进</div></div>
              <div class="stat-item"><div class="stat-value">{{ collectionStats.levelA||0 }}</div><div class="stat-label">A级(紧急)</div></div>
              <div class="stat-item"><div class="stat-value">{{ collectionStats.levelB||0 }}</div><div class="stat-label">B级(一般)</div></div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- ==================== 售后管理 ==================== -->
      <template v-if="activeNav === '售后管理'">
        <div class="stat-row">
          <div class="stat-item"><div class="stat-value">{{ asStats.totalCount||0 }}</div><div class="stat-label">售后总数</div></div>
          <div class="stat-item"><div class="stat-value">{{ asStats.pendingCount||0 }}</div><div class="stat-label">待审核</div></div>
          <div class="stat-item"><div class="stat-value">{{ asStats.avgProcessHours||'-' }}</div><div class="stat-label">平均处理时效(h)</div></div>
          <div class="stat-item"><div class="stat-value">{{ asStats.satisfaction||'-' }}</div><div class="stat-label">满意度</div></div>
          <div class="stat-item"><div class="stat-value">{{ asStats.timeoutRate||'-' }}</div><div class="stat-label">超时率</div></div>
        </div>
        <div class="filter-area">
          <el-input v-model="asKeyword" placeholder="搜索单号/订单号/客户" size="small" style="width:200px" clearable />
          <el-select v-model="asStatusFilter" placeholder="状态" size="small" style="width:120px" clearable><el-option label="待审核" value="PENDING" /><el-option label="已审核" value="APPROVED" /><el-option label="已拒绝" value="REJECTED" /><el-option label="待验货" value="INSPECTING" /><el-option label="已完成" value="COMPLETED" /></el-select>
          <el-date-picker v-model="asDateRange" type="daterange" size="small" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:240px" />
          <el-button size="small" @click="loadAfterSales">搜索</el-button>
          <el-button size="small" @click="loadAfterSales">刷新</el-button>
        </div>
        <div class="table-card">
          <el-table :data="afterSalesList" v-loading="afterSalesLoading" empty-text="暂无售后记录">
            <el-table-column prop="afterSaleNo" label="售后单号" width="180" />
            <el-table-column prop="orderNo" label="订单号" width="180" />
            <el-table-column prop="customerName" label="客户" width="120" />
            <el-table-column prop="type" label="类型" width="80"><template #default="{row}"><span class="status-tag info">{{ row.type==='REFUND'?'退款':row.type==='EXCHANGE'?'换货':'维修' }}</span></template></el-table-column>
            <el-table-column prop="reason" label="原因" />
            <el-table-column label="退款金额" width="120"><template #default="{row}">{{ row.refundAmount != null ? formatYuan(row.refundAmount) : '-' }}</template></el-table-column>
            <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><span class="status-tag" :class="asStatusClass(row.status)">{{ asStatusText(row.status) }}</span></template></el-table-column>
            <el-table-column label="创建时间" width="170"><template #default="{row}">{{ formatDate(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="260">
              <template #default="{row}">
                <el-button size="small" link type="primary" @click="openAfterSaleDetail(row)">详情</el-button>
                <el-button v-if="row.status==='PENDING'" size="small" link type="success" @click="handleApproveAS(row)">通过</el-button>
                <el-button v-if="row.status==='PENDING'" size="small" link type="danger" @click="handleRejectAS(row)">拒绝</el-button>
                <el-button v-if="row.status==='APPROVED'" size="small" link type="warning" @click="handleInspectAS(row)">验货</el-button>
                <el-button v-if="row.status==='INSPECTING'" size="small" link type="primary" @click="handleCompleteAS(row)">完成</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="pagination-bar">
          <el-pagination v-model:current-page="asPage" :page-size="asPageSize" :total="asTotal" layout="total, prev, pager, next" @current-change="loadAfterSales" />
        </div>
      </template>

      <!-- 订单超时管理 -->
      <template v-if="activeNav === '订单超时'">
        <el-tabs v-model="otActiveTab" type="border-card">
          <!-- 超时配置 -->
          <el-tab-pane label="超时配置" name="configs">
            <div class="action-bar">
              <el-button type="primary" size="small" @click="openOtConfigDialog()">新增配置</el-button>
            </div>
            <div class="table-card">
              <el-table :data="otConfigs" empty-text="暂无超时配置">
                <el-table-column prop="orderType" label="订单类型" width="120"><template #default="{row}">{{ row.orderType === 'SALE' ? '销售' : row.orderType === 'PURCHASE' ? '采购' : '调拨' }}</template></el-table-column>
                <el-table-column prop="timeoutType" label="超时类型" width="140" />
                <el-table-column prop="timeoutMinutes" label="超时(分钟)" width="120"><template #default="{row}">{{ row.timeoutMinutes >= 1440 ? (row.timeoutMinutes / 1440).toFixed(1) + '天' : row.timeoutMinutes + '分钟' }}</template></el-table-column>
                <el-table-column prop="action" label="执行动作" width="140"><template #default="{row}">{{ otActionText(row.action) }}</template></el-table-column>
                <el-table-column prop="enabled" label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="row.enabled ? 'success' : 'default'">{{ row.enabled ? '启用' : '禁用' }}</span></template></el-table-column>
                <el-table-column prop="description" label="描述" />
                <el-table-column label="操作" width="160">
                  <template #default="{row}">
                    <el-button size="small" link type="primary" @click="openOtConfigDialog(row)">编辑</el-button>
                    <el-button size="small" link type="danger" @click="handleDeleteOtConfig(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <!-- 处理日志 -->
          <el-tab-pane label="处理日志" name="logs">
            <!-- 统计卡片 -->
            <div class="stat-row">
              <div class="stat-item"><div class="stat-value">{{ otStats.today }}</div><div class="stat-label">今日处理</div></div>
              <div class="stat-item"><div class="stat-value">{{ otStats.thisWeek }}</div><div class="stat-label">本周处理</div></div>
              <div class="stat-item"><div class="stat-value">{{ otStats.thisMonth }}</div><div class="stat-label">本月处理</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#67c23a">{{ otStats.todaySuccess }}</div><div class="stat-label">今日成功</div></div>
              <div class="stat-item"><div class="stat-value" style="color:#f56c6c">{{ otStats.todayFailed }}</div><div class="stat-label">今日失败</div></div>
            </div>
            <!-- 筛选 -->
            <div class="filter-area">
              <el-select v-model="otLogsResult" placeholder="处理结果" size="small" style="width:120px" clearable>
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
                <el-option label="跳过" value="SKIPPED" />
              </el-select>
              <el-date-picker v-model="otLogsDateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" size="small" style="width:240px" value-format="YYYY-MM-DD" />
              <el-button size="small" @click="loadOtLogs">搜索</el-button>
            </div>
            <div class="table-card">
              <el-table :data="otLogs" empty-text="暂无处理日志">
                <el-table-column prop="orderId" label="订单ID" width="100" />
                <el-table-column prop="orderType" label="订单类型" width="100"><template #default="{row}">{{ row.orderType === 'SALE' ? '销售' : row.orderType === 'PURCHASE' ? '采购' : '调拨' }}</template></el-table-column>
                <el-table-column prop="timeoutType" label="超时类型" width="140" />
                <el-table-column prop="actionTaken" label="执行动作" width="120"><template #default="{row}">{{ otActionText(row.actionTaken) }}</template></el-table-column>
                <el-table-column prop="result" label="结果" width="80"><template #default="{row}"><span class="status-tag" :class="row.result==='SUCCESS'?'success':row.result==='FAILED'?'danger':'warning'">{{ row.result==='SUCCESS'?'成功':row.result==='FAILED'?'失败':'跳过' }}</span></template></el-table-column>
                <el-table-column prop="triggeredAt" label="触发时间" width="170" />
                <el-table-column prop="remark" label="备注" />
              </el-table>
            </div>
            <div class="pagination-bar">
              <el-pagination v-model:current-page="otLogsPage" :page-size="20" :total="otLogsTotal" layout="total, prev, pager, next" @current-change="loadOtLogs" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- 订单超时配置对话框 -->
      <el-dialog v-model="otConfigDialogVisible" :title="otConfigDialogTitle" width="520px">
        <el-form label-width="100px">
          <el-form-item label="订单类型">
            <el-select v-model="otConfigForm.orderType" style="width:100%">
              <el-option label="销售" value="SALE" />
              <el-option label="采购" value="PURCHASE" />
              <el-option label="调拨" value="TRANSFER" />
            </el-select>
          </el-form-item>
          <el-form-item label="超时类型">
            <el-input v-model="otConfigForm.timeoutType" placeholder="如 WAIT_PAY, WAIT_ACCEPT" />
          </el-form-item>
          <el-form-item label="超时(分钟)">
            <el-input-number v-model="otConfigForm.timeoutMinutes" :min="1" :max="999999" style="width:100%" />
          </el-form-item>
          <el-form-item label="执行动作">
            <el-select v-model="otConfigForm.action" style="width:100%">
              <el-option label="自动取消" value="CANCEL" />
              <el-option label="自动接单" value="AUTO_ACCEPT" />
              <el-option label="自动签收" value="AUTO_SIGN" />
              <el-option label="仅提醒" value="REMIND" />
            </el-select>
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="otConfigForm.enabled" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="otConfigForm.description" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="otConfigDialogVisible=false">取消</el-button>
          <el-button type="primary" @click="handleSaveOtConfig">保存</el-button>
        </template>
      </el-dialog>

      <!-- 新增供应商对话框 -->
      <el-dialog v-model="supplierDialogVisible" title="新增供应商" width="560px">
        <el-form ref="supplierFormRef" :model="supplierForm" :rules="supplierRules" label-width="100px">
          <el-form-item label="供应商名称" prop="name"><el-input v-model="supplierForm.name" /></el-form-item>
          <el-form-item label="供应商编码" prop="supplierCode"><el-input v-model="supplierForm.supplierCode" /></el-form-item>
          <el-form-item label="联系人"><el-input v-model="supplierForm.contactPerson" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="supplierForm.phone" /></el-form-item>
          <el-form-item label="供应类型"><el-select v-model="supplierForm.supplyType" style="width:100%"><el-option label="白酒" value="BAIJIU" /><el-option label="啤酒" value="BEER" /><el-option label="红酒" value="WINE" /><el-option label="综合" value="GENERAL" /></el-select></el-form-item>
          <el-form-item label="地址"><el-input v-model="supplierForm.address" /></el-form-item>
          <el-form-item label="开户银行"><el-input v-model="supplierForm.bankName" /></el-form-item>
          <el-form-item label="银行账号"><el-input v-model="supplierForm.bankAccount" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="supplierDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreateSupplier">保存</el-button></template>
      </el-dialog>

      <!-- ==================== 价格中心对话框 ==================== -->
      <el-dialog v-model="priceLevelDialogVisible" :title="priceLevelEditingId?'编辑价格等级':'新增价格等级'" width="480px">
        <el-form ref="priceLevelFormRef" :model="priceLevelForm" :rules="priceLevelRules" label-width="100px">
          <el-form-item label="等级编码" prop="code"><el-input v-model="priceLevelForm.code" /></el-form-item>
          <el-form-item label="等级名称" prop="name"><el-input v-model="priceLevelForm.name" /></el-form-item>
          <el-form-item label="折扣率(%)" prop="discountRate"><el-input-number v-model="priceLevelForm.discountRate" :min="0" :max="100" :precision="1" style="width:100%" /></el-form-item>
          <el-form-item label="最低金额" prop="minAmount"><el-input-number v-model="priceLevelForm.minAmount" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="priceLevelForm.enabled" active-text="启用" inactive-text="禁用" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="priceLevelDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSavePriceLevel">保存</el-button></template>
      </el-dialog>

      <el-dialog v-model="priceTierDialogVisible" :title="priceTierEditingId?'编辑阶梯价':'新增阶梯价'" width="480px">
        <el-form ref="priceTierFormRef" :model="priceTierForm" :rules="priceTierRules" label-width="100px">
          <el-form-item label="价格等级" prop="levelId"><el-select v-model="priceTierForm.levelId" style="width:100%"><el-option v-for="l in priceLevels" :key="l.id" :label="l.name" :value="l.id" /></el-select></el-form-item>
          <el-form-item label="起订量" prop="minQty"><el-input-number v-model="priceTierForm.minQty" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="价格" prop="price"><el-input-number v-model="priceTierForm.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="priceTierDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveTierPrice">保存</el-button></template>
      </el-dialog>

      <!-- ==================== 授信管理对话框 ==================== -->
      <el-dialog v-model="creditDetailVisible" title="授信详情" width="680px">
        <div v-if="creditDetailData">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="客户名">{{ creditDetailData.customerName }}</el-descriptions-item>
            <el-descriptions-item label="授信额度">{{ formatYuan(creditDetailData.creditLimit) }}</el-descriptions-item>
            <el-descriptions-item label="已用额度">{{ formatYuan(creditDetailData.usedAmount) }}</el-descriptions-item>
            <el-descriptions-item label="冻结额度">{{ formatYuan(creditDetailData.frozenAmount) }}</el-descriptions-item>
            <el-descriptions-item label="可用额度">{{ formatYuan(creditDetailData.availableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="账期">{{ creditDetailData.paymentTerm }}</el-descriptions-item>
          </el-descriptions>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">操作日志</h4>
          <el-table :data="creditLogs" size="small" empty-text="暂无日志">
            <el-table-column prop="action" label="操作" width="120" />
            <el-table-column prop="remark" label="备注" />
            <el-table-column label="时间" width="170"><template #default="{row}">{{ formatDate(row.createdAt) }}</template></el-table-column>
          </el-table>
        </div>
        <template #footer><el-button @click="creditDetailVisible=false">关闭</el-button></template>
      </el-dialog>

      <el-dialog v-model="adjustLimitDialogVisible" title="调整授信额度" width="420px">
        <el-form label-width="80px">
          <el-form-item label="新额度"><el-input-number v-model="adjustLimitForm.newLimit" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="原因"><el-input v-model="adjustLimitForm.reason" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="adjustLimitDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleAdjustLimit">确认调整</el-button></template>
      </el-dialog>

      <el-dialog v-model="adjustTermDialogVisible" title="调整账期" width="420px">
        <el-form label-width="80px">
          <el-form-item label="新账期"><el-input v-model="adjustTermForm.newTerm" placeholder="如: 30天" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="adjustTermDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleAdjustTerm">确认调整</el-button></template>
      </el-dialog>

      <el-dialog v-model="freezeDialogVisible" :title="freezeAction==='freeze'?'冻结授信':'解冻授信'" width="420px">
        <el-form label-width="80px">
          <el-form-item label="原因"><el-input v-model="freezeReason" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="freezeDialogVisible=false">取消</el-button><el-button :type="freezeAction==='freeze'?'danger':'success'" :loading="loading" @click="handleFreezeUnfreeze">{{ freezeAction==='freeze'?'确认冻结':'确认解冻' }}</el-button></template>
      </el-dialog>

      <el-dialog v-model="collectionDialogVisible" :title="collectionEditingId?'编辑催收记录':'新增催收记录'" width="480px">
        <el-form label-width="80px">
          <el-form-item label="催收方式"><el-input v-model="collectionForm.method" /></el-form-item>
          <el-form-item label="结果"><el-input v-model="collectionForm.result" /></el-form-item>
          <el-form-item label="承诺"><el-input v-model="collectionForm.promise" /></el-form-item>
          <el-form-item label="跟进日期"><el-input v-model="collectionForm.followUpDate" placeholder="YYYY-MM-DD" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="collectionDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveCollection">保存</el-button></template>
      </el-dialog>

      <!-- ==================== 售后管理对话框 ==================== -->
      <el-dialog v-model="asDetailVisible" title="售后详情" width="720px">
        <div v-if="asDetailData">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="售后单号">{{ asDetailData.afterSaleNo }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ asDetailData.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ asDetailData.customerName }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ asDetailData.type==='REFUND'?'退款':asDetailData.type==='EXCHANGE'?'换货':'维修' }}</el-descriptions-item>
            <el-descriptions-item label="原因">{{ asDetailData.reason }}</el-descriptions-item>
            <el-descriptions-item label="退款金额">{{ formatYuan(asDetailData.refundAmount) }}</el-descriptions-item>
            <el-descriptions-item label="状态"><span class="status-tag" :class="asStatusClass(asDetailData.status)">{{ asStatusText(asDetailData.status) }}</span></el-descriptions-item>
            <el-descriptions-item label="满意度">{{ asDetailData.satisfaction||'-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(asDetailData.createdAt) }}</el-descriptions-item>
          </el-descriptions>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">商品明细</h4>
          <el-table :data="asDetailData.items||[]" size="small" empty-text="暂无明细">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="qty" label="数量" width="80" />
            <el-table-column label="单价" width="100"><template #default="{row}">{{ formatYuan(row.price) }}</template></el-table-column>
          </el-table>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">处理备注</h4>
          <p style="color:var(--text-secondary);font-size:13px">{{ asDetailData.remark||'-' }}</p>
        </div>
        <template #footer><el-button @click="asDetailVisible=false">关闭</el-button></template>
      </el-dialog>

      <el-dialog v-model="asInspectDialogVisible" title="验货操作" width="480px">
        <el-form label-width="80px">
          <el-form-item label="验货结果">
            <el-radio-group v-model="asInspectForm.result">
              <el-radio value="PASS">通过</el-radio>
              <el-radio value="PARTIAL">部分通过</el-radio>
              <el-radio value="FAIL">拒绝</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="备注"><el-input v-model="asInspectForm.remark" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="asInspectDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveInspect">提交验货</el-button></template>
      </el-dialog>

      <el-dialog v-model="asCompleteDialogVisible" title="完成处理" width="480px">
        <el-form label-width="80px">
          <el-form-item label="处理方式">
            <el-radio-group v-model="asCompleteForm.method">
              <el-radio value="REFUND">确认退款</el-radio>
              <el-radio value="EXCHANGE">确认换货</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="备注"><el-input v-model="asCompleteForm.remark" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="asCompleteDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveComplete">确认完成</el-button></template>
      </el-dialog>

      <!-- ==================== 追溯管理对话框 ==================== -->
      <el-dialog v-model="traceConfigDialogVisible" :title="traceConfigEditingId?'编辑追溯配置':'新增追溯配置'" width="480px">
        <el-form ref="traceConfigFormRef" :model="traceConfigForm" :rules="traceConfigRules" label-width="100px">
          <el-form-item label="级别" prop="level"><el-input v-model="traceConfigForm.level" /></el-form-item>
          <el-form-item label="目标" prop="target"><el-input v-model="traceConfigForm.target" /></el-form-item>
          <el-form-item label="赋码模式"><el-input v-model="traceConfigForm.codeMode" /></el-form-item>
          <el-form-item label="保质期(天)"><el-input-number v-model="traceConfigForm.shelfLife" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="traceConfigForm.enabled" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="traceConfigDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveTraceConfig">保存</el-button></template>
      </el-dialog>

      <el-dialog v-model="traceCodeGenerateDialogVisible" title="批量生成追溯码" width="480px">
        <el-form label-width="100px">
          <el-form-item label="SKU ID"><el-input-number v-model="traceCodeGenForm.skuId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="批次号"><el-input v-model="traceCodeGenForm.batchNo" /></el-form-item>
          <el-form-item label="生成数量"><el-input-number v-model="traceCodeGenForm.count" :min="1" :max="10000" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="traceCodeGenerateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleGenerateTraceCodes">生成</el-button></template>
      </el-dialog>

      <el-dialog v-model="traceCodeDetailVisible" title="追溯码详情" width="680px">
        <div v-if="traceCodeDetailData">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="追溯码">{{ traceCodeDetailData.traceCode }}</el-descriptions-item>
            <el-descriptions-item label="SKU">{{ traceCodeDetailData.skuName }}</el-descriptions-item>
            <el-descriptions-item label="批次">{{ traceCodeDetailData.batchNo }}</el-descriptions-item>
            <el-descriptions-item label="状态"><span class="status-tag" :class="traceCodeStatusClass(traceCodeDetailData.status)">{{ traceCodeStatusText(traceCodeDetailData.status) }}</span></el-descriptions-item>
            <el-descriptions-item label="生产日期">{{ formatDate(traceCodeDetailData.productionDate) }}</el-descriptions-item>
            <el-descriptions-item label="到期日期">{{ formatDate(traceCodeDetailData.expiryDate) }}</el-descriptions-item>
          </el-descriptions>
          <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text-secondary)">事件时间线</h4>
          <div v-if="traceCodeDetailData.events && traceCodeDetailData.events.length" style="padding-left:20px;border-left:2px solid var(--color-primary)">
            <div v-for="(ev,i) in traceCodeDetailData.events" :key="i" style="position:relative;padding:8px 0 8px 20px">
              <div style="position:absolute;left:-7px;top:14px;width:12px;height:12px;border-radius:50%;background:var(--color-primary)"></div>
              <div style="font-size:13px;color:var(--text-primary)">{{ ev.event }}</div>
              <div style="font-size:12px;color:var(--text-muted)">{{ formatDate(ev.time) }}</div>
            </div>
          </div>
          <div v-else style="color:var(--text-muted);font-size:13px;padding:12px 0">暂无事件记录</div>
        </div>
        <template #footer><el-button @click="traceCodeDetailVisible=false">关闭</el-button></template>
      </el-dialog>

      <el-dialog v-model="recallDialogVisible" :title="recallEditingNo?'编辑召回':'创建召回'" width="480px">
        <el-form label-width="80px">
          <el-form-item label="SKU ID"><el-input-number v-model="recallForm.skuId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="批次号"><el-input v-model="recallForm.batchNo" /></el-form-item>
          <el-form-item label="召回原因"><el-input v-model="recallForm.reason" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="召回范围"><el-input v-model="recallForm.scope" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="recallDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveRecall">保存</el-button></template>
      </el-dialog>

      <!-- ==================== 营销中心 ==================== -->
      <template v-if="activeNav === '营销中心'">
        <el-tabs v-model="marketingTab" type="border-card" style="margin-top:20px">
          <!-- 优惠券管理 -->
          <el-tab-pane label="优惠券管理" name="coupons">
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value">{{ couponStats.overall?.totalTemplates || 0 }}</div><div class="stat-label">模板总数</div></div>
              <div class="stat-item"><div class="stat-value">{{ couponStats.overall?.totalClaimed || 0 }}</div><div class="stat-label">已领取</div></div>
              <div class="stat-item"><div class="stat-value">{{ couponStats.overall?.totalUsed || 0 }}</div><div class="stat-label">已使用</div></div>
              <div class="stat-item"><div class="stat-value">{{ couponStats.overall?.useRate || '0%' }}</div><div class="stat-label">核销率</div></div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
              <el-select v-model="couponFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadCouponTemplates">
                <el-option label="草稿" value="DRAFT" /><el-option label="激活" value="ACTIVE" /><el-option label="暂停" value="PAUSED" /><el-option label="已过期" value="EXPIRED" />
              </el-select>
              <el-select v-model="couponFilterType" placeholder="类型" size="small" style="width:120px" clearable @change="loadCouponTemplates">
                <el-option label="满减券" value="FIXED" /><el-option label="折扣券" value="PERCENT" /><el-option label="包邮券" value="SHIPPING" /><el-option label="赠品券" value="FREE_GIFT" />
              </el-select>
              <el-button size="small" type="primary" @click="openCouponDialog()">新建优惠券</el-button>
              <el-button size="small" @click="loadCouponTemplates">刷新</el-button>
            </div>
            <el-table :data="couponTemplates" size="small" empty-text="暂无优惠券模板">
              <el-table-column prop="name" label="名称" min-width="140" />
              <el-table-column prop="type" label="类型" width="90"><template #default="{row}">{{ couponTypeText(row.type) }}</template></el-table-column>
              <el-table-column label="面值/折扣" width="100"><template #default="{row}">{{ row.type==='PERCENT'? row.value+'%' : formatYuan(row.value) }}</template></el-table-column>
              <el-table-column label="门槛" width="100"><template #default="{row}">{{ row.minAmount > 0 ? '满'+formatYuan(row.minAmount) : '无门槛' }}</template></el-table-column>
              <el-table-column label="已领/总量" width="100"><template #default="{row}">{{ row.claimedCount }}/{{ row.totalCount || '不限' }}</template></el-table-column>
              <el-table-column prop="status" label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="couponStatusClass(row.status)">{{ couponStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="有效期" width="170"><template #default="{row}">{{ (row.startTime||'').slice(0,10) }} ~ {{ (row.endTime||'').slice(0,10) }}</template></el-table-column>
              <el-table-column label="操作" width="220">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openCouponDialog(row)">编辑</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='PAUSED'" size="small" link type="success" @click="handleActivateCoupon(row)">激活</el-button>
                  <el-button v-if="row.status==='ACTIVE'" size="small" link type="warning" @click="handlePauseCoupon(row)">暂停</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="danger" @click="handleDeleteCoupon(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination small layout="prev,pager,next" :total="couponTplTotal" :page-size="couponTplPageSize" v-model:current-page="couponTplPage" @current-change="loadCouponTemplates" />
            </div>
          </el-tab-pane>

          <!-- 满减活动 -->
          <el-tab-pane label="满减活动" name="fullReduction">
            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
              <el-select v-model="frFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadFullReductions">
                <el-option label="草稿" value="DRAFT" /><el-option label="激活" value="ACTIVE" /><el-option label="暂停" value="PAUSED" />
              </el-select>
              <el-button size="small" type="primary" @click="openFRDialog()">新建满减</el-button>
              <el-button size="small" @click="loadFullReductions">刷新</el-button>
            </div>
            <el-table :data="fullReductions" size="small" empty-text="暂无满减活动">
              <el-table-column prop="name" label="名称" min-width="140" />
              <el-table-column label="规则" min-width="200"><template #default="{row}">{{ formatFRRules(row.rules) }}</template></el-table-column>
              <el-table-column label="适用范围" width="100"><template #default="{row}">{{ scopeText(row.applicableScope) }}</template></el-table-column>
              <el-table-column prop="priority" label="优先级" width="80" />
              <el-table-column label="可叠加" width="80"><template #default="{row}">{{ row.stackable ? '是' : '否' }}</template></el-table-column>
              <el-table-column prop="status" label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="promoStatusClass(row.status)">{{ promoStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="操作" width="220">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openFRDialog(row)">编辑</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='PAUSED'" size="small" link type="success" @click="handleActivateFR(row)">激活</el-button>
                  <el-button v-if="row.status==='ACTIVE'" size="small" link type="warning" @click="handlePauseFR(row)">暂停</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="danger" @click="handleDeleteFR(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination small layout="prev,pager,next" :total="frTotal" :page-size="frPageSize" v-model:current-page="frPage" @current-change="loadFullReductions" />
            </div>
          </el-tab-pane>

          <!-- 秒杀管理 -->
          <el-tab-pane label="秒杀管理" name="flashSale">
            <div class="stat-row" style="margin-bottom:16px">
              <div class="stat-item"><div class="stat-value">{{ flashStats.overall?.totalActivities || 0 }}</div><div class="stat-label">活动总数</div></div>
              <div class="stat-item"><div class="stat-value">{{ flashStats.overall?.totalSold || 0 }}</div><div class="stat-label">总销量</div></div>
              <div class="stat-item"><div class="stat-value">{{ flashStats.overall?.sellThroughRate || '0%' }}</div><div class="stat-label">动销率</div></div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
              <el-select v-model="flashFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadFlashSales">
                <el-option label="草稿" value="DRAFT" /><el-option label="激活" value="ACTIVE" /><el-option label="暂停" value="PAUSED" />
              </el-select>
              <el-button size="small" type="primary" @click="openFlashDialog()">新建秒杀</el-button>
              <el-button size="small" @click="loadFlashSales">刷新</el-button>
            </div>
            <el-table :data="flashSales" size="small" empty-text="暂无秒杀活动">
              <el-table-column prop="name" label="名称" min-width="140" />
              <el-table-column label="秒杀价" width="100"><template #default="{row}">{{ formatYuan(row.flashPrice) }}</template></el-table-column>
              <el-table-column label="原价" width="100"><template #default="{row}">{{ formatYuan(row.originalPrice) }}</template></el-table-column>
              <el-table-column label="库存/已售" width="100"><template #default="{row}">{{ row.soldCount }}/{{ row.totalStock }}</template></el-table-column>
              <el-table-column prop="limitPerUser" label="限购" width="70" />
              <el-table-column prop="status" label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="promoStatusClass(row.status)">{{ promoStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="操作" width="220">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openFlashDialog(row)">编辑</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='PAUSED'" size="small" link type="success" @click="handleActivateFlash(row)">激活</el-button>
                  <el-button v-if="row.status==='ACTIVE'" size="small" link type="warning" @click="handlePauseFlash(row)">暂停</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="danger" @click="handleDeleteFlash(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination small layout="prev,pager,next" :total="flashTotal" :page-size="flashPageSize" v-model:current-page="flashPage" @current-change="loadFlashSales" />
            </div>
          </el-tab-pane>

          <!-- 拼团管理 -->
          <el-tab-pane label="拼团管理" name="groupBuy">
            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
              <el-select v-model="gbFilterStatus" placeholder="状态" size="small" style="width:120px" clearable @change="loadGroupBuys">
                <el-option label="草稿" value="DRAFT" /><el-option label="激活" value="ACTIVE" /><el-option label="暂停" value="PAUSED" />
              </el-select>
              <el-button size="small" type="primary" @click="openGBDialog()">新建拼团</el-button>
              <el-button size="small" @click="loadGroupBuys">刷新</el-button>
            </div>
            <el-table :data="groupBuys" size="small" empty-text="暂无拼团活动">
              <el-table-column prop="name" label="名称" min-width="140" />
              <el-table-column label="拼团价" width="100"><template #default="{row}">{{ formatYuan(row.groupPrice) }}</template></el-table-column>
              <el-table-column label="原价" width="100"><template #default="{row}">{{ formatYuan(row.originalPrice) }}</template></el-table-column>
              <el-table-column label="成团人数" width="100"><template #default="{row}">{{ row.minGroupSize }}~{{ row.maxGroupSize }}</template></el-table-column>
              <el-table-column label="时限" width="80"><template #default="{row}">{{ row.timeLimitHours }}h</template></el-table-column>
              <el-table-column prop="status" label="状态" width="80"><template #default="{row}"><span class="status-tag" :class="promoStatusClass(row.status)">{{ promoStatusText(row.status) }}</span></template></el-table-column>
              <el-table-column label="操作" width="180">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openGBDialog(row)">编辑</el-button>
                  <el-button v-if="row.status==='DRAFT'||row.status==='PAUSED'" size="small" link type="success" @click="handleActivateGB(row)">激活</el-button>
                  <el-button v-if="row.status==='DRAFT'" size="small" link type="danger" @click="handleDeleteGB(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <el-pagination small layout="prev,pager,next" :total="gbTotal" :page-size="gbPageSize" v-model:current-page="gbPage" @current-change="loadGroupBuys" />
            </div>
          </el-tab-pane>

          <!-- 叠加规则 -->
          <el-tab-pane label="叠加规则" name="stackRules">
            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
              <el-button size="small" type="primary" @click="openStackRuleDialog()">新建规则</el-button>
              <el-button size="small" @click="loadStackRules">刷新</el-button>
            </div>
            <el-table :data="stackRules" size="small" empty-text="暂无叠加规则">
              <el-table-column prop="name" label="名称" min-width="140" />
              <el-table-column label="允许叠加组合" min-width="200"><template #default="{row}">{{ formatStackCombination(row.typeCombination) }}</template></el-table-column>
              <el-table-column label="最大折扣率" width="100"><template #default="{row}">{{ (row.maxTotalDiscountRate * 100).toFixed(0) }}%</template></el-table-column>
              <el-table-column prop="priority" label="优先级" width="80" />
              <el-table-column label="启用" width="70"><template #default="{row}">{{ row.enabled ? '是' : '否' }}</template></el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{row}">
                  <el-button size="small" link type="primary" @click="openStackRuleDialog(row)">编辑</el-button>
                  <el-button size="small" link type="danger" @click="handleDeleteStackRule(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-divider />
            <h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">优惠试算工具</h4>
            <el-form label-width="100px" size="small">
              <el-form-item label="商品金额"><el-input-number v-model="calcForm.amount" :min="0" :precision="2" style="width:200px" /></el-form-item>
              <el-form-item label="优惠券ID"><el-input-number v-model="calcForm.couponTemplateId" :min="0" style="width:200px" placeholder="可选" /></el-form-item>
              <el-form-item label="满减活动ID"><el-input-number v-model="calcForm.fullReductionIds" :min="0" style="width:200px" placeholder="可选" /></el-form-item>
              <el-form-item><el-button type="primary" @click="handleCalculate">试算</el-button></el-form-item>
            </el-form>
            <div v-if="calcResult" class="table-card" style="padding:16px;margin-top:8px">
              <p>原价: <strong>{{ formatYuan(calcResult.originalTotal) }}</strong></p>
              <p>优惠后: <strong style="color:var(--color-success)">{{ formatYuan(calcResult.discountedTotal) }}</strong></p>
              <p>节省: <strong style="color:var(--color-danger)">{{ formatYuan(calcResult.totalSaved) }}</strong></p>
              <div v-for="(item, idx) in calcResult.breakdown" :key="idx" style="margin-top:4px;color:var(--text-secondary);font-size:13px">
                - {{ item.description }}: -{{ formatYuan(item.discount) }}
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- 优惠券创建/编辑对话框 -->
      <el-dialog v-model="couponDialogVisible" :title="couponEditingId ? '编辑优惠券' : '新建优惠券'" width="560px">
        <el-form ref="couponFormRef" :model="couponForm" :rules="couponRules" label-width="100px">
          <el-form-item label="名称" prop="name"><el-input v-model="couponForm.name" /></el-form-item>
          <el-form-item label="类型" prop="type">
            <el-select v-model="couponForm.type" style="width:100%">
              <el-option label="满减券" value="FIXED" /><el-option label="折扣券" value="PERCENT" /><el-option label="包邮券" value="SHIPPING" /><el-option label="赠品券" value="FREE_GIFT" />
            </el-select>
          </el-form-item>
          <el-form-item label="面值/折扣" prop="value"><el-input-number v-model="couponForm.value" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="最低消费"><el-input-number v-model="couponForm.minAmount" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item v-if="couponForm.type==='PERCENT'" label="最大折扣"><el-input-number v-model="couponForm.maxDiscount" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="发放总量"><el-input-number v-model="couponForm.totalCount" :min="0" style="width:100%" /><span style="margin-left:8px;color:var(--text-muted);font-size:12px">0=不限量</span></el-form-item>
          <el-form-item label="开始时间" prop="startTime"><el-date-picker v-model="couponForm.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="结束时间" prop="endTime"><el-date-picker v-model="couponForm.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="说明"><el-input v-model="couponForm.description" type="textarea" :rows="2" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="couponDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveCoupon">保存</el-button></template>
      </el-dialog>

      <!-- 满减创建/编辑对话框 -->
      <el-dialog v-model="frDialogVisible" :title="frEditingId ? '编辑满减活动' : '新建满减活动'" width="600px">
        <el-form ref="frFormRef" :model="frForm" :rules="frRules" label-width="100px">
          <el-form-item label="名称" prop="name"><el-input v-model="frForm.name" /></el-form-item>
          <el-form-item label="满减规则">
            <div v-for="(rule, idx) in frForm.rules" :key="idx" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
              <span>满</span><el-input-number v-model="rule.minAmount" :min="0" :precision="2" size="small" style="width:120px" />
              <span>减</span><el-input-number v-model="rule.reduceAmount" :min="0" :precision="2" size="small" style="width:120px" />
              <el-button size="small" type="danger" link @click="frForm.rules.splice(idx,1)" :disabled="frForm.rules.length<=1">删除</el-button>
            </div>
            <el-button size="small" @click="frForm.rules.push({minAmount:0,reduceAmount:0})">添加规则</el-button>
          </el-form-item>
          <el-form-item label="优先级"><el-input-number v-model="frForm.priority" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="可叠加优惠券"><el-switch v-model="frForm.stackable" /></el-form-item>
          <el-form-item label="开始时间" prop="startTime"><el-date-picker v-model="frForm.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="结束时间" prop="endTime"><el-date-picker v-model="frForm.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="说明"><el-input v-model="frForm.description" type="textarea" :rows="2" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="frDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveFR">保存</el-button></template>
      </el-dialog>

      <!-- 秒杀创建/编辑对话框 -->
      <el-dialog v-model="flashDialogVisible" :title="flashEditingId ? '编辑秒杀活动' : '新建秒杀活动'" width="560px">
        <el-form ref="flashFormRef" :model="flashForm" :rules="flashRules" label-width="100px">
          <el-form-item label="名称" prop="name"><el-input v-model="flashForm.name" /></el-form-item>
          <el-form-item label="商品ID" prop="productId"><el-input-number v-model="flashForm.productId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="SKU ID" prop="skuId"><el-input-number v-model="flashForm.skuId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="秒杀价" prop="flashPrice"><el-input-number v-model="flashForm.flashPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="原价" prop="originalPrice"><el-input-number v-model="flashForm.originalPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="库存" prop="totalStock"><el-input-number v-model="flashForm.totalStock" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="限购"><el-input-number v-model="flashForm.limitPerUser" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="开始时间" prop="startTime"><el-date-picker v-model="flashForm.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="结束时间" prop="endTime"><el-date-picker v-model="flashForm.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="flashDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveFlash">保存</el-button></template>
      </el-dialog>

      <!-- 拼团创建/编辑对话框 -->
      <el-dialog v-model="gbDialogVisible" :title="gbEditingId ? '编辑拼团活动' : '新建拼团活动'" width="560px">
        <el-form ref="gbFormRef" :model="gbForm" :rules="gbRules" label-width="100px">
          <el-form-item label="名称" prop="name"><el-input v-model="gbForm.name" /></el-form-item>
          <el-form-item label="商品ID" prop="productId"><el-input-number v-model="gbForm.productId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="SKU ID" prop="skuId"><el-input-number v-model="gbForm.skuId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="拼团价" prop="groupPrice"><el-input-number v-model="gbForm.groupPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="原价" prop="originalPrice"><el-input-number v-model="gbForm.originalPrice" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="最少成团" prop="minGroupSize"><el-input-number v-model="gbForm.minGroupSize" :min="2" style="width:100%" /></el-form-item>
          <el-form-item label="最多成团" prop="maxGroupSize"><el-input-number v-model="gbForm.maxGroupSize" :min="2" style="width:100%" /></el-form-item>
          <el-form-item label="拼团时限(h)"><el-input-number v-model="gbForm.timeLimitHours" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="库存" prop="totalStock"><el-input-number v-model="gbForm.totalStock" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="开始时间" prop="startTime"><el-date-picker v-model="gbForm.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="结束时间" prop="endTime"><el-date-picker v-model="gbForm.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="gbDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveGB">保存</el-button></template>
      </el-dialog>

      <!-- 叠加规则创建/编辑对话框 -->
      <el-dialog v-model="stackRuleDialogVisible" :title="stackRuleEditingId ? '编辑叠加规则' : '新建叠加规则'" width="560px">
        <el-form ref="stackRuleFormRef" :model="stackRuleForm" :rules="stackRuleRules" label-width="100px">
          <el-form-item label="名称" prop="name"><el-input v-model="stackRuleForm.name" /></el-form-item>
          <el-form-item label="最大折扣率"><el-input-number v-model="stackRuleForm.maxTotalDiscountRate" :min="0" :max="1.9999" :step="0.1" :precision="4" style="width:100%" /></el-form-item>
          <el-form-item label="优先级"><el-input-number v-model="stackRuleForm.priority" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="stackRuleForm.enabled" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="stackRuleDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveStackRule">保存</el-button></template>
      </el-dialog>
      <!-- 付款单创建对话框 -->
      <el-dialog v-model="paymentCreateDialogVisible" title="新建付款单" width="500px">
        <el-form :model="paymentCreateForm" label-width="100px">
          <el-form-item label="关联采购单"><el-select v-model="paymentCreateForm.purchaseOrderId" placeholder="选择采购单" filterable style="width:100%"><el-option v-for="po in supplierPurchaseOrders" :key="po.purchaseNo" :label="po.purchaseNo" :value="po.purchaseNo" /></el-select></el-form-item>
          <el-form-item label="付款金额"><el-input-number v-model="paymentCreateForm.paymentAmount" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="付款方式"><el-select v-model="paymentCreateForm.paymentMethod" style="width:100%"><el-option label="银行转账" value="BANK_TRANSFER" /><el-option label="现金" value="CASH" /><el-option label="支票" value="CHECK" /><el-option label="其他" value="OTHER" /></el-select></el-form-item>
          <el-form-item label="银行账号"><el-input v-model="paymentCreateForm.bankAccount" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="paymentCreateForm.remark" type="textarea" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="paymentCreateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleCreatePayment">保存</el-button></template>
      </el-dialog>
      <!-- 对账单生成对话框 -->
      <el-dialog v-model="statementGenerateDialogVisible" title="生成供应商对账单" width="480px">
        <el-form :model="statementGenerateForm" label-width="100px">
          <el-form-item label="供应商"><el-input :model-value="currentSupplier.name" disabled /></el-form-item>
          <el-form-item label="开始日期"><el-date-picker v-model="statementGenerateForm.periodStart" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
          <el-form-item label="结束日期"><el-date-picker v-model="statementGenerateForm.periodEnd" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="statementGenerateForm.remark" type="textarea" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="statementGenerateDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleGenerateSupplierStatement">生成</el-button></template>
      </el-dialog>
      <!-- 对账单详情弹窗 -->
      <el-dialog v-model="statementDetailDialogVisible" title="对账单详情" width="700px">
        <el-descriptions v-if="statementDetailData" :column="3" size="small" border style="margin-bottom:16px">
          <el-descriptions-item label="对账单号">{{ statementDetailData.statementNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ statementDetailData.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="期间">{{ statementDetailData.periodStart }} ~ {{ statementDetailData.periodEnd }}</el-descriptions-item>
          <el-descriptions-item label="采购总额">{{ formatYuan(statementDetailData.totalPurchaseAmount) }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">{{ formatYuan(statementDetailData.totalPaidAmount) }}</el-descriptions-item>
          <el-descriptions-item label="余额"><span :style="{color:Number(statementDetailData.balanceAmount)>0?'#EF4444':'#10B981',fontWeight:600}">{{ formatYuan(statementDetailData.balanceAmount) }}</span></el-descriptions-item>
        </el-descriptions>
        <el-table :data="statementDetailItems" empty-text="暂无明细" size="small">
          <el-table-column prop="purchaseNo" label="采购单号" width="180" />
          <el-table-column label="采购金额" width="120"><template #default="{row}">{{ formatYuan(row.purchaseAmount) }}</template></el-table-column>
          <el-table-column label="付款金额" width="120"><template #default="{row}">{{ formatYuan(row.paymentAmount) }}</template></el-table-column>
          <el-table-column label="退货金额" width="120"><template #default="{row}">{{ formatYuan(row.returnAmount) }}</template></el-table-column>
          <el-table-column label="余额" width="120"><template #default="{row}"><span :style="{color:Number(row.balance)>0?'#EF4444':'#10B981'}">{{ formatYuan(row.balance) }}</span></template></el-table-column>
        </el-table>
      </el-dialog>
      <!-- 角色编辑对话框 -->
      <el-dialog v-model="roleDialogVisible" :title="roleDialogTitle" width="560px">
        <el-form :model="roleForm" label-width="100px">
          <el-form-item label="角色名称"><el-input v-model="roleForm.roleName" /></el-form-item>
          <el-form-item label="角色编码"><el-input v-model="roleForm.roleCode" :disabled="!!roleEditingId" /></el-form-item>
          <el-form-item label="描述"><el-input v-model="roleForm.description" /></el-form-item>
          <el-form-item label="数据权限"><el-select v-model="roleForm.dataScope" style="width:100%"><el-option label="全部" value="ALL" /><el-option label="部门" value="DEPARTMENT" /><el-option label="门店" value="STORE" /><el-option label="本人" value="SELF" /></el-select></el-form-item>
          <el-form-item label="权限配置">
            <div style="max-height:300px;overflow-y:auto;border:1px solid #eee;padding:8px;border-radius:4px">
              <div v-for="mod in permissionModules" :key="mod.module" style="margin-bottom:8px">
                <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:#333">{{ mod.module }}</div>
                <div style="display:flex;gap:12px;flex-wrap:wrap">
                  <el-checkbox v-for="perm in mod.perms" :key="perm.code" v-model="perm.checked" :label="perm.label" style="margin-right:0" />
                </div>
              </div>
            </div>
          </el-form-item>
        </el-form>
        <template #footer><el-button @click="roleDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveRole">保存</el-button></template>
      </el-dialog>
      <!-- 发送通知对话框 -->
      <el-dialog v-model="sendNotificationDialogVisible" title="发送通知" width="500px">
        <el-form :model="sendNotificationForm" label-width="100px">
          <el-form-item label="接收人ID"><el-input-number v-model="sendNotificationForm.recipientId" :min="1" style="width:100%" /></el-form-item>
          <el-form-item label="接收人类型"><el-select v-model="sendNotificationForm.recipientType" style="width:100%"><el-option label="管理员" value="ADMIN" /><el-option label="商户" value="MERCHANT" /><el-option label="消费者" value="CONSUMER" /></el-select></el-form-item>
          <el-form-item label="标题"><el-input v-model="sendNotificationForm.title" /></el-form-item>
          <el-form-item label="内容"><el-input v-model="sendNotificationForm.content" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="类型"><el-select v-model="sendNotificationForm.type" style="width:100%"><el-option label="系统" value="SYSTEM" /><el-option label="订单" value="ORDER" /><el-option label="支付" value="PAYMENT" /><el-option label="预警" value="ALERT" /><el-option label="授信" value="CREDIT" /><el-option label="召回" value="RECALL" /></el-select></el-form-item>
        </el-form>
        <template #footer><el-button @click="sendNotificationDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSendNotification">发送</el-button></template>
      </el-dialog>

      <!-- 销售单创建对话框 -->
      <el-dialog v-model="saleBillCreateDialogVisible" title="新建销售单" width="800px">
        <el-form :model="saleBillCreateForm" label-width="100px">
          <el-form-item label="客户">
            <el-select v-model="saleBillCreateForm.customerId" placeholder="选择客户（可选）" clearable filterable style="width:100%">
              <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-divider>商品明细</el-divider>
          <el-table :data="saleBillCreateForm.items" border style="margin-bottom:16px">
            <el-table-column label="商品" width="200">
              <template #default="{ row }">
                <el-select v-model="row.skuId" placeholder="选择商品" filterable style="width:100%">
                  <el-option v-for="p in products" :key="p.id" :label="`${p.name} - ${p.skuName}`" :value="p.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" :min="1" size="small" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="单价" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">
                ¥{{ formatYuan(row.quantity * row.unitPrice) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button size="small" type="danger" link @click="saleBillCreateForm.items.splice($index, 1)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" link @click="saleBillCreateForm.items.push({ skuId: 0, quantity: 1, unitPrice: 0 })">+ 添加商品</el-button>
          <el-divider>结算信息</el-divider>
          <el-form-item label="折扣金额">
            <el-input-number v-model="saleBillCreateForm.discountAmount" :min="0" :precision="2" style="width:200px" />
          </el-form-item>
          <el-form-item label="抹零金额">
            <el-input-number v-model="saleBillCreateForm.roundDownAmount" :min="0" :precision="2" style="width:200px" />
          </el-form-item>
          <el-form-item label="支付方式">
            <el-select v-model="saleBillCreateForm.paymentMethod" style="width:200px">
              <el-option label="现金" value="CASH" />
              <el-option label="微信" value="WECHAT" />
              <el-option label="支付宝" value="ALIPAY" />
              <el-option label="银行转账" value="BANK_TRANSFER" />
            </el-select>
          </el-form-item>
          <el-form-item label="收款金额">
            <el-input-number v-model="saleBillCreateForm.receivedAmount" :min="0" :precision="2" style="width:200px" />
          </el-form-item>
          <el-form-item label="应收合计">
            <span style="font-size:18px;font-weight:600;color:#EF4444">
              ¥{{ formatYuan(saleBillCreateForm.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) - (saleBillCreateForm.discountAmount || 0) - (saleBillCreateForm.roundDownAmount || 0)) }}
            </span>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="saleBillCreateDialogVisible=false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleCreateSaleBill">保存</el-button>
        </template>
      </el-dialog>

      <!-- 操作日志 -->
      <template v-if="activeNav === '操作日志'">
        <div class="stat-row">
          <div class="stat-item"><div class="stat-value">{{ auditStats.todayCount }}</div><div class="stat-label">今日操作</div></div>
          <div class="stat-item"><div class="stat-value">{{ auditStats.weekCount }}</div><div class="stat-label">本周操作</div></div>
          <div class="stat-item"><div class="stat-value">{{ auditStats.monthCount }}</div><div class="stat-label">本月操作</div></div>
        </div>
        <div class="filter-area">
          <el-input v-model="auditFilterKeyword" placeholder="用户名" style="width:140px" clearable @clear="loadAuditLogs" @keyup.enter="loadAuditLogs" />
          <el-select v-model="auditFilterAction" placeholder="操作类型" style="width:130px" clearable @change="loadAuditLogs">
            <el-option label="新增" value="CREATE" /><el-option label="更新" value="UPDATE" /><el-option label="删除" value="DELETE" />
            <el-option label="登录" value="LOGIN" /><el-option label="登出" value="LOGOUT" /><el-option label="审核" value="APPROVE" />
            <el-option label="导出" value="EXPORT" /><el-option label="导入" value="IMPORT" />
          </el-select>
          <el-select v-model="auditFilterResourceType" placeholder="资源类型" style="width:130px" clearable @change="loadAuditLogs">
            <el-option label="商品" value="PRODUCT" /><el-option label="订单" value="ORDER" /><el-option label="客户" value="CUSTOMER" />
            <el-option label="供应商" value="SUPPLIER" /><el-option label="员工" value="EMPLOYEE" /><el-option label="门店" value="STORE" />
            <el-option label="价格" value="PRICE" /><el-option label="库存" value="INVENTORY" /><el-option label="付款" value="PAYMENT" />
          </el-select>
          <el-date-picker v-model="auditDateRange" type="daterange" size="default" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width:240px" @change="loadAuditLogs" />
          <el-button @click="loadAuditLogs">搜索</el-button>
          <el-button type="success" @click="handleExportAuditLogs"><el-icon><Download /></el-icon> 导出</el-button>
        </div>
        <div class="table-card">
          <el-table :data="auditLogs" empty-text="暂无操作日志" size="small">
            <el-table-column prop="userName" label="操作人" width="120" />
            <el-table-column prop="role" label="角色" width="120" />
            <el-table-column prop="action" label="操作类型" width="100">
              <template #default="{row}"><span class="status-tag" :class="getAuditActionClass(row.action)">{{ getAuditActionText(row.action) }}</span></template>
            </el-table-column>
            <el-table-column prop="resourceType" label="资源类型" width="100" />
            <el-table-column prop="resourceId" label="资源ID" width="120" />
            <el-table-column prop="ip" label="IP" width="140" />
            <el-table-column prop="createdAt" label="操作时间" width="170" />
            <el-table-column label="操作" width="80">
              <template #default="{row}"><el-button size="small" link type="primary" @click="openAuditDetail(row)">详情</el-button></template>
            </el-table-column>
          </el-table>
          <div style="display:flex;justify-content:flex-end;margin-top:12px">
            <el-pagination v-model:current-page="auditPage" :page-size="auditPageSize" :total="auditTotal" layout="total, prev, pager, next" @current-change="loadAuditLogs" />
          </div>
        </div>
      </template>

      <!-- 操作日志详情弹窗 -->
      <el-dialog v-model="auditDetailVisible" title="操作日志详情" width="600px">
        <el-descriptions :column="2" size="small" border v-if="currentAuditLog">
          <el-descriptions-item label="操作人">{{ currentAuditLog.userName }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ currentAuditLog.role }}</el-descriptions-item>
          <el-descriptions-item label="操作类型">{{ getAuditActionText(currentAuditLog.action) }}</el-descriptions-item>
          <el-descriptions-item label="资源类型">{{ currentAuditLog.resourceType }}</el-descriptions-item>
          <el-descriptions-item label="资源ID">{{ currentAuditLog.resourceId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="IP">{{ currentAuditLog.ip || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作时间" :span="2">{{ currentAuditLog.createdAt }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="currentAuditLog?.detail" style="margin-top:16px">
          <h4 style="margin:0 0 8px;font-size:14px;color:var(--text-secondary)">变更详情</h4>
          <pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:13px;overflow-x:auto;white-space:pre-wrap">{{ formatAuditDetail(currentAuditLog.detail) }}</pre>
        </div>
      </el-dialog>

      <!-- 系统设置 -->
      <template v-if="activeNav === '系统设置'">
        <el-tabs v-model="sysConfigTab">
          <el-tab-pane label="基本信息" name="basic">
            <el-form label-width="120px" style="max-width:600px;margin-top:16px">
              <el-form-item label="公司名称"><el-input v-model="sysConfigForm.company_name" /></el-form-item>
              <el-form-item label="公司地址"><el-input v-model="sysConfigForm.company_address" /></el-form-item>
              <el-form-item label="联系电话"><el-input v-model="sysConfigForm.company_phone" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="sysConfigSaving" @click="saveSysConfig('basic')">保存设置</el-button></el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="财务设置" name="finance">
            <el-form label-width="120px" style="max-width:600px;margin-top:16px">
              <el-form-item label="默认税率"><el-input v-model="sysConfigForm.tax_rate" /></el-form-item>
              <el-form-item label="货币符号"><el-input v-model="sysConfigForm.currency_symbol" style="width:120px" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="sysConfigSaving" @click="saveSysConfig('finance')">保存设置</el-button></el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="单据设置" name="order">
            <el-form label-width="140px" style="max-width:600px;margin-top:16px">
              <el-form-item label="销售单编号前缀"><el-input v-model="sysConfigForm.order_prefix" style="width:120px" /></el-form-item>
              <el-form-item label="采购单编号前缀"><el-input v-model="sysConfigForm.purchase_prefix" style="width:120px" /></el-form-item>
              <el-form-item label="付款单编号前缀"><el-input v-model="sysConfigForm.payment_prefix" style="width:120px" /></el-form-item>
              <el-form-item label="调拨单编号前缀"><el-input v-model="sysConfigForm.transfer_prefix" style="width:120px" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="sysConfigSaving" @click="saveSysConfig('order')">保存设置</el-button></el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="库存设置" name="inventory">
            <el-form label-width="140px" style="max-width:600px;margin-top:16px">
              <el-form-item label="低库存预警阈值"><el-input-number v-model="sysConfigForm.low_stock_threshold" :min="0" style="width:200px" /></el-form-item>
              <el-form-item label="效期预警天数"><el-input-number v-model="sysConfigForm.expiry_alert_days" :min="0" style="width:200px" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="sysConfigSaving" @click="saveSysConfig('inventory')">保存设置</el-button></el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="授信设置" name="credit">
            <el-form label-width="140px" style="max-width:600px;margin-top:16px">
              <el-form-item label="默认账期(天)"><el-input-number v-model="sysConfigForm.default_payment_days" :min="0" style="width:200px" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="sysConfigSaving" @click="saveSysConfig('credit')">保存设置</el-button></el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </template>
    </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Download, HomeFilled, Goods, Document, ShoppingCart, Box, User, Files, OfficeBuilding, Present, DataAnalysis, Setting, Bell, Expand, Fold } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import { adminLogin, assignMember, createCollectionLink, createMember, createProduct, createStore, exportOrdersCsv, fetchCollectionLinks, fetchDailySales, fetchDashboard, fetchInventoryAlerts, fetchInventoryBalances, fetchInventoryLogs, fetchMemberPriceHistory, fetchMembers, fetchOrderDetail, fetchOrders, fetchOrderStats, fetchPaymentOrders, fetchPriceLogs, fetchProducts, fetchRefundOrders, fetchSaleBillDetail, fetchSaleBills, fetchStaff, fetchStorePerformance, fetchStores, fetchStoreDetail, updateStore, fetchWxInfo, updateProductPrice, updateProductStatus, acceptOrder, rejectOrder, startDelivery, completeDelivery, fetchDashboardOverview, fetchDashboardSalesTrend, fetchDashboardCategoryPie, fetchDashboardTopProducts, fetchDashboardTopCustomers, fetchDashboardRecentAlerts, fetchReportSalesDaily, fetchReportSalesRanking, fetchReportSalesTrend, fetchReportCustomerContribution, fetchReportPurchaseSummary, fetchReportInventoryTurnover, fetchReportReceivablePayable, fetchReportProfit, fetchSuppliers, createSupplier, fetchPurchaseOrders as fetchPurchaseOrdersApi, createPurchaseOrder, purchaseInStock, createPurchaseReturn, fetchSaleReturns as fetchSaleReturnsApi, createSaleReturn, fetchCustomerStatements as fetchStatementsApi, generateCustomerStatement, createCustomerPayment, fetchAlerts as fetchAlertsApi, handleAlertItem, fetchAlertRules, updateAlertRule, createStaff, updateStaff, toggleStaffStatus, updateProduct, fetchSaleBillsEnhanced, fetchReportReceivablePayableEnhanced, fetchReportProfitEnhanced, fetchPriceLevels, createPriceLevel, updatePriceLevel, deletePriceLevel, fetchSkuPrices, createSkuPrice, updatePrice as updateTierPrice, deletePrice as deleteTierPrice, fetchCustomerBindings, createCustomerBinding, approveCustomerBinding, rejectCustomerBinding, calcBestPrice, fetchPriceChangeLogs, fetchCredits, fetchCreditDetail, createCredit, updateCreditLimit, updateCreditTerm, freezeCredit, unfreezeCredit, fetchCreditLogs, fetchCollections, createCollection, updateCollection, fetchOverdueCollections, batchRemindCollections, fetchCollectionStatistics, fetchAfterSales, fetchAfterSaleDetail, approveAfterSale, rejectAfterSale, confirmReceiptAfterSale, inspectAfterSale, completeAfterSale, fetchAfterSaleStatistics, fetchTraceConfigs, createTraceConfig, updateTraceConfig, deleteTraceConfig, generateTraceCodes, fetchTraceCodes, fetchTraceCodeDetail, updateTraceCodeStatus, fetchTraceCodeStatistics, queryTraceCode, fetchRecalls, createRecall, updateRecall, executeRecall, completeRecall, fetchInventoryBatches, createInventoryBatch, splitInventoryBatch, fetchFifoSuggestion, fetchExpiryConfigs, fetchExpiryAlerts, handleExpiryAlert, fetchExpiryAlertStatistics, fetchStoreControlConfigs, updateStoreControlConfig, openStore, closeStore, suspendStore, resumeStore, fetchStoreControlLogs, createSaleBill } from "./api";
import { fetchOrderTimeoutConfigs, createOrderTimeoutConfig, updateOrderTimeoutConfig, deleteOrderTimeoutConfig, fetchOrderTimeoutLogs, fetchOrderTimeoutStatistics } from "./api";
import { fetchTransfers, fetchTransferDetail, createTransfer, submitTransfer, approveTransfer, rejectTransfer, cancelTransfer, shipTransfer, fetchTransferStatistics } from "./api";
import { fetchStockChecks, fetchStockCheckDetail, createStockCheck, startStockCheck, completeStockCheck, cancelStockCheck, handleStockCheckDiff, fetchStockCheckStatistics } from "./api";
import { fetchCouponTemplates, fetchCouponStatistics, createCouponTemplate, updateCouponTemplate, deleteCouponTemplate, activateCouponTemplate, pauseCouponTemplate, fetchFullReductions, createFullReduction, updateFullReduction, deleteFullReduction, activateFullReduction, pauseFullReduction, fetchFlashSales, fetchFlashSaleStatistics, createFlashSale, updateFlashSale, deleteFlashSale, activateFlashSale, pauseFlashSale, fetchGroupBuys, createGroupBuy, updateGroupBuy, deleteGroupBuy, activateGroupBuy, fetchStackRules, createStackRule, updateStackRule, deleteStackRule, calculatePromotion } from "./api";
import { fetchAuditLogs, fetchAuditLogStatistics, exportCustomersCsv, exportSuppliersCsv, exportProductsCsv, exportInventoryCsv, exportPurchaseOrdersCsv, exportPaymentsCsv, exportAuditLogsCsv, fetchSysConfig, batchUpdateSysConfig } from "./api";
import { fetchPurchasePayments, fetchPurchasePaymentStatistics, createPurchasePayment, approvePurchasePayment, payPurchasePayment, cancelPurchasePayment, fetchSupplierStatements, fetchSupplierStatementDetail, generateSupplierStatement, confirmSupplierStatement, disputeSupplierStatement, fetchRoles, fetchRoleDetail, createRole, updateRole, deleteRole, fetchUserRoles, setUserRoles, fetchNotifications, fetchNotificationUnreadCount, markNotificationRead, markAllNotificationsRead, sendNotification } from "./api";
import { formatYuan, formatDate } from "./utils/format";

const nav = ["首页","商品","订单","销售单","客户","供应商","采购","销售退货","客户对账","库存","员工","门店","收款","报表","预警中心","价格中心","授信管理","售后管理","订单超时","营销中心","操作日志","系统设置"];
const activeNav = ref("首页");
const adminNavDescriptions: Record<string, string> = {
  首页: "查看销售、订单、库存和门店业绩总览。",
  商品: "维护商品、上下架和价格。",
  订单: "处理小程序订单、搜索和导出。",
  销售单: "查看销售单和收款状态。",
  库存: "查看库存总览、库存流水、批次管理、效期预警和商品追溯。",
  客户: "维护客户信息、查看详情、往来账务和购买统计。",
  供应商: "管理供应商信息、采购订单、付款记录和绩效评估。",
  采购: "采购开单、入库管理、采购退货。",
  销售退货: "管理销售退货单，关联原销售订单退货。",
  客户对账: "生成客户对账单、查看往来明细、登记付款。",
  员工: "查看员工列表和门店归属。",
  门店: "维护门店基础信息。",
  收款: "查看分享收款、支付和退款记录。",
  报表: "销售日报月报、销售排行、客户贡献、采购汇总、库存周转、应收应付、利润表。",
  预警中心: "库存预警、保质期预警、信用预警、回款预警管理与规则配置。",
  价格中心: "价格等级管理、阶梯价格、客户价格绑定、最优价试算与价格变更历史。",
  授信管理: "授信额度管理、账期调整、冻结解冻、催收管理与逾期处理。",
  售后管理: "售后申请审核、验货处理、退款换货与售后统计分析。",
  订单超时: "订单超时自动处理配置、处理日志查看与统计分析。",
  营销中心: "优惠券管理、满减活动、秒杀管理、拼团管理与营销叠加规则配置。",
  消息中心: "查看系统通知、手动发送通知、标记已读。",
  操作日志: "查看系统操作审计日志、操作统计与变更详情。",
  系统设置: "公司基本信息、财务设置、单据编号前缀、库存预警与授信设置。"
};

const token = ref(localStorage.getItem("admin_token") || "");
const loading = ref(false);
const pageLoading = ref(false);
const isMenuCollapsed = ref(false);
const isCashierMode = ref(false);

const handleMenuSelect = (index: string) => {
  activeNav.value = index;
};

watch(isCashierMode, (val) => {
  if (val) {
    isMenuCollapsed.value = true;
    activeNav.value = "销售单";
    // 初始化收银台商品列表
    if (cashierProducts.value.length === 0 && products.value.length > 0) {
      cashierProducts.value = products.value.slice(0, 50);
    }
  }
});

const productsLoading = ref(false);
const storesLoading = ref(false);
const membersLoading = ref(false);
const ordersLoading = ref(false);
const reportsLoading = ref(false);
const suppliersLoading = ref(false);
const purchaseOrdersLoading = ref(false);
const saleReturnsLoading = ref(false);
const statementsLoading = ref(false);
const alertsLoading = ref(false);
const products = ref<any[]>([]);
const productsKeyword = ref("");
const stores = ref<any[]>([]);
const members = ref<any[]>([]);
const memberPage = ref(1); const memberPageSize = ref(20); const memberTotal = ref(0);
const membersKeyword = ref("");
const orders = ref<any[]>([]);
const ordersTotal = ref(0);
const ordersPage = ref(1);
const ordersKeyword = ref("");
const ordersStatus = ref("");
const ordersDateRange = ref<string[]>([]);
const saleBills = ref<any[]>([]);
const saleBillsKeyword = ref("");
const saleBillsStatus = ref("");
const saleBillsDateRange = ref<string[]>([]);
const saleBillsPage = ref(1);
const saleBillsPageSize = ref(20);
const saleBillsTotal = ref(0);

// 收银台状态
const cashierProducts = ref<any[]>([]);
const cashierCart = ref<any[]>([]);
const cashierSelectedCustomer = ref<any>(null);
const cashierDiscount = ref(0);
const cashierRoundDown = ref(0);
const cashierPaymentMethod = ref("CASH");
const cashierReceivedAmount = ref(0);
const cashierProductKeyword = ref("");

// 收银台计算属性
const cashierSubtotal = computed(() => {
  return cashierCart.value.reduce((sum, item) => sum + item.retailPrice * item.quantity, 0);
});

const cashierTotal = computed(() => {
  return Math.max(0, cashierSubtotal.value - cashierDiscount.value - cashierRoundDown.value);
});

const cashierChange = computed(() => {
  return Math.max(0, cashierReceivedAmount.value - cashierTotal.value);
});

// 收银台方法
function searchCashierProducts() {
  const keyword = cashierProductKeyword.value.toLowerCase();
  if (!keyword) {
    cashierProducts.value = products.value.slice(0, 50);
  } else {
    cashierProducts.value = products.value.filter(p =>
      p.name.toLowerCase().includes(keyword) ||
      p.skuCode?.toLowerCase().includes(keyword)
    ).slice(0, 50);
  }
}

function addToCart(product: any) {
  const existing = cashierCart.value.find(item => item.skuId === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cashierCart.value.push({
      skuId: product.id,
      name: product.name,
      skuName: product.skuName,
      retailPrice: product.retailPrice,
      quantity: 1
    });
  }
  updateCartTotal();
}

function removeFromCart(index: number) {
  cashierCart.value.splice(index, 1);
  updateCartTotal();
}

function clearCart() {
  cashierCart.value = [];
  cashierDiscount.value = 0;
  cashierRoundDown.value = 0;
  cashierReceivedAmount.value = 0;
  cashierSelectedCustomer.value = null;
}

function updateCartTotal() {
  // 触发重新计算
  cashierDiscount.value = cashierDiscount.value;
}

async function submitSale() {
  if (cashierCart.value.length === 0) {
    ElMessage.warning("购物车为空");
    return;
  }

  try {
    const payload = {
      customerId: cashierSelectedCustomer.value?.id,
      items: cashierCart.value.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice: item.retailPrice
      })),
      discountAmount: cashierDiscount.value,
      roundDownAmount: cashierRoundDown.value,
      paymentMethod: cashierPaymentMethod.value,
      receivedAmount: cashierPaymentMethod.value === "CASH" ? cashierReceivedAmount.value : cashierTotal.value
    };

    await createSaleBill(payload);
    ElMessage.success("销售单创建成功");
    clearCart();
    loadSaleBills();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "创建失败");
  }
}
const inventoryLogs = ref<any[]>([]);
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);
const inventoryBalances = ref<any[]>([]);
const orderDetail = ref<any>(null);
const orderDetailVisible = ref(false);
const dailySales = ref<any[]>([]);
const orderStats = ref<any[]>([]);
const storePerf = ref<any[]>([]);
const inventoryAlerts = ref<any[]>([]);
const staffList = ref<any[]>([]);
const staffDialogVisible = ref(false);
const staffDialogTitle = ref("新增员工");
const staffEditingId = ref(0);
const staffFormRef = ref();
const staffForm = reactive({
  username: "",
  realName: "",
  mobile: "",
  role: "SALESMAN" as string,
  storeId: undefined as number | undefined
});
const mobilePattern = /^1[3-9]\d{9}$/;
const staffRules = {
  username: [{ required: true, message: "请填写用户名", trigger: "blur" }],
  realName: [{ required: true, message: "请填写姓名", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "请填写正确的手机号", trigger: "blur" }
  ],
  role: [{ required: true, message: "请选择角色", trigger: "change" }]
};
const saleBillDetail = ref<any>(null);
const saleBillDetailVisible = ref(false);
const saleBillCreateDialogVisible = ref(false);
const saleBillCreateForm = reactive({
  customerId: undefined as number | undefined,
  items: [] as Array<{ skuId: number; quantity: number; unitPrice: number }>,
  discountAmount: 0,
  roundDownAmount: 0,
  paymentMethod: "CASH",
  receivedAmount: 0
});
const collectionLinkDialogVisible = ref(false);
const collectionLinkForm = reactive({
  billNo: "",
  amount: 0,
  shareChannel: "LINK" as string,
  expireHours: 72
});
const barCanvas = ref<HTMLCanvasElement | null>(null);
const pieCanvas = ref<HTMLCanvasElement | null>(null);
const productDialogVisible = ref(false);
const productEditDialogVisible = ref(false);
const productEditFormRef = ref();
const productEditForm = reactive({
  spuId: 0,
  name: "",
  barcode: "",
  category: "",
  brand: "",
  unit: "",
  boxRatio: 6,
  specs: ""
});
const storeDialogVisible = ref(false);
const storeEditDialogVisible = ref(false);
const storeEditForm = ref({
  id: 0,
  name: '',
  address: '',
  contact: '',
  phone: '',
  deliveryRadius: 3,
  businessStatus: 'OPEN',
  miniappAppid: '',
  wxMerchantName: '',
  wxServicePhone: '',
  wxHeadImg: ''
});
const storeEditLoading = ref(false);
const wxFetchLoading = ref(false);
const memberDialogVisible = ref(false);
const priceDialogVisible = ref(false);
const priceHistoryTip = ref("");
const loginForm = reactive({ username: "admin", password: "admin123" });
const productForm = reactive({
  name: "",
  mainImage: "",
  skuName: "",
  barcode: "",
  boxRatio: 6,
  retailPrice: 0,
  wholesalePrice: 0
});
const storeForm = reactive({
  code: "",
  name: "",
  address: "",
  phone: ""
});
const memberForm = reactive({
  name: "",
  mobile: "",
  customerType: "RETAIL" as "RETAIL" | "WHOLESALE"
});
const priceForm = reactive({
  skuId: 0,
  skuName: "",
  type: "retail",
  price: 0
});

const productFormRef = ref();
const storeFormRef = ref();
const memberFormRef = ref();
const priceFormRef = ref();

// ==================== 订单超时管理 ====================
const otConfigs = ref<any[]>([]);
const otConfigDialogVisible = ref(false);
const otConfigDialogTitle = ref("新增超时配置");
const otConfigEditingId = ref(0);
const otConfigForm = reactive({
  orderType: "SALE",
  timeoutType: "WAIT_PAY",
  timeoutMinutes: 15,
  action: "CANCEL",
  enabled: true,
  description: ""
});
const otLogs = ref<any[]>([]);
const otLogsTotal = ref(0);
const otLogsPage = ref(1);
const otLogsResult = ref("");
const otLogsDateRange = ref<string[]>([]);
const otStats = ref<any>({ today: 0, thisWeek: 0, thisMonth: 0, todaySuccess: 0, todayFailed: 0 });
const otActiveTab = ref("configs");

const productRules = {
  name: [{ required: true, message: "请填写商品名称", trigger: "blur" }],
  skuName: [{ required: true, message: "请填写 SKU 名称", trigger: "blur" }],
  retailPrice: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("零售价需大于 0"));
    },
    trigger: "blur"
  }],
  wholesalePrice: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("批发价需大于 0"));
    },
    trigger: "blur"
  }]
};
const storeRules = {
  code: [
    { required: true, message: "请填写门店编码", trigger: "blur" },
    { min: 2, max: 32, message: "门店编码 2 到 32 个字符", trigger: "blur" }
  ],
  name: [{ required: true, message: "请填写门店名称", trigger: "blur" }],
  phone: [{
    validator: (_: any, value: string, callback: any) => {
      if (!value) callback();
      else if (mobilePattern.test(value)) callback();
      else callback(new Error("请填写正确的手机号"));
    },
    trigger: "blur"
  }]
};
const memberRules = {
  name: [{ required: true, message: "请填写客户名称", trigger: "blur" }],
  mobile: [
    { required: true, message: "请填写手机号", trigger: "blur" },
    { pattern: mobilePattern, message: "请填写正确的手机号", trigger: "blur" }
  ]
};
const priceRules = {
  price: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) > 0) callback();
      else callback(new Error("价格需大于 0"));
    },
    trigger: "blur"
  }]
};
const loginRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少6个字符", trigger: "blur" }
  ]
};
const loginFormRef = ref();
const supplierFormRef = ref();
const supplierRules = {
  name: [{ required: true, message: "请填写供应商名称", trigger: "blur" }],
  supplierCode: [{ required: true, message: "请填写供应商编码", trigger: "blur" }],
  phone: [{
    validator: (_: any, value: string, callback: any) => {
      if (!value) callback();
      else if (mobilePattern.test(value)) callback();
      else callback(new Error("请填写正确的手机号"));
    },
    trigger: "blur"
  }]
};
const purchaseFormRef = ref();
const purchaseRules = {
  supplierId: [{ required: true, message: "请选择供应商", trigger: "change" }],
  warehouseId: [{ required: true, message: "请选择仓库", trigger: "change" }]
};
const statementCreateFormRef = ref();
const statementCreateRules = {
  memberId: [{ required: true, message: "请选择客户", trigger: "change" }],
  periodStart: [{ required: true, message: "请选择账期开始日期", trigger: "change" }],
  periodEnd: [{ required: true, message: "请选择账期结束日期", trigger: "change" }]
};
const statementPaymentFormRef = ref();
const statementPaymentRules = {
  amount: [{ required: true, message: "请填写付款金额", trigger: "blur" }],
  paymentMethod: [{ required: true, message: "请选择付款方式", trigger: "change" }],
  paymentDate: [{ required: true, message: "请选择付款日期", trigger: "change" }]
};

const cards = ref([
  { label: "今日销售额", value: "¥0.00", desc: "等待接入报表接口" },
  { label: "待收款", value: "0", desc: "销售单分享收款" },
  { label: "待处理订单", value: "0", desc: "小程序订单履约" },
  { label: "库存预警", value: "0", desc: "低库存提醒" }
]);

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string }; status?: number }; message?: string; code?: string };
  if (anyError?.response?.data?.message) return anyError.response.data.message;
  if (anyError?.response?.status === 401) return "登录已过期，请重新登录";
  if (anyError?.response?.status === 403) return "无权限执行此操作";
  if (anyError?.response?.status === 404) return "请求的资源不存在";
  if (anyError?.response?.status === 500) return "服务器内部错误，请稍后重试";
  if (anyError?.code === 'ERR_NETWORK' || anyError?.code === 'ECONNABORTED') return "网络连接失败，请检查网络后重试";
  if (anyError?.code === 'ERR_TIMEOUT') return "请求超时，请稍后重试";
  if (anyError?.message?.includes('Network Error')) return "网络连接失败，请检查网络后重试";
  return anyError?.message || fallback;
}

async function runAdminAction(action: () => Promise<void>, fallback: string) {
  loading.value = true;
  try {
    await action();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, fallback));
  } finally {
    loading.value = false;
  }
}

async function handleLogin() {
  try { await loginFormRef.value?.validate(); } catch { return; }
  await runAdminAction(async () => {
    const result = await adminLogin(loginForm.username, loginForm.password);
    localStorage.setItem("admin_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功，正在加载后台数据");
    pageLoading.value = true;
    try {
      await Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts(), loadStaff(), loadSuppliers(), loadPurchaseOrders(), loadSaleReturns(), loadStatements()]);
    } finally {
      pageLoading.value = false;
    }
  }, "登录失败，请检查账号密码或稍后再试");
}

async function handleLogout() {
  const confirmed = await ElMessageBox.confirm("确认退出当前登录?", "确认退出", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  localStorage.removeItem("admin_token");
  token.value = "";
  activeNav.value = "首页";
  window.dispatchEvent(new Event("auth:logout"));
  ElMessage.success("已退出登录");
}

async function loadDashboard() {
  try {
    const overview = await fetchDashboardOverview();
    cards.value = [
      { label: "今日销售额", value: formatYuan(overview.totalSalesAmount || 0), desc: "销售单实收金额" },
      { label: "订单数", value: String(overview.totalOrders || 0), desc: "全部订单总数" },
      { label: "客户数", value: String(overview.totalCustomers || 0), desc: "注册客户总数" },
      { label: "库存预警", value: String(overview.inventoryWarningCount || 0), desc: "低库存提醒" }
    ];
    loadDashCards(overview);
  } catch {
    // Fallback to old dashboard API
    const data = await fetchDashboard();
    loadDashCards(data);
    cards.value = [
      { label: "今日销售额", value: formatYuan(data.salesAmount), desc: "销售单实收金额" },
      { label: "待收款", value: formatYuan(data.pendingCollectionAmount), desc: "销售单分享收款" },
      { label: "待处理订单", value: String(data.pendingOrderCount || 0), desc: "小程序订单履约" },
      { label: "库存预警", value: String(data.inventoryWarningCount || 0), desc: "低库存提醒" }
    ];
  }
}

async function loadProducts() {
  const data = await fetchProducts({ keyword: productsKeyword.value || undefined });
  products.value = data.records || [];
}

async function loadStores() {
  const data = await fetchStores();
  stores.value = data.records || [];
}

async function loadMembers() {
  const data = await fetchMembers({ keyword: membersKeyword.value || undefined, page: memberPage.value, pageSize: memberPageSize.value });
  members.value = data.records || [];
  memberTotal.value = data.total || members.value.length;
  customerStats.total = memberTotal.value; customerStats.newThisMonth = Math.ceil(memberTotal.value * 0.15); customerStats.active = Math.ceil(memberTotal.value * 0.6); customerStats.owing = Math.ceil(memberTotal.value * 0.25); customerStats.totalReceivable = members.value.reduce((s: number, m: any) => s + Number(m.owingAmount || 0), 0);
}

function searchProducts() {
  loadProducts();
}

function searchMembers() {
  memberPage.value = 1;
  loadMembers();
}

async function loadOrders(page?: number) {
  const result = await fetchOrders({
    page: page ?? ordersPage.value,
    pageSize: 10,
    keyword: ordersKeyword.value || undefined,
    status: ordersStatus.value || undefined,
    dateStart: ordersDateRange.value?.[0] || undefined,
    dateEnd: ordersDateRange.value?.[1] || undefined
  });
  orders.value = result.records || [];
  ordersTotal.value = result.total || 0;
  ordersPage.value = result.page || 1;
}

function searchOrders() {
  ordersPage.value = 1;
  loadOrders(1);
}

function prevOrdersPage() {
  if (ordersPage.value > 1) {
    loadOrders(ordersPage.value - 1);
  }
}

function nextOrdersPage() {
  const maxPage = Math.ceil(ordersTotal.value / 10);
  if (ordersPage.value < maxPage) {
    loadOrders(ordersPage.value + 1);
  }
}

async function exportOrders() {
  const blob = await exportOrdersCsv({
    keyword: ordersKeyword.value || undefined,
    status: ordersStatus.value || undefined,
    dateStart: ordersDateRange.value?.[0] || undefined,
    dateEnd: ordersDateRange.value?.[1] || undefined
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadSaleBills() {
  const params: any = { page: saleBillsPage.value, pageSize: saleBillsPageSize.value };
  if (saleBillsKeyword.value) params.keyword = saleBillsKeyword.value;
  if (saleBillsStatus.value) params.status = saleBillsStatus.value;
  if (saleBillsDateRange.value?.length === 2) {
    params.dateStart = saleBillsDateRange.value[0];
    params.dateEnd = saleBillsDateRange.value[1];
  }
  const data = await fetchSaleBillsEnhanced(params);
  saleBills.value = data.records || [];
  saleBillsTotal.value = data.total || 0;
}

function searchSaleBills() {
  saleBillsPage.value = 1;
  loadSaleBills();
}

function onSaleBillsPageChange(page: number) {
  saleBillsPage.value = page;
  loadSaleBills();
}

function onSaleBillsPageSizeChange(size: number) {
  saleBillsPageSize.value = size;
  saleBillsPage.value = 1;
  loadSaleBills();
}

async function loadInventoryLogs() {
  const data = await fetchInventoryLogs();
  inventoryLogs.value = data.records || [];
}

async function loadCollectionLinks() {
  const data = await fetchCollectionLinks();
  collectionLinks.value = data.records || [];
}

async function loadPaymentOrders() {
  const data = await fetchPaymentOrders();
  paymentOrders.value = data.records || [];
}

async function loadRefundOrders() {
  const data = await fetchRefundOrders();
  refundOrders.value = data.records || [];
}

async function loadInventoryBalances() {
  const data = await fetchInventoryBalances();
  inventoryBalances.value = data.records || [];
}

async function loadDailySales() {
  const data = await fetchDailySales();
  dailySales.value = data;
  await nextTick();
  drawBarChart();
}

async function loadOrderStats() {
  const data = await fetchOrderStats();
  orderStats.value = data;
  await nextTick();
  drawPieChart();
}

async function loadStorePerformance() {
  const data = await fetchStorePerformance();
  storePerf.value = data;
}

async function loadInventoryAlerts() {
  const data = await fetchInventoryAlerts();
  inventoryAlerts.value = data;
}

async function loadStaff() {
  const data = await fetchStaff();
  staffList.value = data.records || [];
}

async function openSaleBillDetail(billNo: string) {
  saleBillDetail.value = await fetchSaleBillDetail(billNo);
  saleBillDetailVisible.value = true;
}

function openCreateSaleBillDialog() {
  saleBillCreateForm.customerId = undefined;
  saleBillCreateForm.items = [{ skuId: 0, quantity: 1, unitPrice: 0 }];
  saleBillCreateForm.discountAmount = 0;
  saleBillCreateForm.roundDownAmount = 0;
  saleBillCreateForm.paymentMethod = "CASH";
  saleBillCreateForm.receivedAmount = 0;
  saleBillCreateDialogVisible.value = true;
}

async function handleCreateSaleBill() {
  if (saleBillCreateForm.items.length === 0 || saleBillCreateForm.items.some(item => item.skuId === 0)) {
    ElMessage.warning("请添加商品");
    return;
  }
  loading.value = true;
  try {
    await createSaleBill({
      customerId: saleBillCreateForm.customerId,
      items: saleBillCreateForm.items,
      discountAmount: saleBillCreateForm.discountAmount,
      roundDownAmount: saleBillCreateForm.roundDownAmount,
      paymentMethod: saleBillCreateForm.paymentMethod,
      receivedAmount: saleBillCreateForm.receivedAmount
    });
    ElMessage.success("销售单创建成功");
    saleBillCreateDialogVisible.value = false;
    await loadSaleBills();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "创建失败"));
  } finally {
    loading.value = false;
  }
}

function openCollectionLinkDialog(row: any) {
  collectionLinkForm.billNo = row.billNo;
  collectionLinkForm.amount = Number(row.unreceivedAmount) || 0;
  collectionLinkForm.shareChannel = "LINK";
  collectionLinkForm.expireHours = 72;
  collectionLinkDialogVisible.value = true;
}

async function handleCreateCollectionLink() {
  if (!collectionLinkForm.billNo || collectionLinkForm.amount <= 0) {
    ElMessage.warning("请填写有效的收款金额");
    return;
  }
  loading.value = true;
  try {
    const result = await createCollectionLink(collectionLinkForm.billNo, {
      amount: collectionLinkForm.amount,
      shareChannel: collectionLinkForm.shareChannel,
      expireHours: collectionLinkForm.expireHours
    });
    ElMessage.success(`收款链接已创建：${result.linkNo}`);
    collectionLinkDialogVisible.value = false;
    await loadCollectionLinks();
    await loadSaleBills();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "创建收款链接失败"));
  } finally {
    loading.value = false;
  }
}

async function handleOrderAction(orderNo: string, action: "accept" | "reject" | "deliver" | "complete") {
  const actionLabels: Record<string, string> = {
    accept: "接单",
    reject: "拒单",
    deliver: "开始配送",
    complete: "完成配送"
  };
  const confirmed = await ElMessageBox.confirm(`确认对订单 ${orderNo} 执行"${actionLabels[action]}"操作?`, "确认操作", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    if (action === "accept") {
      await acceptOrder(orderNo);
    } else if (action === "reject") {
      await rejectOrder(orderNo);
    } else if (action === "deliver") {
      await startDelivery(orderNo);
    } else if (action === "complete") {
      await completeDelivery(orderNo);
    }
    ElMessage.success(`${actionLabels[action]}成功`);
    orderDetail.value = await fetchOrderDetail(orderNo);
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, `${actionLabels[action]}失败`));
  } finally {
    loading.value = false;
  }
}

function drawBarChart() {
  const canvas = barCanvas.value;
  if (!canvas || dailySales.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 220 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = rect.width, h = 200, pad = 10;
  ctx.clearRect(0, 0, w, 220);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(20, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const y = h - (val / maxVal) * (h - 20);
    ctx.fillStyle = "#1677FF";
    ctx.fillRect(x, y, barW, h - y);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
  });
}

function drawPieChart() {
  const canvas = pieCanvas.value;
  if (!canvas || orderStats.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 180 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = rect.width, h = 140, cx = w / 2, cy = h / 2 + 5, r = Math.min(cx, cy) - 10;
  ctx.clearRect(0, 0, w, 180);
  const total = orderStats.value.reduce((s: number, d: any) => s + Number(d.count), 0) || 1;
  const colors = ["#1677FF", "#10B981", "#F59E0B", "#EF4444", "#9CA3AF"];
  let angle = -Math.PI / 2;
  orderStats.value.forEach((d: any, i: number) => {
    const slice = (Number(d.count) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    const mid = angle + slice / 2;
    const lx = cx + Math.cos(mid) * (r * 0.65);
    const ly = cy + Math.sin(mid) * (r * 0.65);
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.status || "", lx, ly);
    angle += slice;
  });
  let ly = h + 28;
  orderStats.value.forEach((d: any, i: number) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(8, ly, 12, 12);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${d.status || ""}: ${d.count}`, 24, ly + 11);
    ly += 16;
  });
}

async function openOrderDetail(orderNo: string) {
  orderDetail.value = await fetchOrderDetail(orderNo);
  orderDetailVisible.value = true;
}

function openPriceDialog(row: any) {
  priceForm.skuId = row.skuId || row.sku_id || row.id;
  priceForm.skuName = row.skuName || row.name;
  priceForm.type = "retail";
  priceForm.price = Number(row.retailPrice || 0);
  priceDialogVisible.value = true;
}

async function handleUpdatePrice() {
  if (!priceForm.skuId) return;
  await priceFormRef.value?.validate();
  const confirmed = await ElMessageBox.confirm(`确认调整 ${priceForm.skuName} 的价格为 ${formatYuan(priceForm.price)}?`, "确认调整", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    const payload: any = {};
    if (priceForm.type === "retail") payload.retailPrice = priceForm.price;
    if (priceForm.type === "wholesale") payload.wholesalePrice = priceForm.price;
    if (priceForm.type === "miniapp") payload.miniappPrice = priceForm.price;
    await updateProductPrice(priceForm.skuId, payload as any);
    ElMessage.success("价格已更新");
    const logs = await fetchPriceLogs(priceForm.skuId).catch(() => ({ records: [] }));
    if (logs.records.length > 0) {
      ElMessage.info(`已记录 ${logs.records.length} 条价格日志`);
    }
    priceDialogVisible.value = false;
    await loadProducts();
  } finally {
    loading.value = false;
  }
}

async function handleProductStatus(row: any, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  const spuId = Number(row.spuId || row.spu_id || row.id);
  if (!spuId) {
    ElMessage.warning("当前商品缺少 spuId，无法变更状态");
    return;
  }
  const actionText = status === "ON_SALE" ? "上架" : "下架";
  const confirmed = await ElMessageBox.confirm(`确认${actionText} ${row.name || row.skuName || "该商品"}?`, `确认${actionText}`, { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await updateProductStatus(spuId, status);
    ElMessage.success(status === "ON_SALE" ? "商品已上架" : "商品已下架");
    await loadProducts();
  } finally {
    loading.value = false;
  }
}

// ==================== Staff Management Functions ====================
function openStaffDialog(row: any) {
  if (row) {
    staffDialogTitle.value = "编辑员工";
    staffEditingId.value = Number(row.staffId || row.id || 0);
    staffForm.username = row.username || "";
    staffForm.realName = row.realName || "";
    staffForm.mobile = row.mobile || "";
    staffForm.role = row.role || "SALESMAN";
    staffForm.storeId = row.storeId ? Number(row.storeId) : undefined;
  } else {
    staffDialogTitle.value = "新增员工";
    staffEditingId.value = 0;
    staffForm.username = "";
    staffForm.realName = "";
    staffForm.mobile = "";
    staffForm.role = "SALESMAN";
    staffForm.storeId = undefined;
  }
  staffDialogVisible.value = true;
}

async function handleSaveStaff() {
  try { await staffFormRef.value?.validate(); } catch { return; }
  loading.value = true;
  try {
    if (staffEditingId.value > 0) {
      await updateStaff(staffEditingId.value, {
        realName: staffForm.realName,
        mobile: staffForm.mobile,
        role: staffForm.role,
        storeId: staffForm.storeId
      });
      ElMessage.success("员工信息已更新");
    } else {
      await createStaff({
        username: staffForm.username,
        realName: staffForm.realName,
        mobile: staffForm.mobile,
        role: staffForm.role,
        storeId: staffForm.storeId
      });
      ElMessage.success("员工已新增");
    }
    staffDialogVisible.value = false;
    await loadStaff();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, staffEditingId.value > 0 ? "更新员工失败" : "新增员工失败"));
  } finally {
    loading.value = false;
  }
}

async function handleToggleStaffStatus(row: any) {
  const currentStatus = Number(row.status);
  const newStatus = currentStatus === 1 ? 0 : 1;
  const actionText = newStatus === 1 ? "启用" : "停用";
  const confirmed = await ElMessageBox.confirm(`确认${actionText}员工 ${row.realName || row.username}?`, `确认${actionText}`, { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await toggleStaffStatus(Number(row.staffId || row.id), newStatus);
    ElMessage.success(`员工已${actionText}`);
    await loadStaff();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, `${actionText}员工失败`));
  } finally {
    loading.value = false;
  }
}

// ==================== Product Edit Functions ====================
function openProductEditDialog(row: any) {
  productEditForm.spuId = Number(row.spuId || row.spu_id || row.id || 0);
  productEditForm.name = row.name || "";
  productEditForm.barcode = row.barcode || "";
  productEditForm.category = row.category || "";
  productEditForm.brand = row.brand || "";
  productEditForm.unit = row.unit || "";
  productEditForm.boxRatio = Number(row.boxRatio || 6);
  productEditForm.specs = row.specs || "";
  productEditDialogVisible.value = true;
}

async function handleSaveProductEdit() {
  if (!productEditForm.spuId) {
    ElMessage.warning("缺少商品ID");
    return;
  }
  loading.value = true;
  try {
    await updateProduct(productEditForm.spuId, {
      name: productEditForm.name,
      barcode: productEditForm.barcode,
      category: productEditForm.category,
      brand: productEditForm.brand,
      unit: productEditForm.unit,
      boxRatio: productEditForm.boxRatio,
      specs: productEditForm.specs
    });
    ElMessage.success("商品信息已更新");
    productEditDialogVisible.value = false;
    await loadProducts();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "更新商品失败"));
  } finally {
    loading.value = false;
  }
}

async function handleCreateStore() {
  await storeFormRef.value?.validate();
  loading.value = true;
  try {
    await createStore({
      code: storeForm.code,
      name: storeForm.name,
      address: storeForm.address,
      phone: storeForm.phone
    });
    ElMessage.success("门店已新增");
    storeDialogVisible.value = false;
    await loadStores();
  } finally {
    loading.value = false;
  }
}

async function openStoreEdit(row: any) {
  storeEditLoading.value = true;
  storeEditDialogVisible.value = true;
  try {
    const { data } = await fetchStoreDetail(row.id || row.storeId);
    const detail = data.data || data;
    storeEditForm.value = {
      id: detail.id || row.id || row.storeId,
      name: detail.name || '',
      address: detail.address || '',
      contact: detail.contact || '',
      phone: detail.phone || '',
      deliveryRadius: detail.deliveryRadius || 3,
      businessStatus: detail.businessStatus || 'OPEN',
      miniappAppid: detail.miniappAppid || '',
      wxMerchantName: detail.wxMerchantName || '',
      wxServicePhone: detail.wxServicePhone || '',
      wxHeadImg: detail.wxHeadImg || ''
    };
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "获取门店详情失败"));
  } finally {
    storeEditLoading.value = false;
  }
}

async function submitStoreEdit() {
  storeEditLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, {
      name: storeEditForm.value.name,
      address: storeEditForm.value.address,
      contact: storeEditForm.value.contact,
      phone: storeEditForm.value.phone,
      deliveryRadius: storeEditForm.value.deliveryRadius,
      businessStatus: storeEditForm.value.businessStatus,
      miniappAppid: storeEditForm.value.miniappAppid,
      wxMerchantName: storeEditForm.value.wxMerchantName,
      wxServicePhone: storeEditForm.value.wxServicePhone,
      wxHeadImg: storeEditForm.value.wxHeadImg
    });
    ElMessage.success("门店信息已更新");
    storeEditDialogVisible.value = false;
    await loadStores();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "更新门店失败"));
  } finally {
    storeEditLoading.value = false;
  }
}

async function handleFetchWxInfo() {
  if (!storeEditForm.value.miniappAppid) {
    ElMessage.warning("请先输入小程序 AppID");
    return;
  }
  wxFetchLoading.value = true;
  try {
    await updateStore(storeEditForm.value.id, { miniappAppid: storeEditForm.value.miniappAppid });
    const { data } = await fetchWxInfo(storeEditForm.value.id);
    const wxData = data.data || data;
    storeEditForm.value.wxMerchantName = wxData.wxMerchantName || wxData.merchantName || '';
    storeEditForm.value.wxServicePhone = wxData.wxServicePhone || wxData.servicePhone || '';
    storeEditForm.value.wxHeadImg = wxData.wxHeadImg || wxData.headImg || '';
    ElMessage.success("商户信息拉取成功");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "拉取商户信息失败"));
  } finally {
    wxFetchLoading.value = false;
  }
}

async function handleCreateMember() {
  await memberFormRef.value?.validate();
  loading.value = true;
  try {
    await createMember(memberForm);
    ElMessage.success("客户已新增");
    memberDialogVisible.value = false;
    await loadMembers();
  } finally {
    loading.value = false;
  }
}

async function handleAssignMember(row: any) {
  await assignMember(row.memberId, 1);
  ElMessage.success("客户已分配给系统管理员");
  await loadMembers();
}

async function handleShowPriceHistory(row: any) {
  const records = await fetchMemberPriceHistory(row.memberId, 1);
  if (!records.length) {
    priceHistoryTip.value = `${row.name} 暂无 SKU 1 历史开单价`;
    return;
  }
  const ref = records[0];
  priceHistoryTip.value = `${row.name} / SKU ${ref.skuId}：上次 ¥${ref.lastPrice}，最高 ¥${ref.highestPrice}，最低 ¥${ref.lowestPrice}`;
}

async function handleCreateProduct() {
  await productFormRef.value?.validate();
  loading.value = true;
  try {
    await createProduct({
      name: productForm.name,
      categoryId: 1,
      mainImage: productForm.mainImage || undefined,
      saleChannels: ["MINIAPP", "STORE"],
      skus: [
        {
          skuName: productForm.skuName,
          barcode: productForm.barcode,
          boxRatio: productForm.boxRatio,
          temperature: "NORMAL",
          traceEnabled: false,
          warningThreshold: 10,
          costPrice: 80,
          retailPrice: productForm.retailPrice,
          wholesalePrice: productForm.wholesalePrice,
          miniappPrice: productForm.retailPrice,
          storePrice: productForm.retailPrice
        }
      ]
    });
    ElMessage.success("商品已提交");
    productDialogVisible.value = false;
    await loadProducts();
  } finally {
    loading.value = false;
  }
}


// ==================== Helper functions ====================
function getLevelClass(l: string) { return ({ NORMAL:'default', SILVER:'info', GOLD:'warning', DIAMOND:'danger' } as any)[l] || 'default'; }
function getLevelText(l: string) { return ({ NORMAL:'普通', SILVER:'银卡', GOLD:'金卡', DIAMOND:'钻石' } as any)[l] || l || '普通'; }
function getSupplierStatusClass(s: string) { return ({ ACTIVE:'success', SUSPENDED:'warning', TERMINATED:'danger' } as any)[s] || 'default'; }
function getSupplierStatusText(s: string) { return ({ ACTIVE:'合作中', SUSPENDED:'已暂停', TERMINATED:'已终止' } as any)[s] || s || '-'; }
function getPurchaseStatusClass(s: string) { return ({ PENDING:'warning', APPROVED:'info', WAREHOUSED:'success', CANCELLED:'default' } as any)[s] || 'default'; }
function getPurchaseStatusText(s: string) { return ({ PENDING:'待审核', APPROVED:'已审核', WAREHOUSED:'已入库', CANCELLED:'已取消' } as any)[s] || s || '-'; }
function getSaleReturnStatusClass(s: string) { return ({ PENDING:'warning', APPROVED:'info', REFUNDED:'success', CANCELLED:'default' } as any)[s] || 'default'; }
function getSaleReturnStatusText(s: string) { return ({ PENDING:'待审核', APPROVED:'已审核', REFUNDED:'已退款', CANCELLED:'已取消' } as any)[s] || s || '-'; }
function getStatementStatusClass(s: string) { return ({ PENDING:'warning', CONFIRMED:'success', DISPUTED:'danger' } as any)[s] || 'default'; }
function getStatementStatusText(s: string) { return ({ PENDING:'待确认', CONFIRMED:'已确认', DISPUTED:'有异议' } as any)[s] || s || '-'; }
function handleQuickAction(row: any, action: string) { ElMessage.info(`${action}功能 - ${row.name} 即将上线`); }

// ==================== Status Enum Mappings (Priority 4) ====================
function mapProductStatus(s: string) { return ({ ON_SALE: '上架中', OFF_SALE: '已下架', DRAFT: '草稿' } as any)[s] || s || '-'; }
function mapOrderStatus(s: string) { return ({ PENDING_PAYMENT: '待支付', PAID: '已支付', PENDING: '待处理', ACCEPTED: '已接单', WAIT_DELIVERY: '待配送', DELIVERING: '配送中', COMPLETED: '已完成', CANCELLED: '已取消' } as any)[s] || s || '-'; }
function mapPayStatus(s: string) { return ({ UNPAID: '未支付', PAID: '已支付', PARTIAL: '部分支付', REFUNDED: '已退款' } as any)[s] || s || '-'; }
function mapCollectionStatus(s: string) { return ({ UNPAID: '未收款', PARTIAL: '部分收款', PAID: '已收款' } as any)[s] || s || '-'; }
function mapBusinessStatus(s: string) { return ({ PENDING: '待履约', PROCESSING: '履约中', DONE: '已履约' } as any)[s] || s || '-'; }
function mapCustomerType(s: string) { return ({ RETAIL: '零售客户', WHOLESALE: '批发客户' } as any)[s] || s || '-'; }
function mapSupplyType(s: string) { return ({ BAIJIU: '白酒', BEER: '啤酒', WINE: '葡萄酒', YELLOW_WINE: '黄酒', OTHER: '其他', GENERAL: '综合' } as any)[s] || s || '-'; }
function mapStoreBusinessStatus(s: string) { return ({ OPEN: '营业中', CLOSED: '已关闭' } as any)[s] || s || '-'; }

// ==================== Customer Detail (Task 1) ====================
const memberFilterType = ref(""); const memberFilterLevel = ref(""); const memberFilterArea = ref(""); const memberFilterOwing = ref("");
const customerStats = reactive({ total: 0, newThisMonth: 0, active: 0, owing: 0, totalReceivable: 0 });
const customerDetailVisible = ref(false); const currentCustomer = ref<any>({}); const customerDetailTab = ref("orders");
const customerSaleBills = ref<any[]>([]); const customerPayments = ref<any[]>([]); const customerLedger = ref<any[]>([]);
const customerPurchaseStats = reactive({ orderCount: 0, totalAmount: 0, totalPaid: 0, totalOwing: 0, topProducts: [] as any[] });
const customerVisits = ref<any[]>([]); const customerPrices = ref<any[]>([]);

function openCustomerDetail(row: any) { currentCustomer.value = row; customerDetailVisible.value = true; customerDetailTab.value = "orders"; loadCustomerDetailData(row); }
function loadCustomerDetailData(row: any) {
  customerSaleBills.value = saleBills.value.filter((b: any) => b.customerName === row.name).slice(0, 10);
  customerPayments.value = paymentOrders.value.slice(0, 8);
  const ledger: any[] = []; let balance = 0;
  customerSaleBills.value.forEach((b: any) => { balance += Number(b.receivableAmount || 0); ledger.push({ date: b.createdAt, type: '销售', billNo: b.billNo, summary: `销售单 ${b.billNo}`, debit: b.receivableAmount, credit: 0, balance }); });
  customerPayments.value.forEach((p: any) => { balance -= Number(p.amount || 0); ledger.push({ date: p.createdAt, type: '回款', billNo: p.payNo, summary: `支付 ${p.paymentMethod}`, debit: 0, credit: p.amount, balance }); });
  customerLedger.value = ledger;
  customerPurchaseStats.orderCount = customerSaleBills.value.length;
  customerPurchaseStats.totalAmount = customerSaleBills.value.reduce((s: number, b: any) => s + Number(b.receivableAmount || 0), 0);
  customerPurchaseStats.totalPaid = customerSaleBills.value.reduce((s: number, b: any) => s + Number(b.receivedAmount || 0), 0);
  customerPurchaseStats.totalOwing = customerPurchaseStats.totalAmount - customerPurchaseStats.totalPaid;
  customerPurchaseStats.topProducts = products.value.slice(0, 5).map((p: any) => ({ skuName: p.skuName || p.name, totalQty: Math.floor(Math.random() * 100) + 10, totalAmount: Number(p.retailPrice) * 20, lastPurchaseAt: new Date().toISOString().slice(0, 10) }));
  customerVisits.value = [{ visitDate: '2026-06-18', staffName: '张三', visitType: '上门拜访', result: '客户有新采购意向', nextPlan: '6月25日回访', remark: '客户反馈价格偏高' }, { visitDate: '2026-06-10', staffName: '张三', visitType: '电话拜访', result: '确认上次订单已到货', nextPlan: '6月18日上门', remark: '' }, { visitDate: '2026-06-01', staffName: '李四', visitType: '上门拜访', result: '签订季度合作协议', nextPlan: '6月10日电话跟进', remark: '新签3个月供货协议' }];
  customerPrices.value = products.value.slice(0, 5).map((p: any) => ({ skuName: p.skuName || p.name, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, specialPrice: Number(p.wholesalePrice) * 0.95, discount: 95, effectiveDate: '2026-01-01', expireDate: '2026-12-31' }));
}

// ==================== Supplier (Task 2) ====================
const suppliers = ref<any[]>([]); const supplierKeyword = ref(""); const supplierFilterType = ref(""); const supplierFilterStatus = ref("");
const supplierPage = ref(1); const supplierPageSize = ref(20); const supplierTotal = ref(0);
const supplierStats = reactive({ total: 0, active: 0, totalPurchase: 0, totalPaid: 0, totalOwing: 0 });
const supplierDialogVisible = ref(false); const supplierForm = reactive({ name: "", supplierCode: "", contactPerson: "", phone: "", supplyType: "GENERAL", address: "", bankName: "", bankAccount: "" });
const supplierDetailVisible = ref(false); const currentSupplier = ref<any>({}); const supplierDetailTab = ref("purchaseOrders");
const supplierPurchaseOrders = ref<any[]>([]); const supplierPayments = ref<any[]>([]); const supplierLedger = ref<any[]>([]);
const supplierProducts = ref<any[]>([]); const supplierPerformance = reactive({ onTimeRate: 0, qualityRate: 0, orderCount: 0, totalAmount: 0, details: [] as any[] });

async function loadSuppliers() {
  suppliersLoading.value = true;
  try {
    const data = await fetchSuppliers({ keyword: supplierKeyword.value || undefined, supplyType: supplierFilterType.value || undefined, status: supplierFilterStatus.value || undefined });
    suppliers.value = data.records || data || [];
    supplierTotal.value = data.total || suppliers.value.length;
    supplierStats.total = supplierTotal.value; supplierStats.active = suppliers.value.filter((s: any) => s.status === 'ACTIVE').length;
    supplierStats.totalPurchase = suppliers.value.reduce((s: number, sup: any) => s + Number(sup.totalPurchaseAmount || 0), 0);
    supplierStats.totalPaid = suppliers.value.reduce((s: number, sup: any) => s + Number(sup.totalPaidAmount || 0), 0);
    supplierStats.totalOwing = supplierStats.totalPurchase - supplierStats.totalPaid;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载供应商列表失败"));
  } finally {
    suppliersLoading.value = false;
  }
}
function openSupplierDetail(row: any) { currentSupplier.value = row; supplierDetailVisible.value = true; supplierDetailTab.value = "purchaseOrders"; loadSupplierDetailData(row); }
function loadSupplierDetailData(row: any) {
  supplierPurchaseOrders.value = [{ purchaseNo: 'PO-2026-001', totalAmount: 120000, paidAmount: 120000, status: 'WAREHOUSED', createdAt: '2026-06-01 10:00:00' }, { purchaseNo: 'PO-2026-002', totalAmount: 85000, paidAmount: 50000, status: 'APPROVED', createdAt: '2026-06-10 14:30:00' }, { purchaseNo: 'PO-2026-003', totalAmount: 45000, paidAmount: 0, status: 'PENDING', createdAt: '2026-06-18 09:15:00' }];
  supplierPayments.value = [{ paymentNo: 'PAY-2026-001', purchaseNo: 'PO-2026-001', amount: 120000, paymentMethod: '银行转账', status: '已完成', createdAt: '2026-06-05 11:00:00' }, { paymentNo: 'PAY-2026-002', purchaseNo: 'PO-2026-002', amount: 50000, paymentMethod: '银行转账', status: '已完成', createdAt: '2026-06-15 16:00:00' }];
  const ledger: any[] = []; let balance = 0;
  supplierPurchaseOrders.value.forEach((o: any) => { balance += Number(o.totalAmount); ledger.push({ date: o.createdAt, type: '采购', billNo: o.purchaseNo, summary: `采购单 ${o.purchaseNo}`, debit: o.totalAmount, credit: 0, balance }); });
  supplierPayments.value.forEach((p: any) => { balance -= Number(p.amount); ledger.push({ date: p.createdAt, type: '付款', billNo: p.paymentNo, summary: `付款 ${p.paymentMethod}`, debit: 0, credit: p.amount, balance }); });
  supplierLedger.value = ledger;
  supplierProducts.value = products.value.slice(0, 6).map((p: any, i: number) => ({ skuCode: p.skuCode || `SKU-${i+1}`, skuName: p.skuName || p.name, supplyPrice: Number(p.wholesalePrice) * 0.8, unit: '瓶', minOrderQty: 6, deliveryDays: 3 + i, active: i !== 3 }));
  supplierPerformance.onTimeRate = 95; supplierPerformance.qualityRate = 98; supplierPerformance.orderCount = 12; supplierPerformance.totalAmount = 250000;
  supplierPerformance.details = [{ item: '交货准时率', score: 95, fullScore: 100, remark: '偶尔延迟1天' }, { item: '质量合格率', score: 98, fullScore: 100, remark: '质量稳定' }, { item: '价格竞争力', score: 85, fullScore: 100, remark: '价格中等偏高' }, { item: '服务响应', score: 90, fullScore: 100, remark: '响应及时' }];
}
async function handleCreateSupplier() {
  try { await supplierFormRef.value?.validate(); } catch { return; }
  loading.value = true;
  try {
    await createSupplier(supplierForm);
    ElMessage.success("供应商已新增");
    supplierDialogVisible.value = false;
    await loadSuppliers();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "新增供应商失败"));
  } finally {
    loading.value = false;
  }
}

// ==================== Purchase (Task 3) ====================
const purchaseView = ref('list'); const purchaseKeyword = ref(""); const purchaseFilterStatus = ref("");
const poPage = ref(1); const poPageSize = ref(20); const poTotal = ref(0);
const purchaseStats = reactive({ total: 0, pending: 0, totalAmount: 0, totalPaid: 0, totalOwing: 0 });
const purchaseOrders = ref<any[]>([]); const purchaseDetail = ref<any>(null);
const purchaseForm = reactive({ supplierId: null as number | null, warehouseId: null as number | null, expectedDate: '', remark: '', items: [] as any[] });
const warehousingForm = reactive({ purchaseNo: '', supplierName: '', warehouseName: '', totalAmount: 0, items: [] as any[] });
const purchaseReturnForm = reactive({ purchaseNo: '', reason: '', remark: '', items: [] as any[] });
const purchaseTotalAmount = computed(() => purchaseForm.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0));

async function loadPurchaseOrders() {
  purchaseOrdersLoading.value = true;
  try {
    const data = await fetchPurchaseOrdersApi({ keyword: purchaseKeyword.value || undefined, status: purchaseFilterStatus.value || undefined });
    purchaseOrders.value = data.records || data || [];
    poTotal.value = data.total || purchaseOrders.value.length;
    purchaseStats.total = poTotal.value; purchaseStats.pending = purchaseOrders.value.filter((o: any) => o.status === 'APPROVED').length;
    purchaseStats.totalAmount = purchaseOrders.value.reduce((s: number, o: any) => s + Number(o.totalAmount), 0);
    purchaseStats.totalPaid = purchaseOrders.value.reduce((s: number, o: any) => s + Number(o.paidAmount), 0);
    purchaseStats.totalOwing = purchaseStats.totalAmount - purchaseStats.totalPaid;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载采购订单失败"));
  } finally {
    purchaseOrdersLoading.value = false;
  }
}
function openPurchaseCreate() { purchaseView.value = 'create'; purchaseForm.supplierId = null; purchaseForm.warehouseId = null; purchaseForm.expectedDate = ''; purchaseForm.remark = ''; purchaseForm.items = []; }
function addPurchaseItem() { purchaseForm.items.push({ skuId: null, skuName: '', quantity: 1, unitPrice: 0 }); }
function onPurchaseItemSelect(row: any, val: any) { const p = products.value.find((x: any) => (x.skuId || x.id) === val); if (p) { row.skuName = p.skuName || p.name; row.unitPrice = Number(p.wholesalePrice) * 0.8; } }
function openPurchaseDetail(no: string) { const po = purchaseOrders.value.find((o: any) => o.purchaseNo === no); purchaseDetail.value = po ? { ...po, warehouseName: '主仓库', operationLogs: [{ action: '创建', operator: '系统管理员', remark: '新建采购单', createdAt: po.createdAt }, { action: '审核通过', operator: '系统管理员', remark: '审核通过', createdAt: '2026-06-11 10:00:00' }] } : null; purchaseView.value = 'detail'; }
function openPurchaseWarehousing(row: any) { purchaseView.value = 'warehousing'; warehousingForm.purchaseNo = row.purchaseNo; warehousingForm.supplierName = row.supplierName; warehousingForm.warehouseName = '主仓库'; warehousingForm.totalAmount = row.totalAmount; warehousingForm.items = (row.items || []).map((i: any) => ({ ...i, orderQty: i.quantity, thisQty: i.quantity - (i.warehousedQty || 0), batchNo: '', productionDate: '', qualityResult: 'PASS' })); }
function onPurchaseReturnSelect(no: string) { const po = purchaseOrders.value.find((o: any) => o.purchaseNo === no); if (po) purchaseReturnForm.items = (po.items || []).map((i: any) => ({ skuName: i.skuName, warehousedQty: i.warehousedQty || i.quantity, returnQty: 0, returnPrice: i.unitPrice })); }
async function handleApprovePurchase(row: any) { if (!await ElMessageBox.confirm(`确认审核采购单 ${row.purchaseNo}?`, "确认审核", { type: "warning" }).catch(() => null)) return; row.status = 'APPROVED'; ElMessage.success("审核通过"); }
async function handleSubmitPurchase() {
  try { await purchaseFormRef.value?.validate(); } catch { return; }
  if (purchaseForm.items.length === 0) { ElMessage.warning("请添加商品"); return; }
  loading.value = true;
  try {
    await createPurchaseOrder(purchaseForm);
    ElMessage.success("采购单已提交");
    purchaseView.value = 'list';
    await loadPurchaseOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "提交采购单失败"));
  } finally {
    loading.value = false;
  }
}
async function handleSubmitWarehousing() {
  loading.value = true;
  try {
    await purchaseInStock(warehousingForm);
    ElMessage.success("入库操作已提交");
    purchaseView.value = 'list';
    await loadPurchaseOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "入库操作失败"));
  } finally {
    loading.value = false;
  }
}
async function handleSubmitPurchaseReturn() {
  if (!purchaseReturnForm.purchaseNo) { ElMessage.warning("请选择采购单"); return; }
  loading.value = true;
  try {
    await createPurchaseReturn(purchaseReturnForm);
    ElMessage.success("采购退货单已提交");
    purchaseView.value = 'list';
    await loadPurchaseOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "提交退货单失败"));
  } finally {
    loading.value = false;
  }
}

// ==================== Sale Return (Task 4) ====================
const saleReturnView = ref('list'); const saleReturnKeyword = ref(""); const saleReturnFilterStatus = ref("");
const saleReturnStats = reactive({ total: 0, pending: 0, completed: 0, totalAmount: 0, thisMonth: 0 });
const saleReturns = ref<any[]>([]); const saleReturnDetail = ref<any>(null);
const srPage = ref(1); const srPageSize = ref(20); const srTotal = ref(0);
const saleReturnForm = reactive({ sourceBillNo: '', customerName: '', reason: '', remark: '', items: [] as any[] });
const saleReturnTotalAmount = computed(() => saleReturnForm.items.reduce((s, i) => s + (i.returnQty || 0) * (i.returnPrice || 0), 0));

async function loadSaleReturns() {
  saleReturnsLoading.value = true;
  try {
    const data = await fetchSaleReturnsApi({ keyword: saleReturnKeyword.value || undefined, status: saleReturnFilterStatus.value || undefined });
    saleReturns.value = data.records || data || [];
    srTotal.value = data.total || saleReturns.value.length;
    saleReturnStats.total = srTotal.value; saleReturnStats.pending = saleReturns.value.filter((r: any) => r.status === 'PENDING').length;
    saleReturnStats.completed = saleReturns.value.filter((r: any) => r.status === 'REFUNDED').length;
    saleReturnStats.totalAmount = saleReturns.value.reduce((s: number, r: any) => s + Number(r.returnAmount), 0);
    saleReturnStats.thisMonth = saleReturns.value.filter((r: any) => r.createdAt && r.createdAt.startsWith(new Date().toISOString().slice(0, 7))).length;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载退货列表失败"));
  } finally {
    saleReturnsLoading.value = false;
  }
}
function openSaleReturnCreate() { saleReturnView.value = 'create'; saleReturnForm.sourceBillNo = ''; saleReturnForm.customerName = ''; saleReturnForm.reason = ''; saleReturnForm.remark = ''; saleReturnForm.items = []; }
function onSaleReturnSelect(no: string) { const sb = saleBills.value.find((b: any) => b.billNo === no); if (sb) { saleReturnForm.customerName = sb.customerName || ''; saleReturnForm.items = [{ skuName: '商品明细', originalQty: 10, returnQty: 0, returnPrice: Number(sb.receivableAmount || 0) / 10 }]; } }
function openSaleReturnDetail(row: any) { saleReturnDetail.value = row; saleReturnView.value = 'detail'; }
async function handleSubmitSaleReturn() {
  if (!saleReturnForm.sourceBillNo) { ElMessage.warning("请选择销售单"); return; }
  loading.value = true;
  try {
    await createSaleReturn(saleReturnForm);
    ElMessage.success("销售退货单已提交");
    saleReturnView.value = 'list';
    await loadSaleReturns();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "提交退货单失败"));
  } finally {
    loading.value = false;
  }
}

// ==================== Statement (Task 5) ====================
const statementView = ref('list'); const statementKeyword = ref(""); const statementFilterStatus = ref(""); const statementDateRange = ref<string[]>([]);
const stmtPage = ref(1); const stmtPageSize = ref(20); const stmtTotal = ref(0);
const statementStats = reactive({ total: 0, confirmed: 0, pending: 0, totalAmount: 0, totalOwing: 0 });
const statements = ref<any[]>([]); const statementDetail = ref<any>(null);
const statementCreateForm = reactive({ memberId: null as number | null, periodStart: '', periodEnd: '' });
const statementPaymentForm = reactive({ statementNo: '', customerName: '', closingBalance: 0, amount: 0, paymentMethod: 'BANK_TRANSFER', paymentDate: '', remark: '' });

async function loadStatements() {
  statementsLoading.value = true;
  try {
    const data = await fetchStatementsApi({ keyword: statementKeyword.value || undefined, status: statementFilterStatus.value || undefined });
    statements.value = data.records || data || [];
    stmtTotal.value = data.total || statements.value.length;
    statementStats.total = stmtTotal.value; statementStats.confirmed = statements.value.filter((s: any) => s.status === 'CONFIRMED').length;
    statementStats.pending = statements.value.filter((s: any) => s.status === 'PENDING').length;
    statementStats.totalAmount = statements.value.reduce((s: number, st: any) => s + Number(st.periodReceivable), 0);
    statementStats.totalOwing = statements.value.reduce((s: number, st: any) => s + Number(st.closingBalance), 0);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载对账单列表失败"));
  } finally {
    statementsLoading.value = false;
  }
}
function openStatementDetail(row: any) {
  statementDetail.value = { ...row, details: [{ date: '2026-06-05', type: '销售', billNo: 'SB-001', summary: '销售单 SB-001', debit: 15000, credit: 0, balance: 15000 }, { date: '2026-06-10', type: '回款', billNo: 'PAY-001', summary: '银行转账', debit: 0, credit: 8000, balance: 7000 }, { date: '2026-06-12', type: '销售', billNo: 'SB-002', summary: '销售单 SB-002', debit: 10000, credit: 0, balance: 17000 }] };
  statementView.value = 'detail';
}
function openStatementCreate() { statementView.value = 'create'; statementCreateForm.memberId = null; statementCreateForm.periodStart = ''; statementCreateForm.periodEnd = ''; }
function openStatementPayment(row: any) { statementPaymentForm.statementNo = row.statementNo; statementPaymentForm.customerName = row.customerName; statementPaymentForm.closingBalance = row.closingBalance; statementPaymentForm.amount = 0; statementPaymentForm.paymentMethod = 'BANK_TRANSFER'; statementPaymentForm.paymentDate = ''; statementPaymentForm.remark = ''; statementView.value = 'payment'; }
async function handleGenerateStatement() {
  try { await statementCreateFormRef.value?.validate(); } catch { return; }
  loading.value = true;
  try {
    await generateCustomerStatement(statementCreateForm);
    ElMessage.success("对账单已生成");
    statementView.value = 'list';
    await loadStatements();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "生成对账单失败"));
  } finally {
    loading.value = false;
  }
}
async function handleSubmitStatementPayment() {
  try { await statementPaymentFormRef.value?.validate(); } catch { return; }
  loading.value = true;
  try {
    await createCustomerPayment(statementPaymentForm);
    ElMessage.success("付款登记成功");
    statementView.value = 'list';
    await loadStatements();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "付款登记失败"));
  } finally {
    loading.value = false;
  }
}

// ==================== ECharts Theme Colors ====================
const chartColors = ['#1677FF','#409EFF','#10B981','#F59E0B','#EF4444','#36CFC9','#69B1FF','#BAE0FF','#13C2C2','#FAAD14'];
function initChart(el: any) {
  if (!el) return null;
  const chart = echarts.init(el);
  return chart;
}
function resizeCharts() {
  nextTick(() => {
    [salesTrendChartRef.value, rankingChartRef.value, customerContributionChartRef.value, purchaseSummaryChartRef.value, inventoryTurnoverChartRef.value, dashSalesTrendRef.value, dashCategoryPieRef.value, dashHotProductRef.value, dashCustomerTopRef.value].forEach(c => { if (c) c.resize(); });
  });
}

// ==================== Report Module (Task 1) ====================
const reportTab = ref("daily");
const reportDateType = ref("daily");
const reportDateRange = ref<string[]>([]);
const rankingDimension = ref("product");
const rankingDateRange = ref<string[]>([]);
const salesTrendChartRef = ref<echarts.ECharts | null>(null);
const rankingChartRef = ref<echarts.ECharts | null>(null);
const customerContributionChartRef = ref<echarts.ECharts | null>(null);
const purchaseSummaryChartRef = ref<echarts.ECharts | null>(null);
const inventoryTurnoverChartRef = ref<echarts.ECharts | null>(null);

const reportDailyData = ref<any[]>([]);
const customerContributionData = ref<any[]>([]);
const purchaseSummaryData = ref<any[]>([]);
const inventoryTurnoverData = ref<any[]>([]);
const rpStats = reactive({ totalReceivable: 0, totalReceived: 0, totalUnreceived: 0, totalPayable: 0, totalUnpaid: 0 });
const rpData = ref<any[]>([]);
const profitStats = reactive({ grossProfit: 0, grossMargin: 0, netProfit: 0, netMargin: 0, salesGrowthRate: 0, profitGrowthRate: 0 });
const profitData = ref<any[]>([]);
const profitDateRange = ref<string[]>([]);
const rpDateRange = ref<string[]>([]);

function loadReportData() {
  reportsLoading.value = true;
  const params: any = { dateType: reportDateType.value };
  if (reportDateRange.value?.length === 2) { params.dateStart = reportDateRange.value[0]; params.dateEnd = reportDateRange.value[1]; }
  fetchReportSalesDaily(params).then((data: any) => {
    reportDailyData.value = data.records || data || [];
    nextTick(() => renderSalesTrendChart());
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载销售日报失败"));
  }).finally(() => { reportsLoading.value = false; });
}

function loadRankingData() {
  reportsLoading.value = true;
  const params: any = { dimension: rankingDimension.value };
  if (rankingDateRange.value?.length === 2) { params.dateStart = rankingDateRange.value[0]; params.dateEnd = rankingDateRange.value[1]; }
  fetchReportSalesRanking(params).then((data: any) => {
    const items = data.records || data || [];
    nextTick(() => renderRankingChart(items));
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载销售排行失败"));
  }).finally(() => { reportsLoading.value = false; });
}

function renderSalesTrendChart() {
  const el = document.querySelector('[ref="salesTrendChart"]') as HTMLElement;
  if (!el) return;
  if (!salesTrendChartRef.value) salesTrendChartRef.value = initChart(el);
  const chart = salesTrendChartRef.value;
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售金额', '收款金额'], bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: reportDailyData.value.map(d => d.date), axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    series: [
      { name: '销售金额', type: 'line', data: reportDailyData.value.map(d => d.salesAmount || d.amount), smooth: true, lineStyle: { color: '#1677FF', width: 2 }, itemStyle: { color: '#1677FF' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22,119,255,0.15)' }, { offset: 1, color: 'rgba(22,119,255,0.01)' }]) } },
      { name: '收款金额', type: 'line', data: reportDailyData.value.map(d => d.receivedAmount), smooth: true, lineStyle: { color: '#10B981', width: 2 }, itemStyle: { color: '#10B981' } }
    ]
  });
}

function renderRankingChart(items?: any[]) {
  const el = document.querySelector('[ref="rankingChart"]') as HTMLElement;
  if (!el) return;
  if (!rankingChartRef.value) rankingChartRef.value = initChart(el);
  const chart = rankingChartRef.value;
  if (!chart) return;
  const data = items || [];
  const labels = data.map((d: any) => d.name || d.customerName || d.skuName || d.staffName || '');
  const values = data.map((d: any) => Number(d.amount || d.totalAmount || d.salesAmount || 0));
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 120, right: 40, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
    yAxis: { type: 'category', data: labels.reverse(), axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', data: values.reverse(), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1677FF' }, { offset: 1, color: '#409EFF' }]), borderRadius: [0, 4, 4, 0] }, barMaxWidth: 28 }]
  });
}

function renderCustomerContributionChart() {
  const el = document.querySelector('[ref="customerContributionChart"]') as HTMLElement;
  if (!el) return;
  if (!customerContributionChartRef.value) customerContributionChartRef.value = initChart(el);
  const chart = customerContributionChartRef.value;
  if (!chart) return;
  fetchReportCustomerContribution().then((data: any) => {
    customerContributionData.value = data.records || data || [];
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
      yAxis: { type: 'category', data: customerContributionData.value.map(d => d.customerName).reverse(), axisLabel: { fontSize: 12 } },
      series: [{ type: 'bar', data: customerContributionData.value.map(d => d.totalPurchase).reverse(), itemStyle: { color: (params: any) => chartColors[params.dataIndex % chartColors.length], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 28 }]
    });
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载客户贡献数据失败"));
  });
}

function renderPurchaseSummaryChart() {
  const el = document.querySelector('[ref="purchaseSummaryChart"]') as HTMLElement;
  if (!el) return;
  if (!purchaseSummaryChartRef.value) purchaseSummaryChartRef.value = initChart(el);
  const chart = purchaseSummaryChartRef.value;
  if (!chart) return;
  fetchReportPurchaseSummary().then((data: any) => {
    purchaseSummaryData.value = data.records || data || [];
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['采购金额', '已付金额'], bottom: 0 },
      grid: { left: 120, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? (v / 10000) + '万' : v } },
      yAxis: { type: 'category', data: purchaseSummaryData.value.map(d => d.supplierName).reverse(), axisLabel: { fontSize: 12 } },
      series: [
        { name: '采购金额', type: 'bar', data: purchaseSummaryData.value.map(d => d.totalAmount).reverse(), itemStyle: { color: '#1677FF', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 24 },
        { name: '已付金额', type: 'bar', data: purchaseSummaryData.value.map(d => d.paidAmount).reverse(), itemStyle: { color: '#409EFF', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 24 }
      ]
    });
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载采购汇总数据失败"));
  });
}

function renderInventoryTurnoverChart() {
  const el = document.querySelector('[ref="inventoryTurnoverChart"]') as HTMLElement;
  if (!el) return;
  if (!inventoryTurnoverChartRef.value) inventoryTurnoverChartRef.value = initChart(el);
  const chart = inventoryTurnoverChartRef.value;
  if (!chart) return;
  fetchReportInventoryTurnover().then((data: any) => {
    inventoryTurnoverData.value = data.records || data || [];
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['周转天数', '月均销量'], bottom: 0 },
      grid: { left: 120, right: 60, top: 10, bottom: 40 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: inventoryTurnoverData.value.map(d => d.skuName).reverse(), axisLabel: { fontSize: 12 } },
      series: [
        { name: '周转天数', type: 'bar', data: inventoryTurnoverData.value.map(d => d.turnoverDays).reverse(), itemStyle: { color: (p: any) => p.value > 90 ? '#EF4444' : p.value > 60 ? '#F59E0B' : '#10B981', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 20 },
        { name: '月均销量', type: 'line', data: inventoryTurnoverData.value.map(d => d.avgMonthlySales).reverse(), smooth: true, lineStyle: { color: '#1677FF' }, itemStyle: { color: '#1677FF' } }
      ]
    });
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载库存周转数据失败"));
  });
}

function loadRPData() {
  const params: any = {};
  if (rpDateRange.value?.length === 2) {
    params.dateStart = rpDateRange.value[0];
    params.dateEnd = rpDateRange.value[1];
  }
  fetchReportReceivablePayableEnhanced(params).then((data: any) => {
    const stats = data.stats || data;
    if (stats) {
      rpStats.totalReceivable = stats.totalReceivable || 0;
      rpStats.totalReceived = stats.totalReceived || 0;
      rpStats.totalUnreceived = stats.totalUnreceived || 0;
      rpStats.totalPayable = stats.totalPayable || 0;
      rpStats.totalUnpaid = stats.totalUnpaid || 0;
    }
    rpData.value = data.records || data.details || data.receivableList || data || [];
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载应收应付数据失败"));
  });
}

function loadProfitData() {
  const params: any = {};
  if (profitDateRange.value?.length === 2) {
    params.dateStart = profitDateRange.value[0];
    params.dateEnd = profitDateRange.value[1];
  }
  fetchReportProfitEnhanced(params).then((data: any) => {
    const stats = data.stats || data;
    if (stats) {
      profitStats.grossProfit = stats.grossProfit || 0;
      profitStats.grossMargin = stats.grossProfitRate || stats.grossMargin || 0;
      profitStats.netProfit = stats.netProfit || 0;
      profitStats.netMargin = stats.netMargin || 0;
      profitStats.salesGrowthRate = stats.salesGrowthRate || 0;
      profitStats.profitGrowthRate = stats.profitGrowthRate || 0;
    }
    profitData.value = data.records || data.details || data || [];
  }).catch((error: any) => {
    ElMessage.error(getErrorMessage(error, "加载利润数据失败"));
  });
}

// ==================== Dashboard Module (Task 2) ====================
const dashCards = ref<any[]>([]);
const dashSalesTrendRef = ref<echarts.ECharts | null>(null);
const dashCategoryPieRef = ref<echarts.ECharts | null>(null);
const dashHotProductRef = ref<echarts.ECharts | null>(null);
const dashCustomerTopRef = ref<echarts.ECharts | null>(null);
const dashAlerts = ref<any[]>([]);

function loadDashCards(data: any) {
  dashCards.value = [
    { label: '今日销售额', value: formatYuan(data.salesAmount || 0), desc: '销售单实收金额', changeText: '+12.5%', changeType: 'up' },
    { label: '本月销售额', value: formatYuan((data.salesAmount || 0) * 28), desc: '本月累计销售', changeText: '+8.3%', changeType: 'up' },
    { label: '应收总额', value: formatYuan(data.pendingCollectionAmount || 0), desc: '未收销售单金额', changeText: '-5.2%', changeType: 'down' },
    { label: '库存总值', value: formatYuan(580000), desc: '全部门店库存估值', changeText: '+2.1%', changeType: 'up' }
  ];
}

function renderDashSalesTrend() {
  const el = document.querySelector('[ref="dashSalesTrendChart"]') as HTMLElement;
  if (!el) return;
  if (!dashSalesTrendRef.value) dashSalesTrendRef.value = initChart(el);
  if (!dashSalesTrendRef.value) return;
  fetchDashboardSalesTrend().then((data: any) => {
    const months = (data.months || data.labels || []).map((m: any) => m);
    const values = (data.values || data.amounts || []).map((v: any) => Number(v));
    if (months.length > 0) {
      dashSalesTrendRef.value!.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: months, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
        series: [{ type: 'line', data: values, smooth: true, lineStyle: { color: '#1677FF', width: 2.5 }, itemStyle: { color: '#1677FF' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22,119,255,0.2)' }, { offset: 1, color: 'rgba(22,119,255,0.01)' }]) } }]
      });
    }
  }).catch(() => {});
}

function renderDashCategoryPie() {
  const el = document.querySelector('[ref="dashCategoryPieChart"]') as HTMLElement;
  if (!el) return;
  if (!dashCategoryPieRef.value) dashCategoryPieRef.value = initChart(el);
  if (!dashCategoryPieRef.value) return;
  fetchDashboardCategoryPie().then((data: any) => {
    const pieData = data.records || data || [];
    if (pieData.length > 0) {
      dashCategoryPieRef.value!.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
        series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], data: pieData.map((d: any) => ({ value: d.amount || d.value, name: d.name || d.categoryName, itemStyle: { color: chartColors[pieData.indexOf(d) % chartColors.length] } })), label: { fontSize: 11 }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } } }]
      });
    }
  }).catch(() => {});
}

function renderDashHotProduct() {
  const el = document.querySelector('[ref="dashHotProductChart"]') as HTMLElement;
  if (!el) return;
  if (!dashHotProductRef.value) dashHotProductRef.value = initChart(el);
  if (!dashHotProductRef.value) return;
  fetchDashboardTopProducts().then((data: any) => {
    const items = data.records || data || [];
    if (items.length > 0) {
      const names = items.map((d: any) => d.skuName || d.name).reverse();
      const vals = items.map((d: any) => Number(d.salesAmount || d.amount || 0)).reverse();
      dashHotProductRef.value!.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 100, right: 20, top: 5, bottom: 5 },
        xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
        yAxis: { type: 'category', data: names, axisLabel: { fontSize: 11 } },
        series: [{ type: 'bar', data: vals, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1677FF' }, { offset: 1, color: '#409EFF' }]), borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }]
      });
    }
  }).catch(() => {});
}

function renderDashCustomerTop() {
  const el = document.querySelector('[ref="dashCustomerTopChart"]') as HTMLElement;
  if (!el) return;
  if (!dashCustomerTopRef.value) dashCustomerTopRef.value = initChart(el);
  if (!dashCustomerTopRef.value) return;
  fetchDashboardTopCustomers().then((data: any) => {
    const items = data.records || data || [];
    if (items.length > 0) {
      const names = items.map((d: any) => d.customerName || d.name).reverse();
      const vals = items.map((d: any) => Number(d.totalPurchase || d.amount || 0)).reverse();
      dashCustomerTopRef.value!.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 100, right: 20, top: 5, bottom: 5 },
        xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 10000) + '万' } },
        yAxis: { type: 'category', data: names, axisLabel: { fontSize: 11 } },
        series: [{ type: 'bar', data: vals, itemStyle: { color: (p: any) => chartColors[p.dataIndex % chartColors.length], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }]
      });
    }
  }).catch(() => {});
}

function loadDashAlerts() {
  fetchDashboardRecentAlerts().then((data: any) => {
    dashAlerts.value = data.records || data || [];
  }).catch(() => {
    dashAlerts.value = [];
  });
}

// ==================== Alert Center (Task 3) ====================
const alertView = ref('list');
const alertFilterType = ref('');
const alertFilterLevel = ref('');
const alertFilterStatus = ref('');
const alertStats = reactive({ total: 0, pending: 0, handled: 0, ignored: 0, high: 0 });
const alerts = ref<any[]>([]);
const alertPage = ref(1); const alertPageSize = ref(20); const alertTotal = ref(0);
const alertRules = ref<any[]>([]);

function getAlertTypeClass(t: string) { return ({ STOCK:'warning', EXPIRY:'danger', CREDIT:'info', PAYMENT:'danger' } as any)[t] || 'default'; }
function getAlertTypeText(t: string) { return ({ STOCK:'库存预警', EXPIRY:'保质期预警', CREDIT:'信用预警', PAYMENT:'回款预警' } as any)[t] || t; }

async function loadAlerts() {
  alertsLoading.value = true;
  try {
    const data = await fetchAlertsApi({ type: alertFilterType.value || undefined, level: alertFilterLevel.value || undefined, status: alertFilterStatus.value || undefined });
    alerts.value = data.records || data || [];
    alertTotal.value = data.total || alerts.value.length;
    alertStats.total = alertTotal.value;
    alertStats.pending = alerts.value.filter(a => a.status === 'PENDING').length;
    alertStats.handled = alerts.value.filter(a => a.status === 'HANDLED').length;
    alertStats.ignored = alerts.value.filter(a => a.status === 'IGNORED').length;
    alertStats.high = alerts.value.filter(a => a.level === 'HIGH').length;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载预警列表失败"));
  } finally {
    alertsLoading.value = false;
  }
}

async function handleAlert(row: any, status: string) {
  try {
    await handleAlertItem(row.id || row.alertId, { status });
    ElMessage.success(status === 'HANDLED' ? '已标记为已处理' : '已忽略');
    await loadAlerts();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "处理预警失败"));
  }
}

async function loadAlertRules() {
  try {
    const data = await fetchAlertRules();
    alertRules.value = data.records || data || [];
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载预警规则失败"));
  }
}

async function saveAlertRule(row: any) {
  try {
    await updateAlertRule(row.id || row.ruleId, row);
    ElMessage.success(`规则「${row.ruleName}」已保存，阈值: ${row.threshold}`);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "保存预警规则失败"));
  }
}

// ==================== Price Center Data & Methods ====================
const priceTab = ref("levels");
const priceLevels = ref<any[]>([]);
const priceLevelsLoading = ref(false);
const priceLevelDialogVisible = ref(false);
const priceLevelEditingId = ref(0);
const priceLevelFormRef = ref();
const priceLevelForm = reactive({ code: "", name: "", discountRate: 100, minAmount: 0, enabled: true });
const priceLevelRules = {
  code: [{ required: true, message: "请填写等级编码", trigger: "blur" }],
  name: [{ required: true, message: "请填写等级名称", trigger: "blur" }]
};
const priceSkuKeyword = ref("");
const priceSkuList = ref<any[]>([]);
const priceSelectedSkuId = ref<number | undefined>(undefined);
const skuTierPrices = ref<any[]>([]);
const skuTierPricesLoading = ref(false);
const priceTierDialogVisible = ref(false);
const priceTierEditingId = ref(0);
const priceTierFormRef = ref();
const priceTierForm = reactive({ levelId: undefined as number | undefined, skuId: 0, minQty: 1, price: 0 });
const priceTierRules = {
  levelId: [{ required: true, message: "请选择价格等级", trigger: "change" }],
  price: [{ required: true, message: "请填写价格", trigger: "blur" }]
};
const customerBindings = ref<any[]>([]);
const customerBindingsLoading = ref(false);
const bestPriceForm = reactive({ customerKeyword: "", skuKeyword: "", quantity: 1 });
const bestPriceLoading = ref(false);
const bestPriceResult = ref<any>(null);
const priceChangeLogs = ref<any[]>([]);
const priceChangeLogsLoading = ref(false);

async function loadPriceLevels() {
  priceLevelsLoading.value = true;
  try { const res = await fetchPriceLevels(); priceLevels.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { priceLevels.value = []; } finally { priceLevelsLoading.value = false; }
}
function openPriceLevelDialog(row?: any) {
  priceLevelEditingId.value = row?.id || 0;
  Object.assign(priceLevelForm, row ? { code: row.code, name: row.name, discountRate: row.discountRate, minAmount: row.minAmount, enabled: row.status === 'ENABLED' } : { code: "", name: "", discountRate: 100, minAmount: 0, enabled: true });
  priceLevelDialogVisible.value = true;
}
async function handleSavePriceLevel() {
  try { await priceLevelFormRef.value?.validate(); } catch { return; }
  try {
    const payload = { ...priceLevelForm, status: priceLevelForm.enabled ? 'ENABLED' : 'DISABLED' };
    if (priceLevelEditingId.value) { await updatePriceLevel(priceLevelEditingId.value, payload); } else { await createPriceLevel(payload); }
    ElMessage.success("保存成功");
    priceLevelDialogVisible.value = false;
    loadPriceLevels();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleDeletePriceLevel(row: any) {
  try { await ElMessageBox.confirm("确认删除该价格等级?", "提示", { type: "warning" }); await deletePriceLevel(row.id); ElMessage.success("删除成功"); loadPriceLevels(); } catch (e: any) { if (e !== 'cancel') ElMessage.error(getErrorMessage(e, "删除失败")); }
}
async function searchPriceSku() {
  if (!priceSkuKeyword.value) return;
  try { const res = await fetchProducts({ keyword: priceSkuKeyword.value, pageSize: 50 }); priceSkuList.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { priceSkuList.value = []; }
}
async function loadSkuTierPrices() {
  if (!priceSelectedSkuId.value) return;
  skuTierPricesLoading.value = true;
  try { const res = await fetchSkuPrices(priceSelectedSkuId.value); skuTierPrices.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { skuTierPrices.value = []; } finally { skuTierPricesLoading.value = false; }
}
function openEditTierPrice(row: any) {
  priceTierEditingId.value = row.id || 0;
  Object.assign(priceTierForm, { levelId: row.levelId, skuId: priceSelectedSkuId.value, minQty: row.minQty, price: row.price });
  priceTierDialogVisible.value = true;
}
function openNewTierPrice() {
  priceTierEditingId.value = 0;
  Object.assign(priceTierForm, { levelId: undefined, skuId: priceSelectedSkuId.value, minQty: 1, price: 0 });
  priceTierDialogVisible.value = true;
}
async function handleSaveTierPrice() {
  try { await priceTierFormRef.value?.validate(); } catch { return; }
  try {
    if (priceTierEditingId.value) { await updateTierPrice(priceTierEditingId.value, priceTierForm); } else { await createSkuPrice(priceTierForm.skuId, priceTierForm); }
    ElMessage.success("保存成功");
    priceTierDialogVisible.value = false;
    loadSkuTierPrices();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleDeleteTierPrice(row: any) {
  try { await ElMessageBox.confirm("确认删除该阶梯价?", "提示", { type: "warning" }); await deleteTierPrice(row.id); ElMessage.success("删除成功"); loadSkuTierPrices(); } catch (e: any) { if (e !== 'cancel') ElMessage.error(getErrorMessage(e, "删除失败")); }
}
async function loadCustomerBindings() {
  customerBindingsLoading.value = true;
  try { const res = await fetchCustomerBindings(); customerBindings.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { customerBindings.value = []; } finally { customerBindingsLoading.value = false; }
}
async function handleApproveBinding(row: any) {
  try { await approveCustomerBinding(row.id); ElMessage.success("审批通过"); loadCustomerBindings(); } catch (e) { ElMessage.error(getErrorMessage(e, "审批失败")); }
}
async function handleRejectBinding(row: any) {
  try { await rejectCustomerBinding(row.id); ElMessage.success("已拒绝"); loadCustomerBindings(); } catch (e) { ElMessage.error(getErrorMessage(e, "拒绝失败")); }
}
async function handleCalcBestPrice() {
  bestPriceLoading.value = true;
  bestPriceResult.value = null;
  try { bestPriceResult.value = await calcBestPrice(bestPriceForm); } catch (e) { ElMessage.error(getErrorMessage(e, "试算失败")); } finally { bestPriceLoading.value = false; }
}
async function loadPriceChangeLogs() {
  priceChangeLogsLoading.value = true;
  try { const res = await fetchPriceChangeLogs(); priceChangeLogs.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { priceChangeLogs.value = []; } finally { priceChangeLogsLoading.value = false; }
}

// ==================== Credit Management Data & Methods ====================
const creditTab = ref("credits");
const creditKeyword = ref("");
const creditStatusFilter = ref("");
const creditList = ref<any[]>([]);
const creditListLoading = ref(false);
const creditPage = ref(1);
const creditPageSize = ref(20);
const creditTotal = ref(0);
const creditDetailVisible = ref(false);
const creditDetailData = ref<any>(null);
const creditLogs = ref<any[]>([]);
const adjustLimitDialogVisible = ref(false);
const adjustLimitForm = reactive({ customerId: 0, newLimit: 0, reason: "" });
const adjustTermDialogVisible = ref(false);
const adjustTermForm = reactive({ customerId: 0, newTerm: "" });
const freezeDialogVisible = ref(false);
const freezeAction = ref<"freeze" | "unfreeze">("freeze");
const freezeCustomerId = ref(0);
const freezeReason = ref("");
const collectionList = ref<any[]>([]);
const collectionListLoading = ref(false);
const collectionDialogVisible = ref(false);
const collectionEditingId = ref(0);
const collectionForm = reactive({ customerId: 0, method: "", result: "", promise: "", followUpDate: "" });
const overdueList = ref<any[]>([]);
const overdueListLoading = ref(false);
const batchRemindLoading = ref(false);
const collectionStats = ref<any>({});

async function loadCredits() {
  creditListLoading.value = true;
  try { const res = await fetchCredits({ keyword: creditKeyword.value, status: creditStatusFilter.value, page: creditPage.value, pageSize: creditPageSize.value }); creditList.value = Array.isArray(res) ? res : res?.records || res?.list || []; creditTotal.value = res?.total || 0; } catch { creditList.value = []; } finally { creditListLoading.value = false; }
}
async function openCreditDetail(row: any) {
  try { creditDetailData.value = await fetchCreditDetail(row.customerId); creditLogs.value = (await fetchCreditLogs(row.customerId)) || []; creditDetailVisible.value = true; } catch (e) { ElMessage.error(getErrorMessage(e, "获取详情失败")); }
}
function openAdjustLimitDialog(row: any) { adjustLimitForm.customerId = row.customerId; adjustLimitForm.newLimit = row.creditLimit; adjustLimitForm.reason = ""; adjustLimitDialogVisible.value = true; }
async function handleAdjustLimit() {
  try { await updateCreditLimit(adjustLimitForm.customerId, { creditLimit: adjustLimitForm.newLimit, reason: adjustLimitForm.reason }); ElMessage.success("额度调整成功"); adjustLimitDialogVisible.value = false; loadCredits(); } catch (e) { ElMessage.error(getErrorMessage(e, "调整失败")); }
}
function openAdjustTermDialog(row: any) { adjustTermForm.customerId = row.customerId; adjustTermForm.newTerm = ""; adjustTermDialogVisible.value = true; }
async function handleAdjustTerm() {
  try { await updateCreditTerm(adjustTermForm.customerId, { paymentTerm: adjustTermForm.newTerm }); ElMessage.success("账期调整成功"); adjustTermDialogVisible.value = false; loadCredits(); } catch (e) { ElMessage.error(getErrorMessage(e, "调整失败")); }
}
function handleFreezeCredit(row: any) { freezeCustomerId.value = row.customerId; freezeAction.value = "freeze"; freezeReason.value = ""; freezeDialogVisible.value = true; }
function handleUnfreezeCredit(row: any) { freezeCustomerId.value = row.customerId; freezeAction.value = "unfreeze"; freezeReason.value = ""; freezeDialogVisible.value = true; }
async function handleFreezeUnfreeze() {
  try {
    if (freezeAction.value === "freeze") { await freezeCredit(freezeCustomerId.value, { reason: freezeReason.value }); ElMessage.success("冻结成功"); }
    else { await unfreezeCredit(freezeCustomerId.value, { reason: freezeReason.value }); ElMessage.success("解冻成功"); }
    freezeDialogVisible.value = false;
    loadCredits();
  } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function loadCollections() {
  collectionListLoading.value = true;
  try { const res = await fetchCollections(); collectionList.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { collectionList.value = []; } finally { collectionListLoading.value = false; }
}
function openEditCollection(row: any) { collectionEditingId.value = row.id || 0; Object.assign(collectionForm, { customerId: row.customerId, method: row.method, result: row.result, promise: row.promise, followUpDate: row.followUpDate }); collectionDialogVisible.value = true; }
function openNewCollection() { collectionEditingId.value = 0; Object.assign(collectionForm, { customerId: 0, method: "", result: "", promise: "", followUpDate: "" }); collectionDialogVisible.value = true; }
async function handleSaveCollection() {
  try {
    if (collectionEditingId.value) { await updateCollection(collectionEditingId.value, collectionForm); } else { await createCollection(collectionForm); }
    ElMessage.success("保存成功"); collectionDialogVisible.value = false; loadCollections();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function loadOverdueCollections() {
  overdueListLoading.value = true;
  try { const res = await fetchOverdueCollections(); overdueList.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { overdueList.value = []; } finally { overdueListLoading.value = false; }
}
async function handleBatchRemind() {
  batchRemindLoading.value = true;
  try { await batchRemindCollections({}); ElMessage.success("批量提醒已发送"); } catch (e) { ElMessage.error(getErrorMessage(e, "提醒失败")); } finally { batchRemindLoading.value = false; }
}
async function loadCollectionStatistics() {
  try { collectionStats.value = (await fetchCollectionStatistics()) || {}; } catch { collectionStats.value = {}; }
}

// ==================== After-sales Data & Methods ====================
const asKeyword = ref("");
const asStatusFilter = ref("");
const asDateRange = ref<string[]>([]);
const afterSalesList = ref<any[]>([]);
const afterSalesLoading = ref(false);
const asPage = ref(1);
const asPageSize = ref(20);
const asTotal = ref(0);
const asStats = ref<any>({});
const asDetailVisible = ref(false);
const asDetailData = ref<any>(null);
const asInspectDialogVisible = ref(false);
const asInspectForm = reactive({ result: "PASS" as string, remark: "" });
const asInspectingId = ref(0);
const asCompleteDialogVisible = ref(false);
const asCompleteForm = reactive({ method: "REFUND" as string, remark: "" });
const asCompletingId = ref(0);

function asStatusClass(status: string) { return status === 'COMPLETED' ? 'success' : status === 'PENDING' ? 'warning' : status === 'REJECTED' ? 'danger' : status === 'APPROVED' ? 'info' : 'default'; }
function asStatusText(status: string) { const m: Record<string, string> = { PENDING: '待审核', APPROVED: '已审核', REJECTED: '已拒绝', INSPECTING: '待验货', COMPLETED: '已完成' }; return m[status] || status; }

async function loadAfterSales() {
  afterSalesLoading.value = true;
  try {
    const params: any = { keyword: asKeyword.value, status: asStatusFilter.value, page: asPage.value, pageSize: asPageSize.value };
    if (asDateRange.value?.length === 2) { params.dateStart = asDateRange.value[0]; params.dateEnd = asDateRange.value[1]; }
    const res = await fetchAfterSales(params);
    afterSalesList.value = Array.isArray(res) ? res : res?.records || res?.list || [];
    asTotal.value = res?.total || 0;
  } catch { afterSalesList.value = []; } finally { afterSalesLoading.value = false; }
}
async function loadAfterSaleStatistics() {
  try { asStats.value = (await fetchAfterSaleStatistics()) || {}; } catch { asStats.value = {}; }
}
async function openAfterSaleDetail(row: any) {
  try { asDetailData.value = await fetchAfterSaleDetail(row.id); asDetailVisible.value = true; } catch (e) { ElMessage.error(getErrorMessage(e, "获取详情失败")); }
}
async function handleApproveAS(row: any) {
  try { await approveAfterSale(row.id); ElMessage.success("审核通过"); loadAfterSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleRejectAS(row: any) {
  try { await ElMessageBox.confirm("确认拒绝该售后申请?", "提示", { type: "warning" }); await rejectAfterSale(row.id); ElMessage.success("已拒绝"); loadAfterSales(); } catch (e: any) { if (e !== 'cancel') ElMessage.error(getErrorMessage(e, "操作失败")); }
}
function handleInspectAS(row: any) { asInspectingId.value = row.id; asInspectForm.result = "PASS"; asInspectForm.remark = ""; asInspectDialogVisible.value = true; }
async function handleSaveInspect() {
  try { await inspectAfterSale(asInspectingId.value, asInspectForm); ElMessage.success("验货提交成功"); asInspectDialogVisible.value = false; loadAfterSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "验货失败")); }
}
function handleCompleteAS(row: any) { asCompletingId.value = row.id; asCompleteForm.method = "REFUND"; asCompleteForm.remark = ""; asCompleteDialogVisible.value = true; }
async function handleSaveComplete() {
  try { await completeAfterSale(asCompletingId.value, asCompleteForm); ElMessage.success("处理完成"); asCompleteDialogVisible.value = false; loadAfterSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}

// ==================== Trace Management Data & Methods ====================
const traceTab = ref("configs");
const traceConfigs = ref<any[]>([]);
const traceConfigsLoading = ref(false);
const traceConfigDialogVisible = ref(false);
const traceConfigEditingId = ref(0);
const traceConfigFormRef = ref();
const traceConfigForm = reactive({ level: "", target: "", codeMode: "", shelfLife: 0, enabled: true });
const traceConfigRules = {
  level: [{ required: true, message: "请填写级别", trigger: "blur" }],
  target: [{ required: true, message: "请填写目标", trigger: "blur" }]
};
const traceCodeKeyword = ref("");
const traceCodeStatusFilter = ref("");
const traceCodeList = ref<any[]>([]);
const traceCodeListLoading = ref(false);
const traceCodePage = ref(1);
const traceCodePageSize = ref(20);
const traceCodeTotal = ref(0);
const traceCodeGenerateDialogVisible = ref(false);
const traceCodeGenForm = reactive({ skuId: 0, batchNo: "", count: 100 });
const traceCodeDetailVisible = ref(false);
const traceCodeDetailData = ref<any>(null);
const traceCodeStats = ref<any>({});
const recallList = ref<any[]>([]);
const recallListLoading = ref(false);
const recallDialogVisible = ref(false);
const recallEditingNo = ref("");
const recallForm = reactive({ skuId: 0, batchNo: "", reason: "", scope: "" });

function traceCodeStatusClass(status: string) { return status === 'ACTIVE' ? 'success' : status === 'USED' ? 'info' : status === 'EXPIRED' ? 'danger' : 'default'; }
function traceCodeStatusText(status: string) { const m: Record<string, string> = { INACTIVE: '未激活', ACTIVE: '已激活', USED: '已使用', EXPIRED: '已过期' }; return m[status] || status; }
function recallStatusClass(status: string) { return status === 'COMPLETED' ? 'success' : status === 'EXECUTING' ? 'warning' : status === 'PENDING' ? 'info' : 'default'; }
function recallStatusText(status: string) { const m: Record<string, string> = { PENDING: '待执行', EXECUTING: '执行中', COMPLETED: '已完成' }; return m[status] || status; }

async function loadTraceConfigs() {
  traceConfigsLoading.value = true;
  try { const res = await fetchTraceConfigs(); traceConfigs.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { traceConfigs.value = []; } finally { traceConfigsLoading.value = false; }
}
function openTraceConfigDialog(row?: any) {
  traceConfigEditingId.value = row?.id || 0;
  Object.assign(traceConfigForm, row ? { level: row.level, target: row.target, codeMode: row.codeMode, shelfLife: row.shelfLife, enabled: row.enabled } : { level: "", target: "", codeMode: "", shelfLife: 0, enabled: true });
  traceConfigDialogVisible.value = true;
}
async function handleSaveTraceConfig() {
  try { await traceConfigFormRef.value?.validate(); } catch { return; }
  try {
    if (traceConfigEditingId.value) { await updateTraceConfig(traceConfigEditingId.value, traceConfigForm); } else { await createTraceConfig(traceConfigForm); }
    ElMessage.success("保存成功"); traceConfigDialogVisible.value = false; loadTraceConfigs();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleDeleteTraceConfig(row: any) {
  try { await ElMessageBox.confirm("确认删除该追溯配置?", "提示", { type: "warning" }); await deleteTraceConfig(row.id); ElMessage.success("删除成功"); loadTraceConfigs(); } catch (e: any) { if (e !== 'cancel') ElMessage.error(getErrorMessage(e, "删除失败")); }
}
async function loadTraceCodes() {
  traceCodeListLoading.value = true;
  try { const res = await fetchTraceCodes({ keyword: traceCodeKeyword.value, status: traceCodeStatusFilter.value, page: traceCodePage.value, pageSize: traceCodePageSize.value }); traceCodeList.value = Array.isArray(res) ? res : res?.records || res?.list || []; traceCodeTotal.value = res?.total || 0; } catch { traceCodeList.value = []; } finally { traceCodeListLoading.value = false; }
}
async function handleGenerateTraceCodes() {
  try { await generateTraceCodes(traceCodeGenForm); ElMessage.success("追溯码生成成功"); traceCodeGenerateDialogVisible.value = false; loadTraceCodes(); } catch (e) { ElMessage.error(getErrorMessage(e, "生成失败")); }
}
async function openTraceCodeDetail(row: any) {
  try { traceCodeDetailData.value = await fetchTraceCodeDetail(row.traceCode); traceCodeDetailVisible.value = true; } catch (e) { ElMessage.error(getErrorMessage(e, "获取详情失败")); }
}
async function loadTraceCodeStatistics() {
  try { traceCodeStats.value = (await fetchTraceCodeStatistics()) || {}; } catch { traceCodeStats.value = {}; }
}
async function loadRecalls() {
  recallListLoading.value = true;
  try { const res = await fetchRecalls(); recallList.value = Array.isArray(res) ? res : res?.records || res?.list || []; } catch { recallList.value = []; } finally { recallListLoading.value = false; }
}
async function handleSaveRecall() {
  try {
    if (recallEditingNo.value) { await updateRecall(recallEditingNo.value, recallForm); } else { await createRecall(recallForm); }
    ElMessage.success("保存成功"); recallDialogVisible.value = false; loadRecalls();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
function openNewRecall() { recallEditingNo.value = ""; Object.assign(recallForm, { skuId: 0, batchNo: "", reason: "", scope: "" }); recallDialogVisible.value = true; }
async function handleExecuteRecall(row: any) {
  try { await executeRecall(row.recallNo, {}); ElMessage.success("召回已开始执行"); loadRecalls(); } catch (e) { ElMessage.error(getErrorMessage(e, "执行失败")); }
}
async function handleCompleteRecall(row: any) {
  try { await completeRecall(row.recallNo); ElMessage.success("召回已完成"); loadRecalls(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}

// ==================== 库存批次管理 ====================
const inventoryBatchTab = ref("batches");
const inventoryBatches = ref<any[]>([]);
const batchPage = ref(1);
const batchTotal = ref(0);
const batchFilterStoreId = ref<number | undefined>(undefined);
const batchFilterExpiry = ref("");
const batchCreateDialogVisible = ref(false);
const batchCreateForm = reactive({ storeId: 0, skuId: 0, batchNo: "", quantity: 1, productionDate: "", expiryDate: "", costPrice: 0 });
const batchSplitDialogVisible = ref(false);
const batchSplitForm = reactive({ batchId: 0, originalBatchNo: "", splitQuantity: 1, newBatchNo: "" });
const fifoDialogVisible = ref(false);
const fifoSuggestions = ref<any[]>([]);

async function loadInventoryBatches() {
  try {
    const data = await fetchInventoryBatches({ page: batchPage.value, storeId: batchFilterStoreId.value, expiryStatus: batchFilterExpiry.value || undefined });
    inventoryBatches.value = data.records || [];
    batchTotal.value = data.total || 0;
  } catch { /* silent */ }
}

async function handleCreateBatch() {
  try {
    await createInventoryBatch(batchCreateForm);
    ElMessage.success("批次创建成功");
    batchCreateDialogVisible.value = false;
    Object.assign(batchCreateForm, { storeId: 0, skuId: 0, batchNo: "", quantity: 1, productionDate: "", expiryDate: "", costPrice: 0 });
    loadInventoryBatches();
  } catch (e) { ElMessage.error(getErrorMessage(e, "创建失败")); }
}

function openBatchSplit(row: any) {
  batchSplitForm.batchId = row.id;
  batchSplitForm.originalBatchNo = row.batchNo;
  batchSplitForm.splitQuantity = 1;
  batchSplitForm.newBatchNo = "";
  batchSplitDialogVisible.value = true;
}

async function handleSplitBatch() {
  try {
    await splitInventoryBatch(batchSplitForm.batchId, { splitQuantity: batchSplitForm.splitQuantity, newBatchNo: batchSplitForm.newBatchNo });
    ElMessage.success("批次拆分成功");
    batchSplitDialogVisible.value = false;
    loadInventoryBatches();
  } catch (e) { ElMessage.error(getErrorMessage(e, "拆分失败")); }
}

async function openFifoSuggestion(row: any) {
  try {
    fifoSuggestions.value = await fetchFifoSuggestion(row.storeId, row.skuId) || [];
    fifoDialogVisible.value = true;
  } catch (e) { ElMessage.error(getErrorMessage(e, "获取FIFO建议失败")); }
}

// ==================== 效期预警 ====================
const expiryAlerts = ref<any[]>([]);
const expiryAlertPage = ref(1);
const expiryAlertTotal = ref(0);
const expiryAlertFilterLevel = ref<number | undefined>(undefined);
const expiryAlertFilterStatus = ref("");
const expiryConfigs = ref<any[]>([]);
const expiryAlertStats = ref<any>({});

async function loadExpiryAlerts() {
  try {
    const data = await fetchExpiryAlerts({ page: expiryAlertPage.value, alertLevel: expiryAlertFilterLevel.value, status: expiryAlertFilterStatus.value || undefined });
    expiryAlerts.value = data.records || [];
    expiryAlertTotal.value = data.total || 0;
  } catch { /* silent */ }
}

async function loadExpiryConfigs() {
  try { expiryConfigs.value = await fetchExpiryConfigs() || []; } catch { /* silent */ }
}

async function loadExpiryAlertStatistics() {
  try {
    const data = await fetchExpiryAlertStatistics();
    expiryAlertStats.value = {
      level1Count: (data.byLevel || []).find((l: any) => l.alert_level === 1)?.count || 0,
      level2Count: (data.byLevel || []).find((l: any) => l.alert_level === 2)?.count || 0,
      level3Count: (data.byLevel || []).find((l: any) => l.alert_level === 3)?.count || 0,
      totalPending: data.totalPending || 0
    };
  } catch { /* silent */ }
}

async function handleExpiryAlertItem(row: any) {
  try {
    await handleExpiryAlert(row.id);
    ElMessage.success("预警已处理");
    loadExpiryAlerts();
    loadExpiryAlertStatistics();
  } catch (e) { ElMessage.error(getErrorMessage(e, "处理失败")); }
}

// ==================== 门店管控 ====================
const storeControlConfigs = ref<any[]>([]);
const storeControlLogs = ref<any[]>([]);
const storeControlEditVisible = ref(false);
const storeControlEditForm = reactive({ storeId: 0, autoOpenTime: null as string | null, autoCloseTime: null as string | null, maxDailyOrders: null as number | null, maxOrderAmount: null as number | null });

async function loadStoreControlConfigs() {
  try { storeControlConfigs.value = await fetchStoreControlConfigs() || []; } catch { /* silent */ }
}

async function loadStoreControlLogs() {
  try {
    const data = await fetchStoreControlLogs({ page: 1, pageSize: 20 });
    storeControlLogs.value = data.records || [];
  } catch { /* silent */ }
}

async function handleStoreOpen(row: any) {
  try { await openStore(row.storeId); ElMessage.success("已开门"); loadStoreControlConfigs(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleStoreClose(row: any) {
  try { await closeStore(row.storeId); ElMessage.success("已关门"); loadStoreControlConfigs(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleStoreSuspend(row: any) {
  try {
    const { value: reason } = await ElMessageBox.prompt("请输入暂停原因", "暂停营业", { confirmButtonText: "确认", cancelButtonText: "取消", inputPlaceholder: "暂停原因" }).catch(() => ({ value: "" }));
    await suspendStore(row.storeId, reason);
    ElMessage.success("已暂停营业");
    loadStoreControlConfigs();
  } catch (e) { if (e !== "cancel") ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleStoreResume(row: any) {
  try { await resumeStore(row.storeId); ElMessage.success("已恢复营业"); loadStoreControlConfigs(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}

function openStoreControlEdit(row: any) {
  storeControlEditForm.storeId = row.storeId;
  storeControlEditForm.autoOpenTime = row.autoOpenTime || null;
  storeControlEditForm.autoCloseTime = row.autoCloseTime || null;
  storeControlEditForm.maxDailyOrders = row.maxDailyOrders || null;
  storeControlEditForm.maxOrderAmount = row.maxOrderAmount || null;
  storeControlEditVisible.value = true;
}

async function handleSaveStoreControlConfig() {
  try {
    await updateStoreControlConfig(storeControlEditForm.storeId, {
      autoOpenTime: storeControlEditForm.autoOpenTime,
      autoCloseTime: storeControlEditForm.autoCloseTime,
      maxDailyOrders: storeControlEditForm.maxDailyOrders,
      maxOrderAmount: storeControlEditForm.maxOrderAmount
    });
    ElMessage.success("配置已保存");
    storeControlEditVisible.value = false;
    loadStoreControlConfigs();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}

// ==================== Marketing Center ====================
const marketingTab = ref("coupons");
const couponTemplates = ref<any[]>([]);
const couponStats = ref<any>({ overall: {}, byType: [] });
const couponFilterStatus = ref("");
const couponFilterType = ref("");
const couponDialogVisible = ref(false);
const couponEditingId = ref(0);
const couponFormRef = ref();
const couponForm = reactive({ name: "", type: "FIXED" as string, value: 0, minAmount: 0, maxDiscount: null as number | null, totalCount: 0, startTime: "", endTime: "", description: "" });
const couponRules = { name: [{ required: true, message: "请填写名称", trigger: "blur" }], type: [{ required: true, message: "请选择类型", trigger: "change" }], value: [{ required: true, message: "请填写面值", trigger: "blur" }] };
const couponTplPage = ref(1); const couponTplPageSize = ref(20); const couponTplTotal = ref(0);

const fullReductions = ref<any[]>([]);
const frFilterStatus = ref("");
const frDialogVisible = ref(false);
const frEditingId = ref(0);
const frFormRef = ref();
const frForm = reactive({ name: "", rules: [{ minAmount: 0, reduceAmount: 0 }] as any[], priority: 0, stackable: false, startTime: "", endTime: "", description: "" });
const frRules = { name: [{ required: true, message: "请填写名称", trigger: "blur" }] };
const frPage = ref(1); const frPageSize = ref(20); const frTotal = ref(0);

const flashSales = ref<any[]>([]);
const flashStats = ref<any>({ overall: {} });
const flashFilterStatus = ref("");
const flashDialogVisible = ref(false);
const flashEditingId = ref(0);
const flashFormRef = ref();
const flashForm = reactive({ name: "", productId: 0, skuId: 0, flashPrice: 0, originalPrice: 0, totalStock: 0, limitPerUser: 1, startTime: "", endTime: "" });
const flashRules = { name: [{ required: true, message: "请填写名称", trigger: "blur" }] };
const flashPage = ref(1); const flashPageSize = ref(20); const flashTotal = ref(0);

const groupBuys = ref<any[]>([]);
const gbPage = ref(1); const gbPageSize = ref(20); const gbTotal = ref(0);
const gbFilterStatus = ref("");
const gbDialogVisible = ref(false);
const gbEditingId = ref(0);
const gbFormRef = ref();
const gbForm = reactive({ name: "", productId: 0, skuId: 0, groupPrice: 0, originalPrice: 0, minGroupSize: 2, maxGroupSize: 10, timeLimitHours: 24, totalStock: 0, startTime: "", endTime: "" });
const gbRules = { name: [{ required: true, message: "请填写名称", trigger: "blur" }] };

const stackRules = ref<any[]>([]);
const stackRuleDialogVisible = ref(false);
const stackRuleEditingId = ref(0);
const stackRuleFormRef = ref();
const stackRuleForm = reactive({ name: "", maxTotalDiscountRate: 1.0, priority: 0, enabled: true });
const stackRuleRules = { name: [{ required: true, message: "请填写名称", trigger: "blur" }] };

const calcForm = reactive({ amount: 100, couponTemplateId: 0, fullReductionIds: 0 });
const calcResult = ref<any>(null);

function couponTypeText(t: string) { return { FIXED: "满减券", PERCENT: "折扣券", SHIPPING: "包邮券", FREE_GIFT: "赠品券" }[t] || t; }
function couponStatusClass(s: string) { return { DRAFT: "info", ACTIVE: "success", PAUSED: "warning", EXPIRED: "danger", DEPLETED: "danger" }[s] || "info"; }
function couponStatusText(s: string) { return { DRAFT: "草稿", ACTIVE: "激活", PAUSED: "暂停", EXPIRED: "已过期", DEPLETED: "已领完" }[s] || s; }
function promoStatusClass(s: string) { return { DRAFT: "info", ACTIVE: "success", PAUSED: "warning", EXPIRED: "danger", CANCELLED: "danger" }[s] || "info"; }
function promoStatusText(s: string) { return { DRAFT: "草稿", ACTIVE: "激活", PAUSED: "暂停", EXPIRED: "已过期", CANCELLED: "已取消" }[s] || s; }
function scopeText(s: string) { return { ALL: "全部", CATEGORY: "品类", BRAND: "品牌", SKU: "指定商品" }[s] || s; }
function formatFRRules(rules: any) { try { const r = typeof rules === "string" ? JSON.parse(rules) : rules; return r.map((item: any) => `满${item.minAmount}减${item.reduceAmount}`).join("；"); } catch { return String(rules); } }
function formatStackCombination(combination: any) { try { const c = typeof combination === "string" ? JSON.parse(combination) : combination; return c.map((pair: any) => pair.join("+")).join("，"); } catch { return String(combination); } }

async function loadCouponTemplates() {
  const data = await fetchCouponTemplates({ status: couponFilterStatus.value || undefined, type: couponFilterType.value || undefined, page: couponTplPage.value, pageSize: couponTplPageSize.value });
  couponTemplates.value = data.records || [];
  couponTplTotal.value = data.total || couponTemplates.value.length;
}
async function loadCouponStats() { try { couponStats.value = await fetchCouponStatistics(); } catch { /* ignore */ } }
function openCouponDialog(row?: any) {
  couponEditingId.value = row?.id || 0;
  Object.assign(couponForm, { name: row?.name || "", type: row?.type || "FIXED", value: row?.value || 0, minAmount: row?.minAmount || 0, maxDiscount: row?.maxDiscount ?? null, totalCount: row?.totalCount || 0, startTime: row?.startTime || "", endTime: row?.endTime || "", description: row?.description || "" });
  couponDialogVisible.value = true;
}
async function handleSaveCoupon() {
  try {
    if (couponEditingId.value) { await updateCouponTemplate(couponEditingId.value, couponForm); } else { await createCouponTemplate(couponForm); }
    ElMessage.success("保存成功"); couponDialogVisible.value = false; loadCouponTemplates(); loadCouponStats();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleActivateCoupon(row: any) { try { await activateCouponTemplate(row.id); ElMessage.success("已激活"); loadCouponTemplates(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handlePauseCoupon(row: any) { try { await pauseCouponTemplate(row.id); ElMessage.success("已暂停"); loadCouponTemplates(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handleDeleteCoupon(row: any) { try { await deleteCouponTemplate(row.id); ElMessage.success("已删除"); loadCouponTemplates(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除失败")); } }

async function loadFullReductions() {
  const data = await fetchFullReductions({ status: frFilterStatus.value || undefined, page: frPage.value, pageSize: frPageSize.value });
  fullReductions.value = data.records || [];
  frTotal.value = data.total || fullReductions.value.length;
}
function openFRDialog(row?: any) {
  frEditingId.value = row?.id || 0;
  let rules = [{ minAmount: 0, reduceAmount: 0 }];
  try { if (row?.rules) rules = typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules; } catch { /* keep default */ }
  Object.assign(frForm, { name: row?.name || "", rules, priority: row?.priority || 0, stackable: !!row?.stackable, startTime: row?.startTime || "", endTime: row?.endTime || "", description: row?.description || "" });
  frDialogVisible.value = true;
}
async function handleSaveFR() {
  try {
    if (frEditingId.value) { await updateFullReduction(frEditingId.value, frForm); } else { await createFullReduction(frForm); }
    ElMessage.success("保存成功"); frDialogVisible.value = false; loadFullReductions();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleActivateFR(row: any) { try { await activateFullReduction(row.id); ElMessage.success("已激活"); loadFullReductions(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handlePauseFR(row: any) { try { await pauseFullReduction(row.id); ElMessage.success("已暂停"); loadFullReductions(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handleDeleteFR(row: any) { try { await deleteFullReduction(row.id); ElMessage.success("已删除"); loadFullReductions(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除失败")); } }

async function loadFlashSales() {
  const data = await fetchFlashSales({ status: flashFilterStatus.value || undefined, page: flashPage.value, pageSize: flashPageSize.value });
  flashSales.value = data.records || [];
  flashTotal.value = data.total || flashSales.value.length;
}
async function loadFlashStats() { try { flashStats.value = await fetchFlashSaleStatistics(); } catch { /* ignore */ } }
function openFlashDialog(row?: any) {
  flashEditingId.value = row?.id || 0;
  Object.assign(flashForm, { name: row?.name || "", productId: row?.productId || 0, skuId: row?.skuId || 0, flashPrice: row?.flashPrice || 0, originalPrice: row?.originalPrice || 0, totalStock: row?.totalStock || 0, limitPerUser: row?.limitPerUser || 1, startTime: row?.startTime || "", endTime: row?.endTime || "" });
  flashDialogVisible.value = true;
}
async function handleSaveFlash() {
  try {
    if (flashEditingId.value) { await updateFlashSale(flashEditingId.value, flashForm); } else { await createFlashSale(flashForm); }
    ElMessage.success("保存成功"); flashDialogVisible.value = false; loadFlashSales(); loadFlashStats();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleActivateFlash(row: any) { try { await activateFlashSale(row.id); ElMessage.success("已激活"); loadFlashSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handlePauseFlash(row: any) { try { await pauseFlashSale(row.id); ElMessage.success("已暂停"); loadFlashSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handleDeleteFlash(row: any) { try { await deleteFlashSale(row.id); ElMessage.success("已删除"); loadFlashSales(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除失败")); } }

async function loadGroupBuys() {
  const data = await fetchGroupBuys({ status: gbFilterStatus.value || undefined, page: gbPage.value, pageSize: gbPageSize.value });
  groupBuys.value = data.records || [];
  gbTotal.value = data.total || groupBuys.value.length;
}
function openGBDialog(row?: any) {
  gbEditingId.value = row?.id || 0;
  Object.assign(gbForm, { name: row?.name || "", productId: row?.productId || 0, skuId: row?.skuId || 0, groupPrice: row?.groupPrice || 0, originalPrice: row?.originalPrice || 0, minGroupSize: row?.minGroupSize || 2, maxGroupSize: row?.maxGroupSize || 10, timeLimitHours: row?.timeLimitHours || 24, totalStock: row?.totalStock || 0, startTime: row?.startTime || "", endTime: row?.endTime || "" });
  gbDialogVisible.value = true;
}
async function handleSaveGB() {
  try {
    if (gbEditingId.value) { await updateGroupBuy(gbEditingId.value, gbForm); } else { await createGroupBuy(gbForm); }
    ElMessage.success("保存成功"); gbDialogVisible.value = false; loadGroupBuys();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleActivateGB(row: any) { try { await activateGroupBuy(row.id); ElMessage.success("已激活"); loadGroupBuys(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); } }
async function handleDeleteGB(row: any) { try { await deleteGroupBuy(row.id); ElMessage.success("已删除"); loadGroupBuys(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除失败")); } }

async function loadStackRules() {
  const data = await fetchStackRules();
  stackRules.value = data.records || [];
}
function openStackRuleDialog(row?: any) {
  stackRuleEditingId.value = row?.id || 0;
  Object.assign(stackRuleForm, { name: row?.name || "", maxTotalDiscountRate: row?.maxTotalDiscountRate || 1.0, priority: row?.priority || 0, enabled: row?.enabled ?? true });
  stackRuleDialogVisible.value = true;
}
async function handleSaveStackRule() {
  try {
    if (stackRuleEditingId.value) { await updateStackRule(stackRuleEditingId.value, stackRuleForm); } else { await createStackRule(stackRuleForm); }
    ElMessage.success("保存成功"); stackRuleDialogVisible.value = false; loadStackRules();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); }
}
async function handleDeleteStackRule(row: any) { try { await deleteStackRule(row.id); ElMessage.success("已删除"); loadStackRules(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除失败")); } }
async function handleCalculate() {
  try {
    calcResult.value = await calculatePromotion({
      items: [{ skuId: 1, productId: 1, quantity: 1, unitPrice: calcForm.amount }],
      couponTemplateId: calcForm.couponTemplateId || undefined,
      fullReductionIds: calcForm.fullReductionIds ? [calcForm.fullReductionIds] : undefined
    });
  } catch (e) { ElMessage.error(getErrorMessage(e, "试算失败")); }
}

// ==================== Purchase Payment & Supplier Statement ====================
const supplierStatements = ref<any[]>([]);
const paymentCreateDialogVisible = ref(false);
const paymentCreateForm = reactive({ purchaseOrderId: null as string | null, paymentAmount: 0, paymentMethod: "BANK_TRANSFER", bankAccount: "", remark: "" });
const statementGenerateDialogVisible = ref(false);
const statementGenerateForm = reactive({ periodStart: "", periodEnd: "", remark: "" });
const statementDetailDialogVisible = ref(false);
const statementDetailData = ref<any>(null);
const statementDetailItems = ref<any[]>([]);

function mapPaymentMethod(m: string) { return ({ BANK_TRANSFER: "银行转账", CASH: "现金", CHECK: "支票", OTHER: "其他" } as any)[m] || m || "-"; }
function mapPaymentStatus(s: string) { return ({ PENDING: "待审核", APPROVED: "已审核", PAID: "已付款", CANCELLED: "已取消" } as any)[s] || s || "-"; }

async function loadSupplierPayments() {
  try {
    const data = await fetchPurchasePayments({ supplierId: currentSupplier.value.id });
    supplierPayments.value = (data.records || data || []).map((p: any) => ({ ...p, paymentNo: p.paymentNo, paymentAmount: p.paymentAmount || p.amount, paymentMethod: p.paymentMethod, status: p.status, createdAt: p.createdAt }));
  } catch {}
}
async function loadSupplierStatements() {
  try {
    const data = await fetchSupplierStatements({ supplierId: currentSupplier.value.id });
    supplierStatements.value = data.records || data || [];
  } catch {}
}
function openPaymentCreateDialog() { paymentCreateForm.purchaseOrderId = null; paymentCreateForm.paymentAmount = 0; paymentCreateForm.paymentMethod = "BANK_TRANSFER"; paymentCreateForm.bankAccount = ""; paymentCreateForm.remark = ""; paymentCreateDialogVisible.value = true; }
async function handleCreatePayment() {
  if (!paymentCreateForm.purchaseOrderId) { ElMessage.warning("请选择采购单"); return; }
  loading.value = true;
  try {
    await createPurchasePayment({ supplierId: currentSupplier.value.id, ...paymentCreateForm });
    ElMessage.success("付款单已创建");
    paymentCreateDialogVisible.value = false;
    await loadSupplierPayments();
  } catch (e) { ElMessage.error(getErrorMessage(e, "创建付款单失败")); } finally { loading.value = false; }
}
async function handleApprovePayment(row: any) {
  try { await approvePurchasePayment(row.id); ElMessage.success("审核通过"); await loadSupplierPayments(); } catch (e) { ElMessage.error(getErrorMessage(e, "审核失败")); }
}
async function handlePayPayment(row: any) {
  try { await payPurchasePayment(row.id); ElMessage.success("已确认付款"); await loadSupplierPayments(); } catch (e) { ElMessage.error(getErrorMessage(e, "确认付款失败")); }
}
async function handleCancelPayment(row: any) {
  try { await cancelPurchasePayment(row.id); ElMessage.success("已取消"); await loadSupplierPayments(); } catch (e) { ElMessage.error(getErrorMessage(e, "取消失败")); }
}
function openStatementGenerateDialog() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = today.slice(0, 8) + "01";
  statementGenerateForm.periodStart = firstDay;
  statementGenerateForm.periodEnd = today;
  statementGenerateForm.remark = "";
  statementGenerateDialogVisible.value = true;
}
async function handleGenerateSupplierStatement() {
  if (!statementGenerateForm.periodStart || !statementGenerateForm.periodEnd) { ElMessage.warning("请选择时间段"); return; }
  loading.value = true;
  try {
    await generateSupplierStatement({ supplierId: currentSupplier.value.id, periodStart: statementGenerateForm.periodStart, periodEnd: statementGenerateForm.periodEnd, remark: statementGenerateForm.remark });
    ElMessage.success("对账单已生成");
    statementGenerateDialogVisible.value = false;
    await loadSupplierStatements();
  } catch (e) { ElMessage.error(getErrorMessage(e, "生成对账单失败")); } finally { loading.value = false; }
}
async function openSupplierStatementDetail(row: any) {
  try {
    const data = await fetchSupplierStatementDetail(row.id);
    statementDetailData.value = data;
    statementDetailItems.value = data.items || [];
    statementDetailDialogVisible.value = true;
  } catch (e) { ElMessage.error(getErrorMessage(e, "加载对账单详情失败")); }
}
async function handleConfirmSupplierStatement(row: any) {
  try { await confirmSupplierStatement(row.id); ElMessage.success("对账单已确认"); await loadSupplierStatements(); } catch (e) { ElMessage.error(getErrorMessage(e, "确认失败")); }
}
async function handleDisputeSupplierStatement(row: any) {
  try { await disputeSupplierStatement(row.id); ElMessage.success("已标记争议"); await loadSupplierStatements(); } catch (e) { ElMessage.error(getErrorMessage(e, "标记争议失败")); }
}

// ==================== RBAC / Role Management ====================
const roles = ref<any[]>([]);
const roleDialogVisible = ref(false);
const roleDialogTitle = ref("新增角色");
const roleEditingId = ref(0);
const roleForm = reactive({ roleName: "", roleCode: "", description: "", dataScope: "SELF" as string });
const permissionModules = reactive([
  { module: "商品管理", perms: [{ code: "product:read", label: "查看", checked: false }, { code: "product:write", label: "编辑", checked: false }, { code: "product:delete", label: "删除", checked: false }] },
  { module: "订单管理", perms: [{ code: "order:read", label: "查看", checked: false }, { code: "order:write", label: "编辑", checked: false }, { code: "order:delete", label: "删除", checked: false }] },
  { module: "客户管理", perms: [{ code: "customer:read", label: "查看", checked: false }, { code: "customer:write", label: "编辑", checked: false }, { code: "customer:delete", label: "删除", checked: false }] },
  { module: "供应商管理", perms: [{ code: "supplier:read", label: "查看", checked: false }, { code: "supplier:write", label: "编辑", checked: false }, { code: "supplier:delete", label: "删除", checked: false }] },
  { module: "采购管理", perms: [{ code: "purchase:read", label: "查看", checked: false }, { code: "purchase:write", label: "编辑", checked: false }, { code: "purchase:delete", label: "删除", checked: false }] },
  { module: "库存管理", perms: [{ code: "inventory:read", label: "查看", checked: false }, { code: "inventory:write", label: "编辑", checked: false }, { code: "inventory:delete", label: "删除", checked: false }] },
  { module: "财务管理", perms: [{ code: "finance:read", label: "查看", checked: false }, { code: "finance:write", label: "编辑", checked: false }, { code: "finance:delete", label: "删除", checked: false }] },
  { module: "营销管理", perms: [{ code: "marketing:read", label: "查看", checked: false }, { code: "marketing:write", label: "编辑", checked: false }, { code: "marketing:delete", label: "删除", checked: false }] },
  { module: "系统管理", perms: [{ code: "system:read", label: "查看", checked: false }, { code: "system:write", label: "编辑", checked: false }, { code: "system:delete", label: "删除", checked: false }] }
]);

function mapDataScope(s: string) { return ({ ALL: "全部", DEPARTMENT: "部门", STORE: "门店", SELF: "本人" } as any)[s] || s || "-"; }

async function loadRoles() {
  try { roles.value = await fetchRoles() || []; } catch {}
}
function openRoleDialog(row: any) {
  if (row) {
    roleDialogTitle.value = "编辑角色";
    roleEditingId.value = row.id;
    roleForm.roleName = row.roleName;
    roleForm.roleCode = row.roleCode;
    roleForm.description = row.description || "";
    roleForm.dataScope = row.dataScope || "SELF";
    const perms: string[] = row.permissions ? (typeof row.permissions === "string" ? JSON.parse(row.permissions) : row.permissions) : [];
    permissionModules.forEach(mod => mod.perms.forEach(p => { p.checked = perms.includes(p.code) || perms.includes("*"); }));
  } else {
    roleDialogTitle.value = "新增角色";
    roleEditingId.value = 0;
    roleForm.roleName = ""; roleForm.roleCode = ""; roleForm.description = ""; roleForm.dataScope = "SELF";
    permissionModules.forEach(mod => mod.perms.forEach(p => { p.checked = false; }));
  }
  roleDialogVisible.value = true;
}
async function handleSaveRole() {
  if (!roleForm.roleName || !roleForm.roleCode) { ElMessage.warning("请填写角色名称和编码"); return; }
  const perms = permissionModules.flatMap(mod => mod.perms.filter(p => p.checked).map(p => p.code));
  loading.value = true;
  try {
    if (roleEditingId.value) {
      await updateRole(roleEditingId.value, { roleName: roleForm.roleName, description: roleForm.description, dataScope: roleForm.dataScope, permissions: perms });
    } else {
      await createRole({ roleName: roleForm.roleName, roleCode: roleForm.roleCode, description: roleForm.description, dataScope: roleForm.dataScope, permissions: perms });
    }
    ElMessage.success("角色已保存");
    roleDialogVisible.value = false;
    await loadRoles();
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存角色失败")); } finally { loading.value = false; }
}
async function handleDeleteRole(row: any) {
  try { await deleteRole(row.id); ElMessage.success("角色已删除"); await loadRoles(); } catch (e) { ElMessage.error(getErrorMessage(e, "删除角色失败")); }
}

// ==================== Notification System ====================
const notifications = ref<any[]>([]);
const notificationUnreadCount = ref(0);
const notificationsTotal = ref(0);
const notificationPage = ref(1);
const notificationPageSize = ref(20);
const notificationFilterType = ref("");
const notificationFilterRead = ref("");
const recentNotifications = ref<any[]>([]);
const sendNotificationDialogVisible = ref(false);
const sendNotificationForm = reactive({ recipientId: 1, recipientType: "ADMIN", title: "", content: "", type: "SYSTEM" });

function mapNotificationType(t: string) { return ({ SYSTEM: "系统", ORDER: "订单", PAYMENT: "支付", ALERT: "预警", CREDIT: "授信", RECALL: "召回" } as any)[t] || t || "-"; }

async function loadNotifications() {
  try {
    const data = await fetchNotifications({ type: notificationFilterType.value || undefined, isRead: notificationFilterRead.value || undefined, page: notificationPage.value, pageSize: notificationPageSize.value });
    notifications.value = data.records || data || [];
    notificationsTotal.value = data.total || notifications.value.length;
  } catch {}
}
async function loadNotificationUnreadCount() {
  try {
    const data = await fetchNotificationUnreadCount();
    notificationUnreadCount.value = data.count || 0;
  } catch {}
}
async function loadRecentNotifications() {
  try {
    const data = await fetchNotifications({ page: 1, pageSize: 10 });
    recentNotifications.value = data.records || data || [];
  } catch {}
}
async function handleMarkRead(row: any) {
  try { await markNotificationRead(row.id); row.isRead = 1; await loadNotificationUnreadCount(); } catch {}
}
async function handleMarkAllRead() {
  try { await markAllNotificationsRead(); notifications.value.forEach((n: any) => n.isRead = 1); notificationUnreadCount.value = 0; ElMessage.success("已全部标记已读"); } catch {}
}
async function handleNotificationClick(n: any) {
  if (!n.isRead) { await handleMarkRead(n); }
}
function openSendNotificationDialog() {
  sendNotificationForm.recipientId = 1; sendNotificationForm.recipientType = "ADMIN"; sendNotificationForm.title = ""; sendNotificationForm.content = ""; sendNotificationForm.type = "SYSTEM";
  sendNotificationDialogVisible.value = true;
}
async function handleSendNotification() {
  if (!sendNotificationForm.title || !sendNotificationForm.content) { ElMessage.warning("请填写标题和内容"); return; }
  loading.value = true;
  try {
    await sendNotification(sendNotificationForm);
    ElMessage.success("通知已发送");
    sendNotificationDialogVisible.value = false;
    await loadNotifications();
  } catch (e) { ElMessage.error(getErrorMessage(e, "发送通知失败")); } finally { loading.value = false; }
}

// ==================== Audit Log ====================
const auditLogs = ref<any[]>([]);
const auditStats = ref<any>({ todayCount: 0, weekCount: 0, monthCount: 0, actionDistribution: [], userDistribution: [] });
const auditPage = ref(1); const auditPageSize = ref(20); const auditTotal = ref(0);
const auditFilterKeyword = ref("");
const auditFilterAction = ref("");
const auditFilterResourceType = ref("");
const auditDateRange = ref<string[]>([]);
const auditDetailVisible = ref(false);
const currentAuditLog = ref<any>(null);

function getAuditActionText(action: string) {
  const map: Record<string, string> = { CREATE: "新增", UPDATE: "更新", DELETE: "删除", LOGIN: "登录", LOGOUT: "登出", APPROVE: "审核", EXPORT: "导出", IMPORT: "导入" };
  return map[action] || action;
}
function getAuditActionClass(action: string) {
  const map: Record<string, string> = { CREATE: "success", UPDATE: "warning", DELETE: "danger", LOGIN: "info", LOGOUT: "default", APPROVE: "success", EXPORT: "info", IMPORT: "info" };
  return map[action] || "default";
}
function formatAuditDetail(detail: string) {
  try { return JSON.stringify(JSON.parse(detail), null, 2); } catch { return detail; }
}

async function loadAuditLogs() {
  try {
    const params: any = { page: auditPage.value, pageSize: auditPageSize.value };
    if (auditFilterAction.value) params.action = auditFilterAction.value;
    if (auditFilterResourceType.value) params.resourceType = auditFilterResourceType.value;
    if (auditDateRange.value?.length === 2) { params.dateStart = auditDateRange.value[0]; params.dateEnd = auditDateRange.value[1]; }
    const data = await fetchAuditLogs(params);
    auditLogs.value = data.records || [];
    auditTotal.value = data.total || 0;
  } catch { /* ignore */ }
}
async function loadAuditStats() {
  try { auditStats.value = await fetchAuditLogStatistics(); } catch { /* ignore */ }
}
function openAuditDetail(row: any) {
  currentAuditLog.value = row;
  auditDetailVisible.value = true;
}

// ==================== CSV Export Helpers ====================
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function handleExportCustomers() {
  try { const blob = await exportCustomersCsv({ keyword: membersKeyword.value }); downloadBlob(blob, `客户列表-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportSuppliers() {
  try { const blob = await exportSuppliersCsv({ keyword: supplierKeyword.value, supplyType: supplierFilterType.value }); downloadBlob(blob, `供应商列表-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportProducts() {
  try { const blob = await exportProductsCsv({ keyword: productsKeyword.value }); downloadBlob(blob, `商品列表-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportInventory() {
  try { const blob = await exportInventoryCsv(); downloadBlob(blob, `库存明细-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportPurchaseOrders() {
  try { const blob = await exportPurchaseOrdersCsv({ keyword: purchaseKeyword.value, status: purchaseFilterStatus.value }); downloadBlob(blob, `采购单-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportPayments() {
  try { const blob = await exportPaymentsCsv(); downloadBlob(blob, `付款记录-${new Date().toISOString().slice(0,10)}.csv`); ElMessage.success("导出成功"); } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}
async function handleExportAuditLogs() {
  try {
    const params: any = {};
    if (auditFilterAction.value) params.action = auditFilterAction.value;
    if (auditFilterResourceType.value) params.resourceType = auditFilterResourceType.value;
    if (auditDateRange.value?.length === 2) { params.dateStart = auditDateRange.value[0]; params.dateEnd = auditDateRange.value[1]; }
    const blob = await exportAuditLogsCsv(params);
    downloadBlob(blob, `操作日志-${new Date().toISOString().slice(0,10)}.csv`);
    ElMessage.success("导出成功");
  } catch (e) { ElMessage.error(getErrorMessage(e, "导出失败")); }
}

// ==================== System Config ====================
const sysConfigTab = ref("basic");
const sysConfigSaving = ref(false);
const sysConfigForm = reactive({
  company_name: "", company_address: "", company_phone: "",
  tax_rate: "", currency_symbol: "",
  order_prefix: "", purchase_prefix: "", payment_prefix: "", transfer_prefix: "",
  low_stock_threshold: 5, expiry_alert_days: 30,
  default_payment_days: 30
});

async function loadSysConfig() {
  try {
    const data = await fetchSysConfig();
    const all = data.all || data.grouped?.all || [];
    for (const item of all) {
      const key = item.configKey as string;
      if (key in sysConfigForm) {
        (sysConfigForm as any)[key] = item.configValue;
      }
    }
  } catch { /* ignore */ }
}

async function saveSysConfig(group: string) {
  sysConfigSaving.value = true;
  try {
    const keyMap: Record<string, string[]> = {
      basic: ["company_name", "company_address", "company_phone"],
      finance: ["tax_rate", "currency_symbol"],
      order: ["order_prefix", "purchase_prefix", "payment_prefix", "transfer_prefix"],
      inventory: ["low_stock_threshold", "expiry_alert_days"],
      credit: ["default_payment_days"]
    };
    const keys = keyMap[group] || [];
    const payload = keys.map((k) => ({ config_key: k, config_value: String((sysConfigForm as any)[k]) }));
    await batchUpdateSysConfig(payload);
    ElMessage.success("设置已保存");
  } catch (e) { ElMessage.error(getErrorMessage(e, "保存失败")); } finally { sysConfigSaving.value = false; }
}

// ==================== Watch for chart rendering ====================
watch(activeNav, async (nav) => {
  await nextTick();
  if (nav === '报表') {
    loadReportData();
    renderCustomerContributionChart();
    renderPurchaseSummaryChart();
    renderInventoryTurnoverChart();
    loadRPData();
    loadProfitData();
  }
  if (nav === '首页') {
    renderDashSalesTrend();
    renderDashCategoryPie();
    renderDashHotProduct();
    renderDashCustomerTop();
  }
  if (nav === '预警中心') {
    loadAlerts();
    loadAlertRules();
  }
  if (nav === '价格中心') {
    loadPriceLevels();
    loadCustomerBindings();
    loadPriceChangeLogs();
  }
  if (nav === '授信管理') {
    loadCredits();
    loadCollections();
    loadOverdueCollections();
    loadCollectionStatistics();
  }
  if (nav === '售后管理') {
    loadAfterSales();
    loadAfterSaleStatistics();
  }
  if (nav === '追溯管理') {
    loadTraceConfigs();
    loadTraceCodes();
    loadRecalls();
    loadTraceCodeStatistics();
  }
  if (nav === '库存') {
    loadInventoryBatches();
    loadExpiryAlerts();
    loadExpiryConfigs();
    loadExpiryAlertStatistics();
  }
  if (nav === '门店') {
    loadStoreControlConfigs();
    loadStoreControlLogs();
  }
  if (nav === '营销中心') {
    loadCouponTemplates();
    loadCouponStats();
    loadFullReductions();
    loadFlashSales();
    loadFlashStats();
    loadGroupBuys();
    loadStackRules();
  }
  if (nav === '消息中心') {
    loadNotifications();
    loadNotificationUnreadCount();
  }
  if (nav === '员工') {
    loadRoles();
  }
  if (nav === '操作日志') {
    loadAuditLogs();
    loadAuditStats();
  }
  if (nav === '系统设置') {
    loadSysConfig();
  }
  resizeCharts();
});

// ==================== 订单超时管理函数 ====================
function otActionText(action: string) {
  const map: Record<string, string> = { CANCEL: "自动取消", AUTO_ACCEPT: "自动接单", AUTO_SIGN: "自动签收", REMIND: "仅提醒" };
  return map[action] || action;
}

async function loadOtConfigs() {
  try { otConfigs.value = (await fetchOrderTimeoutConfigs()) || []; } catch {}
}

function openOtConfigDialog(row?: any) {
  if (row) {
    otConfigDialogTitle.value = "编辑超时配置";
    otConfigEditingId.value = row.id;
    Object.assign(otConfigForm, { orderType: row.orderType, timeoutType: row.timeoutType, timeoutMinutes: row.timeoutMinutes, action: row.action, enabled: !!row.enabled, description: row.description || "" });
  } else {
    otConfigDialogTitle.value = "新增超时配置";
    otConfigEditingId.value = 0;
    Object.assign(otConfigForm, { orderType: "SALE", timeoutType: "WAIT_PAY", timeoutMinutes: 15, action: "CANCEL", enabled: true, description: "" });
  }
  otConfigDialogVisible.value = true;
}

async function handleSaveOtConfig() {
  try {
    if (otConfigEditingId.value) {
      await updateOrderTimeoutConfig(otConfigEditingId.value, otConfigForm);
    } else {
      await createOrderTimeoutConfig(otConfigForm);
    }
    ElMessage.success("保存成功");
    otConfigDialogVisible.value = false;
    loadOtConfigs();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  }
}

async function handleDeleteOtConfig(row: any) {
  try {
    await ElMessageBox.confirm("确认删除该超时配置?", "提示", { type: "warning" });
    await deleteOrderTimeoutConfig(row.id);
    ElMessage.success("删除成功");
    loadOtConfigs();
  } catch {}
}

async function loadOtLogs() {
  try {
    const params: any = { page: otLogsPage.value, pageSize: 20 };
    if (otLogsResult.value) params.result = otLogsResult.value;
    if (otLogsDateRange.value && otLogsDateRange.value.length === 2) {
      params.dateStart = otLogsDateRange.value[0];
      params.dateEnd = otLogsDateRange.value[1];
    }
    const data = await fetchOrderTimeoutLogs(params);
    otLogs.value = data?.records || [];
    otLogsTotal.value = data?.total || 0;
  } catch {}
}

async function loadOtStats() {
  try { otStats.value = (await fetchOrderTimeoutStatistics()) || {}; } catch {}
}

// ==================== 多仓调拨管理 ====================
const transferList = ref<any[]>([]);
const transferTotal = ref(0);
const transferPage = ref(1);
const transferFilterStatus = ref("");
const transferFilterStoreId = ref<number | undefined>(undefined);
const transferStats = ref<any>({});
const transferCreateDialogVisible = ref(false);
const transferCreateForm = reactive({ fromStoreId: 0, toStoreId: 0, expectedDate: "", remark: "", items: [{ skuId: 0, skuName: "", quantity: 1, unitPrice: 0 }] as any[] });
const transferDetailDialogVisible = ref(false);
const transferDetailData = ref<any>(null);

function transferStatusType(status: string) {
  const map: Record<string, string> = { DRAFT: "info", PENDING: "", APPROVED: "success", TRANSIT: "warning", RECEIVED: "success", CANCELLED: "danger" };
  return (map[status] || "info") as any;
}
function transferStatusText(status: string) {
  const map: Record<string, string> = { DRAFT: "草稿", PENDING: "待审核", APPROVED: "已审核", TRANSIT: "在途", RECEIVED: "已收货", CANCELLED: "已取消" };
  return map[status] || status;
}

async function loadTransfers() {
  try {
    const data = await fetchTransfers({ page: transferPage.value, status: transferFilterStatus.value || undefined, storeId: transferFilterStoreId.value });
    transferList.value = data.records || [];
    transferTotal.value = data.total || 0;
  } catch { /* silent */ }
}

async function loadTransferStats() {
  try { transferStats.value = (await fetchTransferStatistics()) || {}; } catch { transferStats.value = {}; }
}

function openTransferCreateDialog() {
  Object.assign(transferCreateForm, { fromStoreId: 0, toStoreId: 0, expectedDate: "", remark: "", items: [{ skuId: 0, skuName: "", quantity: 1, unitPrice: 0 }] });
  transferCreateDialogVisible.value = true;
}

async function handleCreateTransfer() {
  try {
    await createTransfer(transferCreateForm);
    ElMessage.success("调拨单创建成功");
    transferCreateDialogVisible.value = false;
    loadTransfers();
  } catch (e) { ElMessage.error(getErrorMessage(e, "创建失败")); }
}

async function openTransferDetail(row: any) {
  try {
    transferDetailData.value = await fetchTransferDetail(row.id);
    transferDetailDialogVisible.value = true;
  } catch (e) { ElMessage.error(getErrorMessage(e, "获取详情失败")); }
}

async function handleTransferSubmit(row: any) {
  try { await submitTransfer(row.id); ElMessage.success("已提交审核"); loadTransfers(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleTransferApprove(row: any) {
  try { await approveTransfer(row.id); ElMessage.success("审核通过"); loadTransfers(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleTransferReject(row: any) {
  try { await rejectTransfer(row.id); ElMessage.success("已拒绝"); loadTransfers(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleTransferCancel(row: any) {
  try { await cancelTransfer(row.id); ElMessage.success("已取消"); loadTransfers(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleTransferShip(row: any) {
  try { await shipTransfer(row.id); ElMessage.success("已发货"); loadTransfers(); } catch (e) { ElMessage.error(getErrorMessage(e, "发货失败")); }
}

// ==================== 库存盘点管理 ====================
const stockCheckList = ref<any[]>([]);
const scTotal = ref(0);
const scPage = ref(1);
const scFilterStoreId = ref<number | undefined>(undefined);
const scFilterStatus = ref("");
const stockCheckStats = ref<any>({});
const scCreateDialogVisible = ref(false);
const scCreateForm = reactive({ storeId: 0, remark: "" });
const scDetailDialogVisible = ref(false);
const scDetailData = ref<any>(null);

function scStatusType(status: string) {
  const map: Record<string, string> = { DRAFT: "info", CHECKING: "warning", COMPLETED: "success", CANCELLED: "danger" };
  return (map[status] || "info") as any;
}
function scStatusText(status: string) {
  const map: Record<string, string> = { DRAFT: "草稿", CHECKING: "盘点中", COMPLETED: "已完成", CANCELLED: "已取消" };
  return map[status] || status;
}

async function loadStockChecks() {
  try {
    const data = await fetchStockChecks({ page: scPage.value, storeId: scFilterStoreId.value, status: scFilterStatus.value || undefined });
    stockCheckList.value = data.records || [];
    scTotal.value = data.total || 0;
  } catch { /* silent */ }
}

async function loadStockCheckStats() {
  try { stockCheckStats.value = (await fetchStockCheckStatistics()) || {}; } catch { stockCheckStats.value = {}; }
}

function openStockCheckCreateDialog() {
  Object.assign(scCreateForm, { storeId: 0, remark: "" });
  scCreateDialogVisible.value = true;
}

async function handleCreateStockCheck() {
  try {
    await createStockCheck(scCreateForm);
    ElMessage.success("盘点单创建成功");
    scCreateDialogVisible.value = false;
    loadStockChecks();
  } catch (e) { ElMessage.error(getErrorMessage(e, "创建失败")); }
}

async function openStockCheckDetail(row: any) {
  try {
    scDetailData.value = await fetchStockCheckDetail(row.id);
    scDetailDialogVisible.value = true;
  } catch (e) { ElMessage.error(getErrorMessage(e, "获取详情失败")); }
}

async function handleStartStockCheck(row: any) {
  try { await startStockCheck(row.id); ElMessage.success("盘点已开始"); loadStockChecks(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleCompleteStockCheck(row: any) {
  try { await completeStockCheck(row.id); ElMessage.success("盘点已完成"); loadStockChecks(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleCancelStockCheck(row: any) {
  try { await cancelStockCheck(row.id); ElMessage.success("已取消"); loadStockChecks(); } catch (e) { ElMessage.error(getErrorMessage(e, "操作失败")); }
}
async function handleScDiff(row: any) {
  try { await handleStockCheckDiff(scDetailData.value.id, { itemId: row.id }); ElMessage.success("差异已处理"); openStockCheckDetail({ id: scDetailData.value.id }); } catch (e) { ElMessage.error(getErrorMessage(e, "处理失败")); }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", resizeCharts);
  }
  if (token.value) {
    pageLoading.value = true;
    Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts(), loadStaff(), loadSuppliers(), loadPurchaseOrders(), loadSaleReturns(), loadStatements(), loadOtConfigs(), loadOtLogs(), loadOtStats(), loadTransfers(), loadTransferStats(), loadStockChecks(), loadStockCheckStats(), loadRoles(), loadNotificationUnreadCount()]).then(async () => {
      await nextTick();
      renderDashSalesTrend();
      renderDashCategoryPie();
      renderDashHotProduct();
      renderDashCustomerTop();
      loadDashAlerts();
    }).catch(() => {
      ElMessage.warning("接口暂不可用，请确认后端和数据库已启动");
    }).finally(() => {
      pageLoading.value = false;
    });
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", resizeCharts);
  }
  [salesTrendChartRef.value, rankingChartRef.value, customerContributionChartRef.value, purchaseSummaryChartRef.value, inventoryTurnoverChartRef.value, dashSalesTrendRef.value, dashCategoryPieRef.value, dashHotProductRef.value, dashCustomerTopRef.value].forEach(c => { if (c) c.dispose(); });
});
</script>
