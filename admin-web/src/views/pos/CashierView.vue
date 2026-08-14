<template>
  <div class="pos-cashier">
    <!-- 工作区：分类 | 商品 | 购物车（对标设计稿收银台左右布局） -->
    <div class="cashier-workspace">
      <!-- 左侧：商品分类（固定可见，彩色分类标识） -->
      <aside class="category-panel">
        <div class="category-panel-title">商品分类</div>
        <div
          class="category-item"
          :class="{ active: activeCategory === 0 }"
          @click="selectCategory(0)"
        >
          <span class="category-dot category-dot--all"></span>
          <span class="category-name">全部</span>
          <span class="category-count">{{ productOptions.length }}</span>
        </div>
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="category-item"
          :class="{ active: activeCategory === cat.id }"
          @click="selectCategory(cat.id)"
        >
          <span class="category-dot" :style="{ background: categoryColor(cat.id) }"></span>
          <span class="category-name">{{ cat.name }}</span>
          <span class="category-count">{{ categoryCount(cat.id) }}</span>
        </div>
      </aside>

      <!-- 中间：商品搜索与列表 -->
      <section class="product-panel">
        <div class="product-searchbar">
          <el-input
            ref="productSearchRef"
            v-model="productKeyword"
            class="product-search-input"
            placeholder="搜索商品名称 / 条码 / 拼音首字母，扫码枪直接扫描"
            clearable
            @keyup.enter="handleSearchProducts"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button class="scan-button" :loading="loading" @click="handleScan">
            <el-icon class="btn-icon"><FullScreen /></el-icon>
            扫码
          </el-button>
          <el-button type="primary" class="search-button" :loading="loading" @click="handleSearchProducts">
            搜索
          </el-button>
          <el-button class="settings-button" title="收银硬件设置" @click="openSettingsDialog">
            <el-icon class="btn-icon"><Setting /></el-icon>
            设置
          </el-button>
        </div>

        <div v-if="productOptions.length === 0" class="empty-state">
          <el-empty description="输入关键词搜索商品，或点击分类浏览" />
        </div>
        <div v-else class="product-grid">
          <div
            v-for="product in filteredProducts"
            :key="product.skuId || product.id"
            class="product-card"
            :class="{ 'is-out': Number(product.availableQty ?? 0) <= 0 }"
            @click="addCartItem(product)"
          >
            <div class="product-card-top">
              <span class="product-cat-dot" :style="{ background: categoryColor(product.categoryId) }"></span>
              <span class="product-stock" :class="stockClass(product.availableQty ?? 0)">
                {{ stockText(product.availableQty ?? 0) }}
              </span>
            </div>
            <div class="product-name">{{ product.productName || product.skuName }}</div>
            <div class="product-spec">{{ product.skuName || "标准规格" }}</div>
            <div class="product-card-bottom">
              <div class="product-price">
                <span class="price-symbol">¥</span>
                <span class="price-value">{{ Number(product.storePrice || product.retailPrice || 0).toFixed(2) }}</span>
              </div>
              <button
                class="add-btn"
                :disabled="Number(product.availableQty ?? 0) <= 0"
                @click.stop="addCartItem(product)"
              >
                <el-icon><Plus /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：购物车与结算 -->
      <section class="cart-panel">
        <!-- 会员信息 -->
        <div class="member-section">
          <div class="member-selected">
            <span class="member-avatar"><el-icon><User /></el-icon></span>
            <div class="member-meta">
              <div class="member-name">{{ saleForm.customerName || "散户" }}</div>
              <div class="member-phone">{{ saleForm.customerId > 0 ? (saleForm.customerMobile || "会员") : "散户" }}</div>
            </div>
            <!-- 会员选择框：默认散户，下拉直接选择会员，选中即切换为会员 -->
            <el-select
              v-model="selectedMemberId"
              filterable
              remote
              clearable
              size="small"
              placeholder="识别 / 选择会员"
              :remote-method="handleSearchMembers"
              :loading="memberLoading"
              class="member-select"
              @change="onMemberSelect"
              @clear="useWalkInCustomer"
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
              <el-option
                v-for="m in memberOptions"
                :key="m.memberId || m.id"
                :label="`${m.name} ${m.mobile || ''}`"
                :value="m.memberId || m.id"
              />
            </el-select>
          </div>
        </div>

        <!-- 购物车列表 -->
        <div class="cart-list" :class="{ empty: cartItems.length === 0 }">
          <template v-if="cartItems.length > 0">
            <div v-for="(item, index) in cartItems" :key="item.skuId" class="cart-row">
              <div class="cart-row-main">
                <div class="cart-row-name">{{ item.skuName }}</div>
                <div v-if="item.traceCodes?.length" class="cart-row-trace">
                  <span v-for="(c, i) in item.traceCodes" :key="i" class="trace-chip" :title="c">
                    {{ shortTrace(c) }}
                  </span>
                </div>
                <div v-if="editingPriceIdx === index" class="cart-row-price">
                  <span class="cart-row-price-symbol">¥</span>
                  <el-input-number
                    v-model="item.unitPrice"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    size="small"
                    class="cart-row-price-input"
                    :ref="(el: any) => priceInputRefs[index] = el"
                    @change="confirmPriceEdit(index)"
                    @blur="confirmPriceEdit(index)"
                    @keyup.enter="confirmPriceEdit(index)"
                  />
                </div>
                <div v-else class="cart-row-price cart-row-price--static" @click="startPriceEdit(index)">
                  <span class="cart-row-price-symbol">¥</span>
                  <span class="cart-row-price-text">{{ Number(item.unitPrice).toFixed(2) }}</span>
                </div>
              </div>
              <div class="cart-row-qty">
                <button class="qty-btn" @click="decreaseQty(index)">−</button>
                <span class="qty-value">{{ item.quantity }}</span>
                <button class="qty-btn" @click="increaseQty(index)">+</button>
              </div>
              <div class="cart-row-amount">¥{{ (item.unitPrice * item.quantity).toFixed(2) }}</div>
              <button class="cart-row-trace-btn" title="扫追溯码" @click="openTraceDialog(index)">追溯</button>
              <button class="cart-row-del" @click="removeCartItem(index)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </template>
          <div v-else class="cart-empty">
            <el-icon class="cart-empty-icon"><ShoppingCart /></el-icon>
            <span>点击左侧商品加入购物车</span>
          </div>
        </div>

        <!-- 金额汇总 -->
        <div class="cart-summary">
          <div class="summary-row">
            <span>商品件数</span>
            <span class="summary-num">{{ totalQty }} 件</span>
          </div>
          <div class="summary-row total">
            <span>应收金额</span>
            <span class="total-amount">
              <span class="price-symbol">¥</span>{{ cartAmount.toFixed(2) }}
            </span>
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="pay-methods">
          <button
            v-for="m in payMethodOptions"
            :key="m.value"
            class="pay-method-btn"
            :class="{ active: paymentMethod === m.value }"
            @click="paymentMethod = m.value"
          >
            <span
              class="pay-method-icon"
              :class="payIconClass(m.value)"
            >
              <PayMethodLogo :method="m.value" />
            </span>
            <span class="pay-method-name">{{ m.label }}</span>
          </button>
        </div>

        <!-- 功能导航 + 结算：结算占右侧两列并跨两行（填充原清空/打印位） -->
        <div class="cart-action-grid">
          <button class="action-btn" @click="handleCreateHoldOrder">
            <span class="action-kbd">F2</span>
            <span class="action-label">挂单</span>
          </button>
          <button class="action-btn" @click="holdDialogVisible = true">
            <span class="action-kbd">F4</span>
            <span class="action-label">取单</span>
          </button>
          <button class="action-btn" @click="cartItems = []">
            <span class="action-label">清空</span>
          </button>
          <button class="action-btn" @click="handlePrint">
            <span class="action-kbd">F9</span>
            <span class="action-label">打印</span>
          </button>
          <button class="checkout-btn" :disabled="cartItems.length === 0 || loading" @click="openPayDialog">
            <span class="checkout-label">结算</span>
            <span class="checkout-amount">
              <span class="price-symbol">¥</span>{{ cartAmount.toFixed(2) }}
            </span>
          </button>
        </div>

        <el-alert
          v-if="currentBillNo"
          type="success"
          :closable="false"
          class="bill-alert"
        >
          订单号：{{ currentBillNo }}
        </el-alert>
      </section>
    </div>

    <!-- 结算弹窗（对标设计稿 p12：应收 / 支付方式 / 实收 / 找零 / 确认收款 + 数字键盘） -->
    <el-dialog
      v-model="payDialogVisible"
      title="收款结算"
      width="680px"
      :close-on-click-modal="false"
      align-center
      class="pay-dialog"
    >
      <div class="pay-dialog-body">
        <div class="pay-amount-row">
          <span class="pay-amount-label">应收金额</span>
          <span class="pay-amount-value">¥{{ cartAmount.toFixed(2) }}</span>
        </div>
        <div class="pay-items-info">
          {{ totalQty }} 件商品 · {{ saleForm.customerName || "散客" }}
          <template v-if="paymentMethod === 'BALANCE'"> · 可用余额 ¥{{ memberBalance.toFixed(2) }}</template>
        </div>

        <div class="pay-method-title">支付方式</div>
        <div class="pay-method-grid">
          <button
            v-for="m in payMethodOptions"
            :key="m.value"
            class="pay-method-card"
            :class="{ active: paymentMethod === m.value }"
            @click="paymentMethod = m.value"
          >
            <span
              class="pay-method-icon"
              :class="payIconClass(m.value)"
            >
              <PayMethodLogo :method="m.value" />
            </span>
            <span>{{ m.label }}</span>
          </button>
        </div>

        <!-- 扫码收款（反扫）：扫码枪扫顾客付款码，自动识别微信/支付宝扣款 -->
        <div class="pay-code-section">
          <div class="pay-code-title">
            扫顾客付款码收款
            <span v-if="payCodeChannelLabel" class="pay-code-channel">{{ payCodeChannelLabel }}</span>
          </div>
          <div class="pay-code-input-row">
            <el-input
              ref="payCodeRef"
              v-model="payCode"
              class="pay-code-input"
              placeholder="用扫码枪扫顾客微信 / 支付宝付款码"
              clearable
              @keyup.enter="handlePayByCode"
            >
              <template #prefix><el-icon><FullScreen /></el-icon></template>
            </el-input>
            <el-button type="success" :loading="payCodeLoading" @click="handlePayByCode">
              扫码收款
            </el-button>
          </div>
          <div class="pay-code-hint">{{ payCodeHint }}</div>
        </div>

        <div class="pay-received-row">
          <span class="pay-received-label">实收金额</span>
          <span class="pay-received-value">¥{{ receivedAmount.toFixed(2) }}</span>
        </div>

        <!-- 数字键盘：快速收银输入 -->
        <div class="numpad">
          <button v-for="key in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']" :key="key" class="numpad-key" @click="numpadPress(key)">
            {{ key }}
          </button>
          <button class="numpad-key numpad-clear" @click="receivedAmount = 0">C</button>
          <button class="numpad-key numpad-equal" @click="receivedAmount = Number(cartAmount.toFixed(2))">应收</button>
        </div>

        <div v-if="changeAmount > 0" class="pay-change-row">
          <span>应找零</span>
          <span class="pay-change-value">¥{{ changeAmount.toFixed(2) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" size="large" :loading="loading" @click="confirmPayment">
          确认收款
        </el-button>
      </template>
    </el-dialog>

    <!-- 收银硬件设置 -->
    <el-dialog
      v-model="settingsDialogVisible"
      title="收银硬件设置"
      width="780px"
      align-center
      :close-on-click-modal="false"
    >
      <div class="hardware-settings" v-loading="hardwareLoading">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 14px"
          title="扫码枪即插即用：商品条码在搜索框扫描，顾客付款码在结算弹窗扫描；客显/电子秤为串口设备，需本机安装「智享打印助手」"
        />

        <el-collapse v-model="activeHardwareSection">
          <!-- 基础设置 -->
          <el-collapse-item name="basic" title="基础设置（钱箱 / 语音 / 聚焦）">
            <div class="hardware-setting-row">
              <div class="hardware-setting-meta">
                <div class="hardware-setting-name">现金收款后自动弹钱箱</div>
                <div class="hardware-setting-desc">需打印机连接 RJ11 钱箱口，经本地打印助手发送 ESC/POS 脉冲</div>
              </div>
              <el-switch v-model="hardwareSettings.cashDrawerEnabled" />
            </div>
            <div class="hardware-setting-row">
              <div class="hardware-setting-meta">
                <div class="hardware-setting-name">收款成功语音播报</div>
                <div class="hardware-setting-desc">浏览器语音播报收款金额，无需额外硬件</div>
              </div>
              <el-switch v-model="hardwareSettings.voiceEnabled" />
            </div>
            <div class="hardware-setting-row">
              <div class="hardware-setting-meta">
                <div class="hardware-setting-name">结算时自动聚焦付款码框</div>
                <div class="hardware-setting-desc">打开结算弹窗后直接扫顾客付款码，无需鼠标点击</div>
              </div>
              <el-switch v-model="hardwareSettings.scanPayAutoFocus" />
            </div>
          </el-collapse-item>

          <!-- 客显 -->
          <el-collapse-item name="display" title="客显（顾客显示屏，本机串口）">
            <div class="hw-grid">
              <div class="hw-field">
                <label>COM 口</label>
                <el-select v-model="hardwareSettings.displayPort" placeholder="选择串口" style="width: 100%">
                  <el-option v-for="p in serialPorts" :key="p" :label="p" :value="p" />
                </el-select>
              </div>
              <div class="hw-field">
                <label>波特率</label>
                <el-select v-model="hardwareSettings.displayBaudRate" style="width: 100%">
                  <el-option v-for="b in [9600, 19200, 38400, 115200]" :key="b" :label="b" :value="b" />
                </el-select>
              </div>
              <div class="hw-field">
                <label>协议</label>
                <el-select v-model="hardwareSettings.displayProtocol" style="width: 100%">
                  <el-option label="ESC/POS（启明/亿城等）" value="ESC_POS" />
                  <el-option label="VKP80（威肯/联迪）" value="VKP80" />
                  <el-option label="纯文本（UTF-8 屏）" value="TEXT" />
                  <el-option label="自定义十六进制模板" value="CUSTOM" />
                </el-select>
              </div>
              <div v-if="hardwareSettings.displayProtocol === 'CUSTOM'" class="hw-field hw-field--wide">
                <label>命令模板（hex，支持 {line1} {line2} {amount}）</label>
                <el-input v-model="hardwareSettings.displayTemplate" placeholder="如 1B5A1B4A7B6C696E65317D1B4B7B6C696E65327D" />
              </div>
            </div>
            <div class="hw-actions">
              <el-button size="small" :loading="displayTesting" @click="testCustomerDisplay">测试显示</el-button>
              <span class="hw-tip">结算打开时自动显示应收金额</span>
            </div>
          </el-collapse-item>

          <!-- 电子秤 -->
          <el-collapse-item name="scale" title="电子秤（本机串口）">
            <div class="hw-grid">
              <div class="hw-field">
                <label>COM 口</label>
                <el-select v-model="hardwareSettings.scalePort" placeholder="选择串口" style="width: 100%">
                  <el-option v-for="p in serialPorts" :key="p" :label="p" :value="p" />
                </el-select>
              </div>
              <div class="hw-field">
                <label>波特率</label>
                <el-select v-model="hardwareSettings.scaleBaudRate" style="width: 100%">
                  <el-option v-for="b in [9600, 19200, 38400, 115200]" :key="b" :label="b" :value="b" />
                </el-select>
              </div>
              <div class="hw-field">
                <label>协议</label>
                <el-select v-model="hardwareSettings.scaleProtocol" style="width: 100%">
                  <el-option label="连续输出（耀华/托利多等）" value="CONTINUOUS" />
                  <el-option label="命令应答（发命令后读数）" value="COMMAND" />
                </el-select>
              </div>
              <div v-if="hardwareSettings.scaleProtocol === 'COMMAND'" class="hw-field">
                <label>命令（hex）</label>
                <el-input v-model="hardwareSettings.scaleCommandHex" placeholder="如 57（W）" />
              </div>
            </div>
            <div class="hw-actions">
              <el-button size="small" :loading="scaleTesting" @click="testScale">读取重量</el-button>
              <span class="hw-tip">{{ scaleTestResult }}</span>
            </div>
          </el-collapse-item>

          <!-- 云喇叭 -->
          <el-collapse-item name="speaker" title="云喇叭 / 收款播报器（云端）">
            <div class="hw-grid">
              <div class="hw-field">
                <label>启用</label>
                <el-switch v-model="cloudSpeakerForm.enabled" />
              </div>
              <div class="hw-field">
                <label>服务商</label>
                <el-input v-model="cloudSpeakerForm.provider" placeholder="如 云喇叭/银盛" />
              </div>
              <div class="hw-field">
                <label>播报接口地址 apiUrl</label>
                <el-input v-model="cloudSpeakerForm.apiUrl" placeholder="服务商 HTTP 播报接口" />
              </div>
              <div class="hw-field">
                <label>设备号 deviceId</label>
                <el-input v-model="cloudSpeakerForm.deviceId" placeholder="云喇叭设备编号" />
              </div>
              <div class="hw-field">
                <label>密钥 secret</label>
                <el-input v-model="cloudSpeakerForm.secret" type="password" show-password placeholder="接口签名密钥（选填）" />
              </div>
            </div>
            <div class="hw-actions">
              <el-button size="small" :loading="speakerTesting" @click="testCloudSpeaker">测试播报</el-button>
              <span class="hw-tip">收款成功后自动播报金额</span>
            </div>
          </el-collapse-item>

          <!-- 收款盒子 -->
          <el-collapse-item name="box" title="收款盒子（聚合收款）">
            <div class="hw-grid">
              <div class="hw-field">
                <label>启用</label>
                <el-switch v-model="boxForm.enabled" />
              </div>
              <div class="hw-field">
                <label>服务商</label>
                <el-input v-model="boxForm.provider" placeholder="如 银盛/随行付/拉卡拉" />
              </div>
              <div class="hw-field">
                <label>激活码 / 设备号</label>
                <el-input v-model="boxForm.activationCode" placeholder="服务商后台生成的激活码" />
              </div>
              <div class="hw-field">
                <label>应用ID appId</label>
                <el-input v-model="boxForm.appId" placeholder="服务商开放平台应用ID（选填）" />
              </div>
              <div class="hw-field">
                <label>HTTP 接口 apiUrl</label>
                <el-input v-model="boxForm.apiUrl" placeholder="服务商金额下发接口（与串口二选一）" />
              </div>
              <div class="hw-field">
                <label>串口 COM（串口联动）</label>
                <el-input v-model="boxForm.comPort" placeholder="如 COM3（与 HTTP 二选一）" />
              </div>
              <div class="hw-field">
                <label>接口密钥 secret</label>
                <el-input v-model="boxForm.secret" type="password" show-password placeholder="签名密钥（选填）" />
              </div>
              <div class="hw-field hw-field--wide">
                <label>串口命令模板（hex，{amount} 占位）</label>
                <el-input v-model="boxForm.commandTemplate" placeholder="服务商串口协议指令模板" />
              </div>
            </div>
            <div class="hw-actions">
              <el-button size="small" :loading="boxTesting" @click="testBoxConfig">测试配置</el-button>
              <span class="hw-tip">HTTP 通道直接下发金额；串口通道经本地打印助手写入指令</span>
            </div>
          </el-collapse-item>

          <!-- 云闪付 -->
          <el-collapse-item name="unionpay" title="云闪付付款码（云端）">
            <div class="hw-grid">
              <div class="hw-field">
                <label>启用</label>
                <el-switch v-model="unionpayForm.enabled" />
              </div>
              <div class="hw-field">
                <label>网关地址 gatewayUrl</label>
                <el-input v-model="unionpayForm.gatewayUrl" placeholder="银联/聚合服务商网关接口" />
              </div>
              <div class="hw-field">
                <label>商户号 mchId</label>
                <el-input v-model="unionpayForm.mchId" placeholder="银联/聚合商户号" />
              </div>
              <div class="hw-field">
                <label>密钥 apiKey</label>
                <el-input v-model="unionpayForm.apiKey" type="password" show-password placeholder="网关签名密钥" />
              </div>
            </div>
            <div class="hw-actions">
              <el-button size="small" :loading="unionpayTesting" @click="testUnionpayConfig">测试连通</el-button>
              <span class="hw-tip">配置后结算弹窗可直接扫云闪付付款码（62 开头）</span>
            </div>
          </el-collapse-item>
        </el-collapse>

        <div class="hardware-setting-footer">
          <span>支付通道状态：</span>
          <template v-if="channelStatus">
            <el-tag size="small" :type="channelStatus.wechat.ready ? 'success' : 'info'" style="margin-right: 6px">
              微信{{ channelStatus.wechat.ready ? "已配置" : "未配置" }}
            </el-tag>
            <el-tag size="small" :type="channelStatus.alipay.ready ? 'success' : 'info'" style="margin-right: 6px">
              支付宝{{ channelStatus.alipay.ready ? "已配置" : "未配置" }}
            </el-tag>
            <el-tag size="small" :type="channelStatus.box.ready ? 'success' : 'info'">
              收款盒子{{ channelStatus.box.ready ? "已配置" : "未配置" }}
            </el-tag>
          </template>
          <el-tag v-else size="small" type="info">查询中</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="settingsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="hardwareSaving" @click="saveHardwareSettings">保存</el-button>
      </template>
    </el-dialog>

    <!-- 追溯码录入弹窗（连续扫码，扫完自动归入当前行） -->
    <el-dialog
      v-model="traceDialogVisible"
      title="扫追溯码"
      width="440px"
      align-center
      :close-on-click-modal="false"
      @open="focusTraceInput"
    >
      <div class="trace-dialog-body">
        <div class="trace-dialog-item" v-if="traceDialogItemIndex >= 0">
          当前商品：{{ cartItems[traceDialogItemIndex]?.skuName || "-" }}
          <span v-if="cartItems[traceDialogItemIndex]?.traceCodes?.length" class="trace-count">
            已录 {{ cartItems[traceDialogItemIndex].traceCodes.length }} 个
          </span>
        </div>
        <el-input
          ref="traceCodeRef"
          v-model="traceCodeInput"
          class="trace-code-input"
          placeholder="用扫码枪扫瓶盖 / 瓶身追溯码"
          clearable
          @keyup.enter="handleTraceDialogScan"
        >
          <template #prefix><el-icon><FullScreen /></el-icon></template>
        </el-input>
        <div class="trace-dialog-tip">连续扫码自动累加到当前商品；扫入后即锁定瓶码，出库时自动更新追溯状态</div>
      </div>
      <template #footer>
        <el-button @click="traceDialogVisible = false">完成</el-button>
      </template>
    </el-dialog>

    <!-- 挂单弹窗 -->
    <el-dialog v-model="holdDialogVisible" title="挂单列表" width="720px">
      <el-button type="primary" style="margin-bottom: 12px" @click="handleCreateHoldOrder">挂当前购物车</el-button>
      <el-table :data="holdOrders" size="small">
        <el-table-column prop="holdNo" label="挂单号" width="160" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleRestoreHoldOrder(row.holdNo)">取单</el-button>
            <el-button size="small" type="danger" link @click="handleDeleteHoldOrder(row.holdNo)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import {
  Search, User, Plus, Close, FullScreen, ShoppingCart, Setting
} from "@element-plus/icons-vue";
import PayMethodLogo from "../../components/pos/PayMethodLogo.vue";
import {
  searchStoreProducts,
  searchStoreMembers,
  fetchProductCategories,
  createStoreSaleBill,
  createStoreOfflinePayment,
  payStoreSaleBillByCode,
  fetchStorePaymentChannels,
  verifyStoreTraceCode,
  createStoreHoldOrder,
  fetchStoreHoldOrders,
  restoreStoreHoldOrder,
  deleteStoreHoldOrder
} from "../../api";
import { getLocalPrintConfig } from "../../modules/print/localConfig";
import { openPrintWindow, printBill, openCashDrawer } from "../../modules/print/printClient";
import {
  getPosHardwareSettings,
  savePosHardwareSettings,
  DEFAULT_POS_HARDWARE,
  type PosHardwareSettings,
} from "../../modules/pos/hardwareConfig";
import {
  fetchHardwareConfigs,
  saveHardwareConfig,
  fetchBoxConfig,
  saveBoxConfig,
  testBoxConfig as testBoxConfigApi,
  announceCloudSpeaker,
  testUnionpay,
} from "../../api/hardware";
import { listSerialPorts } from "../../modules/hardware/serialClient";
import { showCustomerDisplay } from "../../modules/hardware/customerDisplay";
import { readScaleWeight } from "../../modules/hardware/scale";
import { buildTableHtml, fmtMoney, rawHtml } from "../../modules/print/renderer";

const loading = ref(false);
const productKeyword = ref("");
const productSearchRef = ref();
const productOptions = ref<any[]>([]);
const categories = ref<any[]>([]);
const activeCategory = ref(0);
const memberKeyword = ref("");
const memberOptions = ref<any[]>([]);
const selectedMemberId = ref<number | null>(null);
const memberLoading = ref(false);
const cartItems = ref<any[]>([]);
const paymentMethod = ref("CASH");
const saleForm = reactive({
  customerId: 0,
  customerName: "散户",
  customerMobile: ""
});
const currentBillNo = ref("");
const currentAmount = ref(0);
const holdDialogVisible = ref(false);
const holdOrders = ref<any[]>([]);
const payDialogVisible = ref(false);
const receivedAmount = ref(0);
/** 会员可用余额（选中会员且有数据时展示，无则 0） */
const memberBalance = ref(0);
/** 付款码（反扫） */
const payCode = ref("");
const payCodeRef = ref();
const payCodeLoading = ref(false);
/** 追溯码录入 */
const traceDialogVisible = ref(false);
const traceDialogItemIndex = ref(-1);
const traceCodeInput = ref("");
const traceCodeRef = ref();
const traceScanLoading = ref(false);
/** 支付渠道状态（微信/支付宝/收款盒子） */
const channelStatus = ref<any>(null);
/** 收银硬件设置 */
const settingsDialogVisible = ref(false);
const hardwareSettings = ref<PosHardwareSettings>({ ...DEFAULT_POS_HARDWARE });
const activeHardwareSection = ref<string[]>(["basic"]);
const hardwareLoading = ref(false);
const hardwareSaving = ref(false);
const serialPorts = ref<string[]>([]);
const displayTesting = ref(false);
const scaleTesting = ref(false);
const scaleTestResult = ref("");
const speakerTesting = ref(false);
const boxTesting = ref(false);
const unionpayTesting = ref(false);

/** 云喇叭配置（租户级） */
const cloudSpeakerForm = reactive({
  enabled: false,
  provider: "",
  apiUrl: "",
  deviceId: "",
  secret: "",
});
/** 收款盒子配置（租户级，存 t_payment_config.box_config） */
const boxForm = reactive({
  enabled: false,
  provider: "",
  activationCode: "",
  appId: "",
  comPort: "",
  apiUrl: "",
  secret: "",
  commandTemplate: "",
});
/** 云闪付配置（租户级） */
const unionpayForm = reactive({
  enabled: false,
  gatewayUrl: "",
  mchId: "",
  apiKey: "",
});

/** 付款码渠道识别提示（前端预判，最终以后端为准） */
const payCodeChannelLabel = computed(() => {
  const code = payCode.value.trim();
  if (!/^\d{16,24}$/.test(code)) return "";
  const prefix = Number(code.slice(0, 2));
  if (code.length === 18 && prefix >= 10 && prefix <= 15) return "识别为：微信付款码";
  if (code.length >= 16 && code.length <= 24 && prefix >= 25 && prefix <= 30) return "识别为：支付宝付款码";
  if (code.length === 19 && code.startsWith("62")) return "识别为：云闪付付款码";
  return "";
});

/** 扫码收款提示（通道状态 + 输入引导） */
const payCodeHint = computed(() => {
  const code = payCode.value.trim();
  if (code && !/^\d{16,24}$/.test(code)) return "付款码为 16~24 位纯数字，请直接扫顾客手机上的付款码";
  if (channelStatus.value) {
    const readyChannels: string[] = [];
    if (channelStatus.value.wechat.ready) readyChannels.push("微信");
    if (channelStatus.value.alipay.ready) readyChannels.push("支付宝");
    if (readyChannels.length === 0) {
      return "微信/支付宝通道均未配置，扫码收款会提示失败；可先用现金/余额或手动确认收款";
    }
    return `支持通道：${readyChannels.join("、")}（未配置通道扫描后仍可点击确认收款手工记账）`;
  }
  return "正在检测支付通道…";
});

/** 支付方式配置：图标 + 文案（现金/微信/支付宝/余额） */
const payMethodOptions = [
  { value: "CASH", label: "现金" },
  { value: "WECHAT", label: "微信" },
  { value: "ALIPAY", label: "支付宝" },
  { value: "BALANCE", label: "余额" }
];

function payIconClass(value: string): string {
  const map: Record<string, string> = {
    CASH: "pay-method-icon--cash",
    WECHAT: "pay-method-icon--wechat",
    ALIPAY: "pay-method-icon--alipay",
    BALANCE: "pay-method-icon--balance",
  };
  return map[value] || "";
}

/** 分类色板：按 categoryId 循环取色，商品与分类颜色一致 */
const CATEGORY_COLORS = ["#3F6FEF", "#0EA879", "#D48B3A", "#C0392B", "#8B5CF6", "#06B6D4", "#E67E22", "#16A085"];

function categoryColor(id?: number): string {
  if (!id) return "#CCCCCC";
  const idx = Math.abs(Number(id)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[idx];
}

const totalQty = computed(() => cartItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));

const cartAmount = computed(() => cartItems.value.reduce((sum, item) => {
  return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
}, 0));

/** 应找零 = 实收 - 应收 */
const changeAmount = computed(() => {
  return Math.max(0, receivedAmount.value - cartAmount.value);
});

/** 按分类过滤后的商品列表（前端过滤，无需重复请求） */
const filteredProducts = computed(() => {
  if (activeCategory.value === 0) return productOptions.value;
  return productOptions.value.filter(
    (p) => Number(p.categoryId) === activeCategory.value
  );
});

/** 分类商品数量 */
function categoryCount(catId: number): number {
  return productOptions.value.filter((p) => Number(p.categoryId) === catId).length;
}

/** 库存状态：0 缺货红 / ≤10 告急橙 / 其余正常灰 */
function stockClass(stock: number): string {
  if (stock <= 0) return 'stock-out'
  if (stock <= 10) return 'stock-low'
  return 'stock-ok'
}

function stockText(stock: number): string {
  if (stock <= 0) return "缺货"
  if (stock <= 10) return `库存 ${stock}`
  return `库存 ${stock}`
}

onMounted(() => {
  loadHoldOrders();
  loadCategories();
  loadAllProducts();
  loadPosChannels();
  loadTenantHardwareConfigs();
  hardwareSettings.value = getPosHardwareSettings();
  window.addEventListener("keydown", handleHotkey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleHotkey);
});

/** 加载支付通道状态（微信/支付宝/收款盒子） */
async function loadPosChannels() {
  try {
    channelStatus.value = await fetchStorePaymentChannels();
  } catch {
    channelStatus.value = null;
  }
}

/** 打开硬件设置：加载本机串口 + 租户级配置 + 通道状态 */
async function openSettingsDialog() {
  settingsDialogVisible.value = true;
  hardwareLoading.value = true;
  try {
    hardwareSettings.value = getPosHardwareSettings();
    serialPorts.value = await listSerialPorts();
    await Promise.all([loadTenantHardwareConfigs(), loadPosChannels()]);
  } finally {
    hardwareLoading.value = false;
  }
}

/** 加载租户级硬件配置（云喇叭/收款盒子/云闪付） */
async function loadTenantHardwareConfigs() {
  try {
    const [configs, box] = await Promise.all([fetchHardwareConfigs(), fetchBoxConfig()]);
    const speaker = (configs || []).find((c: any) => c.category === "cloud_speaker");
    const unionpayCfg = (configs || []).find((c: any) => c.category === "unionpay");
    if (speaker) {
      cloudSpeakerForm.enabled = !!speaker.enabled;
      cloudSpeakerForm.provider = speaker.config?.provider || "";
      cloudSpeakerForm.apiUrl = speaker.config?.apiUrl || "";
      cloudSpeakerForm.deviceId = speaker.config?.deviceId || "";
      cloudSpeakerForm.secret = speaker.config?.secret || "";
    }
    if (unionpayCfg) {
      unionpayForm.enabled = !!unionpayCfg.enabled;
      unionpayForm.gatewayUrl = unionpayCfg.config?.gatewayUrl || "";
      unionpayForm.mchId = unionpayCfg.config?.mchId || "";
      unionpayForm.apiKey = unionpayCfg.config?.apiKey || "";
    }
    if (box) {
      boxForm.enabled = !!box.enabled;
      boxForm.provider = box.config?.provider || "";
      boxForm.activationCode = box.config?.activationCode || "";
      boxForm.appId = box.config?.appId || "";
      boxForm.comPort = box.config?.comPort || "";
      boxForm.apiUrl = box.config?.apiUrl || "";
      boxForm.commandTemplate = box.config?.commandTemplate || "";
    }
  } catch {
    // 租户级配置加载失败不阻断本机设置
  }
}

/** 保存收银硬件设置：本机（localStorage）+ 租户级（后端） */
async function saveHardwareSettings() {
  hardwareSaving.value = true;
  try {
    savePosHardwareSettings(hardwareSettings.value);
    await Promise.all([
      saveHardwareConfig("cloud_speaker", {
        provider: cloudSpeakerForm.provider,
        apiUrl: cloudSpeakerForm.apiUrl,
        deviceId: cloudSpeakerForm.deviceId,
        secret: cloudSpeakerForm.secret,
      }, cloudSpeakerForm.enabled),
      saveBoxConfig({
        provider: boxForm.provider,
        activationCode: boxForm.activationCode,
        appId: boxForm.appId,
        comPort: boxForm.comPort,
        apiUrl: boxForm.apiUrl,
        secret: boxForm.secret,
        commandTemplate: boxForm.commandTemplate,
      }, boxForm.enabled),
      saveHardwareConfig("unionpay", {
        gatewayUrl: unionpayForm.gatewayUrl,
        mchId: unionpayForm.mchId,
        apiKey: unionpayForm.apiKey,
      }, unionpayForm.enabled),
    ]);
    settingsDialogVisible.value = false;
    ElMessage.success("收银硬件设置已保存");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "保存硬件设置失败"));
  } finally {
    hardwareSaving.value = false;
  }
}

