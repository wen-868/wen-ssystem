<template>
  <div v-if="!token" class="store-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>门店操作端</h1>
          <p class="muted">请先登录，登录后进入门店收银和履约工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="store_operator" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入门店端</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side">
      <h1>门店操作端</h1>
      <button
        v-for="item in nav"
        :key="item"
        class="nav-item"
        :class="{ active: item === activeNav }"
        type="button"
        @click="activeNav = item"
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
          <el-tag v-if="storeStatus" :type="storeStatus==='OPEN'?'success':storeStatus==='SUSPENDED'?'warning':'info'" size="small" style="margin-right:8px">{{storeStatus==='OPEN'?'营业中':storeStatus==='SUSPENDED'?'已暂停':'已关闭'}}</el-tag>
          <span>门店操作员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
      <!-- 门店状态提示横幅 -->
      <div v-if="storeStatus && storeStatus !== 'OPEN'" style="margin:0 0 16px;padding:12px 16px;border-radius:8px;font-weight:600;text-align:center"
        :style="{background:storeStatus==='SUSPENDED'?'#FEF0E7':'#F5F7FA',color:storeStatus==='SUSPENDED'?'#E6A23C':'#909399'}">
        {{storeStatus==='SUSPENDED'?'门店已暂停营业，暂停原因：'+(storeControlConfig?.suspendedReason||'未知'):'门店已关闭，暂不可接单'}}
      </div>
      <section v-if='activeNav === "工作台"' class="cards">
        <div class="card" v-for="card in cards" :key="card.label">
          <div class="metric">{{ card.value }}</div>
          <div>{{ card.label }}</div>
          <p class="muted">{{ card.desc }}</p>
        </div>
      </section>
      <el-card v-if='activeNav === "工作台" && inventoryAlerts.length > 0' style="margin-top: 20px; border-left: 4px solid #e6a23c">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="color: #e6a23c; font-weight: bold">⚠ 库存预警（可用库存 ≤ 5）</span>
            <el-button size="small" @click="loadInventoryAlerts">刷新</el-button>
          </div>
        </template>
        <el-table :data="inventoryAlerts" size="small">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="stockType" label="库存类型" width="100" />
          <el-table-column prop="availableQty" label="可用库存" width="100">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: bold">{{ row.availableQty }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "工作台"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>近七日销售趋势</span>
            <el-button size="small" @click="loadDailySales">刷新</el-button>
          </div>
        </template>
        <canvas ref="barCanvas" style="width: 100%; height: 180px" />
        <div v-if="dailySales.length === 0" style="text-align: center; padding: 20px; color: #999">暂无销售数据</div>
      </el-card>
      <!-- 日结快捷入口 -->
      <el-card v-if='activeNav === "工作台"' style="margin-top: 20px; border-left: 4px solid #8B4513">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div>
            <div style="font-size: 16px; font-weight: 600; color: #8B4513">日结对账</div>
            <div class="muted" style="margin-top: 4px">选择日期范围，查看销售汇总并进行现金对账</div>
          </div>
          <el-button type="primary" @click="activeNav = '日结'">进入日结</el-button>
        </div>
      </el-card>
      <el-card v-if='activeNav === "接单履约"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>小程序订单履约</span>
            <el-button size="small" @click="loadOrders">刷新订单</el-button>
          </div>
        </template>
        <el-table :data="orders">
          <el-table-column prop="orderNo" label="订单号" width="220" />
          <el-table-column prop="receiverName" label="收货人" />
          <el-table-column prop="receiverMobile" label="手机号" width="140" />
          <el-table-column prop="fulfillmentType" label="履约方式" width="110" />
          <el-table-column prop="orderStatus" label="订单状态" width="130" />
          <el-table-column prop="payStatus" label="支付状态" width="110" />
          <el-table-column prop="payableAmount" label="应付金额" width="120" />
          <el-table-column label="操作" width="280">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openStoreOrderDetail(row.orderNo)">详情</el-button>
              <el-button v-if="row.orderStatus === 'NEW'" size="small" type="success" @click="handleAcceptOrder(row.orderNo)">接单</el-button>
              <el-button v-if="row.orderStatus === 'NEW'" size="small" type="danger" @click="handleRejectOrder(row.orderNo)">拒单</el-button>
              <el-button v-if="row.orderStatus === 'ACCEPTED'" size="small" type="primary" @click="handleStartDelivery(row.orderNo)">开始配送</el-button>
              <el-button v-if="row.orderStatus === 'DELIVERING'" size="small" type="primary" @click="handleCompleteOrder(row.orderNo)">完成配送</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <div v-if='activeNav === "快速收银"' class="cashier-page">
        <div class="cashier-header">
          <div class="cashier-header-left">
            <h2 class="cashier-title">收银台</h2>
            <span class="cashier-date">{{ formatDate(new Date()) }}</span>
          </div>
          <div class="cashier-header-right">
            <el-button size="small" @click="handleCreateHoldOrder" :disabled="cartItems.length === 0">
              <el-icon><Reading /></el-icon>
              挂单
            </el-button>
            <el-button size="small" @click="holdDialogVisible = true; loadHoldOrders()">
              <el-icon><List /></el-icon>
              取单
            </el-button>
          </div>
        </div>

        <div class="cashier-main">
          <div class="cashier-left">
            <div class="cashier-search">
              <el-input
                v-model="productKeyword"
                placeholder="搜索商品名称/SKU/条码"
                clearable
                @input="handleSearchProducts"
                @keyup.enter="handleSearchProducts"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="cashier-category-tabs">
              <el-tag
                v-for="cat in cashierCategories"
                :key="cat"
                :type="cashierActiveCategory === cat ? 'primary' : 'info'"
                effect="plain"
                class="category-tag"
                @click="cashierActiveCategory = cat; filterProductsByCategory()"
              >
                {{ cat }}
              </el-tag>
            </div>
            <div class="cashier-product-list">
              <div
                v-for="product in filteredProducts"
                :key="product.skuId || product.id"
                class="cashier-product-item"
                @click="addCartItem(product)"
              >
                <div class="product-image">
                  <span class="product-placeholder">{{ (product.productName || product.skuName || '商')?.charAt(0) }}</span>
                </div>
                <div class="product-info">
                  <div class="product-name">{{ product.productName || product.skuName }}</div>
                  <div class="product-sku">{{ product.skuName }}</div>
                  <div class="product-bottom">
                    <span class="product-price">¥{{ formatYuan(product.storePrice || product.retailPrice) }}</span>
                    <span class="product-stock" :class="{ low: (product.availableQty ?? 99) <= 5 }">
                      库存: {{ product.availableQty ?? '--' }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="filteredProducts.length === 0" class="product-empty">
                <el-icon size="48" color="#ccc"><Document /></el-icon>
                <p>暂无匹配商品</p>
                <p class="muted" style="font-size: 12px">请输入关键词搜索商品</p>
              </div>
            </div>
          </div>

          <div class="cashier-center">
            <div class="cart-header">
              <div class="cart-header-left">
                <h3>购物车</h3>
                <el-tag v-if="cartTotalCount > 0" type="primary" effect="dark" size="small" round>
                  {{ cartTotalCount }} 件
                </el-tag>
              </div>
              <el-button size="small" type="danger" :disabled="cartItems.length === 0" @click="clearCart">
                <el-icon><Delete /></el-icon>
                清空
              </el-button>
            </div>
            <div v-if="cashierRemark" class="cart-remark-bar" @click="remarkDialogVisible = true">
              <el-icon><EditPen /></el-icon>
              <span class="remark-text">{{ cashierRemark }}</span>
              <el-icon class="remark-edit"><ArrowRight /></el-icon>
            </div>
            <div class="cart-list">
              <div v-if="cartItems.length === 0" class="cart-empty">
                <el-icon size="64" color="#e0e0e0"><ShoppingCart /></el-icon>
                <p>购物车为空</p>
                <p class="cart-empty-tip">点击左侧商品添加到购物车</p>
              </div>
              <div
                v-for="(item, index) in cartItems"
                :key="index"
                class="cart-item"
                :class="{ 'cart-item-first': index === 0 }"
              >
                <div class="cart-item-info">
                  <div class="cart-item-name">{{ item.productName || item.skuName }}</div>
                  <div class="cart-item-sku">{{ item.skuName }}</div>
                  <div class="cart-item-unit-price">单价: ¥{{ formatYuan(item.unitPrice) }}</div>
                </div>
                <div class="cart-item-right">
                  <div class="cart-item-quantity-control">
                    <button class="qty-btn qty-minus" @click="decreaseQty(index)">
                      <el-icon><Minus /></el-icon>
                    </button>
                    <span class="qty-value">{{ item.quantity }}</span>
                    <button class="qty-btn qty-plus" @click="increaseQty(index)">
                      <el-icon><Plus /></el-icon>
                    </button>
                  </div>
                  <div class="cart-item-subtotal">¥{{ formatYuan(item.unitPrice * item.quantity) }}</div>
                  <button class="cart-item-remove" @click="removeCartItem(index)" title="删除">
                    <el-icon><Delete /></el-icon>
                  </button>
                </div>
              </div>
            </div>
            <div class="cart-footer">
              <el-button type="primary" link @click="remarkDialogVisible = true">
                <el-icon><EditPen /></el-icon>
                {{ cashierRemark ? '修改备注' : '添加备注' }}
              </el-button>
              <div class="cart-footer-total">
                <span>合计：</span>
                <span class="cart-total-amount">¥{{ formatYuan(cartAmount) }}</span>
              </div>
            </div>
          </div>

          <div class="cashier-right">
            <div class="settlement-section">
              <div class="total-card">
                <div class="total-label">应收金额</div>
                <div class="total-amount-large">¥{{ formatYuan(cashierTotal) }}</div>
                <div class="total-item-count">{{ cartTotalCount }} 件商品</div>
              </div>

              <div class="settlement-block">
                <div class="settlement-block-title">客户信息</div>
                <el-select
                  v-model="cashierSelectedCustomer"
                  placeholder="选择客户（散客可留空）"
                  clearable
                  filterable
                  remote
                  :remote-method="remoteSearchMembers"
                  :loading="memberLoading"
                  style="width: 100%"
                  @change="handleCustomerChange"
                >
                  <el-option
                    v-for="member in memberOptions"
                    :key="member.memberId || member.id"
                    :label="member.name + (member.mobile ? ' (' + member.mobile + ')' : '')"
                    :value="member"
                  />
                </el-select>
              </div>

              <div class="settlement-block">
                <div class="settlement-block-title">金额明细</div>
                <div class="amount-detail">
                  <div class="amount-row">
                    <span>商品总额</span>
                    <span>¥{{ formatYuan(cartAmount) }}</span>
                  </div>
                  <div class="amount-row discount-row">
                    <span>优惠折扣</span>
                    <div class="discount-input">
                      <el-input-number
                        v-model="cashierDiscount"
                        :min="0"
                        :max="cartAmount"
                        :precision="2"
                        size="small"
                        style="width: 120px"
                      />
                    </div>
                  </div>
                  <div class="amount-row discount-row">
                    <span>抹零</span>
                    <div class="discount-input">
                      <el-input-number
                        v-model="cashierRoundDown"
                        :min="0"
                        :max="Math.min(10, cartAmount - cashierDiscount)"
                        :precision="2"
                        size="small"
                        style="width: 120px"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="settlement-block">
                <div class="settlement-block-title">支付方式</div>
                <div class="payment-methods">
                  <div
                    v-for="method in paymentMethodsList"
                    :key="method.value"
                    class="payment-method-item"
                    :class="{ active: paymentMethod === method.value }"
                    @click="paymentMethod = method.value"
                  >
                    <div class="payment-icon">{{ method.icon }}</div>
                    <div class="payment-name">{{ method.label }}</div>
                  </div>
                </div>
              </div>

              <div v-if="paymentMethod === 'CASH'" class="settlement-block">
                <div class="settlement-block-title">现金收款</div>
                <div class="cash-receive">
                  <el-input-number
                    v-model="cashierReceivedAmount"
                    :min="0"
                    :precision="2"
                    size="large"
                    style="width: 100%"
                    placeholder="输入收款金额"
                  />
                  <div class="change-card" :class="{ positive: cashierChange > 0 }">
                    <span>找零金额</span>
                    <span class="change-value">¥{{ formatYuan(cashierChange) }}</span>
                  </div>
                  <div class="quick-amounts">
                    <el-button
                      v-for="amt in quickAmounts"
                      :key="amt"
                      size="small"
                      @click="cashierReceivedAmount = Math.max(cashierTotal, amt)"
                    >
                      ¥{{ amt }}
                    </el-button>
                  </div>
                </div>
              </div>

              <el-button
                type="primary"
                size="large"
                class="submit-btn"
                :disabled="cartItems.length === 0"
                :loading="loading"
                @click="handleSubmitSale"
              >
                <el-icon><Check /></el-icon>
                确认收款（¥{{ formatYuan(cashierTotal) }}）
              </el-button>

              <div class="shortcut-tips">
                <span>快捷键：Enter 确认收款</span>
              </div>

              <el-alert v-if="currentBillNo" type="success" show-icon :closable="false" style="margin-top: 12px">
                <template #title>销售单：{{ currentBillNo }}，应收金额：{{ formatYuan(currentAmount) }}</template>
              </el-alert>
            </div>
          </div>
        </div>
      </div>

      <el-dialog v-model="remarkDialogVisible" title="订单备注" width="400px">
        <el-input
          v-model="cashierRemarkTemp"
          type="textarea"
          :rows="4"
          placeholder="请输入备注信息..."
          maxlength="200"
          show-word-limit
        />
        <div class="remark-tags">
          <el-tag
            v-for="tag in remarkTags"
            :key="tag"
            class="remark-tag"
            @click="cashierRemarkTemp = tag"
            effect="plain"
          >
            {{ tag }}
          </el-tag>
        </div>
        <template #footer>
          <el-button @click="cashierRemarkTemp = ''">清空</el-button>
          <el-button type="primary" @click="saveRemark">确定</el-button>
        </template>
      </el-dialog>

      <el-card v-if='activeNav === "销售单"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px">
            <span>销售单列表</span>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
              <el-input v-model="saleBillKeyword" placeholder="搜索销售单号/客户名" clearable size="small" style="width: 200px" @keyup.enter="handleSearchSaleBills" />
              <el-select v-model="saleBillStatusFilter" placeholder="收款状态" clearable size="small" style="width: 120px" @change="handleSearchSaleBills">
                <el-option label="全部" value="" />
                <el-option label="待收款" value="UNPAID" />
                <el-option label="部分收款" value="PARTIAL" />
                <el-option label="已收款" value="PAID" />
              </el-select>
              <el-button size="small" @click="handleSearchSaleBills">搜索</el-button>
              <el-button size="small" @click="saleBillKeyword = ''; saleBillStatusFilter = ''; saleBillPage = 1; loadSaleBills()">刷新</el-button>
            </div>
          </div>
        </template>
        <el-table :data="saleBills">
          <el-table-column prop="billNo" label="销售单号" width="220" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column prop="businessStatus" label="业务状态" width="120" />
          <el-table-column prop="collectionStatus" label="收款状态" width="120" />
          <el-table-column label="应收金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.receivableAmount) }}</template>
          </el-table-column>
          <el-table-column label="未收金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.unreceivedAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button size="small" @click="openSaleBillDetail(row.billNo)">详情</el-button>
              <el-button size="small" type="primary" @click="shareExistingBill(row)">分享收款</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="saleBillTotal > saleBillPageSize" style="display: flex; justify-content: flex-end; margin-top: 12px">
          <el-pagination
            v-model:current-page="saleBillPage"
            :page-size="saleBillPageSize"
            :total="saleBillTotal"
            layout="prev, pager, next"
            size="small"
            @current-change="handleSaleBillPageChange"
          />
        </div>
      </el-card>

      <el-drawer v-model="detailVisible" title="销售单详情" size="520px">
        <template v-if="saleBillDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="销售单号">{{ saleBillDetail.billNo }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ saleBillDetail.customerName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="业务状态">{{ saleBillDetail.businessStatus }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ saleBillDetail.collectionStatus }}</el-descriptions-item>
            <el-descriptions-item label="应收金额">{{ formatYuan(saleBillDetail.receivableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="未收金额">{{ formatYuan(saleBillDetail.unreceivedAmount) }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="saleBillDetail.items || []" style="margin-top: 16px">
            <el-table-column prop="skuName" label="商品" />
            <el-table-column prop="totalBottleQty" label="数量" width="80" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">{{ formatYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="小计" width="100">
              <template #default="{ row }">{{ formatYuan(row.subtotalAmount) }}</template>
            </el-table-column>
          </el-table>
          <el-alert v-if="detailShareUrl" type="warning" show-icon :closable="false" style="margin-top: 16px">
            <template #title>{{ detailShareUrl }}</template>
          </el-alert>
          <el-button type="primary" style="margin-top: 16px" @click="shareExistingBill(saleBillDetail)">
            生成分享收款
          </el-button>
        </template>
      </el-drawer>

      <el-dialog v-model="holdDialogVisible" title="挂单/取单" width="760px">
        <el-table :data="holdOrders" empty-text="暂无挂单">
          <el-table-column prop="holdNo" label="挂单号" width="200" />
          <el-table-column prop="customerName" label="客户" width="120" />
          <el-table-column prop="customerMobile" label="手机号" width="140" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">{{ formatYuan(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleRestoreHoldOrder(row.holdNo)">取单</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteHoldOrder(row.holdNo)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>

      <el-card v-if='activeNav === "库存查询"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存查询</span>
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input v-model="inventoryKeyword" placeholder="按商品名/SKU编码/条码搜索" clearable size="small" style="width: 220px" @keyup.enter="handleSearchInventory" />
              <el-button size="small" @click="handleSearchInventory">搜索</el-button>
              <el-button size="small" @click="inventoryKeyword = ''; loadInventory()">刷新库存</el-button>
            </div>
          </div>
        </template>
        <el-table :data="inventory">
          <el-table-column prop="skuId" label="SKU ID" width="100" />
          <el-table-column prop="skuName" label="商品规格" />
          <el-table-column prop="stockType" label="库存类型" width="120" />
          <el-table-column prop="physicalQty" label="物理库存" width="120" />
          <el-table-column prop="availableQty" label="可售库存" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openInvAdjust(row)">调整</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "库存查询"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>库存流水</span>
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
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>分享收款</span>
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
          <el-table-column prop="createdAt" label="创建时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
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
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-card v-if='activeNav === "分享收款"' style="margin-top: 20px">
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
          <el-table-column prop="createdAt" label="时间" width="170" />
        </el-table>
      </el-card>
      <el-dialog v-model="orderDetailVisible" title="订单详情" width="560px">
        <template v-if="orderDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ orderDetail.customerType }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ orderDetail.orderStatus }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ orderDetail.payStatus }}</el-descriptions-item>
            <el-descriptions-item label="应付金额">{{ formatYuan(orderDetail.payableAmount) }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ orderDetail.receiverName || "-" }}</el-descriptions-item>
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
          <div style="display: flex; gap: 8px; margin-top: 16px">
            <el-button v-if="orderDetail.orderStatus === 'NEW'" type="success" :loading="loading" @click="handleAcceptOrder(orderDetail.orderNo); orderDetailVisible = false">接单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'NEW'" type="danger" :loading="loading" @click="handleRejectOrder(orderDetail.orderNo); orderDetailVisible = false">拒单</el-button>
            <el-button v-if="orderDetail.orderStatus === 'ACCEPTED'" type="primary" :loading="loading" @click="handleStartDelivery(orderDetail.orderNo); orderDetailVisible = false">开始配送</el-button>
            <el-button v-if="orderDetail.orderStatus === 'DELIVERING'" type="primary" :loading="loading" @click="handleCompleteOrder(orderDetail.orderNo); orderDetailVisible = false">完成配送</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="invDialogVisible" title="库存调整" width="400px">
        <el-form ref="invFormRef" :model="invForm" :rules="invRules" label-width="100px">
          <el-form-item label="商品">
            <span>{{ invForm.skuName || "—" }}</span>
          </el-form-item>
          <el-form-item label="库存类型">
            <span>{{ invForm.stockType }}</span>
          </el-form-item>
          <el-form-item label="变化量" prop="change">
            <el-input-number v-model="invForm.change" :min="-999" :max="999" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="invForm.remark" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="invDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="loading" @click="handleInvAdjust">确认调整</el-button>
        </template>
      </el-dialog>

      <!-- 日结模块 -->
      <template v-if="activeNav === '日结'">
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>日结对账</span>
              <div style="display: flex; gap: 8px; align-items: center">
                <el-date-picker v-model="dailySettleDateRange" type="daterange" size="small" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
                <el-button size="small" type="primary" :loading="loading" @click="handleDailySettle">生成日结单</el-button>
              </div>
            </div>
          </template>
          <div v-if="!dailySettleResult" style="text-align: center; padding: 40px; color: #999">
            <p>请选择日期范围后点击"生成日结单"</p>
          </div>
          <div v-else>
            <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
              <el-descriptions-item label="日结期间" :span="2">{{ dailySettleResult.periodStart }} ~ {{ dailySettleResult.periodEnd }}</el-descriptions-item>
              <el-descriptions-item label="操作员">{{ dailySettleResult.operatorName || "-" }}</el-descriptions-item>
            </el-descriptions>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px">
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px">{{ dailySettleResult.orderCount }}</div>
                <div>订单数</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #27AE60">{{ formatYuan(dailySettleResult.totalSales) }}</div>
                <div>销售金额</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #8B4513">{{ formatYuan(dailySettleResult.totalReceived) }}</div>
                <div>收款金额</div>
              </div>
              <div class="card" style="text-align: center">
                <div class="metric" style="font-size: 22px; color: #C0392B">{{ formatYuan(dailySettleResult.totalRefund) }}</div>
                <div>退款金额</div>
              </div>
            </div>
            <h4 style="margin: 16px 0 8px; font-size: 14px; color: #5C554C">收款明细</h4>
            <el-table :data="dailySettleResult.paymentBreakdown" size="small" style="margin-bottom: 16px">
              <el-table-column prop="method" label="收款方式" />
              <el-table-column label="金额" width="140"><template #default="{row}">{{ formatYuan(row.amount) }}</template></el-table-column>
              <el-table-column prop="count" label="笔数" width="100" />
            </el-table>
            <h4 style="margin: 16px 0 8px; font-size: 14px; color: #5C554C">现金对账</h4>
            <el-form label-width="100px" size="small" style="max-width: 500px; margin-bottom: 16px">
              <el-form-item label="系统应收现金">
                <span style="font-weight: 600; color: #8B4513">{{ formatYuan(dailySettleResult.systemCash) }}</span>
              </el-form-item>
              <el-form-item label="实际点钞">
                <el-input-number v-model="dailySettleActualCash" :min="0" :precision="2" style="width: 200px" />
              </el-form-item>
              <el-form-item label="差异">
                <span :style="{ fontWeight: 600, color: cashDifference === 0 ? '#27AE60' : '#C0392B' }">{{ formatYuan(cashDifference) }}</span>
              </el-form-item>
            </el-form>
            <div style="display: flex; gap: 12px; margin-top: 20px">
              <el-button type="primary" @click="handlePrintDailySettle">打印日结单</el-button>
              <el-button @click="dailySettleResult = null">关闭</el-button>
            </div>
          </div>
        </el-card>
        <!-- 日结历史列表 -->
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>日结历史</span>
              <el-button size="small" @click="loadDailySettleHistory">刷新</el-button>
            </div>
          </template>
          <el-table :data="dailySettleHistory" size="small" empty-text="暂无日结记录">
            <el-table-column prop="settleDate" label="日结日期" width="120" />
            <el-table-column label="总销售" width="120">
              <template #default="{ row }">{{ formatYuan(row.totalSales) }}</template>
            </el-table-column>
            <el-table-column label="总收款" width="120">
              <template #default="{ row }">{{ formatYuan(row.totalReceived) }}</template>
            </el-table-column>
            <el-table-column label="现金" width="120">
              <template #default="{ row }">{{ formatYuan(row.cashAmount) }}</template>
            </el-table-column>
            <el-table-column label="微信" width="120">
              <template #default="{ row }">{{ formatYuan(row.wechatAmount) }}</template>
            </el-table-column>
            <el-table-column label="支付宝" width="120">
              <template #default="{ row }">{{ formatYuan(row.alipayAmount) }}</template>
            </el-table-column>
            <el-table-column label="转账" width="120">
              <template #default="{ row }">{{ formatYuan(row.transferAmount) }}</template>
            </el-table-column>
            <el-table-column prop="operatorName" label="操作员" width="120" />
            <el-table-column prop="createdAt" label="创建时间" width="170" />
          </el-table>
        </el-card>
      </template>
      <!-- 调拨模块 -->
      <template v-if="activeNav === '调拨'">
        <el-card style="margin-top: 20px">
          <el-tabs v-model="storeTransferTab">
            <el-tab-pane label="我收到的" name="received">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-weight:600">在途调拨单（调入）</span>
                <el-button size="small" @click="loadStoreInTransit">刷新</el-button>
              </div>
              <el-table :data="storeInTransitList" size="small" empty-text="暂无在途调拨单">
                <el-table-column prop="transferNo" label="调拨单号" width="180" />
                <el-table-column prop="fromStoreName" label="调出门店" width="120" />
                <el-table-column label="状态" width="90">
                  <template #default="{row}"><el-tag size="small" :type="row.status==='TRANSIT'?'warning':'success'">{{row.status==='TRANSIT'?'在途':'已收货'}}</el-tag></template>
                </el-table-column>
                <el-table-column label="总金额" width="100"><template #default="{row}">{{formatYuan(row.totalAmount)}}</template></el-table-column>
                <el-table-column prop="expectedDate" label="期望日期" width="110" />
                <el-table-column label="操作" width="100">
                  <template #default="{row}">
                    <el-button v-if="row.status==='TRANSIT'" size="small" type="primary" @click="openReceiveDialog(row)">收货确认</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="我发出的" name="shipped">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-weight:600">已发货调拨单（调出）</span>
                <el-button size="small" @click="loadStoreMyShipments">刷新</el-button>
              </div>
              <el-table :data="storeMyShipmentList" size="small" empty-text="暂无已发货调拨单">
                <el-table-column prop="transferNo" label="调拨单号" width="180" />
                <el-table-column prop="toStoreName" label="调入门店" width="120" />
                <el-table-column label="状态" width="90">
                  <template #default="{row}"><el-tag size="small" :type="row.status==='TRANSIT'?'warning':'success'">{{row.status==='TRANSIT'?'在途':'已收货'}}</el-tag></template>
                </el-table-column>
                <el-table-column label="总金额" width="100"><template #default="{row}">{{formatYuan(row.totalAmount)}}</template></el-table-column>
                <el-table-column prop="createdAt" label="创建时间" width="170" />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </template>
      <!-- 收货确认对话框 -->
      <el-dialog v-model="receiveDialogVisible" title="收货确认" width="600px">
        <el-table :data="receiveDialogItems" size="small" empty-text="暂无明细">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="quantity" label="调拨数量" width="90" />
          <el-table-column prop="receivedQty" label="已收货" width="80" />
          <el-table-column label="本次收货" width="120">
            <template #default="{row}">
              <el-input-number v-model="row.thisReceiveQty" :min="0" :max="row.quantity - row.receivedQty" size="small" style="width:100%" />
            </template>
          </el-table-column>
        </el-table>
        <template #footer><el-button @click="receiveDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleReceiveTransfer">确认收货</el-button></template>
      </el-dialog>
      <!-- 盘点模块 -->
      <template v-if="activeNav === '盘点'">
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>盘点单列表</span>
              <el-button size="small" @click="loadStoreStockChecks">刷新</el-button>
            </div>
          </template>
          <el-table :data="storeStockCheckList" size="small" empty-text="暂无盘点单">
            <el-table-column prop="checkNo" label="盘点单号" width="180" />
            <el-table-column label="状态" width="90">
              <template #default="{row}"><el-tag size="small" :type="row.status==='CHECKING'?'warning':row.status==='COMPLETED'?'success':'info'">{{row.status==='CHECKING'?'盘点中':row.status==='COMPLETED'?'已完成':row.status==='DRAFT'?'草稿':'已取消'}}</el-tag></template>
            </el-table-column>
            <el-table-column prop="totalSku" label="SKU数" width="80" />
            <el-table-column prop="diffSku" label="差异数" width="80" />
            <el-table-column label="差异金额" width="100"><template #default="{row}">{{formatYuan(row.diffAmount)}}</template></el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <el-table-column label="操作" width="160">
              <template #default="{row}">
                <el-button v-if="row.status==='CHECKING'" size="small" type="primary" @click="openScInputDialog(row)">录入实盘</el-button>
                <el-button v-if="row.status==='CHECKING'" size="small" type="success" @click="handleSubmitStockCheck(row)">提交</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
      <!-- 盘点录入对话框 -->
      <el-dialog v-model="scInputDialogVisible" title="录入实盘数量" width="700px">
        <el-table :data="scInputItems" size="small" empty-text="暂无明细" max-height="400">
          <el-table-column prop="skuName" label="商品" />
          <el-table-column prop="batchNo" label="批次号" width="120" />
          <el-table-column prop="systemQty" label="系统数量" width="90" />
          <el-table-column label="实盘数量" width="120">
            <template #default="{row}">
              <el-input-number v-model="row.actualQty" :min="0" size="small" style="width:100%" />
            </template>
          </el-table-column>
        </el-table>
        <template #footer><el-button @click="scInputDialogVisible=false">取消</el-button><el-button type="primary" :loading="loading" @click="handleSaveScItems">保存</el-button></template>
      </el-dialog>
      <!-- 门店管控模块 -->
      <template v-if="activeNav === '门店管控'">
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>门店状态</span>
              <el-button size="small" @click="loadStoreControlStatus">刷新</el-button>
            </div>
          </template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="门店名称">{{storeControlStatusData?.storeName||'-'}}</el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag v-if="storeControlStatusData" :type="storeControlStatusData.status==='OPEN'?'success':storeControlStatusData.status==='SUSPENDED'?'warning':'info'" size="small">
                {{storeControlStatusData.status==='OPEN'?'营业中':storeControlStatusData.status==='SUSPENDED'?'已暂停':'已关闭'}}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="自动开门时间">{{storeControlConfig?.autoOpenTime||'未设置'}}</el-descriptions-item>
            <el-descriptions-item label="自动关门时间">{{storeControlConfig?.autoCloseTime||'未设置'}}</el-descriptions-item>
            <el-descriptions-item label="日订单上限">{{storeControlConfig?.maxDailyOrders||'未设置'}}</el-descriptions-item>
            <el-descriptions-item label="日金额上限">{{storeControlConfig?.maxOrderAmount||'未设置'}}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>状态变更日志</span>
              <el-button size="small" @click="loadStoreControlMyLogs">刷新</el-button>
            </div>
          </template>
          <el-table :data="storeControlMyLogs" size="small" empty-text="暂无日志">
            <el-table-column prop="fromStatus" label="变更前" width="90" />
            <el-table-column prop="toStatus" label="变更后" width="90" />
            <el-table-column prop="changeType" label="类型" width="90">
              <template #default="{row}"><el-tag size="small" :type="row.changeType==='MANUAL'?'':row.changeType==='SCHEDULED'?'warning':'danger'">{{row.changeType==='MANUAL'?'手动':row.changeType==='SCHEDULED'?'定时':'自动'}}</el-tag></template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" />
            <el-table-column prop="createdAt" label="时间" width="170" />
          </el-table>
        </el-card>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Delete, EditPen, ArrowRight, Minus, Plus, Check, ShoppingCart, Document, Reading, List } from "@element-plus/icons-vue";
import { acceptStoreOrder, adjustInventory, completeStoreOrder, createCollectionLink, createHoldOrder, createOfflinePayment, createSaleBill, deleteHoldOrder, fetchDailySettleHistory, fetchDashboardOverview, fetchHoldOrders, fetchInventory, fetchInventoryLogs, fetchSaleBillDetail, fetchSaleBills, fetchStoreCollectionLinks, fetchStoreDailySales, fetchStoreDashboard, fetchStoreInventoryAlerts, fetchStoreOrderDetail, fetchStoreOrders, fetchStorePaymentOrders, fetchStoreRefundOrders, rejectStoreOrder, restoreHoldOrder, searchStoreMembers, searchStoreProducts, startDelivery, storeLogin, submitDailySettle, fetchStoreControlStatus, fetchStoreControlMyLogs, fetchStoreInTransitTransfers, fetchStoreMyShipments, receiveStoreTransfer, fetchStoreStockChecks, fetchStoreStockCheckDetail, updateStockCheckItem, submitStoreStockCheck } from "./api";
import { formatYuan } from "./utils/format";

const nav = ["工作台", "快速收银", "销售单", "接单履约", "库存查询", "调拨", "盘点", "分享收款", "日结", "门店管控"];
const activeNav = ref("工作台");
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
const token = ref(localStorage.getItem("store_token") || localStorage.getItem("admin_token") || "");
const loading = ref(false);
const invDialogVisible = ref(false);
const invForm = reactive({
  skuId: 0,
  skuName: "",
  stockType: "OFFLINE",
  change: 0,
  remark: ""
});
const invFormRef = ref();
const invRules = {
  change: [{
    validator: (_: any, value: number, callback: any) => {
      if (Number(value) !== 0) callback();
      else callback(new Error("变化量不能为 0"));
    },
    trigger: "blur"
  }]
};
const inventory = ref<any[]>([]);
const inventoryKeyword = ref("");
const inventoryLogs = ref<any[]>([]);
const collectionLinks = ref<any[]>([]);
const paymentOrders = ref<any[]>([]);
const refundOrders = ref<any[]>([]);
const orders = ref<any[]>([]);
const orderDetail = ref<any>(null);
const orderDetailVisible = ref(false);
const dashboard = ref<any>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0
});
const dashboardOverview = ref<any>({
  monthSalesAmount: 0,
  monthOrderCount: 0
});
const dailySales = ref<any[]>([]);
const inventoryAlerts = ref<any[]>([]);
const barCanvas = ref<HTMLCanvasElement | null>(null);

async function loadDashboard() {
  try {
    const data = await fetchStoreDashboard();
    dashboard.value = data;
  } catch {
    ElMessage.warning("工作台概览接口暂不可用");
  }
}

async function loadDashboardOverview() {
  try {
    const data = await fetchDashboardOverview();
    if (data) {
      dashboardOverview.value = {
        monthSalesAmount: Number(data.monthSalesAmount || data.monthSales || 0),
        monthOrderCount: Number(data.monthOrderCount || data.monthOrders || 0)
      };
    }
  } catch {
    // 静默失败，不影响主仪表盘
  }
}

async function loadDailySales() {
  try {
    const data = await fetchStoreDailySales();
    dailySales.value = data;
    drawBarChart();
  } catch {
    ElMessage.warning("销售趋势数据加载失败");
  }
}

async function loadInventoryAlerts() {
  try {
    const data = await fetchStoreInventoryAlerts();
    inventoryAlerts.value = data;
  } catch {
    ElMessage.warning("库存预警加载失败");
  }
}

function drawBarChart() {
  const canvas = barCanvas.value;
  if (!canvas || dailySales.value.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 160, pad = 20;
  ctx.clearRect(0, 0, w, 180);
  const maxVal = Math.max(...dailySales.value.map((d: any) => Number(d.amount)), 1);
  const barW = Math.max(25, (w - pad * 2) / dailySales.value.length * 0.6);
  const step = (w - pad * 2) / dailySales.value.length;
  // 从 CSS 变量或主题配置获取颜色，降级到默认值
  const barColor = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim() || "#9b1c31";
  dailySales.value.forEach((d: any, i: number) => {
    const x = pad + step * i + (step - barW) / 2;
    const val = Number(d.amount);
    const y = h - (val / maxVal) * (h - 20);
    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barW, h - y);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((d.date || "").slice(5), x + barW / 2, h + 14);
  });
}
const saleBills = ref<any[]>([]);
const saleBillTotal = ref(0);
const saleBillPage = ref(1);
const saleBillPageSize = ref(20);
const saleBillKeyword = ref("");
const saleBillStatusFilter = ref("");
const saleBillDetail = ref<any | null>(null);
const detailVisible = ref(false);
const holdDialogVisible = ref(false);
const holdOrders = ref<any[]>([]);
const detailShareUrl = ref("");
const currentBillNo = ref("");
const currentAmount = ref(0);
const shareUrl = ref("");
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const loginForm = reactive({ username: "", password: "" });
const saleForm = reactive({
  customerId: 0,
  customerName: "",
  customerMobile: "",
  taxEnabled: false,
  taxRate: 0.13
});

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

const cashierActiveCategory = ref("全部");
const cashierDiscount = ref(0);
const cashierRoundDown = ref(0);
const cashierReceivedAmount = ref(0);
const cashierRemark = ref("");
const cashierRemarkTemp = ref("");
const remarkDialogVisible = ref(false);
const cashierSelectedCustomer = ref<any>(null);
const memberLoading = ref(false);

const paymentMethodsList = [
  { value: "CASH", label: "现金", icon: "💵" },
  { value: "WECHAT", label: "微信", icon: "💚" },
  { value: "ALIPAY", label: "支付宝", icon: "💙" }
];

const quickAmounts = [50, 100, 200, 500];

const remarkTags = ["带走", "堂食", "开发票", "少冰", "常温", "加急"];

const cashierCategories = computed(() => {
  const cats = new Set<string>();
  cats.add("全部");
  productOptions.value.forEach(p => {
    if (p.categoryName) cats.add(p.categoryName);
    if (p.category) cats.add(p.category);
  });
  return Array.from(cats).slice(0, 8);
});

const filteredProducts = computed(() => {
  const cat = cashierActiveCategory.value;
  if (cat && cat !== "全部") {
    return productOptions.value.filter(p => p.categoryName === cat || p.category === cat);
  }
  return productOptions.value;
});

const cashierTotal = computed(() => {
  return Math.max(0, cartAmount.value - cashierDiscount.value - cashierRoundDown.value);
});

const cashierChange = computed(() => {
  return Math.max(0, cashierReceivedAmount.value - cashierTotal.value);
});

const cartTotalCount = computed(() => {
  return cartItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
});

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function filterProductsByCategory() {
}

function increaseQty(index: number) {
  cartItems.value[index].quantity = Number(cartItems.value[index].quantity || 0) + 1;
}

function decreaseQty(index: number) {
  if (Number(cartItems.value[index].quantity) > 1) {
    cartItems.value[index].quantity = Number(cartItems.value[index].quantity) - 1;
  } else {
    removeCartItem(index);
  }
}

function clearCart() {
  cartItems.value = [];
  cashierDiscount.value = 0;
  cashierRoundDown.value = 0;
  cashierReceivedAmount.value = 0;
  cashierSelectedCustomer.value = null;
  cashierRemark.value = "";
  saleForm.customerId = 0;
  saleForm.customerName = "";
  saleForm.customerMobile = "";
  currentBillNo.value = "";
  currentAmount.value = 0;
}

function saveRemark() {
  cashierRemark.value = cashierRemarkTemp.value;
  remarkDialogVisible.value = false;
}

async function remoteSearchMembers(keyword: string) {
  if (!keyword) {
    memberOptions.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    const data = await searchStoreMembers(keyword.trim());
    memberOptions.value = data.records || [];
  } finally {
    memberLoading.value = false;
  }
}

function handleCustomerChange(member: any) {
  if (member) {
    saleForm.customerId = Number(member.memberId || member.id || 0);
    saleForm.customerName = member.name || "";
    saleForm.customerMobile = member.mobile || "";
  } else {
    saleForm.customerId = 0;
    saleForm.customerName = "";
    saleForm.customerMobile = "";
  }
}

async function handleSubmitSale() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("购物车为空");
    return;
  }
  loading.value = true;
  try {
    const result = await createSaleBill({
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      remark: cashierRemark.value,
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity || 1),
        boxQty: Number(item.boxQty || 0),
        bottleQty: Number(item.quantity || 1),
        totalBottleQty: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        priceType: "STORE"
      })),
      discountAmount: cashierDiscount.value,
      roundDownAmount: cashierRoundDown.value
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cashierTotal.value || 0);

    if (paymentMethod.value === "CASH" && cashierReceivedAmount.value > 0) {
      await createOfflinePayment(currentBillNo.value, cashierTotal.value, paymentMethod.value);
      ElMessage.success(`收款成功，找零：¥${formatYuan(cashierChange.value)}`);
      clearCart();
    } else if (paymentMethod.value !== "CASH") {
      await createOfflinePayment(currentBillNo.value, cashierTotal.value, paymentMethod.value);
      ElMessage.success("收款成功");
      clearCart();
    } else {
      ElMessage.success("销售单创建成功，请输入收款金额");
    }

    await Promise.all([loadSaleBills(), loadInventory(), loadDashboard()]);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "创建销售单失败"));
  } finally {
    loading.value = false;
  }
}