/** 客显测试：显示测试内容 */
async function testCustomerDisplay() {
  displayTesting.value = true;
  try {
    const res = await showCustomerDisplay({
      port: hardwareSettings.value.displayPort,
      baudRate: hardwareSettings.value.displayBaudRate,
      protocol: hardwareSettings.value.displayProtocol,
      template: hardwareSettings.value.displayTemplate,
      lines: ["智享全链", "测试显示 ¥123.45"],
      amount: 123.45,
    });
    if (res.ok) ElMessage.success("客显指令已发送");
    else ElMessage.error(res.message || "客显发送失败");
  } finally {
    displayTesting.value = false;
  }
}

/** 电子秤测试：读取当前重量 */
async function testScale() {
  scaleTesting.value = true;
  scaleTestResult.value = "读取中…";
  try {
    const res = await readScaleWeight({
      port: hardwareSettings.value.scalePort,
      baudRate: hardwareSettings.value.scaleBaudRate,
      protocol: hardwareSettings.value.scaleProtocol,
      commandHex: hardwareSettings.value.scaleCommandHex,
    });
    if (res.ok && res.weight !== undefined) {
      scaleTestResult.value = `当前重量 ${res.weight.toFixed(3)} kg`;
    } else {
      scaleTestResult.value = res.message || "读取失败";
    }
  } finally {
    scaleTesting.value = false;
  }
}