const cards = computed(() => [
  { label: "今日销售额", value: formatYuan(dashboard.value.todaySalesAmount), desc: "销售单汇总" },
  { label: "待收款", value: formatYuan(dashboard.value.unReceivedAmount), desc: "未收销售单金额" },
  { label: "待处理订单", value: String(dashboard.value.pendingOrderCount || 0), desc: "待接单小程序订单" },
  { label: "今日订单", value: String(dashboard.value.todayOrderCount || 0), desc: "今日小程序订单数" },
  { label: "本月累计销售", value: formatYuan(dashboardOverview.value.monthSalesAmount), desc: "本月销售单汇总" },
  { label: "本月累计订单", value: String(dashboardOverview.value.monthOrderCount), desc: "本月小程序订单数" }
]);

function getLoginUserStoreId(): number {
  try {
    const raw = localStorage.getItem("login_response");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user?.storeId) return Number(parsed.user.storeId);
      if (parsed?.storeId) return Number(parsed.storeId);
    }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem("store_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.storeId) return Number(parsed.storeId);
    }
  } catch { /* ignore */ }
  throw new Error("无法获取当前门店ID，请重新登录");
}

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function runStoreAction(action: () => Promise<void>, fallback: string) {
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
  await runStoreAction(async () => {
    const result = await storeLogin(loginForm.username, loginForm.password);
    localStorage.setItem("store_token", result.token);
    localStorage.setItem("login_response", JSON.stringify(result));
    token.value = result.token;
    ElMessage.success("登录成功，正在加载门店数据");
    await Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadDashboard(), loadDashboardOverview(), loadDailySales(), loadInventoryAlerts(), loadRefundOrders()]);
  }, "登录失败，请检查门店账号或稍后再试");
}