/** 云喇叭测试播报 */
async function testCloudSpeaker() {
  speakerTesting.value = true;
  try {
    const res = await announceCloudSpeaker({ amount: 1, orderNo: `TEST${Date.now()}`, channel: "TEST" });
    if (res.success) ElMessage.success("播报指令已下发");
    else ElMessage.warning(res.reason || "云喇叭未配置或播报失败");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "播报测试失败"));
  } finally {
    speakerTesting.value = false;
  }
}

/** 收款盒子配置测试 */
async function testBoxConfig() {
  boxTesting.value = true;
  try {
    const res = await testBoxConfigApi();
    if (res.success) ElMessage.success(res.message || "配置校验通过");
    else ElMessage.warning(res.message || "配置不完整");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "测试失败"));
  } finally {
    boxTesting.value = false;
  }
}

/** 云闪付网关连通测试 */
async function testUnionpayConfig() {
  unionpayTesting.value = true;
  try {
    const res = await testUnionpay();
    if (res.success) ElMessage.success("云闪付网关连通");
    else ElMessage.warning(res.message || "云闪付网关未连通或未配置");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "测试失败"));
  } finally {
    unionpayTesting.value = false;
  }
}

/** 结算打开时：客显显示应收金额（本机串口，失败不阻断） */
function showAmountOnCustomerDisplay() {
  if (!hardwareSettings.value.displayPort) return;
  showCustomerDisplay({
    port: hardwareSettings.value.displayPort,
    baudRate: hardwareSettings.value.displayBaudRate,
    protocol: hardwareSettings.value.displayProtocol,
    template: hardwareSettings.value.displayTemplate,
    lines: ["智享全链", `应收 ¥${cartAmount.value.toFixed(2)}`],
    amount: cartAmount.value,
  }).catch(() => {
    // 客显未接/助手未启动不阻断结算
  });
}

/** 收款成功后：云喇叭播报（租户级云端设备） */
function announceCloud() {
  if (!cloudSpeakerForm.enabled) return;
  announceCloudSpeaker({
    amount: currentAmount.value || cartAmount.value,
    orderNo: currentBillNo.value || `POS${Date.now()}`,
    channel: "SALE",
  }).catch(() => {
    // 播报失败不阻断收款
  });
}

/** 收款成功语音播报（浏览器 SpeechSynthesis，无需额外硬件） */
function speakResult(text: string) {
  if (!hardwareSettings.value.voiceEnabled) return;
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  } catch {
    // 语音播报失败不影响收款
  }
}

/** 现金收款后自动弹钱箱（经本地打印助手 ESC/POS 脉冲） */
function kickCashDrawer() {
  if (!hardwareSettings.value.cashDrawerEnabled) return;
  openCashDrawer().catch(() => {
    // 钱箱未接/助手未启动不阻断收款
  });
}

/** 键盘快捷键：F2 挂单 / F3 扫码 / F4 取单 / F8 结算 / F9 打印 */
function handleHotkey(e: KeyboardEvent) {
  if (e.key === "F2") {
    e.preventDefault();
    handleCreateHoldOrder();
  } else if (e.key === "F3") {
    e.preventDefault();
    handleScan();
  } else if (e.key === "F4") {
    e.preventDefault();
    holdDialogVisible.value = true;
    loadHoldOrders();
  } else if (e.key === "F8") {
    e.preventDefault();
    openPayDialog();
  } else if (e.key === "F9") {
    e.preventDefault();
    handlePrint();
  }
}