async function handleLogout() {
  const confirmed = await ElMessageBox.confirm("确认退出当前登录?", "确认退出", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  localStorage.removeItem("store_token");
  token.value = "";
  activeNav.value = "工作台";
  window.dispatchEvent(new Event("auth:logout"));
  ElMessage.success("已退出登录");
}

async function handleSearchProducts() {
  loading.value = true;
  try {
    const data = await searchStoreProducts(productKeyword.value.trim());
    productOptions.value = data.records || [];
    if (productOptions.value.length === 0) {
      ElMessage.info("未找到匹配商品");
    }
  } finally {
    loading.value = false;
  }
}

async function handleSearchMembers() {
  loading.value = true;
  try {
    const data = await searchStoreMembers(memberKeyword.value.trim());
    memberOptions.value = data.records || [];
    if (memberOptions.value.length === 0) {
      ElMessage.info("未找到匹配客户");
    }
  } finally {
    loading.value = false;
  }
}

function selectMember(row: any) {
  saleForm.customerId = Number(row.memberId || row.id || 0);
  saleForm.customerName = row.name || "";
  saleForm.customerMobile = row.mobile || "";
  ElMessage.success(`已选择客户：${saleForm.customerName || "散客"}`);
}

function addCartItem(row: any) {
  const skuId = Number(row.skuId || row.id);
  if (!skuId) {
    ElMessage.warning("当前商品缺少 SKU ID");
    return;
  }
  const unitPrice = Number(row.storePrice || row.retailPrice || 0);
  if (unitPrice <= 0) {
    ElMessage.warning("该商品单价为 0，请确认价格后再加入购物车");
    return;
  }
  const existed = cartItems.value.find((item) => Number(item.skuId) === skuId);
  if (existed) {
    existed.quantity = Number(existed.quantity || 0) + 1;
    return;
  }
  cartItems.value.push({
    skuId,
    skuName: row.skuName || row.productName || `SKU-${skuId}`,
    productName: row.productName || "",
    quantity: 1,
    unitPrice,
    availableQty: Number(row.availableQty || 0)
  });
}

function removeCartItem(index: number) {
  cartItems.value.splice(index, 1);
}

async function handleCreateSaleBill() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createSaleBill({
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity || 1),
        boxQty: Number(item.boxQty || 0),
        bottleQty: Number(item.quantity || 1),
        totalBottleQty: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        priceType: "STORE"
      }))
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);
    shareUrl.value = "";
    ElMessage.success("销售单创建成功");
    await loadSaleBills();
  } finally {
    loading.value = false;
  }
}