/** 加载商品分类 */
async function loadCategories() {
  try {
    const list = await fetchProductCategories();
    categories.value = Array.isArray(list) ? list : (list?.records || list?.list || []);
  } catch (e) {
    console.error("加载商品分类失败", e);
  }
}

/** 默认加载全部在售商品（对标 POS 效率优先：进入即见商品） */
async function loadAllProducts() {
  loading.value = true;
  try {
    const data = await searchStoreProducts();
    productOptions.value = data.records || [];
  } catch (e) {
    console.error("加载商品失败", e);
  } finally {
    loading.value = false;
  }
}

/** 选择分类 */
function selectCategory(id: number) {
  activeCategory.value = id;
}

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function getLoginUserStoreId(): number {
  try {
    const raw = localStorage.getItem("admin_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed;
      if (user?.storeId) return Number(user.storeId);
    }
  } catch { /* ignore */ }
  return 1;
}

function getLoginUserRealName(): string {
  try {
    const raw = localStorage.getItem("admin_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed;
      return user?.realName || user?.username || "";
    }
  } catch { /* ignore */ }
  return "";
}

async function handleSearchProducts() {
  if (!productKeyword.value.trim()) {
    loadAllProducts();
    return;
  }
  loading.value = true;
  try {
    const data = await searchStoreProducts({ keyword: productKeyword.value.trim() });
    productOptions.value = data.records || [];
    // 搜索结果展示全部匹配商品，重置分类过滤
    activeCategory.value = 0;
    if (productOptions.value.length === 0) {
      // 商品未命中：尝试按追溯码识别（扫瓶盖/瓶身追溯码自动带出商品）
      const traceHit = await handleTraceCodeScan(productKeyword.value);
      if (!traceHit) ElMessage.info("未找到匹配商品");
      // 扫码未命中：清空输入框并保持焦点，便于重新扫描
      productKeyword.value = "";
      productSearchRef.value?.focus?.();
    } else if (productOptions.value.length === 1) {
      // 扫码/精确搜索命中唯一商品：自动加入购物车（数量默认 1）
      addCartItem(productOptions.value[0]);
      // 连续扫码：加入购物车后清空输入框并保持焦点，避免下一次扫码条码拼接
      productKeyword.value = "";
      productSearchRef.value?.focus?.();
    }
  } finally {
    loading.value = false;
  }
}

/** 会员下拉远程搜索（el-select remote-method） */
async function handleSearchMembers(query?: string) {
  memberKeyword.value = (query ?? memberKeyword.value ?? "").trim();
  if (!memberKeyword.value) {
    memberOptions.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    const data = await searchStoreMembers(memberKeyword.value.trim());
    memberOptions.value = data.records || [];
  } catch {
    memberOptions.value = [];
  } finally {
    memberLoading.value = false;
  }
}

/** 选择会员：散户直接切换为所选会员 */
function onMemberSelect(id: number) {
  const m = memberOptions.value.find((x) => Number(x.memberId || x.id) === Number(id));
  saleForm.customerId = Number(id || 0);
  saleForm.customerName = m?.name || "";
  saleForm.customerMobile = m?.mobile || "";
  memberOptions.value = [];
  memberKeyword.value = "";
  ElMessage.success(`已选择客户：${saleForm.customerName || "散户"}`);
}

/** 清空/切换回散户 */
function useWalkInCustomer() {
  saleForm.customerId = 0;
  saleForm.customerName = "散户";
  saleForm.customerMobile = "";
  selectedMemberId.value = null;
}

function addCartItem(row: any, opts?: { traceCode?: string }) {
  const skuId = Number(row.skuId || row.id);
  if (!skuId) {
    ElMessage.warning("当前商品缺少 SKU ID");
    return;
  }
  const unitPrice = Number(row.storePrice || row.retailPrice || 0);
  if (unitPrice <= 0) {
    ElMessage.warning("该商品单价为 0，请确认价格");
    return;
  }
  const existed = cartItems.value.find((item) => Number(item.skuId) === skuId);
  if (existed) {
    existed.quantity = Number(existed.quantity || 0) + 1;
    if (opts?.traceCode) {
      existed.traceCodes = existed.traceCodes || [];
      if (!existed.traceCodes.includes(opts.traceCode)) existed.traceCodes.push(opts.traceCode);
    }
    return;
  }
  cartItems.value.push({
    skuId,
    skuName: row.skuName || row.productName || `SKU-${skuId}`,
    productName: row.productName || "",
    quantity: 1,
    unitPrice,
    availableQty: Number(row.availableQty || 0),
    traceCodes: opts?.traceCode ? [opts.traceCode] : []
  });
}

/** 追溯码短显（前 8 位 + …） */
function shortTrace(code: string) {
  const c = String(code || "");
  return c.length > 10 ? `${c.slice(0, 8)}…` : c;
}

/** 打开追溯码录入弹窗（连续扫码归入指定商品行） */
function openTraceDialog(index: number) {
  traceDialogItemIndex.value = index;
  traceCodeInput.value = "";
  traceDialogVisible.value = true;
}

function focusTraceInput() {
  nextTick(() => {
    traceCodeRef.value?.focus?.();
  });
}

/**
 * 追溯码验证 + 归位：
 * - 传入 itemIndex：追加到指定购物车行（弹窗连续扫码）
 * - 不传：按 skuId 自动带出商品加入购物车（搜索框扫码）
 */
async function handleTraceCodeScan(code: string, itemIndex?: number): Promise<boolean> {
  const traceCode = (code || "").trim();
  if (!traceCode) return false;
  try {
    const verify = await verifyStoreTraceCode(traceCode);
    if (verify.result !== "SUCCESS" || !verify.skuId) return false;
    if (verify.currentStatus === "SOLD_OUT") {
      ElMessage.warning("该追溯码已售出，请核实后重扫");
      return false;
    }
    // 弹窗模式：追加到指定商品行
    if (itemIndex !== undefined && itemIndex >= 0) {
      const item = cartItems.value[itemIndex];
      if (!item) return false;
      item.traceCodes = item.traceCodes || [];
      if (item.traceCodes.includes(traceCode)) {
        ElMessage.warning("该追溯码已录入当前商品");
        return true;
      }
      item.traceCodes.push(traceCode);
      ElMessage.success(`已录入追溯码：${verify.skuName || "商品"}（${item.traceCodes.length} 个）`);
      return true;
    }
    // 搜索框模式：按 skuId 找商品自动加入购物车
    let product = productOptions.value.find((p) => Number(p.skuId) === Number(verify.skuId));
    if (!product) {
      const data = await searchStoreProducts({ keyword: verify.skuName || String(verify.skuId) });
      product = (data.records || []).find((p: any) => Number(p.skuId) === Number(verify.skuId));
    }
    if (!product) {
      ElMessage.warning("追溯码商品未在售或未找到，请核对商品");
      return false;
    }
    addCartItem(product, { traceCode });
    ElMessage.success(`已扫追溯码：${product.skuName || product.productName}`);
    return true;
  } catch {
    return false;
  }
}

/** 追溯弹窗扫码：录入后清空输入保持焦点，支持连续扫 */
async function handleTraceDialogScan() {
  if (!traceCodeInput.value.trim()) return;
  traceScanLoading.value = true;
  try {
    const hit = await handleTraceCodeScan(traceCodeInput.value, traceDialogItemIndex.value);
    if (hit) {
      traceCodeInput.value = "";
      focusTraceInput();
    }
  } finally {
    traceScanLoading.value = false;
  }
}

/** 结算明细（含追溯码，出库时后端自动更新追溯状态） */
function buildSaleItems() {
  return cartItems.value.map((item) => ({
    skuId: Number(item.skuId),
    quantity: Number(item.quantity || 1),
    boxQty: 0,
    bottleQty: Number(item.quantity || 1),
    totalBottleQty: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    priceType: "STORE",
    traceCodes: Array.isArray(item.traceCodes) && item.traceCodes.length > 0 ? item.traceCodes : undefined,
  }));
}

function increaseQty(index: number) {
  cartItems.value[index].quantity = Number(cartItems.value[index].quantity || 0) + 1;
}

/** 改价：点击价格才进入编辑框，改完自动回到文本显示 */
const editingPriceIdx = ref(-1);
const priceInputRefs = ref<any[]>([]);

function startPriceEdit(index: number) {
  editingPriceIdx.value = index;
  nextTick(() => {
    priceInputRefs.value[index]?.focus?.();
  });
}

function confirmPriceEdit(index: number) {
  if (editingPriceIdx.value !== index) return;
  const item = cartItems.value[index];
  if (item) onPriceChange(item);
  editingPriceIdx.value = -1;
}

/** 改价：谈好价后直接修改行单价，金额自动重算 */
function onPriceChange(item: any) {
  item.unitPrice = Math.max(0, Number(item.unitPrice || 0));
}

function decreaseQty(index: number) {
  const item = cartItems.value[index];
  const next = Number(item.quantity || 0) - 1;
  if (next <= 0) {
    cartItems.value.splice(index, 1);
    return;
  }
  item.quantity = next;
}

function removeCartItem(index: number) {
  cartItems.value.splice(index, 1);
}

/** 扫码：聚焦商品搜索框（扫码枪输入条码后回车即搜） */
function handleScan() {
  productSearchRef.value?.focus?.();
  ElMessage.info("请扫码或输入条码后回车");
}

/** 数字键盘输入 */
function numpadPress(key: string) {
  if (key === "⌫") {
    const s = String(receivedAmount.value);
    receivedAmount.value = Number(s.slice(0, -1) || 0);
    return;
  }
  if (key === ".") {
    const s = String(receivedAmount.value);
    if (!s.includes(".")) receivedAmount.value = Number(s + ".");
    return;
  }
  const s = String(receivedAmount.value);
  if (s.includes(".") && s.split(".")[1].length >= 2) return;
  const next = Number(s + key);
  receivedAmount.value = Number(next.toFixed(2));
}

/** 打印小票：加载模板 → 渲染 → 输出（本机配置优先本地助手，其次浏览器） */
function handlePrint() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("购物车为空，无可打印内容");
    return;
  }
  const cfg = getLocalPrintConfig();
  const items = buildTableHtml(
    cartItems.value.map((item) => ({
      name: item.skuName || item.productName || "-",
      qty: `x${item.quantity}`,
      amount: `¥${fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1))}`,
    })),
    [
      { key: "name", label: "品名", align: "left" },
      { key: "qty", label: "数量" },
      { key: "amount", label: "金额", align: "right" },
    ]
  );
  const payLabel =
    payMethodOptions.find((m) => m.value === paymentMethod.value)?.label ??
    paymentMethod.value;
  // 同步开窗防弹窗拦截，模板异步加载后写入
  const win = openPrintWindow();
  printBill({
    billType: "SALE_RECEIPT",
    billNo: currentBillNo.value || `POS${Date.now()}`,
    title: "销售小票",
    win,
    copies: cfg.copies,
    vars: {
      headerName: cfg.headerName,
      storePhone: cfg.headerPhone,
      storeAddressLine: rawHtml(cfg.headerAddress ? `<br>${cfg.headerAddress}` : ""),
      billNo: currentBillNo.value || "-",
      billDate: new Date().toLocaleString(),
      operatorName: getLoginUserRealName() || "收银员",
      customerName: saleForm.customerName || "散客",
      items: rawHtml(items),
      itemsRows: cartItems.value.map((item) => ({
        name: item.skuName || item.productName || "-",
        qty: `x${item.quantity}`,
        amount: fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1)),
      })),
      totalAmount: fmtMoney(cartAmount.value),
      paidAmount: fmtMoney(cartAmount.value),
      changeAmount: fmtMoney(changeAmount.value),
      paymentMethod: payLabel,
      memberBalanceRow: rawHtml(
        selectedMemberId.value
          ? `<div class="row"><span>会员余额</span><span>¥${fmtMoney(memberBalance.value)}</span></div>`
          : ""
      ),
      memberBalance: fmtMoney(memberBalance.value),
      remarkBlock: "",
      footerText: cfg.footerText,
    },
  }).catch((error) => {
    ElMessage.error(getErrorMessage(error, "打印失败"));
  });
}

async function handleCreateSaleBill() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createStoreSaleBill({
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: buildSaleItems()
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);
    ElMessage.success("销售单创建成功");
  } finally {
    loading.value = false;
  }
}

/** 打开结算弹窗：默认实收 = 应收 */
function openPayDialog() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  receivedAmount.value = cartAmount.value;
  memberBalance.value = 0;
  payCode.value = "";
  payDialogVisible.value = true;
  showAmountOnCustomerDisplay();
  // 硬件设置开启时自动聚焦付款码框：扫码枪扫完商品可直接扫顾客付款码
  if (hardwareSettings.value.scanPayAutoFocus) {
    nextTick(() => {
      payCodeRef.value?.focus?.();
    });
  }
}

async function confirmPayment() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  loading.value = true;
  try {
    const result = await createStoreSaleBill({
      storeId: getLoginUserStoreId(),
      customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
      customerName: saleForm.customerName,
      customerMobile: saleForm.customerMobile,
      items: buildSaleItems()
    });
    currentBillNo.value = result.billNo;
    currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);

    await createStoreOfflinePayment(currentBillNo.value, currentAmount.value, paymentMethod.value);
    ElMessage.success("收款成功");
    const payLabel =
      payMethodOptions.find((m) => m.value === paymentMethod.value)?.label ??
      paymentMethod.value;
    completePaymentFlow(currentBillNo.value, currentAmount.value, payLabel, paymentMethod.value);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "收款失败"));
  } finally {
    loading.value = false;
  }
}