async function handleOfflinePayment() {
  if (!currentBillNo.value || currentAmount.value <= 0) {
    ElMessage.warning("请先创建有应收金额的销售单");
    return;
  }
  loading.value = true;
  try {
    await createOfflinePayment(currentBillNo.value, currentAmount.value, paymentMethod.value);
    ElMessage.success("线下收款成功");
    currentAmount.value = 0;
    cartItems.value = [];
    await Promise.all([loadSaleBills(), loadPaymentOrders(), loadInventory(), loadInventoryLogs(), loadDashboard()]);
  } finally {
    loading.value = false;
  }
}

async function handleCreateHoldOrder() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  try {
    const result = await createHoldOrder({
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      amount: cartAmount.value,
      remark: "快速收银挂单",
      items: cartItems.value.map((item) => ({
        skuId: Number(item.skuId),
        skuName: item.skuName,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        subtotalAmount: Number(item.quantity || 0) * Number(item.unitPrice || 0)
      }))
    });
    ElMessage.success(`已挂单：${result.holdNo}`);
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "挂单失败，请重试"));
  }
}

async function loadHoldOrders() {
  try {
    const data = await fetchHoldOrders();
    holdOrders.value = data.records || [];
  } catch {
    ElMessage.warning("挂单列表加载失败");
  }
}