/**
 * 收款成功统一收尾：现金弹钱箱 + 语音播报 + 自动打印小票 + 清空购物车
 * @param drawerChannel 现金(CASH)收款时触发钱箱
 */
function completePaymentFlow(printedBillNo: string, printedAmount: number, payLabel: string, drawerChannel: string) {
  // 现金收款弹钱箱（经本地打印助手 ESC/POS 脉冲）
  if (drawerChannel === "CASH") kickCashDrawer();
  // 云喇叭播报（租户级云端设备）
  announceCloud();
  // 语音播报收款金额
  speakResult(`收款成功，${fmtMoney(printedAmount)} 元`);
  // 本机配置：结算后自动打印小票（先取号再清空购物车）
  if (getLocalPrintConfig().autoPrint && printedBillNo) {
    const cfg = getLocalPrintConfig();
    const items = buildTableHtml(
      cartItems.value.map((item) => ({
        name: item.skuName || item.productName || "-",
        qty: `x${item.quantity}`,
        amount: `¥${fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1))}`,
      })),
      [
        { key: "name", label: "品名", align: "left" },
        { key: "qty", label: "数量" },
        { key: "amount", label: "金额", align: "right" },
      ]
    );
    printBill({
      billType: "SALE_RECEIPT",
      billNo: printedBillNo,
      title: "销售小票",
      copies: cfg.copies,
      vars: {
        headerName: cfg.headerName,
        storePhone: cfg.headerPhone,
        storeAddressLine: rawHtml(cfg.headerAddress ? `<br>${cfg.headerAddress}` : ""),
        billNo: printedBillNo,
        billDate: new Date().toLocaleString(),
        operatorName: getLoginUserRealName() || "收银员",
        customerName: saleForm.customerName || "散客",
        items: rawHtml(items),
        itemsRows: cartItems.value.map((item) => ({
          name: item.skuName || item.productName || "-",
          qty: `x${item.quantity}`,
          amount: fmtMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1)),
        })),
        totalAmount: fmtMoney(printedAmount),
        paidAmount: fmtMoney(printedAmount),
        changeAmount: fmtMoney(changeAmount.value),
        paymentMethod: payLabel,
        memberBalanceRow: "",
        memberBalance: fmtMoney(memberBalance.value),
        remarkBlock: "",
        footerText: cfg.footerText,
      },
    }).catch(() => {
      // 自动打印失败不阻断收款流程，用户可手动点打印
    });
  }
  currentAmount.value = 0;
  currentBillNo.value = "";
  cartItems.value = [];
  payCode.value = "";
  payDialogVisible.value = false;
}

/** 扫码收款（反扫）：建单后调支付通道扣款；失败保留当前单号便于重试，避免重复建单 */
async function handlePayByCode() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  const code = payCode.value.trim();
  if (!/^\d{16,24}$/.test(code)) {
    ElMessage.warning("请用扫码枪扫顾客付款码（16~24 位纯数字）");
    return;
  }
  payCodeLoading.value = true;
  try {
    // 优先复用本次弹窗已创建的单号（付款失败重试时避免重复建单）
    if (!currentBillNo.value) {
      const result = await createStoreSaleBill({
        storeId: getLoginUserStoreId(),
        customerId: saleForm.customerId > 0 ? saleForm.customerId : undefined,
        customerName: saleForm.customerName,
        customerMobile: saleForm.customerMobile,
        items: buildSaleItems()
      });
      currentBillNo.value = result.billNo;
      currentAmount.value = Number(result.receivableAmount || cartAmount.value || 0);
    }

    const payResult = await payStoreSaleBillByCode(
      currentBillNo.value,
      currentAmount.value || cartAmount.value,
      code
    );
    ElMessage.success(`扫码收款成功（${payResult.channelLabel || "电子支付"}）`);
    completePaymentFlow(
      currentBillNo.value,
      currentAmount.value || cartAmount.value,
      payResult.channelLabel || "扫码支付",
      payResult.channel || ""
    );
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "扫码收款失败"));
  } finally {
    payCodeLoading.value = false;
    payCode.value = "";
    nextTick(() => {
      payCodeRef.value?.focus?.();
    });
  }
}

async function handleCreateHoldOrder() {
  if (cartItems.value.length === 0) {
    ElMessage.warning("请先加入商品到购物车");
    return;
  }
  try {
    const result = await createStoreHoldOrder({
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
    cartItems.value = [];
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "挂单失败"));
  }
}

async function loadHoldOrders() {
  try {
    const data = await fetchStoreHoldOrders();
    holdOrders.value = data.records || [];
  } catch {
    // ignore
  }
}

async function handleRestoreHoldOrder(holdNo: string) {
  try {
    const data = await restoreStoreHoldOrder(holdNo);
    saleForm.customerName = data.customerName || "";
    saleForm.customerMobile = data.customerMobile || "";
    saleForm.customerId = Number(data.customerId || 0);
    cartItems.value = (data.items || []).map((item: any) => ({
      skuId: Number(item.skuId || 0),
      skuName: item.skuName || `SKU-${item.skuId}`,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      availableQty: 0
    }));
    holdDialogVisible.value = false;
    ElMessage.success(`已取单：${holdNo}`);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "取单失败"));
  }
}

async function handleDeleteHoldOrder(holdNo: string) {
  try {
    await deleteStoreHoldOrder(holdNo);
    ElMessage.success("挂单已删除");
    await loadHoldOrders();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "删除挂单失败"));
  }
}
</script>

<style scoped>
.pos-cashier {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
}
.cashier-workspace {
  display: grid;
  grid-template-columns: clamp(130px, 10vw, 160px) minmax(0, 1fr) clamp(360px, 30vw, 430px);
  gap: 10px;
  height: 100%;
}