async function handleRestoreHoldOrder(holdNo: string) {
  try {
    const data = await restoreHoldOrder(holdNo);
    saleForm.customerName = data.customerName || "";
    saleForm.customerMobile = data.customerMobile || "";
    saleForm.customerId = Number(data.customerId || 0);
    cartItems.value = (data.items || []).map((item: any) => ({
      skuId: Number(item.skuId || 0),
      skuName: item.skuName || `SKU-${item.skuId}`,
      quantity: Number(item.quantity || item.totalBottleQty || 1),
      unitPrice: Number(item.unitPrice || 0),
      availableQty: 0
    }));
    holdDialogVisible.value = false;
    ElMessage.success(`已取单：${holdNo}`);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "取单失败，请重试"));
  }
}

async function handleDeleteHoldOrder(holdNo: string) {
  try {
    await deleteHoldOrder(holdNo);
    ElMessage.success("挂单已删除");
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "删除挂单失败，请重试"));
  }
}

async function handleShareCollection() {
  if (!currentBillNo.value) return;
  try {
    const result = await createCollectionLink(currentBillNo.value, currentAmount.value, { taxEnabled: saleForm.taxEnabled, taxRate: saleForm.taxRate });
    shareUrl.value = `${location.origin}${result.shareUrl}`;
    ElMessage.success("分享收款链接已生成");
    await loadSaleBills();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "生成分享收款失败，请重试"));
  }
}

async function loadInventory(keyword?: string) {
  try {
    inventory.value = await fetchInventory(keyword);
  } catch {
    ElMessage.warning("库存接口暂不可用，请确认后端和数据库已启动");
  }
}

function openInvAdjust(row: any) {
  invForm.skuId = row.skuId;
  invForm.skuName = row.skuName;
  invForm.stockType = row.stockType;
  invForm.change = 0;
  invForm.remark = "";
  invDialogVisible.value = true;
}

async function handleInvAdjust() {
  if (!invForm.skuId) return;
  await invFormRef.value?.validate();
  const confirmed = await ElMessageBox.confirm(`确认调整 ${invForm.skuName || "该商品"} 的 ${invForm.stockType} 库存 ${invForm.change > 0 ? "+" : ""}${invForm.change}?`, "确认调整", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await adjustInventory({
      skuId: invForm.skuId,
      stockType: invForm.stockType,
      change: invForm.change,
      remark: invForm.remark
    });
    ElMessage.success("调整成功");
    invDialogVisible.value = false;
    await loadInventory();
  } finally {
    loading.value = false;
  }
}

async function loadInventoryLogs() {
  try {
    const data = await fetchInventoryLogs();
    inventoryLogs.value = data.records || [];
  } catch {
    ElMessage.warning("库存流水接口暂不可用，请确认后端和数据库已启动");
  }
}