/* ─── 左侧分类栏 ─── */
.category-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 10px;
  box-shadow: var(--shadow-card);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.category-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 4px 8px 10px;
  letter-spacing: 0.5px;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
  user-select: none;
}
.category-item:hover {
  background: var(--gray-50);
}
.category-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.category-dot--all {
  background: linear-gradient(135deg, #3F6FEF 0%, #8B5CF6 100%);
}
.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--gray-50);
  border-radius: 10px;
  padding: 1px 7px;
}
.category-item.active .category-count {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

/* ─── 中间商品区 ─── */
.product-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.product-searchbar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.product-search-input {
  flex: 1;
}
.product-search-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--border-normal) inset;
}
.product-search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-primary) inset;
}
.scan-button {
  border-radius: var(--radius-md);
}
.btn-icon {
  margin-right: 3px;
}
.search-button {
  border-radius: var(--radius-md);
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  align-content: start;
}
.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 10px 12px;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.product-card:hover {
  border-color: var(--color-primary-soft);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
.product-card:active {
  transform: scale(0.98);
}
.product-card.is-out {
  opacity: 0.55;
}
.product-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.product-cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.product-stock {
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 7px;
}
.product-stock.stock-out {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.product-stock.stock-low {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.product-stock.stock-ok {
  color: var(--text-muted);
  background: var(--gray-50);
}
.product-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-spec {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.product-price {
  display: flex;
  align-items: baseline;
  color: var(--text-primary);
}
.price-symbol {
  font-size: 12px;
  font-weight: 600;
  margin-right: 1px;
}
.price-value {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.add-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
}
.add-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.08);
}
.add-btn:disabled {
  background: var(--gray-300);
  cursor: not-allowed;
}
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── 右侧购物车 ─── */
.cart-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 12px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}
.member-section {
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 10px;
  position: relative;
}
.member-selected {
  display: flex;
  align-items: center;
  gap: 8px;
}
.member-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.member-meta {
  flex: 1;
  min-width: 0;
}
.member-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.member-phone {
  font-size: 11px;
  color: var(--text-muted);
}
.member-select {
  width: 220px;
  flex-shrink: 0;
}
.member-select :deep(.el-select__wrapper) {
  border-radius: var(--radius-md);
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}

/* 购物车列表 */
.cart-list {
  flex: 1;
  overflow-y: auto;
  min-height: 120px;
  /* 隐藏滚动条（内容仍可滚轮滚动）：避免滚动条出现/消失占位导致结算台布局跳动 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.cart-list::-webkit-scrollbar {
  display: none;
}
.cart-list.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.cart-empty-icon {
  font-size: 30px;
  color: var(--gray-300);
}
.cart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-light);
}
.cart-row:last-child {
  border-bottom: none;
}
.cart-row-main {
  flex: 1;
  min-width: 0;
}
.cart-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cart-row-price {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}
.cart-row-price-symbol {
  font-size: 11px;
  color: var(--text-secondary);
}
.cart-row-price--static {
  cursor: pointer;
}
.cart-row-price-text {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cart-row-price-input {
  width: 86px;
}
.cart-row-price-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-sm);
  box-shadow: none;
  transition: none;
}
.cart-row-price-input :deep(.el-input__inner) {
  font-size: 12px;
  padding: 0 6px;
}
.cart-row-qty {
  display: flex;
  align-items: center;
  gap: 2px;
}
.qty-btn {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-normal);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 120ms;
}
.qty-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.qty-value {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cart-row-amount {
  min-width: 66px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cart-row-del {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 2px;
  border-radius: 4px;
}
.cart-row-del:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

/* 金额汇总 */
.cart-summary {
  border-top: 1px dashed var(--border-normal);
  padding-top: 8px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.summary-num {
  font-variant-numeric: tabular-nums;
}
.summary-row.total {
  margin-top: 2px;
}
.total-amount {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* 支付方式 */
.pay-methods {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.pay-method-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 2px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 150ms;
}
.pay-method-btn:hover {
  border-color: var(--color-primary-soft);
}
.pay-method-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.pay-method-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
}
/* 微信/支付宝使用官方徽标（自带品牌底色），容器透明只保留形状 */
.pay-method-icon--wechat,
.pay-method-icon--alipay {
  background: transparent;
}
.pay-method-icon--cash {
  background: var(--gray-400, #999999);
  color: #fff;
}
.pay-method-icon--balance {
  background: var(--gray-400, #999999);
  color: #fff;
}
.pay-logo {
  width: 24px;
  height: 24px;
  display: block;
}
.pay-logo--wechat {
  width: 28px;
  height: 28px;
}
.pay-logo--alipay {
  width: 28px;
  height: 28px;
}
.pay-logo--balance {
  width: 20px;
  height: 20px;
}
/* 无状态灰阶：未选中时微信/支付宝徽标置灰，选中恢复品牌色 */
.pay-method-btn:not(.active) .pay-logo--wechat,
.pay-method-btn:not(.active) .pay-logo--alipay,
.pay-method-card:not(.active) .pay-logo--wechat,
.pay-method-card:not(.active) .pay-logo--alipay {
  filter: grayscale(1);
  opacity: 0.85;
}
/* 选中点亮：现金绿、余额橙（收银台与结算弹窗一致） */
.pay-method-btn.active .pay-method-icon--cash,
.pay-method-card.active .pay-method-icon--cash {
  background: #16a34a;
}
.pay-method-btn.active .pay-method-icon--balance,
.pay-method-card.active .pay-method-icon--balance {
  background: #fa8c16;
}
.pay-method-btn.active .pay-method-icon {
  color: var(--color-primary);
}
.pay-method-btn.active .pay-method-icon--wechat,
.pay-method-btn.active .pay-method-icon--alipay,
.pay-method-btn.active .pay-method-icon--cash,
.pay-method-btn.active .pay-method-icon--balance {
  color: #fff;
}
.pay-method-name {
  font-size: 11px;
  color: var(--text-secondary);
}
.pay-method-btn.active .pay-method-name {
  color: var(--color-primary);
  font-weight: 600;
}

/* 功能导航 + 结算网格：结算占右侧两列并跨两行 */
.cart-action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}
.cart-action-grid .checkout-btn {
  grid-column: 3 / 5;
  grid-row: 1 / 3;
  height: 100%;
  min-height: 96px;
}
.action-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--gray-50);
  cursor: pointer;
  transition: all 150ms;
}
.action-btn:hover {
  background: var(--color-primary-bg);
  border-color: var(--color-primary-soft);
  color: var(--color-primary);
}
.action-kbd {
  position: absolute;
  top: 3px;
  right: 5px;
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 3px;
  padding: 0 3px;
}
.action-label {
  font-size: 12px;
  font-weight: 500;
}

/* 结算按钮 */
.checkout-btn {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  padding: 0 18px;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
  box-shadow: 0 4px 12px rgba(63, 111, 239, 0.28);
}
.checkout-btn:hover {
  background: var(--color-primary-hover);
}
.checkout-btn:active {
  transform: scale(0.99);
}
.checkout-btn:disabled {
  background: var(--gray-300);
  box-shadow: none;
  cursor: not-allowed;
}
.checkout-label {
  font-size: 16px;
  font-weight: 600;
}
.checkout-amount {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bill-alert {
  margin-top: 0;
}

/* ─── 结算弹窗 ─── */
.pay-dialog :deep(.el-dialog) {
  border-radius: var(--radius-xl);
}
.pay-dialog-body {
  padding: 10px 16px;
}
.pay-amount-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0 10px;
  border-bottom: 1px solid var(--border-light);
}
.pay-amount-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-amount-value {
  font-size: 40px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.pay-items-info {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
.pay-method-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 14px 0 8px;
}
.pay-method-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pay-method-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
}
.pay-method-card:hover {
  border-color: var(--color-primary-soft);
}
.pay-method-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.pay-method-card .pay-method-icon {
  font-size: 15px;
}
.pay-received-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}
.pay-received-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.pay-received-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.numpad-key {
  height: 44px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all 120ms;
}
.numpad-key:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
}
.numpad-key:active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.numpad-clear {
  color: var(--color-danger);
  grid-column: 1 / 2;
}
.numpad-equal {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  font-size: 13px;
  grid-column: 2 / 4;
}
.numpad-equal:hover {
  background: var(--color-primary-hover);
}
.pay-change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--color-success-soft);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-success);
}
.pay-change-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ═══ 屏幕适配（置于基础样式之后，保证覆盖生效） ═══ */

/* 中屏：收窄侧栏与购物车，商品区保持可用 */
@media (max-width: 1280px) {
  .cashier-workspace {
    grid-template-columns: 120px minmax(0, 1fr) 300px;
    gap: 10px;
  }
  .pos-cashier {
    padding: 10px;
  }
}

/* 小屏：分类栏改为顶部横向滚动标签，商品+购物车两栏布局 */
@media (max-width: 1100px) {
  .cashier-workspace {
    grid-template-columns: minmax(0, 1fr) 300px;
    grid-template-areas:
      "cats cats"
      "products cart";
    grid-template-rows: auto minmax(0, 1fr);
  }
  .category-panel {
    grid-area: cats;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 10px;
    min-height: 44px;
  }
  .category-panel-title {
    padding: 0 10px 0 0;
    flex-shrink: 0;
  }
  .category-item {
    flex-shrink: 0;
    padding: 7px 12px;
    margin-bottom: 0;
  }
  .product-panel {
    grid-area: products;
  }
  .cart-panel {
    grid-area: cart;
  }
}

@media (max-width: 900px) {
  .cashier-workspace {
    grid-template-columns: minmax(0, 1fr) 280px;
  }
}

/* 极窄屏：保证右侧购物车完整可见，工作区整体可横向滚动 */
@media (max-width: 760px) {
  .pos-cashier {
    overflow-x: auto;
  }
  .cashier-workspace {
    min-width: 700px;
  }
}

/* ─── 收银硬件设置 ─── */
.settings-button {
  border-radius: var(--radius-md);
  flex-shrink: 0;
}
.hardware-settings {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hardware-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--border-light);
}
.hardware-setting-row:last-of-type {
  border-bottom: none;
}
.hardware-setting-meta {
  min-width: 0;
}
.hardware-setting-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.hardware-setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}
.hardware-setting-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 14px;
  font-size: 13px;
  color: var(--text-secondary);
}
.hardware-settings :deep(.el-collapse) {
  border: none;
}
.hardware-settings :deep(.el-collapse-item__header) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
}
.hardware-settings :deep(.el-collapse-item__content) {
  padding-bottom: 12px;
}
.hw-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
}
.hw-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.hw-field label {
  font-size: 12px;
  color: var(--text-muted);
}
.hw-field--wide {
  grid-column: span 3;
}
.hw-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.hw-tip {
  font-size: 12px;
  color: var(--text-muted);
}

/* ─── 扫码收款（反扫） ─── */
.pay-code-section {
  margin-top: 14px;
  padding: 12px;
  background: var(--gray-50, #f5f7fa);
  border: 1px dashed var(--color-primary-soft, #b8cdf8);
  border-radius: var(--radius-md, 8px);
}
.pay-code-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}
.pay-code-channel {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-success);
  background: var(--color-success-soft, #e8f8ee);
  padding: 2px 8px;
  border-radius: 10px;
}
.pay-code-input-row {
  display: flex;
  gap: 8px;
}
.pay-code-input {
  flex: 1;
}
.pay-code-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--border-normal) inset;
}
.pay-code-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-success) inset;
}
.pay-code-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ─── 追溯码 ─── */
.cart-row-trace {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.trace-chip {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-soft);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.cart-row-trace-btn {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary-soft);
  border-radius: 4px;
  background: var(--bg-card);
  padding: 2px 8px;
  cursor: pointer;
  align-self: center;
}
.cart-row-trace-btn:hover {
  background: var(--color-primary-bg);
}
.trace-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.trace-dialog-item {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.trace-count {
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: 10px;
  padding: 1px 8px;
}
.trace-code-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--border-normal) inset;
}
.trace-code-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-primary) inset;
}
.trace-dialog-tip {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