async function loadCollectionLinks() {
  try {
    const data = await fetchStoreCollectionLinks();
    collectionLinks.value = data.records || [];
  } catch {
    ElMessage.warning("收款记录接口暂不可用");
  }
}

async function loadPaymentOrders() {
  try {
    const data = await fetchStorePaymentOrders();
    paymentOrders.value = data.records || [];
  } catch {
    ElMessage.warning("支付记录接口暂不可用");
  }
}

async function loadRefundOrders() {
  try {
    const data = await fetchStoreRefundOrders();
    refundOrders.value = data.records || [];
  } catch {
    ElMessage.warning("退款记录接口暂不可用");
  }
}

async function loadSaleBills(params?: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number }) {
  try {
    const data = await fetchSaleBills(params);
    saleBills.value = data.records || [];
    saleBillTotal.value = Number(data.total || 0);
  } catch {
    ElMessage.warning("销售单接口暂不可用，请确认后端和数据库已启动");
  }
}

async function loadOrders() {
  try {
    const data = await fetchStoreOrders();
    orders.value = data.records || [];
  } catch {
    ElMessage.warning("订单接口暂不可用，请确认后端和数据库已启动");
  }
}

async function handleAcceptOrder(orderNo: string) {
  try {
    await acceptStoreOrder(orderNo);
    ElMessage.success("已接单");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "接单失败，请重试"));
  }
}

async function handleCompleteOrder(orderNo: string) {
  loading.value = true;
  try {
    await completeStoreOrder(orderNo);
    ElMessage.success("订单已完成");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "完成配送失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function handleStartDelivery(orderNo: string) {
  loading.value = true;
  try {
    await startDelivery(orderNo);
    ElMessage.success("已开始配送");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "开始配送失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function handleRejectOrder(orderNo: string) {
  const confirmed = await ElMessageBox.confirm("确认拒单？拒单后不可撤销。", "确认拒单", { type: "warning" }).catch(() => null);
  if (!confirmed) return;
  loading.value = true;
  try {
    await rejectStoreOrder(orderNo);
    ElMessage.success("已拒单");
    await loadOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "拒单失败，请重试"));
  } finally {
    loading.value = false;
  }
}

function handleSearchInventory() {
  const keyword = inventoryKeyword.value.trim();
  loadInventory(keyword || undefined);
}

function handleSearchSaleBills() {
  saleBillPage.value = 1;
  const params: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number } = {
    page: saleBillPage.value,
    pageSize: saleBillPageSize.value
  };
  if (saleBillKeyword.value.trim()) params.keyword = saleBillKeyword.value.trim();
  if (saleBillStatusFilter.value) params.collectionStatus = saleBillStatusFilter.value;
  loadSaleBills(params);
}

function handleSaleBillPageChange(page: number) {
  saleBillPage.value = page;
  const params: { keyword?: string; collectionStatus?: string; page?: number; pageSize?: number } = {
    page: saleBillPage.value,
    pageSize: saleBillPageSize.value
  };
  if (saleBillKeyword.value.trim()) params.keyword = saleBillKeyword.value.trim();
  if (saleBillStatusFilter.value) params.collectionStatus = saleBillStatusFilter.value;
  loadSaleBills(params);
}

async function openStoreOrderDetail(orderNo: string) {
  loading.value = true;
  try {
    orderDetail.value = await fetchStoreOrderDetail(orderNo);
    orderDetailVisible.value = true;
  } finally {
    loading.value = false;
  }
}

async function openSaleBillDetail(billNo: string) {
  try {
    saleBillDetail.value = await fetchSaleBillDetail(billNo);
    detailShareUrl.value = "";
    detailVisible.value = true;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载销售单详情失败，请重试"));
  }
}

async function shareExistingBill(row: any) {
  const amount = Number(row.unreceivedAmount || row.receivableAmount || 0);
  if (!row.billNo || amount <= 0) {
    ElMessage.warning("当前销售单没有可收金额");
    return;
  }
  try {
    const result = await createCollectionLink(row.billNo, amount, { taxEnabled: saleForm.taxEnabled, taxRate: saleForm.taxRate });
    const url = `${location.origin}${result.shareUrl}`;
    if (detailVisible.value) {
      detailShareUrl.value = url;
    } else {
      shareUrl.value = url;
    }
    ElMessage.success("分享收款链接已生成");
    await loadSaleBills();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "生成分享收款失败，请重试"));
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("auth:logout", () => {
      token.value = "";
      activeNav.value = "工作台";
      ElMessage.warning("登录已过期，请重新登录");
    });
  }
  if (token.value) {
    Promise.allSettled([loadInventory(), loadSaleBills(), loadOrders(), loadInventoryLogs(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDashboard(), loadDashboardOverview(), loadDailySales(), loadInventoryAlerts(), loadStoreControlStatus()]).then((results) => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        ElMessage.warning(`${failed.length} 个接口加载失败，请确认后端和数据库已启动`);
      }
    });
  }
});

// ==================== Daily Settle (Task 5) ====================
const dailySettleDateRange = ref<string[]>([]);
const dailySettleResult = ref<any>(null);
const dailySettleActualCash = ref(0);
const dailySettleHistory = ref<any[]>([]);

const cashDifference = computed(() => {
  if (!dailySettleResult.value) return 0;
  return Number(dailySettleActualCash.value) - Number(dailySettleResult.value.systemCash);
});

async function handleDailySettle() {
  if (!dailySettleDateRange.value || dailySettleDateRange.value.length < 2) {
    ElMessage.warning("请选择日期范围");
    return;
  }
  loading.value = true;
  try {
    // 当前后端仅支持单日期日结，使用日期范围的开始日期
    // TODO: 后端支持日期范围后，传入 startDate/endDate
    const result = await submitDailySettle({
      settleDate: dailySettleDateRange.value[0]
    });

    // 使用后端返回的真实数据
    dailySettleResult.value = {
      periodStart: result.periodStart || dailySettleDateRange.value[0],
      periodEnd: result.periodEnd || dailySettleDateRange.value[1],
      orderCount: Number(result.orderCount || 0),
      totalSales: Number(result.totalSales || 0),
      totalReceived: Number(result.totalReceived || 0),
      totalRefund: Number(result.totalRefund || 0),
      systemCash: Number(result.cashAmount || 0),
      wechatAmount: Number(result.wechatAmount || 0),
      alipayAmount: Number(result.alipayAmount || 0),
      transferAmount: Number(result.transferAmount || 0),
      otherAmount: Number(result.otherAmount || 0),
      operatorName: result.operatorName || "",
      paymentBreakdown: [
        { method: "现金", amount: Number(result.cashAmount || 0), count: Number(result.cashCount || 0) },
        { method: "微信支付", amount: Number(result.wechatAmount || 0), count: Number(result.wechatCount || 0) },
        { method: "支付宝", amount: Number(result.alipayAmount || 0), count: Number(result.alipayCount || 0) },
        { method: "转账", amount: Number(result.transferAmount || 0), count: Number(result.transferCount || 0) },
        { method: "其他", amount: Number(result.otherAmount || 0), count: Number(result.otherCount || 0) }
      ]
    };
    dailySettleActualCash.value = dailySettleResult.value.systemCash;

    ElMessage.success("日结单已生成并提交");
    await loadDailySettleHistory();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "日结失败，请重试"));
  } finally {
    loading.value = false;
  }
}

async function loadDailySettleHistory() {
  try {
    const data = await fetchDailySettleHistory();
    dailySettleHistory.value = data.records || [];
  } catch {
    // 静默失败
  }
}

function handlePrintDailySettle() {
  if (!dailySettleResult.value) return;
  const content = `
    ===== 门店日结单 =====
    期间: ${dailySettleResult.value.periodStart} ~ ${dailySettleResult.value.periodEnd}
    订单数: ${dailySettleResult.value.orderCount}
    销售金额: ${formatYuan(dailySettleResult.value.totalSales)}
    收款金额: ${formatYuan(dailySettleResult.value.totalReceived)}
    退款金额: ${formatYuan(dailySettleResult.value.totalRefund)}
    系统应收现金: ${formatYuan(dailySettleResult.value.systemCash)}
    实际点钞: ${formatYuan(dailySettleActualCash)}
    现金差异: ${formatYuan(cashDifference.value)}
    ======================
  `;
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${content}</pre>`);
    printWindow.document.close();
    printWindow.print();
    ElMessage.success("日结单已发送到打印");
  } else {
    // 弹窗被拦截时，显示打印内容让用户手动复制
    ElMessageBox.alert(`<pre style="font-family:monospace;font-size:14px;padding:12px;white-space:pre-wrap">${content}</pre>`, "打印内容（请手动复制）", {
      dangerouslyUseHTMLString: true,
      confirmButtonText: "关闭"
    });
  }
}

// ==================== 门店管控 ====================
const storeStatus = ref("");
const storeControlStatusData = ref<any>(null);
const storeControlConfig = ref<any>(null);
const storeControlMyLogs = ref<any[]>([]);

async function loadStoreControlStatus() {
  try {
    const data = await fetchStoreControlStatus();
    storeControlStatusData.value = data;
    storeStatus.value = data?.status || "OPEN";
    storeControlConfig.value = data?.config || null;
  } catch { /* silent */ }
}

async function loadStoreControlMyLogs() {
  try {
    const data = await fetchStoreControlMyLogs();
    storeControlMyLogs.value = data.records || [];
  } catch { /* silent */ }
}

// ==================== 调拨模块 ====================
const storeTransferTab = ref("received");
const storeInTransitList = ref<any[]>([]);
const storeMyShipmentList = ref<any[]>([]);
const receiveDialogVisible = ref(false);
const receiveDialogItems = ref<any[]>([]);
const receiveTransferId = ref(0);

async function loadStoreInTransit() {
  try { storeInTransitList.value = (await fetchStoreInTransitTransfers()) || []; } catch { storeInTransitList.value = []; }
}

async function loadStoreMyShipments() {
  try { storeMyShipmentList.value = (await fetchStoreMyShipments()) || []; } catch { storeMyShipmentList.value = []; }
}

async function openReceiveDialog(row: any) {
  receiveTransferId.value = row.id;
  // 直接从 row 对象渲染收货明细，不再调用盘点详情API
  receiveDialogItems.value = (row.items || []).map((item: any) => ({
    ...item,
    thisReceiveQty: item.quantity - item.receivedQty
  }));
  receiveDialogVisible.value = true;
}

async function handleReceiveTransfer() {
  const items = receiveDialogItems.value
    .filter((item: any) => item.thisReceiveQty > 0)
    .map((item: any) => ({ itemId: item.id, receivedQty: item.thisReceiveQty }));
  if (items.length === 0) {
    ElMessage.warning("请输入收货数量");
    return;
  }
  try {
    await receiveStoreTransfer(receiveTransferId.value, { items });
    ElMessage.success("收货确认成功");
    receiveDialogVisible.value = false;
    loadStoreInTransit();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "收货失败");
  }
}

// ==================== 盘点模块 ====================
const storeStockCheckList = ref<any[]>([]);
const scInputDialogVisible = ref(false);
const scInputItems = ref<any[]>([]);
const scInputCheckId = ref(0);

async function loadStoreStockChecks() {
  try { storeStockCheckList.value = (await fetchStoreStockChecks()) || []; } catch { storeStockCheckList.value = []; }
}

async function openScInputDialog(row: any) {
  scInputCheckId.value = row.id;
  try {
    const detail = await fetchStoreStockCheckDetail(row.id);
    scInputItems.value = (detail.items || []).map((item: any) => ({ ...item }));
    scInputDialogVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "获取详情失败");
  }
}

async function handleSaveScItems() {
  try {
    for (const item of scInputItems.value) {
      await updateStockCheckItem(scInputCheckId.value, item.id, { actualQty: item.actualQty });
    }
    ElMessage.success("实盘数量已保存");
    scInputDialogVisible.value = false;
    loadStoreStockChecks();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  }
}

async function handleSubmitStockCheck(row: any) {
  try {
    await submitStoreStockCheck(row.id);
    ElMessage.success("盘点已提交");
    loadStoreStockChecks();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "提交失败");
  }
}
</script>
