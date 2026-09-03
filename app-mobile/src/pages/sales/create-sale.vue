<template>
  <view class="create-sale-page">
    <!-- 顶部栏（原稿 pg-hd：返回 + 动态单据标题 + 草稿/已保存徽标 + 三点） -->
    <view class="page-hd">
      <view class="hd-back" @tap="goBack">
        <image class="hd-back-img" src="/static/icons/ic/back.svg" mode="aspectFit" />
      </view>
      <text class="hd-title">{{ docTitle }}</text>
      <view class="hd-status" :class="isSaved ? 'hd-status--saved' : 'hd-status--draft'">
        <text class="hd-status-text">{{ isSaved ? '已保存' : '编辑中' }}</text>
      </view>
      <view class="qo-menu-trigger" @tap="onMoreMenu">
        <view class="qo-menu-dot"></view>
        <view class="qo-menu-dot"></view>
        <view class="qo-menu-dot"></view>
      </view>
    </view>

    <!-- 单据类型分段导航（主段 销售/采购 + 子段 订单/销售单/退货/收款单） -->
    <view class="doc-nav">
      <view class="doc-nav-main">
        <view class="doc-seg" :class="{ 'doc-seg--active': docMain === 'sale' }" @tap="switchDocMain('sale')">销售</view>
        <view class="doc-seg" :class="{ 'doc-seg--active': docMain === 'purchase' }" @tap="switchDocMain('purchase')">采购</view>
      </view>
      <view class="doc-nav-sub">
        <view
          class="doc-seg doc-seg--sub"
          v-for="s in docSubs"
          :key="s"
          :class="{ 'doc-seg--sub-active': docSub === s }"
          @tap="selectDocSub(s)"
        >{{ s }}</view>
      </view>
    </view>

    <!-- 当前门店（原稿 store-card：蓝渐变卡） -->
    <picker class="store-card" mode="selector" :range="storeNames" @change="onStoreCardChange">
      <view class="sc-main">
        <view class="sc-ico">
          <image class="sc-ico-img" src="/static/icons/store-white.svg" mode="aspectFit" />
        </view>
        <view class="sc-body">
          <text class="sc-label">当前门店</text>
          <text class="sc-name">{{ storeCardName }}</text>
        </view>
        <text class="sc-arrow">›</text>
      </view>
    </picker>

    <!-- 单据表单容器 -->
    <view class="sale-form-scroll">
      <scroll-view class="sale-form" :class="{ 'sale-form--locked': isSaved }" scroll-y>
      <!-- 退货：关联原单（原稿 link-box）+ 退货原因 + 退货仓库 -->
      <view class="form-section" v-if="isReturnDoc">
        <view class="link-box">
          <image class="lb-ico" src="/static/icons/ic/file-blue.svg" mode="aspectFit" />
          <text class="lb-text">关联原单：{{ selectedSourceBill || '请选择' }}</text>
          <text class="lb-arrow">›</text>
          <picker
            class="form-row-picker"
            mode="selector"
            :range="sourceBills"
            range-key="label"
            @change="onSourceBillChange"
          >
            <view class="form-row-cover"></view>
          </picker>
        </view>
        <view class="form-row">
          <view class="fr-body">
            <text class="fr-label">退货原因</text>
            <text class="fr-value" :class="{ 'fr-value--placeholder': !returnReason }">{{ returnReason || '请选择' }}</text>
          </view>
          <text class="fr-arrow">›</text>
          <picker
            class="form-row-picker"
            mode="selector"
            :range="returnReasonOptions"
            @change="onReturnReasonChange"
          >
            <view class="form-row-cover"></view>
          </picker>
        </view>
        <view class="form-row">
          <view class="fr-body">
            <text class="fr-label">退货仓库</text>
            <text class="fr-value">{{ storeCardName }}</text>
          </view>
          <text class="fr-arrow">›</text>
          <picker class="form-row-picker" mode="selector" :range="storeNames" @change="onStoreCardChange">
            <view class="form-row-cover"></view>
          </picker>
        </view>
      </view>

      <!-- 关联销售单（收款单：前端反查客户与金额，按 Receipt 契约提交） -->
      <view class="form-section" v-if="docConfig.showSourceBill">
        <view class="section-title">关联销售单</view>
        <picker
          class="qc-cell"
          mode="selector"
          :range="sourceBills"
          range-key="label"
          @change="onSourceBillChange"
        >
          <view class="qc-val">{{ sourceBillLabel }} <text class="qc-chev">▾</text></view>
        </picker>
      </view>

      <!-- 客户（收款单：后端 createReceipt 必填 customerId，须从客户选择器获取，不能仅用源单反查名字） -->
      <view class="form-section" v-if="docConfig.showReceiptCustomer">
        <view class="section-title">{{ docKey === 'sale-return' ? '客户' : '收款客户' }}</view>
        <view class="qc-cell" @tap="openCustomerPicker">
          <view class="qc-val">{{ receiptCustomerName || '请选择客户' }} <text class="qc-chev">▾</text></view>
        </view>
      </view>

      <!-- 供应商（进货单：真实供应商接口，非客户） -->
      <view class="form-section" v-if="docConfig.showSupplier">
        <view class="section-title">供应商</view>
        <picker
          class="qc-cell"
          mode="selector"
          :range="supplierOptions"
          range-key="name"
          @change="onSupplierChange"
        >
          <view class="qc-val">{{ supplierLabel }} <text class="qc-chev">▾</text></view>
        </picker>
      </view>

      <!-- 门店统一由顶部蓝渐变「当前门店」卡承担（原稿 store-card），不再单列表单块 -->

      <!-- 收款方式（收款单）：对齐 HTML .chip 胶囊选择 -->
      <view class="form-section" v-if="docConfig.showPayment">
        <view class="section-title">{{ docKey === 'pur_payment' ? '付款方式' : '收款方式' }}</view>
        <view class="chip-row">
          <view
            v-for="m in paymentOptions"
            :key="m.value"
            class="chip"
            :class="{ 'chip--active': paymentMethod === m.value }"
            @tap="selectPayment(m.value)"
          >{{ m.label }}</view>
        </view>
      </view>
      <!-- 客户 / 配送方式 / 日期（原稿 form-row 图标行列表） -->
      <view class="form-section" v-if="docConfig.showCustomer || docConfig.showDelivery || docConfig.showOrderDate">
        <view class="form-row" v-if="docConfig.showCustomer" @tap="openCustomerPicker">
          <view class="fr-ico">
            <image class="fr-ico-img" src="/static/icons/ic/users-blue.svg" mode="aspectFit" />
          </view>
          <view class="fr-body">
            <text class="fr-label">客户</text>
            <text class="fr-value" :class="{ 'fr-value--placeholder': !selectedCustomer }">{{ selectedCustomer?.name || '散客' }}</text>
          </view>
          <text class="fr-arrow">›</text>
        </view>
        <view class="form-row" v-if="docConfig.showDelivery">
          <view class="fr-ico">
            <image class="fr-ico-img" src="/static/icons/ic/truck-blue.svg" mode="aspectFit" />
          </view>
          <view class="fr-body">
            <text class="fr-label">配送方式</text>
            <text class="fr-value">{{ deliveryMethod }}</text>
          </view>
          <text class="fr-arrow">›</text>
          <picker class="form-row-picker" mode="selector" :range="deliveryOptions" @change="onDeliveryChange">
            <view class="form-row-cover"></view>
          </picker>
        </view>
        <view class="form-row" v-if="docConfig.showOrderDate">
          <view class="fr-ico">
            <image class="fr-ico-img" src="/static/icons/ic/calendar-blue.svg" mode="aspectFit" />
          </view>
          <view class="fr-body">
            <text class="fr-label">{{ docKey === 'sale_receipt' ? '收款日期' : docKey === 'pur_payment' ? '付款日期' : '单据日期' }}</text>
          </view>
          <text class="fr-value fr-value--date">{{ orderDate }}</text>
          <picker class="form-row-picker" mode="date" :value="orderDate" @change="onDateChange">
            <view class="form-row-cover"></view>
          </picker>
        </view>
        <view
          class="form-row"
          v-if="docKey === 'sale_order' || docKey === 'pur_order'"
        >
          <view class="fr-ico">
            <image class="fr-ico-img" src="/static/icons/ic/calendar-check-blue.svg" mode="aspectFit" />
          </view>
          <view class="fr-body">
            <text class="fr-label">{{ docKey === 'sale_order' ? '交货日期' : '到货日期' }}</text>
          </view>
          <text class="fr-value fr-value--date">{{ deliveryDate || '请选择' }}</text>
          <picker class="form-row-picker" mode="date" :value="deliveryDate" @change="onDeliveryDateChange">
            <view class="form-row-cover"></view>
          </picker>
        </view>
      </view>

      <!-- 订单状态（原稿 status-pill 卡：新建单据真实初始态为待确认） -->
      <view class="form-section status-card" v-if="docConfig.showOrderStatus">
        <text class="status-label">订单状态</text>
        <text class="status-pill" :class="orderStatus === 'confirmed' ? 'status-pill--paid' : 'status-pill--confirmed'">{{ orderStatusLabel }}</text>
      </view>
      <!-- 退款状态（退货单） -->
      <view class="form-section status-card" v-if="isReturnDoc">
        <text class="status-label">退款状态</text>
        <text class="status-pill status-pill--pending">{{ refundStatusLabel }}</text>
      </view>

      <!-- 采购税额（采购订单/入库：含税 toggle + 税率选择） -->
      <view class="form-section" v-if="docConfig.showTax">
        <view class="special-field">
          <text class="sf-label">含税单价</text>
          <view class="tax-toggle">
            <text class="tax-toggle-text" :class="{ 'tax-toggle-text--on': taxIncluded }">{{ taxIncluded ? '含税' : '不含税' }}</text>
            <view class="toggle-switch" :class="{ 'toggle-switch--on': taxIncluded }" @tap="toggleTaxIncluded">
              <view class="toggle-knob"></view>
            </view>
          </view>
        </view>
        <view class="special-field">
          <text class="sf-label">税率</text>
          <view class="tax-rate-wrap">
            <text class="sf-value sf-value--blue">{{ taxRate }}%</text>
            <picker class="form-row-picker" mode="selector" :range="taxRateLabels" @change="onTaxRateChange">
              <view class="form-row-cover"></view>
            </picker>
          </view>
        </view>
      </view>

      <!-- 入库批次（采购入库：批次号 / 有效期 / 到票状态，均为真实录入） -->
      <view class="form-section" v-if="docConfig.showBatch">
        <view class="special-field">
          <text class="sf-label">批次号</text>
          <input class="sf-input sf-input--mono" :value="batchNo" type="text" placeholder="录入批次号" placeholder-class="sf-placeholder" @input="onBatchChange" />
        </view>
        <view class="special-field">
          <text class="sf-label">有效期至</text>
          <text class="sf-value" :class="{ 'sf-value--placeholder': !expiryDate }">{{ expiryDate || '请选择' }}</text>
          <picker class="form-row-picker" mode="date" :value="expiryDate" @change="onExpiryChange">
            <view class="form-row-cover"></view>
          </picker>
        </view>
        <view class="special-field">
          <text class="sf-label">到票状态</text>
          <text class="sf-badge" :class="invoiceStatus === 'received' ? 'sf-badge--green' : 'sf-badge--orange'" @tap="toggleInvoiceStatus">{{ invoiceStatusLabel }}</text>
        </view>
      </view>

      <!-- 商品明细（原稿 card：card-title + prod-list + add-prod-row） -->
      <view class="form-section" v-if="docConfig.showProducts">
        <view class="card-title">
          <text>商品明细</text>
          <text class="ct-badge">{{ saleItems.length }} 种</text>
        </view>

        <!-- 空态（原稿 empty-prod：盒子图标 + 引导文案） -->
        <view class="empty-prod" v-if="saleItems.length === 0">
          <image class="empty-prod-img" src="/static/icons/es-box.svg" mode="aspectFit" />
          <text class="ep-title">暂无商品</text>
          <text class="ep-sub">点击下方「添加商品」或「扫码」快速录入</text>
        </view>

        <view
          class="prod-item"
          v-for="(item, index) in saleItems"
          :key="index"
          :class="{ 'prod-item--swiped': swipeOpenIndex === index }"
          @touchstart="onSwipeStart(index)"
          @touchmove.prevent="onSwipeMove(index, $event)"
          @touchend="onSwipeEnd(index)"
        >
          <view class="swipe-hint" @tap="removeItem(index)">删除</view>
          <view class="prod-item-content">
            <view class="prod-main">
              <view class="prod-thumb-col">
                <view class="prod-thumb" :style="{ background: itemTint(item.productName) }">
                  <text class="pt-letter" :style="{ color: itemColor(item.productName) }">{{ firstChar(item.productName) }}</text>
                </view>
              </view>
              <view class="prod-body">
                <view class="prod-top">
                  <view class="prod-info">
                    <text class="prod-name">{{ item.productName }}</text>
                    <text class="prod-spec" v-if="item.specs">{{ item.specs }}</text>
                  </view>
                  <text class="prod-sum" :class="{ 'prod-sum--red': docMain === 'purchase' }">{{ fmt((item.price ?? 0) * (item.quantity ?? 0)) }}</text>
                </view>
                <view class="prod-bottom">
                  <view class="prod-unit">
                    <text class="pu-label">单价</text>
                    <input
                      class="price-input"
                      :value="item.price"
                      type="digit"
                      @input="onPriceChange(index, $event)"
                      @blur="onPriceConfirm(index)"
                    />
                  </view>
                  <view class="qty-ctrl">
                    <view class="qty-btn" :class="{ 'qty-btn--disabled': (item.quantity ?? 0) <= 1 }" @tap.stop="decreaseQty(index)">−</view>
                    <input
                      class="qty-input"
                      :value="item.quantity"
                      type="number"
                      @input="onQtyChange(index, $event)"
                    />
                    <view class="qty-btn" @tap.stop="increaseQty(index)">+</view>
                  </view>
                </view>
              </view>
            </view>
            <!-- 追溯码（原稿 prod-trace：灰底行 + Qr 框图标 + 蓝色追溯码胶囊（可多码）+ 扫码） -->
            <view class="prod-trace">
              <image class="pt-ico" src="/static/icons/trace-gray.svg" mode="aspectFit" />
              <text class="pt-label">追溯码</text>
              <view class="trace-codes" v-if="(item.traceCodes || []).length">
                <view class="trace-chip" v-for="(tc, tcIdx) in item.traceCodes" :key="tc">
                  <text class="trace-chip-text">{{ tc }}</text>
                  <text class="trace-x" @tap.stop="removeTrace(index, tcIdx)">×</text>
                </view>
              </view>
              <input
                class="trace-input"
                :value="item.draftTrace || ''"
                type="text"
                placeholder="录入 / 扫描追溯码，回车确认"
                placeholder-class="trace-placeholder"
                @input="onTraceInput(index, $event)"
                @confirm="commitTrace(index)"
                @blur="commitTrace(index)"
              />
              <view class="trace-scan" @tap.stop="handleScanTrace(index)">
                <image class="trace-scan-img" src="/static/icons/ic/scan.svg" mode="aspectFit" />
                <text>扫码</text>
              </view>
            </view>
          </view>
        </view>

        <view class="add-prod-row">
          <view class="add-btn add-btn--primary" @tap="openProductPicker">
            <image class="add-btn-img" src="/static/icons/ic/plus.svg" mode="aspectFit" />
            <text>添加商品</text>
          </view>
          <view class="add-btn add-btn--secondary" @tap="handleScanAdd">
            <image class="add-btn-img" src="/static/icons/ic/scan.svg" mode="aspectFit" />
            <text>扫码</text>
          </view>
        </view>
      </view>

      <!-- 待核销单据（收款单/付款单：真实单据列表勾选核销，原稿 verify-item） -->
      <view class="form-section" v-if="docConfig.showVerify">
        <view class="card-title">
          <text>待核销单据</text>
          <text class="ct-badge">{{ verifiedCheckedCount }}/{{ verifiedDocs.length }}</text>
        </view>
        <view class="empty-prod" v-if="!verifiedLoading && verifiedDocs.length === 0">
          <image class="empty-prod-img" src="/static/icons/es-box.svg" mode="aspectFit" />
          <text class="ep-title">暂无可核销单据</text>
        </view>
        <view class="verify-item" v-for="(d, i) in verifiedDocs" :key="d.no">
          <view class="verify-check" :class="{ 'verify-check--checked': d.checked }" @tap="toggleVerify(i)">
            <text v-if="d.checked" class="verify-check-mark">✓</text>
          </view>
          <view class="verify-info">
            <text class="verify-no">{{ docKey === 'sale_receipt' ? '销售单' : '采购订单' }} {{ d.no }}</text>
            <text class="verify-amount">{{ fmt(d.amount) }}</text>
          </view>
          <input
            class="verify-input"
            :value="d.verifyAmount || ''"
            type="digit"
            placeholder="核销额"
            placeholder-class="sf-placeholder"
            @input="onVerifyAmountChange(i, $event)"
          />
        </view>
        <view class="special-field" v-if="docKey === 'pur_payment'">
          <text class="sf-label">预付款抵扣</text>
          <input class="sf-input sf-input--money" :value="prepaymentDeduct" type="digit" @input="onPrepayChange" />
        </view>
      </view>

      <!-- 收款金额（收款单：随核销勾选自动带出，可手动微调，提交按后端 amount 契约） -->
      <view class="form-section" v-if="docConfig.showAmount">
        <view class="section-title">收款金额</view>
        <view class="amount-input-row">
          <text class="price-unit">¥</text>
          <input
            class="discount-input"
            :value="receiptAmount"
            type="digit"
            @input="onReceiptAmountChange"
            placeholder="请输入收款金额"
          />
        </view>
      </view>

      <!-- 备注（原稿顺序：商品明细 → 备注 → 金额汇总） -->
      <view class="form-section" v-if="docConfig.showRemark">
        <view class="section-title">备注</view>
        <textarea
          class="remark-input"
          v-model="remark"
          placeholder="请输入备注信息（选填）"
          placeholder-class="remark-placeholder"
        />
      </view>

      <!-- 金额汇总（原稿 summary-card：按单据类型分列） -->
      <view class="form-section" v-if="!docConfig.placeholder">
        <view class="card-title">金额汇总</view>

        <!-- 收款单 / 付款单 -->
        <template v-if="isMoneyDoc">
          <view class="amount-row">
            <text class="amount-label">待核销总额</text>
            <text class="amount-value amount-value--mono">{{ fmt(pendingTotal) }}</text>
          </view>
          <view class="amount-row">
            <text class="amount-label">本次核销</text>
            <text class="amount-value amount-value--mono">{{ fmt(verifiedTotal) }}</text>
          </view>
          <view class="amount-row" v-if="docKey === 'pur_payment'">
            <text class="amount-label amount-label--red">预付款抵扣</text>
            <text class="amount-value amount-value--red">-{{ fmt(prepaymentDeduct) }}</text>
          </view>
          <view class="sum-divider"></view>
          <view class="amount-row amount-row--total">
            <text class="amount-label amount-label--strong">{{ docKey === 'sale_receipt' ? '实收金额' : '实付金额' }}</text>
            <text class="amount-value amount-value--total">{{ fmt(docTotal) }}</text>
          </view>
        </template>

        <!-- 销售订单 / 采购订单 -->
        <template v-else-if="isOrderDoc">
          <view class="amount-row">
            <text class="amount-label">商品总额</text>
            <text class="amount-value amount-value--mono">{{ fmt(totalAmount) }}</text>
          </view>
          <view class="amount-row" v-if="taxAmount > 0">
            <text class="amount-label">税额</text>
            <text class="amount-value amount-value--mono">{{ fmt(taxAmount) }}</text>
          </view>
          <view class="amount-row">
            <text class="amount-label amount-label--green">定金收取</text>
            <text class="amount-value amount-value--green">-{{ fmt(deposit) }}</text>
          </view>
          <view class="sum-divider"></view>
          <view class="amount-row" v-if="isLogistics">
            <text class="amount-label">物流单号</text>
            <view class="logi-wrap">
              <input class="logi-input" :value="logisticsNo" type="text" placeholder="录入/扫描物流单号" placeholder-class="sf-placeholder" @input="onLogisticsChange" />
              <view class="logi-scan" @tap="scanLogistics">
                <image class="logi-scan-img" src="/static/icons/ic/scan.svg" mode="aspectFit" />
                <text>扫码</text>
              </view>
            </view>
          </view>
          <view class="amount-row amount-row--total">
            <text class="amount-label amount-label--strong">剩余尾款</text>
            <text class="amount-value amount-value--total">{{ fmt(Math.max(0, docTotal - deposit)) }}</text>
          </view>
          <view class="deposit-input-row">
            <text class="amount-label">定金金额</text>
            <input class="sf-input sf-input--money" :value="deposit" type="digit" @input="onDepositChange" />
          </view>
        </template>

        <!-- 销售单（出货）：抹零 + 配送费 -->
        <template v-else-if="docKey === 'sale_ticket'">
          <view class="amount-row">
            <text class="amount-label">商品总额</text>
            <text class="amount-value amount-value--mono">{{ fmt(totalAmount) }}</text>
          </view>
          <view class="amount-row">
            <text class="amount-label amount-label--red">抹零</text>
            <view class="round-wrap">
              <text class="amount-value amount-value--red amount-value--mono">-{{ fmt(roundOffAmount) }}</text>
              <view class="round-chips">
                <view
                  v-for="m in roundModes"
                  :key="m[0]"
                  class="chip chip--sm"
                  :class="{ 'chip--active': roundMode === m[0] }"
                  @tap="selectRoundMode(m[0] as any)"
                >{{ m[1] }}</view>
              </view>
            </view>
          </view>
          <view class="amount-row">
            <text class="amount-label amount-label--orange">配送费</text>
            <input class="sf-input sf-input--money sf-input--inline" :value="shipping" type="digit" @input="onShippingChange" />
          </view>
          <view class="sum-divider"></view>
          <view class="amount-row" v-if="isLogistics">
            <text class="amount-label">物流单号</text>
            <view class="logi-wrap">
              <input class="logi-input" :value="logisticsNo" type="text" placeholder="录入/扫描物流单号" placeholder-class="sf-placeholder" @input="onLogisticsChange" />
              <view class="logi-scan" @tap="scanLogistics">
                <image class="logi-scan-img" src="/static/icons/ic/scan.svg" mode="aspectFit" />
                <text>扫码</text>
              </view>
            </view>
          </view>
          <view class="amount-row amount-row--total">
            <text class="amount-label amount-label--strong">应收金额</text>
            <text class="amount-value amount-value--total">{{ fmt(docTotal) }}</text>
          </view>
        </template>

        <!-- 采购入库：税额 + 运费分摊 -->
        <template v-else-if="docKey === 'pur_inbound'">
          <view class="amount-row">
            <text class="amount-label">商品总额</text>
            <text class="amount-value amount-value--mono">{{ fmt(totalAmount) }}</text>
          </view>
          <view class="amount-row" v-if="taxAmount > 0">
            <text class="amount-label">{{ taxIncluded ? '其中税额' : `税额(${taxRate}%)` }}</text>
            <text class="amount-value amount-value--mono">{{ fmt(taxAmount) }}</text>
          </view>
          <view class="amount-row">
            <text class="amount-label amount-label--orange">运费分摊</text>
            <input class="sf-input sf-input--money sf-input--inline" :value="shipping" type="digit" @input="onShippingChange" />
          </view>
          <view class="sum-divider"></view>
          <view class="amount-row amount-row--total">
            <text class="amount-label amount-label--strong">应付金额</text>
            <text class="amount-value amount-value--total amount-value--red">{{ fmt(docTotal) }}</text>
          </view>
        </template>

        <!-- 退货 -->
        <template v-else-if="isReturnDoc">
          <view class="amount-row">
            <text class="amount-label">商品总额</text>
            <text class="amount-value amount-value--mono">{{ fmt(totalAmount) }}</text>
          </view>
          <view class="sum-divider"></view>
          <view class="amount-row amount-row--total">
            <text class="amount-label amount-label--strong">{{ docMain === 'sale' ? '应收金额' : '应付金额' }}</text>
            <text class="amount-value amount-value--total" :class="{ 'amount-value--red': docMain === 'purchase' }">{{ fmt(docTotal) }}</text>
          </view>
        </template>
      </view>

      <!-- 出货占位（后端接口待开放） -->
      <view class="form-section doc-placeholder" v-if="docConfig.placeholder">
        <image class="placeholder-img" src="/static/icons/es-box.svg" mode="aspectFit" />
        <text class="placeholder-text">{{ docConfig.placeholder }}</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
    </view>

    <!-- 底部提交（原稿 action-bar 悬浮按钮组：保存 secondary / 转单 primary 带箭头 / 分享 tertiary；输入聚焦时隐藏） -->
    <view class="bottom-bar" :class="{ 'bottom-bar--hidden': keyboardHideBar }">
      <button
        v-for="(act, i) in docConfig.actions"
        :key="act.label"
        :class="['submit-btn', act.label === '分享' ? 'share-btn' : (act.variant === 'ghost' ? 'draft-btn' : ''), { 'submit-btn--disabled': submitting || (act.needsSaved && !isSaved) }]"
        :disabled="submitting"
        @tap="onActionTap(act)"
      >
        {{ bottomLabel(act) }}
        <image v-if="act.needsSaved" class="ab-arrow" src="/static/icons/ic/arrow-right-white.svg" mode="aspectFit" />
      </button>
    </view>

    <!-- 客户选择弹窗 -->
    <view class="picker-mask" v-if="showCustomerPicker" @tap="closeCustomerPicker">
      <view class="picker-popup picker-popup--large" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择客户</text>
          <text class="picker-close" @tap="closeCustomerPicker">×</text>
        </view>
        <view class="picker-search">
          <view class="search-input-wrap">
            <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
            <input
              class="search-input"
              v-model="customerSearchKeyword"
              type="text"
              placeholder="搜索客户名称/手机号"
              placeholder-class="search-placeholder"
              confirm-type="search"
              @confirm="searchCustomers"
            />
          </view>
        </view>
        <scroll-view class="picker-content picker-content--with-search" scroll-y @scrolltolower="loadMoreCustomers">
          <view class="customer-loading" v-if="customerLoading && customerList.length === 0">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
          </view>
          <view
            class="picker-item picker-item--customer"
            v-for="customer in customerList"
            :key="customer.id"
            :class="{ 'picker-item--active': selectedCustomer?.id === customer.id }"
            @tap="selectCustomer(customer)"
          >
            <view class="customer-item-info">
              <text class="customer-item-name">{{ customer.name }}</text>
              <text class="customer-item-phone" v-if="customer.phone">{{ customer.phone }}</text>
            </view>
            <view class="customer-item-type" v-if="customer.typeLabel">{{ customer.typeLabel }}</view>
            <view class="picker-check" v-if="selectedCustomer?.id === customer.id">✓</view>
          </view>
          <view class="load-more" v-if="customerList.length > 0">
            <view class="loading-more-spinner" v-if="customerLoadingMore"></view>
            <text class="load-more-text" v-if="customerLoadingMore">加载中...</text>
            <text class="load-more-text" v-else-if="customerNoMore">-- 没有更多了 --</text>
          </view>
          <view class="empty-state" v-if="!customerLoading && customerList.length === 0">
            <text class="empty-text">暂无客户</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 商品选择子页面（原稿 subpage：全屏侧滑，搜索 + 分类 + 无库存开关 + 快速新增 + 底部已选汇总） -->
    <view class="subpage" :class="{ 'subpage--show': showProductPicker }">
      <view class="page-hd">
        <view class="hd-back" @tap="cancelPick">
          <image class="hd-back-img" src="/static/icons/ic/back.svg" mode="aspectFit" />
        </view>
        <text class="hd-title">选择商品</text>
        <view class="pp-hd-acts">
          <view class="pp-hd-btn" :class="{ 'pp-hd-btn--on': hideNoStock }" @tap="toggleHideStock">
            <image class="pp-hd-ico" :src="hideNoStock ? '/static/icons/ic/eyeoff-gray.svg' : '/static/icons/ic/eye-gray.svg'" mode="aspectFit" />
            <text>{{ hideNoStock ? '无库存' : '全部' }}</text>
          </view>
          <view class="pp-hd-btn pp-hd-btn--plus" @tap="openQuickAdd">
            <image class="pp-hd-ico" src="/static/icons/ic/plus.svg" mode="aspectFit" />
          </view>
        </view>
      </view>

      <view class="pp-search">
        <view class="pp-search-inner">
          <image class="pp-search-ico" src="/static/icons/ic/search.svg" mode="aspectFit" />
          <input
            class="pp-search-input"
            :value="productSearchKeyword"
            type="text"
            placeholder="搜索商品名称 / 条码"
            placeholder-class="pp-search-ph"
            @input="onPPSearch($event)"
          />
          <text class="pp-search-clear" v-if="productSearchKeyword" @tap="clearPPSearch">×</text>
        </view>
      </view>

      <scroll-view class="pp-cats" scroll-x :show-scrollbar="false">
        <view
          class="pp-cat"
          :class="{ 'pp-cat--active': selectedCategoryId === 0 }"
          @tap="selectCategory(0)"
        >
          <text>全部</text>
        </view>
        <view
          class="pp-cat"
          v-for="cat in categoryList"
          :key="cat.id"
          :class="{ 'pp-cat--active': selectedCategoryId === cat.id }"
          @tap="selectCategory(cat.id)"
        >
          <text>{{ cat.name }}</text>
        </view>
      </scroll-view>

      <scroll-view class="pp-list" scroll-y @scrolltolower="loadMoreProducts">
        <view class="product-loading" v-if="productLoading && productList.length === 0">
          <view class="loading-spinner"></view>
          <text class="loading-text">加载中...</text>
        </view>
        <view class="pp-empty" v-if="!productLoading && productList.length === 0">
          <text>没有找到相关商品</text>
        </view>
        <view
          class="pp-item"
          :class="{ 'pp-item--sel': (pendingPicks[product.id] || 0) > 0, 'pp-item--nostock': product.stock <= 0 }"
          v-for="product in visibleProducts"
          :key="product.id"
        >
          <view class="pp-thumb" :style="{ background: itemTint(product.name) }">
            <text class="pp-thumb-letter" :style="{ color: itemColor(product.name) }">{{ firstChar(product.name) }}</text>
          </view>
          <view class="pp-body">
            <view class="pp-name">
              <text>{{ product.name }}</text>
              <text class="pp-nostock-tag" v-if="product.stock <= 0">无库存</text>
            </view>
            <text class="pp-desc">{{ product.specs || product.unit }} · 库存{{ product.stock }}{{ product.unit }}</text>
            <view class="pp-price-row">
              <text class="pp-price">{{ fmt(product.wholesalePrice ?? product.price) }}</text>
              <text class="pp-retail" v-if="product.retailPrice">零售{{ fmt(product.retailPrice) }}</text>
            </view>
          </view>
          <view class="pp-act">
            <view class="pp-qty" v-if="(pendingPicks[product.id] || 0) > 0">
              <view class="pp-qty-btn" :data-pid="product.id" data-delta="-1" @tap.stop="onPickTap">−</view>
              <text class="pp-qty-num">{{ pendingPicks[product.id] }}</text>
              <view class="pp-qty-btn" :data-pid="product.id" data-delta="1" @tap.stop="onPickTap">+</view>
            </view>
            <view class="pp-add" v-else :data-pid="product.id" data-delta="1" @tap.stop="onPickTap">
              <image class="pp-add-ico" src="/static/icons/ic/plus.svg" mode="aspectFit" />
            </view>
          </view>
        </view>
        <view class="load-more" v-if="productList.length > 0">
          <view class="loading-more-spinner" v-if="productLoadingMore"></view>
          <text class="load-more-text" v-if="productLoadingMore">加载中...</text>
          <text class="load-more-text" v-else-if="productNoMore">-- 没有更多了 --</text>
        </view>
      </scroll-view>

      <view class="pp-bar">
        <view class="pp-bar-inner">
          <view class="pp-sum">
            <text class="pp-sum-l">{{ ppSumLeft }}</text>
            <text class="pp-sum-amt" :class="{ 'pp-sum-amt--zero': ppKinds === 0 }">{{ fmt(ppTotal) }}</text>
          </view>
          <view class="pp-btn" :class="{ 'pp-btn--dis': ppKinds === 0 }" @tap="confirmPick">选好了</view>
        </view>
      </view>
    </view>

    <!-- 快速新增商品（原稿 openQuickAdd：保存后自动选中 1 件） -->
    <view class="picker-mask" v-if="quickAddShow" @tap="closeQuickAdd">
      <view class="picker-popup" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">快速新增商品</text>
          <text class="picker-close" @tap="closeQuickAdd">×</text>
        </view>
        <scroll-view class="qa-scroll" scroll-y>
          <text class="qa-tip">商品库里没有的商品，可在这里快速新增，保存后会自动加入本次选择。</text>
          <view class="qa-body">
            <view class="qa-field"><text class="qa-label">名称</text><input class="qa-input" v-model="quickAddForm.name" placeholder="请输入商品名称" placeholder-class="qa-ph" /></view>
            <view class="qa-field"><text class="qa-label">规格</text><input class="qa-input" v-model="quickAddForm.spec" placeholder="如 500ml*12/箱" placeholder-class="qa-ph" /></view>
            <view class="qa-field"><text class="qa-label">单位</text><input class="qa-input" v-model="quickAddForm.unit" placeholder="箱 / 瓶 / 袋" placeholder-class="qa-ph" /></view>
            <view class="qa-field"><text class="qa-label">批发价</text><input class="qa-input" v-model="quickAddForm.wholesalePrice" type="digit" placeholder="0.00" placeholder-class="qa-ph" /></view>
            <view class="qa-field"><text class="qa-label">零售价</text><input class="qa-input" v-model="quickAddForm.retailPrice" type="digit" placeholder="0.00" placeholder-class="qa-ph" /></view>
            <view class="qa-field"><text class="qa-label">库存</text><input class="qa-input" v-model="quickAddForm.stock" type="number" placeholder="0" placeholder-class="qa-ph" /></view>
          </view>
          <view class="qa-actions">
            <view class="qa-btn qa-btn--ghost" @tap="closeQuickAdd">取消</view>
            <view class="qa-btn qa-btn--primary" @tap="saveQuickAdd">保存并选中</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { salesApi, type SaleItem } from '@/api/modules/sales'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'
import { productsApi, type ProductInfo, type CategoryInfo } from '@/api/modules/products'
import { storeApi } from '@/api/modules/store'
import { purchaseApi } from '@/api/modules/purchase'
import { receiptApi } from '@/api/modules/receipts'
import { paymentNewApi } from '@/api/modules/finance'
import { supplierApi, type Supplier } from '@/api/modules/suppliers'
import { storesApi } from '@/api/modules/stores'
import { saleReturnApi, purchaseReturnApi } from '@/api/modules/returns'
import { PRODUCT_THUMB_COLORS } from '@/constants/colors'

// ===================================================================
// 单据框架：四种单据各自独立字段 / 底部动作 / 提交接口
// 公共能力（商品选择 / 客户搜索 / 扫码 / 数量编辑 / 分享 / 暂存 / 校验）只实现一次，按单据差异复用
// ===================================================================

const submitting = ref(false)
const isSaved = ref(false)
const todayStr = (): string => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// ---------- 单据类型分段导航（原稿：销售/采购 + 子段） ----------
const docMain = ref<'sale' | 'purchase'>('sale')
const docSubs = computed(() =>
  docMain.value === 'sale'
    ? ['订单', '销售单', '退货', '收款单']
    : ['采购订单', '采购入库', '采购退货', '付款单']
)
const docSub = ref('订单')
function switchDocMain(v: 'sale' | 'purchase') {
  docMain.value = v
  docSub.value = v === 'sale' ? '订单' : '采购订单'
  resetDoc()
}
// 子段切换：对齐 HTML 各单据独立状态（切换即重置当前单据数据）
function selectDocSub(s: string) {
  if (docSub.value === s) return
  docSub.value = s
  resetDoc()
}

// 当前单据业务类型：对齐 HTML 8 单据 id（销售订单/销售单/销售退货/收款单 + 采购订单/采购入库/采购退货/付款单）
const docKey = computed<'sale_order' | 'sale_ticket' | 'sale_return' | 'sale_receipt' | 'pur_order' | 'pur_inbound' | 'pur_return' | 'pur_payment'>(() => {
  if (docMain.value === 'sale') {
    if (docSub.value === '订单') return 'sale_order'
    if (docSub.value === '销售单') return 'sale_ticket'
    if (docSub.value === '退货') return 'sale_return'
    return 'sale_receipt' // 收款单
  } else {
    if (docSub.value === '采购订单') return 'pur_order'
    if (docSub.value === '采购入库') return 'pur_inbound'
    if (docSub.value === '采购退货') return 'pur_return'
    return 'pur_payment' // 付款单
  }
})

// 顶栏标题（原稿 pageTitle：随单据类型切换）
const docTitle = computed(() => ({
  sale_order: '销售订单',
  sale_ticket: '销售单',
  sale_return: '销售退货',
  sale_receipt: '收款单',
  pur_order: '采购订单',
  pur_inbound: '采购入库',
  pur_return: '采购退货',
  pur_payment: '付款单',
}[docKey.value] || '销售订单'))

// 右侧三点：打印设置（真实入口：单据打印记录页）
function onMoreMenu() {
  uni.navigateTo({ url: '/pages-sub/admin/print/print-records' })
}

// ---------- 每种单据配置：字段显隐 + 底部动作 ----------
interface DocAction {
  label: string
  variant: 'primary' | 'ghost'
  handler: () => void
  loadingText?: string
  /** 转单类主按钮：需先保存（草稿态置灰，原稿 convBtn dis） */
  needsSaved?: boolean
}
const docConfig = computed<{
  showCustomer: boolean
  showSupplier: boolean
  showProducts: boolean
  showDelivery: boolean
  showOrderDate: boolean
  showStore: boolean
  showSourceBill: boolean
  showReceiptCustomer: boolean
  showAmount: boolean
  showPayment: boolean
  showRemark: boolean
  showDeposit: boolean
  showRound: boolean
  showLogistics: boolean
  showTax: boolean
  showBatch: boolean
  showReason: boolean
  showVerify: boolean
  showOrderStatus: boolean
  showShipSummary: boolean
  actions: DocAction[]
  placeholder?: string
}>(() => {
  switch (docKey.value) {
    case 'sale_ticket':
      return {
        showCustomer: true, showSupplier: false, showProducts: true,
        showDelivery: true, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: true, showLogistics: true, showTax: false,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转收款单', variant: 'primary', handler: () => convertDoc('sale_receipt'), loadingText: '转收款单中...', needsSaved: true },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'sale_return':
      return {
        showCustomer: false, showSupplier: false, showProducts: true,
        showDelivery: false, showOrderDate: false, showStore: true, showSourceBill: true,
        showReceiptCustomer: true, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: true, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: submitSaleReturn },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'sale_receipt':
      return {
        showCustomer: false, showSupplier: false, showProducts: false,
        showDelivery: false, showOrderDate: true, showStore: false, showSourceBill: true,
        showReceiptCustomer: true, showAmount: true, showPayment: true, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: true, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '确认收款', variant: 'primary', handler: submitReceipt, loadingText: '收款中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_order':
      return {
        showCustomer: true, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: true, showRound: false, showLogistics: false, showTax: true,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: true,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转入库单', variant: 'primary', handler: () => convertDoc('pur_inbound'), loadingText: '转入库单中...', needsSaved: true },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_inbound':
      return {
        showCustomer: false, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: true,
        showBatch: true, showReason: false, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转付款单', variant: 'primary', handler: () => convertDoc('pur_payment'), loadingText: '转付款单中...', needsSaved: true },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_return':
      return {
        showCustomer: false, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: false, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: true, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: submitPurchaseReturn },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_payment':
      return {
        showCustomer: false, showSupplier: true, showProducts: false,
        showDelivery: false, showOrderDate: true, showStore: false, showSourceBill: true,
        showReceiptCustomer: false, showAmount: true, showPayment: true, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: true, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '确认付款', variant: 'primary', handler: submitPayment, loadingText: '付款中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    default: // sale_order
      return {
        showCustomer: true, showSupplier: false, showProducts: true,
        showDelivery: true, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: true, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: true,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转销售单', variant: 'primary', handler: submitOrder, loadingText: '转销售单中...', needsSaved: true },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
  }
})

// ---------- 公共：商品明细状态（订单 / 进货 共用） ----------
const saleItems = reactive<SaleItem[]>([])
const remark = ref('')
const selectedCustomer = ref<CustomerInfo | null>(null)

// 配送方式 / 日期（订单）
const deliveryOptions = ['送货上门', '到店自提', '物流发货']
const deliveryMethod = ref('送货上门')
function onDeliveryChange(e: any) {
  deliveryMethod.value = deliveryOptions[Number(e.detail.value)] ?? deliveryMethod.value
}
const orderDate = ref(todayStr())
function onDateChange(e: any) {
  orderDate.value = e.detail.value
}
// 交货/到货日期（订单类：销售订单=交货，采购订单=到货）
const deliveryDate = ref('')

// ===== 扩展字段（对齐 HTML 8 单据：定金/抹零/物流/税率/批次/退货/核销/预付款） =====
// 抹零方式（原稿 round-modes 四档）
const roundModes: Array<[string, string]> = [['none', '不抹'], ['fen', '抹分'], ['jiao', '抹角'], ['both', '抹角分']]
const roundMode = ref<'none' | 'fen' | 'jiao' | 'both'>('none')
function selectRoundMode(m: 'none' | 'fen' | 'jiao' | 'both') { roundMode.value = m }

const taxRate = ref(0) // 百分比数值（如 13 表示 13%）
const taxRateOptions = [0, 3, 6, 9, 13, 16]
function onTaxRateChange(e: any) { taxRate.value = taxRateOptions[Number(e.detail.value)] ?? 0 }
const taxIncluded = ref(false)
function toggleTaxIncluded() { taxIncluded.value = !taxIncluded.value }

const batchNo = ref('')
function onBatchChange(e: any) { batchNo.value = e.detail.value || '' }
const expiryDate = ref('')
function onExpiryChange(e: any) { expiryDate.value = e.detail.value || '' }
const invoiceStatus = ref<'pending' | 'received'>('pending')
function toggleInvoiceStatus() { invoiceStatus.value = invoiceStatus.value === 'received' ? 'pending' : 'received' }

const returnReason = ref('')
const returnReasonOptions = ['质量问题', '规格不符', '临期商品', '客户取消', '运输损坏', '其他原因']
function selectReturnReason(r: string) { returnReason.value = r }
const originalDoc = ref('') // 关联原单号
function onOriginalDocChange(e: any) { originalDoc.value = e.detail.value || '' }
const returnWarehouseId = ref<number | null>(null)
const returnWarehouseLabel = computed(() => storeOptions.value.find(s => s.id === returnWarehouseId.value)?.name || '请选择退货仓库')
function onReturnWarehouseChange(e: any) {
  returnWarehouseId.value = storeOptions.value[Number(e.detail.value)]?.id ?? null
}

const orderStatus = ref<string | null>(null)
const refundStatus = ref('')

// 待核销单据（收款单 / 付款单）：真实拉取可核销单据列表
interface VerifiedDoc { no: string; amount: number; checked: boolean; verifyAmount: number }
const verifiedDocs = reactive<VerifiedDoc[]>([])
const verifiedLoading = ref(false)
async function loadVerifiedDocs() {
  verifiedDocs.splice(0, verifiedDocs.length)
  verifiedLoading.value = true
  try {
    if (docKey.value === 'sale_receipt') {
      const result = await salesApi.list({ page: 1, pageSize: 20 })
      verifiedDocs.push(...(result.list || []).map((b: any) => ({
        no: b.billNo, amount: Number(b.totalAmount ?? 0), checked: false, verifyAmount: 0,
      })))
    } else if (docKey.value === 'pur_payment') {
      const res = await purchaseApi.getOrderList({ page: 1, pageSize: 20 })
      verifiedDocs.push(...(res.list || []).map((o) => ({
        no: o.orderNo, amount: Number(o.totalAmount ?? 0), checked: false, verifyAmount: 0,
      })))
    }
  } catch { /* 真实失败态：列表为空 */ }
  verifiedLoading.value = false
}
// 核销勾选/改额后同步收款金额（后端 createReceipt 必填 amount）
function syncReceiptAmountFromVerified() {
  if (docKey.value !== 'sale_receipt') return
  receiptAmount.value = verifiedDocs.filter(d => d.checked).reduce((s, d) => s + (d.verifyAmount || 0), 0)
}
function toggleVerify(i: number) {
  const d = verifiedDocs[i]
  if (!d) return
  d.checked = !d.checked
  if (d.checked && !d.verifyAmount) d.verifyAmount = d.amount
  syncReceiptAmountFromVerified()
}
function onVerifyAmountChange(i: number, e: any) {
  const d = verifiedDocs[i]
  if (d) d.verifyAmount = Math.max(0, Number(e.detail.value) || 0)
  syncReceiptAmountFromVerified()
}
const prepaymentDeduct = ref(0)
function onPrepayChange(e: any) { prepaymentDeduct.value = Math.max(0, Number(e.detail.value) || 0) }

// 物流单号（销售单：配送方式=物流发货 时录入/扫码）
const logisticsNo = ref('')
function onLogisticsChange(e: any) { logisticsNo.value = e.detail.value || '' }
async function scanLogistics() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (code) { logisticsNo.value = code; uni.showToast({ title: '已扫描物流单号', icon: 'none' }) }
  } catch (err) {
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

// 定金（订单类：销售订单/采购订单）/ 配送费·运费分摊（销售单/采购入库）
const deposit = ref(0)
function onDepositChange(e: any) { deposit.value = Math.max(0, Number(e.detail.value) || 0) }
const shipping = ref(0)
function onShippingChange(e: any) { shipping.value = Math.max(0, Number(e.detail.value) || 0) }

// 抹零计算（对齐 HTML roundOff）
function roundOff(base: number, mode: 'none' | 'fen' | 'jiao' | 'both'): number {
  if (!mode || mode === 'none') return 0
  const yuan = Math.floor(base)
  const frac = +(base - yuan).toFixed(2)
  if (mode === 'fen') { const jiao = Math.floor(frac * 10) / 10; return +(frac - jiao).toFixed(2) }
  if (mode === 'jiao' || mode === 'both') { return frac }
  return 0
}

// 各单据初始默认值（对齐 HTML initDocState）
function applyDocDefaults(k: string) {
  const isOrder = k === 'sale_order' || k === 'pur_order'
  const isInbound = k === 'pur_inbound'
  const isReturn = k.includes('return')
  const isPayment = k === 'pur_payment'
  const isTicket = k === 'sale_ticket'
  roundMode.value = isTicket ? 'both' : 'none'
  // 真实默认：金额类字段一律 0/空，由用户录入；不预填任何演示数值
  deposit.value = 0
  taxRate.value = (isInbound || k === 'pur_order') ? 13 : 0
  taxIncluded.value = !!(isInbound || k === 'pur_order')
  batchNo.value = ''
  expiryDate.value = ''
  invoiceStatus.value = 'pending'
  returnReason.value = ''
  originalDoc.value = ''
  refundStatus.value = isReturn ? 'pending' : ''
  orderStatus.value = isOrder ? 'pending' : null
  prepaymentDeduct.value = 0
  logisticsNo.value = ''
  shipping.value = 0
  deliveryDate.value = ''
  verifiedDocs.splice(0, verifiedDocs.length)
}

// ---------- 供应商（进货单） ----------
const supplierOptions = ref<Supplier[]>([])
const selectedSupplierId = ref<number | null>(null)
const supplierLabel = computed(() => supplierOptions.value.find(s => s.id === selectedSupplierId.value)?.name || '请选择供应商')
async function loadSuppliers() {
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: 100 })
    supplierOptions.value = res.list || []
  } catch { supplierOptions.value = [] }
}
function onSupplierChange(e: any) {
  selectedSupplierId.value = supplierOptions.value[Number(e.detail.value)]?.id ?? null
}

// ---------- 入库门店（进货单）：后端入库场所为 store_id（门店），无 warehouse 维度 ----------
// 直接复用 storesApi.list 真实门店列表，提交 store_id，杜绝"以门店冒充仓库"的维度错误。
const storeOptions = ref<{ id: number; name: string }[]>([])
const selectedStoreId = ref<number | null>(null)
const storeSectionTitle = computed(() =>
  docKey.value === 'pur_inbound' ? '入库门店'
    : (docKey.value === 'sale_return' || docKey.value === 'pur_return') ? '退货门店'
    : '门店'
)
const storeLabel = computed(() => storeOptions.value.find(s => s.id === selectedStoreId.value)?.name
  || (docKey.value === 'pur_inbound' ? '请选择入库门店' : '请选择门店'))
async function loadStores() {
  try {
    const res = await storesApi.list({ page: 1, pageSize: 100 })
    storeOptions.value = (res.list || []).map(s => ({ id: s.id, name: s.name }))
  } catch { storeOptions.value = [] }
}
function onStoreChange(e: any) {
  selectedStoreId.value = storeOptions.value[Number(e.detail.value)]?.id ?? null
}

// ---------- 当前门店卡（原稿 store-card：蓝渐变，全局选择门店） ----------
const storeNames = computed(() => storeOptions.value.map(s => s.name))
const storeCardName = computed(() =>
  storeOptions.value.find(s => s.id === selectedStoreId.value)?.name
  || storeOptions.value[0]?.name
  || '总仓')
function onStoreCardChange(e: any) {
  selectedStoreId.value = storeOptions.value[Number(e.detail.value)]?.id ?? null
}

// ---------- 关联销售单（收款单：仅前端反查客户与金额，按 Receipt 契约提交，不臆造源单字段） ----------
const sourceBills = ref<{ label: string; billNo: string; customerName: string; totalAmount: number }[]>([])
const selectedSourceBill = ref('')
const receiptCustomerId = ref<number | null>(null)
const receiptCustomerName = ref('')
const sourceBillLabel = computed(() => selectedSourceBill.value || '请选择销售单')
async function loadSourceBills() {
  try {
    if (docKey.value === 'pur_return') {
      // 采购退货：关联原单为真实采购订单
      const res = await purchaseApi.getOrderList({ page: 1, pageSize: 20 })
      sourceBills.value = (res.list || []).map((o) => ({
        label: `${o.orderNo} ¥${Number(o.totalAmount ?? 0).toFixed(2)}`,
        billNo: o.orderNo,
        customerName: o.supplierName || '',
        totalAmount: Number(o.totalAmount ?? 0),
      }))
    } else {
      // 销售退货 / 收款单：关联原单为真实销售单
      const result = await salesApi.list({ page: 1, pageSize: 20 })
      const list = result.list || []
      sourceBills.value = list.map((b: any) => ({
        label: `${b.billNo} ¥${Number(b.totalAmount ?? 0).toFixed(2)}`,
        billNo: b.billNo,
        customerName: b.customerName || '',
        totalAmount: Number(b.totalAmount ?? 0),
      }))
    }
  } catch { sourceBills.value = [] }
}
function onSourceBillChange(e: any) {
  const bill = sourceBills.value[Number(e.detail.value)]
  if (bill) {
    selectedSourceBill.value = bill.billNo
    receiptCustomerName.value = bill.customerName
    if (!receiptAmount.value) receiptAmount.value = bill.totalAmount
  }
}

// 收款单：金额 + 收款方式
const receiptAmount = ref(0)
function onReceiptAmountChange(e: any) { receiptAmount.value = Math.max(0, Number(e.detail.value) || 0) }
// 收付款方式枚举：与工作台 ReceiptsView/PaymentsNewView 完全一致（显示中文、提交英文枚举）
const paymentOptions = [
  { label: '现金', value: 'CASH' },
  { label: '银行转账', value: 'BANK_TRANSFER' },
  { label: '微信支付', value: 'WECHAT' },
  { label: '支付宝', value: 'ALIPAY' },
]
const paymentMethod = ref('CASH')
// 收款方式胶囊点击（对齐 HTML .chip 选择）
function selectPayment(m: string) { paymentMethod.value = m }

// ---------- 切换单据时重置状态 ----------
function resetDoc() {
  saleItems.splice(0, saleItems.length)
  remark.value = ''
  selectedCustomer.value = null
  selectedSupplierId.value = null
  selectedStoreId.value = null
  selectedSourceBill.value = ''
  receiptCustomerName.value = ''
  receiptAmount.value = 0
  receiptCustomerId.value = null
  paymentMethod.value = 'CASH'
  deliveryMethod.value = '送货上门'
  orderDate.value = todayStr()
  discount.value = 0
  isSaved.value = false
  swipeOpenIndex.value = -1
  // 扩展字段复位
  deliveryDate.value = ''
  roundMode.value = 'none'
  taxRate.value = 0
  taxIncluded.value = false
  batchNo.value = ''
  expiryDate.value = ''
  invoiceStatus.value = 'pending'
  returnReason.value = ''
  originalDoc.value = ''
  returnWarehouseId.value = null
  orderStatus.value = null
  refundStatus.value = ''
  prepaymentDeduct.value = 0
  logisticsNo.value = ''
  deposit.value = 0
  shipping.value = 0
  verifiedDocs.splice(0, verifiedDocs.length)
  const k = docKey.value
  applyDocDefaults(k)
  // 门店卡全局可用：统一加载真实门店
  loadStores()
  if (k === 'pur_inbound' || k === 'pur_return') loadSuppliers()
  if (k === 'sale_return' || k === 'sale_receipt' || k === 'pur_return') loadSourceBills()
  if (k === 'sale_receipt' || k === 'pur_payment') loadVerifiedDocs()
}

// ---------- 进入页面时懒加载公共数据 ----------
function ensurePurchaseData() {
  const k = docKey.value
  if (k === 'pur_inbound' || k === 'pur_return') {
    if (supplierOptions.value.length === 0) loadSuppliers()
  }
  if (storeOptions.value.length === 0) loadStores()
  if (k === 'sale_return' || k === 'sale_receipt' || k === 'pur_return') loadSourceBills()
  if (k === 'sale_receipt' || k === 'pur_payment') loadVerifiedDocs()
}

// 已选商品：支持修改单价（订单）
function onPriceChange(index: number, e: any) {
  const item = saleItems[index]
  if (!item) return
  item.price = Number(e.detail.value) || 0
  item.unitPrice = item.price
}
function onPriceConfirm(index: number) {
  const item = saleItems[index]
  if (!item) return
  item.total = (item.price ?? 0) * (item.quantity ?? 0)
  item.subtotalAmount = item.total
  item.unitPrice = item.price
}

// 左滑显示删除
const swipeOpenIndex = ref(-1)
let swipeStartX = 0
function onSwipeStart(index: number) {
  swipeStartX = 0
}
function onSwipeMove(index: number, e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0]
  if (!touch) return
  const dx = touch.clientX - swipeStartX
  if (swipeStartX === 0) { swipeStartX = touch.clientX; return }
  if (dx < -40) swipeOpenIndex.value = index
  else if (dx > 40) swipeOpenIndex.value = -1
}
function onSwipeEnd(index: number) {
  swipeStartX = 0
}

// 商品首字缩略图（原稿 prod-thumb）
function firstChar(name?: string): string {
  return (name || '').trim().charAt(0) || '商'
}

// 商品彩色首字（原稿：按商品名取 8 色板 + 14% tint 背景）
function itemColor(name?: string): string {
  const s = name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PRODUCT_THUMB_COLORS[h % PRODUCT_THUMB_COLORS.length]
}
function itemTint(name?: string): string {
  const n = itemColor(name)
  const r = parseInt(n.slice(1, 3), 16)
  const g = parseInt(n.slice(3, 5), 16)
  const b = parseInt(n.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.14)`
}

// 追溯码胶囊 × 删除（原稿 removeTrace：按索引删多码之一）
function removeTrace(index: number, tcIdx: number) {
  const item = saleItems[index]
  if (item && Array.isArray(item.traceCodes)) item.traceCodes.splice(tcIdx, 1)
}

// 交货/到货日期（原稿 deliveryDate 行）
function onDeliveryDateChange(e: any) {
  deliveryDate.value = e.detail.value || ''
}

// ========== 计算属性 ==========
const totalAmount = computed(() => saleItems.reduce((sum, item) => sum + (item.total ?? 0), 0))
const totalQty = computed(() => saleItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0))
// 提交前置：订单 / 进货需有商品；收款单需金额>0（在各 submit 内单独校验）
const canSubmit = computed(() => !submitting.value)

// 优惠（仅订单汇总使用）
const discount = ref(0)
function onDiscountChange(e: any) {
  discount.value = Math.max(0, Number(e.detail.value) || 0)
}
const receivable = computed(() => Math.max(0, totalAmount.value - discount.value))

// 金额展示（原稿 fmt：¥ 前缀 + 千分位 + 固定两位小数）
function fmt(n: number | string | null | undefined): string {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ========== 金额汇总计算（对齐原稿 calcTotals，按单据类型分列） ==========
const isMoneyDoc = computed(() => docKey.value === 'sale_receipt' || docKey.value === 'pur_payment')
const isReturnDoc = computed(() => docKey.value.includes('return'))
const isOrderDoc = computed(() => docKey.value === 'sale_order' || docKey.value === 'pur_order')
// 税额：含税单价 = 总额价内分离；不含税 = 总额外加
const taxAmount = computed(() => {
  const r = taxRate.value / 100
  if (r <= 0) return 0
  return taxIncluded.value
    ? +(totalAmount.value / (1 + r) * r).toFixed(2)
    : +(totalAmount.value * r).toFixed(2)
})
// 抹零金额（仅销售单按抹零方式自动计算）
const roundOffAmount = computed(() => {
  if (docKey.value !== 'sale_ticket') return 0
  return roundOff(totalAmount.value + shipping.value + (taxIncluded.value ? 0 : taxAmount.value), roundMode.value)
})
// 核销合计 / 待核销总额（收款单/付款单）
const verifiedTotal = computed(() => verifiedDocs.filter(d => d.checked).reduce((s, d) => s + (d.verifyAmount || 0), 0))
const pendingTotal = computed(() => verifiedDocs.reduce((s, d) => s + d.amount, 0))
// 应收/应付合计（各单据口径）
const docTotal = computed(() => {
  const k = docKey.value
  if (isMoneyDoc.value) return Math.max(0, verifiedTotal.value - prepaymentDeduct.value)
  if (k === 'sale_ticket') return Math.max(0, totalAmount.value - roundOffAmount.value + shipping.value)
  if (k === 'pur_inbound') return totalAmount.value + (taxIncluded.value ? 0 : taxAmount.value) + shipping.value
  if (isOrderDoc.value) return totalAmount.value + (taxIncluded.value ? 0 : taxAmount.value)
  return totalAmount.value // 退货：按商品原额
})
// 状态文案（新建单据真实初始态）
const orderStatusLabel = computed(() => orderStatus.value === 'confirmed' ? '已确认' : '待确认')
const refundStatusLabel = computed(() => ({ pending: '待退款', partial: '部分退款', refunded: '已退款' }[refundStatus.value || 'pending'] || '待退款'))
const invoiceStatusLabel = computed(() => invoiceStatus.value === 'received' ? '已到票' : '待到票')
// 物流单号行：销售类单据 + 物流发货
const isLogistics = computed(() =>
  (docKey.value === 'sale_order' || docKey.value === 'sale_ticket') && deliveryMethod.value === '物流发货')

// 核销勾选数（待核销卡徽标）
const verifiedCheckedCount = computed(() => verifiedDocs.filter(d => d.checked).length)

// 退货原因 picker
function onReturnReasonChange(e: any) {
  returnReason.value = returnReasonOptions[Number(e.detail.value)] ?? ''
}

// 税率 picker 选项展示
const taxRateLabels = computed(() => taxRateOptions.map(r => `${r}%`))

// ========== 客户选择弹窗 ==========
const showCustomerPicker = ref(false)
const customerSearchKeyword = ref('')
const customerList = ref<CustomerInfo[]>([])
const customerLoading = ref(false)
const customerLoadingMore = ref(false)
const customerPage = ref(1)
const customerPageSize = 20
const customerNoMore = ref(false)

function openCustomerPicker() {
  showCustomerPicker.value = true
  customerPage.value = 1
  customerNoMore.value = false
  customerList.value = []
  loadCustomers()
}

function closeCustomerPicker() {
  showCustomerPicker.value = false
}

function searchCustomers() {
  customerPage.value = 1
  customerNoMore.value = false
  customerList.value = []
  loadCustomers()
}

async function loadCustomers() {
  if (customerLoading.value) return
  customerLoading.value = true
  try {
    const result = await customersApi.list({
      keyword: customerSearchKeyword.value || undefined,
      page: customerPage.value,
      pageSize: customerPageSize,
    })
    const list = result.list || []
    if (customerPage.value === 1) {
      customerList.value = list
    } else {
      customerList.value = [...customerList.value, ...list]
    }
    customerNoMore.value = list.length < customerPageSize
  } catch (err) {
    console.error('加载客户列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    customerLoading.value = false
    customerLoadingMore.value = false
  }
}

async function loadMoreCustomers() {
  if (customerLoadingMore.value || customerNoMore.value) return
  customerLoadingMore.value = true
  customerPage.value++
  await loadCustomers()
}

function selectCustomer(customer: CustomerInfo) {
  selectedCustomer.value = customer
  // 收款单需要 customerId 提交给后端（createReceipt 必填）
  if (docKey.value === 'sale_receipt') {
    receiptCustomerId.value = customer.id ?? null
    receiptCustomerName.value = customer.name || ''
  }
  showCustomerPicker.value = false
}

// ========== 商品选择子页面（原稿 subpage：全屏侧滑，临时数量确认后写回单据） ==========
const showProductPicker = ref(false)
const productSearchKeyword = ref('')
const productList = ref<ProductInfo[]>([])
// 本次选择页的临时数量：{productId: qty}，点「选好了」才写回单据
const pendingPicks = reactive<Record<number, number>>({})
const hideNoStock = ref(true)
const categoryList = ref<CategoryInfo[]>([])
const selectedCategoryId = ref<number>(0)
const productLoading = ref(false)
const productLoadingMore = ref(false)
const productPage = ref(1)
const productPageSize = 20
const productNoMore = ref(false)
let ppSearchTimer: ReturnType<typeof setTimeout> | null = null

// 无库存开关（默认隐藏）：仅前端过滤真实库存字段
const visibleProducts = computed(() =>
  hideNoStock.value ? productList.value.filter(p => p.stock > 0) : productList.value
)

// 底部已选汇总（原稿 renderPPSum）
const ppKinds = computed(() => Object.keys(pendingPicks).length)
const ppPieces = computed(() => Object.keys(pendingPicks).reduce((a, id) => a + (pendingPicks[Number(id)] || 0), 0))
const ppTotal = computed(() => Object.keys(pendingPicks).reduce((s, id) => {
  const p = productList.value.find(x => x.id === Number(id))
  return s + (p ? (p.wholesalePrice ?? p.price) * (pendingPicks[Number(id)] || 0) : 0)
}, 0))
const ppSumLeft = computed(() =>
  ppKinds.value === 0 ? '还没有选择商品' : `已选 ${ppKinds.value} 种 · ${ppPieces.value} 件`
)

function openProductPicker() {
  // 以单据已有商品数量作为初始值，可在原基础上继续增减
  Object.keys(pendingPicks).forEach(k => delete pendingPicks[Number(k)])
  saleItems.forEach(item => { pendingPicks[item.productId] = item.quantity ?? 0 })
  selectedCategoryId.value = 0
  productSearchKeyword.value = ''
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  if (categoryList.value.length === 0) {
    productsApi.categories()
      .then(cats => { categoryList.value = cats })
      .catch(err => console.error('加载分类失败:', err))
  }
  loadProducts()
  showProductPicker.value = true
}

function cancelPick() {
  Object.keys(pendingPicks).forEach(k => delete pendingPicks[Number(k)])
  showProductPicker.value = false
  uni.showToast({ title: '已取消选择', icon: 'none' })
}

// 待选数量增减（减到 0 移除，未选显示 + 号）
function pickChg(product: ProductInfo, delta: number) {
  const cur = pendingPicks[product.id] || 0
  const nv = cur + delta
  if (nv <= 0) delete pendingPicks[product.id]
  else pendingPicks[product.id] = nv
}

// 事件委托入口：从 DOM dataset 取商品 id（v-for 闭包变量在 uni-view 事件转发下可能丢失）
function onPickTap(e: any) {
  const pid = Number(e?.currentTarget?.dataset?.pid)
  const delta = Number(e?.currentTarget?.dataset?.delta) || 0
  if (!pid || !delta) return
  const cur = pendingPicks[pid] || 0
  const nv = cur + delta
  if (nv <= 0) delete pendingPicks[pid]
  else pendingPicks[pid] = nv
}

// 搜索（300ms 防抖，服务端按名称/条码检索）
function onPPSearch(e: any) {
  productSearchKeyword.value = e.detail.value || ''
  if (ppSearchTimer) clearTimeout(ppSearchTimer)
  ppSearchTimer = setTimeout(() => {
    productPage.value = 1
    productNoMore.value = false
    productList.value = []
    loadProducts()
  }, 300)
}

function clearPPSearch() {
  productSearchKeyword.value = ''
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  loadProducts()
}

// 无库存开关（原稿 toggleHideStock）
function toggleHideStock() {
  hideNoStock.value = !hideNoStock.value
  const hiddenCount = productList.value.filter(p => p.stock <= 0).length
  uni.showToast({
    title: hideNoStock.value ? `已隐藏 ${hiddenCount} 个无库存商品` : `已显示全部商品（含 ${hiddenCount} 个无库存）`,
    icon: 'none',
  })
}

function selectCategory(categoryId: number) {
  selectedCategoryId.value = categoryId
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  loadProducts()
}

async function loadProducts() {
  if (productLoading.value) return
  productLoading.value = true
  try {
    const result = await productsApi.list({
      keyword: productSearchKeyword.value || undefined,
      categoryId: selectedCategoryId.value > 0 ? selectedCategoryId.value : undefined,
      page: productPage.value,
      pageSize: productPageSize,
    })
    const list = result.list || []
    if (productPage.value === 1) {
      productList.value = list
    } else {
      productList.value = [...productList.value, ...list]
    }
    productNoMore.value = list.length < productPageSize
  } catch (err) {
    console.error('加载商品列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    productLoading.value = false
    productLoadingMore.value = false
  }
}

async function loadMoreProducts() {
  if (productLoadingMore.value || productNoMore.value) return
  productLoadingMore.value = true
  productPage.value++
  await loadProducts()
}

// 确认选择：更新已有商品数量 / 移除减到 0 的 / 追加新选（原稿 confirmPick）
function confirmPick() {
  if (ppKinds.value === 0) return
  const priceOf = (p: ProductInfo) => Number(p.wholesalePrice ?? p.price ?? 0)
  // 已有商品：更新数量
  saleItems.forEach(item => {
    const qty = pendingPicks[item.productId]
    if (qty != null) {
      item.quantity = qty
      item.bottleQty = qty
      item.total = (item.price ?? 0) * qty
      item.subtotalAmount = item.total
    }
  })
  // 移除减到 0 的
  for (let i = saleItems.length - 1; i >= 0; i--) {
    if (!pendingPicks[saleItems[i]!.productId]) saleItems.splice(i, 1)
  }
  // 追加本次新选的商品
  Object.keys(pendingPicks).forEach(idStr => {
    const id = Number(idStr)
    const qty = pendingPicks[id]
    if (qty > 0 && !saleItems.find(it => it.productId === id)) {
      const product = productList.value.find(x => x.id === id)
      if (product) {
        const price = priceOf(product)
        saleItems.push({
          productId: product.id,
          skuId: product.skuId ? Number(product.skuId) : undefined,
          productName: product.name,
          price,
          quantity: qty,
          total: price * qty,
          boxQty: 0,
          bottleQty: qty,
          unitPrice: price,
          subtotalAmount: price * qty,
          unit: product.unit,
          specs: product.specs,
          traceCodes: [],
        })
      }
    }
  })
  const kinds = saleItems.length
  const pieces = totalQty.value
  Object.keys(pendingPicks).forEach(k => delete pendingPicks[Number(k)])
  showProductPicker.value = false
  uni.showToast({ title: `已添加 ${kinds} 种 / ${pieces} 件商品`, icon: 'none' })
}

// ---------- 快速新增商品（原稿 openQuickAdd：真实创建商品接口，保存后自动选中 1 件） ----------
const quickAddShow = ref(false)
const quickAddForm = reactive({ name: '', spec: '', unit: '件', wholesalePrice: '', retailPrice: '', stock: '' })
const quickAddSaving = ref(false)

function openQuickAdd() {
  quickAddForm.name = ''
  quickAddForm.spec = ''
  quickAddForm.unit = '件'
  quickAddForm.wholesalePrice = ''
  quickAddForm.retailPrice = ''
  quickAddForm.stock = ''
  quickAddShow.value = true
}

function closeQuickAdd() {
  quickAddShow.value = false
}

async function saveQuickAdd() {
  const name = quickAddForm.name.trim()
  if (!name) { uni.showToast({ title: '请填写商品名称', icon: 'none' }); return }
  if (quickAddSaving.value) return
  quickAddSaving.value = true
  try {
    // 真实创建商品（后端商品库），字段按常用契约提交
    const created: any = await productsApi.createProduct({
      name,
      specs: quickAddForm.spec.trim() || '—',
      unit: quickAddForm.unit.trim() || '件',
      wholesalePrice: Number(quickAddForm.wholesalePrice) || 0,
      retailPrice: Number(quickAddForm.retailPrice) || 0,
      price: Number(quickAddForm.wholesalePrice) || 0,
      stock: parseInt(quickAddForm.stock) || 0,
      status: 'ON',
    })
    const newId = Number(created?.id ?? created?.data?.id ?? 0)
    // 刷新列表并重置筛选，保证新商品一定可见
    selectedCategoryId.value = 0
    productSearchKeyword.value = ''
    productPage.value = 1
    productNoMore.value = false
    hideNoStock.value = false
    productList.value = []
    await loadProducts()
    // 自动选中 1 件：优先用返回 id，否则按名称匹配
    const targetId = newId || (productList.value.find(p => p.name === name)?.id ?? 0)
    if (targetId) pendingPicks[targetId] = 1
    quickAddShow.value = false
    uni.showToast({ title: '已新增并选中：' + name, icon: 'none' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '新增商品失败', icon: 'none' })
  } finally {
    quickAddSaving.value = false
  }
}

function addProduct(product: ProductInfo, qty = 1, traceCode = '') {
  const safeQty = Math.max(1, Number(qty) || 1)
  // 检查是否已添加
  const existingIndex = saleItems.findIndex(item => item.productId === product.id)
  if (existingIndex >= 0) {
    // 已存在，数量累加
    const item = saleItems[existingIndex]!
    item.quantity = (item.quantity ?? 0) + safeQty
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
    item.subtotalAmount = item.total
    item.bottleQty = item.quantity
    if (traceCode) {
      if (!Array.isArray(item.traceCodes)) item.traceCodes = []
      if (!item.traceCodes.includes(traceCode)) item.traceCodes.push(traceCode)
    }
    uni.showToast({ title: '已添加', icon: 'none' })
    return
  }
  // 新增
  const newItem: SaleItem = {
    productId: product.id,
    skuId: product.skuId ? Number(product.skuId) : undefined,
    productName: product.name,
    price: product.price,
    quantity: safeQty,
    total: product.price * safeQty,
    boxQty: 0,
    bottleQty: safeQty,
    unitPrice: product.price,
    subtotalAmount: product.price * safeQty,
    unit: product.unit,
    specs: product.specs,
    traceCodes: traceCode ? [traceCode] : [],
  }
  saleItems.push(newItem)
  uni.showToast({ title: '已添加', icon: 'none' })
}

/** 扫码添加商品（设计稿 UI v1.2：扫码添加/扫描商品条码） */
async function handleScanAdd() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    uni.showLoading({ title: '查询商品...' })
    const res = await productsApi.list({ keyword: code, page: 1, pageSize: 10 })
    uni.hideLoading()
    const rows = res?.list ?? []
    const matched = rows.find((p) => String(p.skuId) === code || (p.name || '').includes(code)) ?? rows[0]
    if (matched) {
      // 条码已关联：数量恒 1，扫码所得条码写入该商品追溯码（原稿 prod-trace 多码）
      addProduct(matched, 1, code)
      uni.showToast({ title: '条码已关联', icon: 'none' })
    } else {
      uni.showToast({ title: '未找到该条码商品', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

// ========== 商品明细操作 ==========
function decreaseQty(index: number) {
  const item = saleItems[index]!
  if ((item.quantity ?? 0) > 1) {
    item.quantity = (item.quantity ?? 0) - 1
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
    item.subtotalAmount = item.total
    item.bottleQty = item.quantity
  }
}

function increaseQty(index: number) {
  const item = saleItems[index]!
  item.quantity = (item.quantity ?? 0) + 1
  item.total = (item.price ?? 0) * (item.quantity ?? 0)
  item.subtotalAmount = item.total
  item.bottleQty = item.quantity
}

function onQtyChange(index: number, e: any) {
  const item = saleItems[index]!
  const qty = Math.max(1, Number(e.detail.value) || 1)
  item.quantity = qty
  item.total = (item.price ?? 0) * qty
  item.subtotalAmount = item.total
  item.bottleQty = qty
}

function removeItem(index: number) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该商品吗？',
    success: (res) => {
      if (res.confirm) {
        saleItems.splice(index, 1)
      }
    }
  })
}

// 追溯码录入草稿（输入框中间态，回车/失焦提交为胶囊）
function onTraceInput(index: number, e: any) {
  const item = saleItems[index]!
  item.draftTrace = e.detail.value || ''
}

// 提交追溯码（去重后入数组，原稿 traces.push）
function commitTrace(index: number) {
  const item = saleItems[index]!
  const code = (item.draftTrace || '').trim()
  if (!code) { item.draftTrace = ''; return }
  if (!Array.isArray(item.traceCodes)) item.traceCodes = []
  if (!item.traceCodes.includes(code)) item.traceCodes.push(code)
  item.draftTrace = ''
}

// 扫码关联追溯码（原稿：条码已关联，追加多码）
async function handleScanTrace(index: number) {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    const item = saleItems[index]!
    if (!Array.isArray(item.traceCodes)) item.traceCodes = []
    if (!item.traceCodes.includes(code)) item.traceCodes.push(code)
    item.draftTrace = ''
    uni.showToast({ title: '条码已关联', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
}

/** 分享（原稿 shareDoc：系统分享 / 复制链接） */
function handleShare() {
  // #ifdef H5
  const nav = navigator as any
  const text = `${docTitle.value} 合计 ${fmt(docTotal.value)}`
  if (nav.share) {
    nav.share({ title: '智享全链 · ' + docTitle.value, text }).catch(() => {})
  } else if (nav.clipboard) {
    nav.clipboard.writeText(location.href).then(
      () => uni.showToast({ title: '已复制分享链接', icon: 'none' }),
      () => uni.showToast({ title: '分享失败，请重试', icon: 'none' })
    )
  } else {
    uni.showToast({ title: '当前环境不支持系统分享', icon: 'none' })
  }
  // #endif
  // #ifndef H5
  uni.showToast({ title: '已生成开单分享卡片', icon: 'none' })
  // #endif
}

/** 保存（暂存草稿）：订单/进货走真实暂存接口，收款单仅前端标记 */
async function handleDraft() {
  if ((docKey.value === 'sale_order' || docKey.value === 'pur_inbound') && saleItems.length === 0) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  try {
    if (docKey.value === 'sale_order' || docKey.value === 'pur_inbound') {
      const result = await storeApi.createHoldOrder({
        customerName: selectedCustomer.value?.name || '散户',
        customerMobile: selectedCustomer.value?.phone || '',
        amount: totalAmount.value,
        remark: remark.value || '移动端开单暂存',
        items: saleItems.map((item) => ({
          skuId: item.skuId ?? Number(item.productId || 0),
          skuName: item.productName || '',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.price ?? item.unitPrice ?? 0),
          subtotalAmount: Number(item.total ?? item.subtotalAmount ?? 0),
        })),
      })
      uni.showToast({ title: `已暂存（${result.holdNo}）`, icon: 'success' })
    } else {
      uni.showToast({ title: '已暂存草稿', icon: 'success' })
    }
    isSaved.value = true
  } catch (err: any) {
    uni.showToast({ title: err?.message || '暂存失败，请重试', icon: 'none' })
  }
}

// ========== 提交载荷类型（严格对齐后端契约，杜绝 as any 掩盖字段错配） ==========
// 进货单：purchase-in-stock.service.ts#create 入参（snake_case）
interface CreatePurchaseInStockPayload {
  supplier_id: number
  supplier_name: string
  store_id: number
  remark?: string
  items: Array<{
    sku_id: number
    sku_name: string
    box_qty?: number
    bottle_qty?: number
    unit_price: number
    tax_rate?: number
  }>
}
// 收款单：receipt.controller.ts#createReceipt 入参
interface CreateReceiptPayload {
  customerId: number
  customerName?: string
  receiptType: string
  amount: number
  paymentMethod?: string
  receivedDate?: string
  remark?: string
}

// ========== 各单据提交 ==========
async function submitOrder() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  submitting.value = true
  try {
    const customer = selectedCustomer.value
    await salesApi.createSale({
      customerId: customer?.id,
      customerName: customer?.name || '散客',
      customerMobile: customer?.phone || '',
      items: saleItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        unitPrice: item.unitPrice,
        subtotalAmount: item.subtotalAmount,
        traceCodes: item.traceCodes?.length ? item.traceCodes : undefined,
      })),
      remark: remark.value || undefined,
    })
    uni.showToast({ title: '已转销售单', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

async function submitPurchaseIn(): Promise<void> {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); throw new Error('empty') }
  if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); throw new Error('empty') }
  // 后端入库场所为 store_id（门店），无 warehouse 维度 —— 见 purchase-in-stock.service.ts#create
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择入库门店', icon: 'none' }); throw new Error('empty') }
  const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
  const store = storeOptions.value.find(s => s.id === selectedStoreId.value)
  // 严格按后端契约（snake_case）：supplier_id / store_id / items[].sku_id / box_qty / bottle_qty / unit_price
  const payload: CreatePurchaseInStockPayload = {
    supplier_id: selectedSupplierId.value,
    supplier_name: supplier?.name || '',
    store_id: selectedStoreId.value,
    remark: remark.value || '',
    items: saleItems.map(item => ({
      sku_id: item.skuId ?? Number(item.productId),
      sku_name: item.productName || '',
      box_qty: item.boxQty ?? 0,
      bottle_qty: item.bottleQty ?? item.quantity ?? 0,
      unit_price: Number(item.unitPrice ?? item.price ?? 0),
    })),
  }
  await purchaseApi.createInStock(payload)
}

// ---------- 转单（原稿 convertDoc）：先真实创建当前单据，成功后切换到目标单据 ----------
function switchToDoc(main: 'sale' | 'purchase', sub: string) {
  docMain.value = main
  docSub.value = sub
  resetDoc()
}
async function convertDoc(target: 'sale_receipt' | 'pur_inbound' | 'pur_payment') {
  const from = docKey.value
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  submitting.value = true
  try {
    if (from === 'sale_ticket' && target === 'sale_receipt') {
      // 销售单 → 收款单：真实创建销售单，成功后切到收款单并预选关联原单
      const customer = selectedCustomer.value
      const bill: any = await salesApi.createSale({
        customerId: customer?.id,
        customerName: customer?.name || '散客',
        customerMobile: customer?.phone || '',
        items: saleItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          boxQty: item.boxQty,
          bottleQty: item.bottleQty,
          unitPrice: item.unitPrice,
          subtotalAmount: item.subtotalAmount,
        })),
        remark: remark.value || undefined,
      })
      switchToDoc('sale', '收款单')
      const billNo = bill?.billNo ?? bill?.result?.billNo ?? ''
      if (billNo) {
        await loadSourceBills()
        const hit = sourceBills.value.find(b => b.billNo === billNo)
        if (hit) {
          selectedSourceBill.value = hit.billNo
          receiptCustomerName.value = hit.customerName
          if (!receiptAmount.value) receiptAmount.value = hit.totalAmount
        }
      }
      uni.showToast({ title: '销售单已创建，已转收款单', icon: 'none' })
    } else if (from === 'pur_order' && target === 'pur_inbound') {
      // 采购订单 → 入库单：真实创建采购订单，成功后切到采购入库
      const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
      if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); return }
      await purchaseApi.createOrder({
        supplierId: selectedSupplierId.value,
        supplierName: supplier?.name || '',
        items: saleItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          skuId: item.skuId ?? Number(item.productId),
          skuName: item.productName || '',
          quantity: item.quantity ?? 0,
          unit: item.unit || '件',
          unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          subtotal: Number(item.subtotalAmount ?? item.total ?? 0),
        })),
        remark: remark.value || '',
      } as any)
      switchToDoc('purchase', '采购入库')
      uni.showToast({ title: '采购订单已创建，已转入库单', icon: 'none' })
    } else if (from === 'pur_inbound' && target === 'pur_payment') {
      // 入库单 → 付款单：真实提交入库，成功后切到付款单
      await submitPurchaseIn()
      switchToDoc('purchase', '付款单')
      uni.showToast({ title: '已确认入库，已转付款单', icon: 'none' })
    }
  } catch (err: any) {
    if (err?.message !== 'empty') uni.showToast({ title: err?.message || '转单失败', icon: 'none' })
  } finally { submitting.value = false }
}

async function submitReceipt() {
  if (receiptCustomerId.value == null) { uni.showToast({ title: '请选择收款客户', icon: 'none' }); return }
  if (receiptAmount.value <= 0) { uni.showToast({ title: '请输入收款金额', icon: 'none' }); return }
  submitting.value = true
  try {
    // 严格按后端契约（receipt.controller.ts#createReceipt）：customerId / customerName / receiptType / amount / paymentMethod / receivedDate / remark
    const payload: CreateReceiptPayload = {
      customerId: receiptCustomerId.value,
      customerName: receiptCustomerName.value || '散客',
      receiptType: 'SALE', // 移动端开单收款默认 SALE，后端默认亦为 SALE
      amount: receiptAmount.value,
      paymentMethod: paymentMethod.value,
      receivedDate: orderDate.value,
      remark: remark.value || '',
    }
    await receiptApi.create(payload)
    uni.showToast({ title: '已确认收款', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '收款失败', icon: 'none' })
  } finally { submitting.value = false }
}

// ---------- 付款单（POST /admin/payments-new，camelCase 契约） ----------
async function submitPayment() {
  if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); return }
  if (receiptAmount.value <= 0) { uni.showToast({ title: '请输入付款金额', icon: 'none' }); return }
  submitting.value = true
  try {
    // 严格按后端契约（payment-new.controller.ts#createPayment）：supplierId / supplierName / paymentType / amount / paymentMethod / paidDate / remark
    const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
    await paymentNewApi.create({
      supplierId: selectedSupplierId.value,
      supplierName: supplier?.name || '',
      paymentType: 'PURCHASE', // 移动端开单付款默认 PURCHASE，后端默认亦为 PURCHASE
      amount: receiptAmount.value,
      paymentMethod: paymentMethod.value,
      paidDate: orderDate.value,
      remark: remark.value || '',
    })
    uni.showToast({ title: '已确认付款', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '付款失败', icon: 'none' })
  } finally { submitting.value = false }
}

// ---------- 销售退货（POST /store/sale-returns，camelCase 契约） ----------
async function submitSaleReturn() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择门店', icon: 'none' }); return }
  submitting.value = true
  try {
    const store = storeOptions.value.find(s => s.id === selectedStoreId.value)
    await saleReturnApi.create({
      sourceBillNo: selectedSourceBill.value || undefined,
      storeId: selectedStoreId.value,
      customerId: receiptCustomerId.value ?? undefined,
      customerName: receiptCustomerName.value || '散客',
      remark: remark.value || '',
      items: saleItems.map(item => ({
        skuId: item.skuId ?? Number(item.productId),
        skuName: item.productName || '',
        boxQty: item.boxQty ?? 0,
        bottleQty: item.bottleQty ?? item.quantity ?? 0,
        unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      })),
    } as any)
    uni.showToast({ title: '已提交退货', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

// ---------- 采购退货（POST /admin/purchase-returns，snake_case 契约） ----------
async function submitPurchaseReturn() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); return }
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择门店', icon: 'none' }); return }
  submitting.value = true
  try {
    const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
    await purchaseReturnApi.create({
      supplier_id: selectedSupplierId.value,
      supplier_name: supplier?.name || '',
      store_id: selectedStoreId.value,
      remark: remark.value || '',
      items: saleItems.map(item => ({
        sku_id: item.skuId ?? Number(item.productId),
        sku_name: item.productName || '',
        box_qty: item.boxQty ?? 0,
        bottle_qty: item.bottleQty ?? item.quantity ?? 0,
        unit_price: Number(item.unitPrice ?? item.price ?? 0),
      })),
    } as any)
    uni.showToast({ title: '已提交退货', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

// 底部按钮双状态机（原稿 renderActionBar）：已保存→「修改」入口，草稿→「保存」；转单需先保存
function bottomLabel(act: { label: string; variant: string }): string {
  if (act.variant === 'ghost' && act.label === '保存') return isSaved.value ? '修改' : '保存'
  return act.label
}

function onActionTap(act: { label: string; variant: string; needsSaved?: boolean; handler: () => void }) {
  // 双状态机：已保存→「修改」入口 / 草稿→「保存」（原稿 editBtn：saved?startEdit():saveDoc）
  if (act.variant === 'ghost' && act.label === '保存') {
    if (isSaved.value) { startEdit(); return }
    act.handler()
    return
  }
  // 转单需先保存（原稿 convertDoc：if(!isSaved()) showToast('请先保存单据，再进行转单'))
  if (act.needsSaved && !isSaved.value) {
    uni.showToast({ title: '请先保存单据，再进行转单', icon: 'none' })
    return
  }
  act.handler()
}

// 修改（原稿 startEdit）：解除锁定，回到编辑态
function startEdit() {
  isSaved.value = false
  uni.showToast({ title: '已进入编辑', icon: 'none' })
}

// 编辑任何字段后回到草稿态（原稿 updateField → saved=false）
// 注意：必须放在所有被监听变量声明之后（否则 setup TDZ 报错导致整页渲染中断）
watch(
  [
    remark, selectedCustomer, deliveryMethod, orderDate, deliveryDate,
    discount, deposit, shipping, roundMode, taxRate, taxIncluded,
    batchNo, expiryDate, invoiceStatus, returnReason, originalDoc,
    logisticsNo, prepaymentDeduct, paymentMethod, receiptAmount,
    selectedSupplierId, selectedStoreId, selectedSourceBill,
    saleItems,
  ],
  () => { isSaved.value = false },
  { deep: true },
)

onMounted(() => {
  // URL 直达单据类型（?doc=pur_inbound 等）：采购入库等入口统一复用本页完整开单流程
  try {
    const pages = getCurrentPages()
    const cur: any = pages[pages.length - 1]
    const opts = cur?.options || cur?.$page?.options || {}
    const docMap: Record<string, ['sale' | 'purchase', string]> = {
      sale_order: ['sale', '订单'],
      sale_ticket: ['sale', '销售单'],
      sale_return: ['sale', '退货'],
      sale_receipt: ['sale', '收款单'],
      pur_order: ['purchase', '采购订单'],
      pur_inbound: ['purchase', '采购入库'],
      pur_return: ['purchase', '采购退货'],
      pur_payment: ['purchase', '付款单'],
    }
    const target = docMap[String(opts.doc || '')]
    if (target) {
      docMain.value = target[0]
      docSub.value = target[1]
    }
  } catch {}
  loadSourceBills()
  loadStores()
  ensurePurchaseData()
  // #ifdef H5
  // 键盘聚焦时隐藏底部操作栏，避免被输入法顶起遮挡（原稿 focusin/focusout）
  document.addEventListener('focusin', onDocFocus)
  document.addEventListener('focusout', onDocFocus)
  // #endif
})

// 输入框聚焦态（H5 键盘遮挡处理）
const keyboardHideBar = ref(false)
function onDocFocus(e: FocusEvent) {
  const t = e.target as HTMLElement | null
  keyboardHideBar.value = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))
}
</script>

<style lang="scss" scoped>
/* ===== 动效体系（原稿：统一曲线与时长；转场只动 transform/opacity，走 GPU 合成） ===== */
.create-sale-page {
  --ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-in: cubic-bezier(0.55, 0.06, 0.68, 0.19);
  --ease-io: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-page: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-1: 140ms;
  --dur-2: 220ms;
  --dur-3: 320ms;
  --dur-4: 380ms;

  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
}

/* 无障碍：系统开启「减少动态效果」时降级为瞬时切换（原稿 prefers-reduced-motion） */
@media (prefers-reduced-motion: reduce) {
  .create-sale-page *,
  .create-sale-page *::before,
  .create-sale-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 单据切换入场（原稿 switch-anim / fadeUp） */
.sale-form {
  animation: csFadeUp var(--dur-3) var(--ease-out) both;
}

@keyframes csFadeUp {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* 顶部栏（原稿 pg-hd：与全局 page-header 组件同高——bar 88rpx、左右 32rpx、白底带阴影）
   sticky：H5 页面为整文档滚动，sticky 保证标题栏不随表单内容滚出视口（与 page-header 组件一致） */
.page-hd {
  display: flex;
  align-items: center;
  gap: 24rpx;
  height: calc(88rpx + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 32rpx 0;
  background: $uni-bg-color;
  box-shadow: 0 2rpx 8rpx $zx-black-40;
  position: sticky;
  top: 0;
  z-index: 5;
  flex-shrink: 0;
}

.hd-back {
  width: 88rpx;
  height: 88rpx;
  margin-left: -28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hd-back:active {
  transform: scale(0.88);
}

.hd-back-img {
  width: 44rpx;
  height: 44rpx;
}

.hd-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
  flex: 1;
  letter-spacing: -0.6rpx;
}

/* 草稿/已保存徽标（原稿 hd-status：前置圆点胶囊，draft 橙 / saved 绿） */
.hd-status {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.hd-status::before {
  content: '';
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: currentColor;
}

.hd-status-text {
  font-size: 22rpx;
  font-weight: 600;
}

.hd-status--draft {
  background: $zx-badge-draft-bg;
  color: $zx-badge-draft-strong;
}

.hd-status--saved {
  background: $zx-badge-success-bg;
  color: $zx-badge-success-strong;
}

/* 原稿 hd-ico：右侧竖向三点 */
.qo-menu-trigger {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  flex-shrink: 0;
}

.qo-menu-trigger:active {
  background: $zx-black-50;
}

.qo-menu-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: $uni-gray-600;
}

/* 单据类型分段导航（原稿 qo-nav：无外层容器，白色段落直接描边） */
/* 单据类型双层 tab（原稿 top-tabs/sub-tabs：两条白底分隔条，紧贴顶栏） */
.doc-nav {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.doc-nav-main,
.doc-nav-sub {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  padding: 12rpx 24rpx;
  background: $uni-bg-color;
}

.doc-nav-main {
  border-bottom: 1rpx solid $zx-black-40;
}

.doc-nav-sub {
  border-bottom: 1rpx solid $zx-black-50;
}

/* 主段 tab（原稿 top-tab：12rpx 上下内距，矮款，居中限宽） */
.doc-seg {
  flex: 1;
  max-width: 360rpx;
  text-align: center;
  padding: 12rpx 0;
  font-size: 28rpx;
  font-weight: 500;
  color: $uni-gray-400;
  background: $uni-gray-50;
  border: 1rpx solid transparent;
  border-radius: 24rpx;
  transition: all 0.2s ease;
}

.doc-seg--active {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
  color: $uni-text-color-inverse;
  font-weight: 700;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

/* 子段（原稿 sub-tab：12rpx 上下内距，不限宽） */
.doc-nav-sub .doc-seg {
  max-width: none;
}

.doc-seg--sub {
  padding: 12rpx 8rpx;
  font-size: 24rpx;
  font-weight: 400;
  color: $uni-gray-500;
}

.doc-seg--sub-active {
  background: $uni-color-primary-soft;
  border-color: $zx-primary-150;
  color: $uni-color-primary;
  font-weight: 600;
}

.sale-form-scroll {
  flex: 1;
  min-height: 0;
}

.sale-form {
  flex: 1;
  padding-bottom: 160rpx;
}

/* 已保存只读锁定态（原稿 doc-panel.locked：内容不可改，opacity 降级） */
.sale-form--locked {
  pointer-events: none;
  opacity: 0.85;
}

/* 金额符号（收款金额行 ¥） */
.price-unit {
  font-size: 26rpx;
  color: $uni-color-primary;
  font-weight: 700;
}

/* 表单卡（原稿 card：白底 r3 32rpx margin 0 28 24 sh2） */
.form-section {
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 32rpx;
  margin: 0 28rpx 24rpx;
  box-shadow: 0 4rpx 16rpx $zx-black-70, 0 2rpx 8rpx $zx-black-50;
  border: 1rpx solid $zx-black-30;
}

/* 卡片标题（原稿 card-title：28rpx 600 + 右侧徽标） */
.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  letter-spacing: -0.4rpx;
}

.ct-badge {
  font-size: 22rpx;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ---------- 当前门店（原稿 store-card：蓝渐变卡） ---------- */
.store-card {
  background: $uni-gradient-blue;
  border-radius: 32rpx;
  padding: 32rpx;
  margin: 24rpx 28rpx 24rpx;
  display: block;
  position: relative;
  overflow: hidden;
  box-shadow: 0 12rpx 36rpx $zx-primary-220;
}

.store-card::before {
  content: '';
  position: absolute;
  right: -68rpx;
  top: -68rpx;
  width: 260rpx;
  height: 260rpx;
  background: radial-gradient(circle, $zx-white-200, transparent 70%);
  border-radius: 50%;
}

.sc-main {
  display: flex;
  align-items: center;
  gap: 24rpx;
  position: relative;
  z-index: 1;
}

.sc-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  background: $zx-white-200;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sc-ico-img {
  width: 40rpx;
  height: 40rpx;
}

.sc-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.sc-label {
  font-size: 22rpx;
  opacity: 0.8;
  color: $uni-gray-0;
}

.sc-name {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-gray-0;
}

.sc-arrow {
  font-size: 40rpx;
  color: $zx-white-700;
  line-height: 1;
}

/* ---------- 客户/配送/日期（原稿 form-row 图标行） ---------- */
.form-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  gap: 24rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

/* 透明 picker 覆盖层：触发系统选择器且不影响行内布局 */
.form-row-picker {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.form-row-cover {
  width: 100%;
  height: 100%;
}

.form-row:last-child {
  border-bottom: none;
}

.fr-ico {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: $uni-color-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.fr-ico-img {
  width: 32rpx;
  height: 32rpx;
}

.fr-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.fr-label {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.fr-value {
  font-size: 28rpx;
  font-weight: 500;
  color: $uni-text-color;
}

.fr-value--placeholder {
  color: $uni-gray-300;
  font-weight: 400;
}

.fr-value--date {
  font-weight: 500;
}

.fr-arrow {
  color: $uni-gray-300;
  font-size: 32rpx;
  line-height: 1;
  flex-shrink: 0;
}

/* 收款单等表单 picker 行（保留灰底格子样式） */
.qc-cell {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  background: $uni-bg-color-page;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
}

/* ---------- 商品明细（原稿 prod-item：彩色首字 + 单价行 + 胶囊数量） ---------- */
.prod-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
  position: relative;
  overflow: hidden;
}

.prod-item:last-of-type {
  border-bottom: none;
}

.swipe-hint {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 140rpx;
  background: $uni-color-error;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $uni-gray-0;
  font-size: 24rpx;
  font-weight: 600;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 0;
}

.prod-item--swiped .swipe-hint {
  transform: translateX(0);
}

.prod-item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  z-index: 1;
  background: $uni-bg-color;
  transition: transform 0.25s ease;
}

.prod-item--swiped .prod-item-content {
  transform: translateX(-140rpx);
}

.prod-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
}

.prod-thumb-col {
  width: 104rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prod-thumb {
  width: 88rpx;
  height: 88rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pt-letter {
  font-size: 30rpx;
  font-weight: 800;
}

.prod-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.prod-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  width: 100%;
}

.prod-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.prod-name {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prod-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
}

/* 行小计（原稿 prod-sum：16px 800 mono 蓝，采购红） */
.prod-sum {
  font-size: 32rpx;
  font-weight: 800;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-color-primary;
  letter-spacing: -0.6rpx;
  flex-shrink: 0;
  line-height: 1.1;
  white-space: nowrap;
}

.prod-sum--red {
  color: $uni-color-error;
}

.prod-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  width: 100%;
}

.prod-unit {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.pu-label {
  font-size: 22rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

/* 单价输入（原稿 price-input：70px 右对齐 mono） */
.price-input {
  width: 140rpx;
  height: 60rpx;
  border: 1rpx solid $uni-border-color;
  border-radius: 16rpx;
  text-align: right;
  padding: 0 16rpx;
  font-size: 26rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
  color: $uni-text-color;
  box-sizing: border-box;
}

/* 数量胶囊（原稿 qty-ctrl：一体边框圆角 −/数量/+） */
.qty-ctrl {
  display: flex;
  align-items: center;
  border: 1rpx solid $uni-border-color;
  border-radius: 999rpx;
  overflow: hidden;
  flex-shrink: 0;
}

.qty-btn {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: $uni-gray-600;
  line-height: 1;
}

.qty-btn:active {
  background: $zx-black-50;
}

.qty-btn--disabled {
  opacity: 0.35;
}

.qty-input {
  width: 64rpx;
  height: 52rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
  border-left: 1rpx solid $uni-border-color;
  border-right: 1rpx solid $uni-border-color;
  background: transparent;
  box-sizing: border-box;
}

/* ---------- 追溯码（原稿 prod-trace：灰底行 + 蓝色胶囊 chips + 扫码） ---------- */
.prod-trace {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 14rpx 20rpx;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  border-radius: 16rpx;
}

.pt-ico {
  width: 30rpx;
  height: 30rpx;
  flex-shrink: 0;
}

.pt-label {
  font-size: 22rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.trace-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
  flex-shrink: 0;
}

.trace-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  max-width: 300rpx;
  padding: 6rpx 16rpx;
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  border-radius: 999rpx;
}

.trace-chip-text {
  font-size: 22rpx;
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trace-x {
  font-size: 26rpx;
  line-height: 1;
  opacity: 0.65;
}

.trace-input {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: transparent;
  color: $uni-gray-700;
  font-weight: 600;
}

.trace-placeholder {
  color: $uni-gray-300;
  font-weight: 400;
}

.trace-scan {
  font-size: 22rpx;
  color: $uni-color-primary;
  font-weight: 600;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.trace-scan-img {
  width: 26rpx;
  height: 26rpx;
}

.trace-scan:active {
  opacity: 0.6;
}

/* ---------- 添加商品（原稿 add-prod-row：添加商品 primary + 扫码 secondary） ---------- */
.add-prod-row {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.add-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 22rpx 0;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 600;
}

.add-btn:active {
  transform: scale(0.97);
}

.add-btn--primary {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  border: 1rpx solid $zx-primary-150;
}

.add-btn--secondary {
  background: $uni-gray-50;
  color: $uni-gray-600;
  border: 1rpx solid $uni-border-color;
}

.add-btn-img {
  width: 36rpx;
  height: 36rpx;
}

/* ---------- 空态（原稿 empty-prod：盒子图标 + 引导文案） ---------- */
.empty-prod {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 68rpx 32rpx;
}

.empty-prod-img {
  width: 92rpx;
  height: 92rpx;
  margin-bottom: 24rpx;
}

.ep-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-500;
}

.ep-sub {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-top: 10rpx;
  text-align: center;
}
/* 金额汇总 */
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-sm 0;
}

.amount-row--total {
  padding-top: $uni-spacing-sm;
  border-top: 1rpx solid $uni-bg-color-grey;
  margin-top: 4rpx;
}

.amount-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.amount-value {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.amount-value--total {
  font-size: 48rpx;
  font-weight: 800;
  color: $uni-color-primary;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -1rpx;
}

/* 优惠（原稿：汇总含「优惠」行，可编辑） */
.discount-edit {
  display: flex;
  align-items: center;
}

.discount-prefix {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  margin-right: 4rpx;
}

.discount-input {
  width: 160rpx;
  text-align: right;
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

/* 备注 */
.remark-input {
  width: 100%;
  height: 160rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.remark-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

/* 底部提交栏（原稿 action-bar：悬浮透明圆角按钮组，距底 24rpx） */
.bottom-bar {
  position: fixed;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  right: 24rpx;
  display: flex;
  align-items: center;
  background: transparent;
  box-shadow: none;
  gap: 20rpx;
  z-index: 50;
}

.share-btn {
  flex: 1;
  height: 84rpx;
  background: $uni-color-primary-soft;
  border: 1rpx solid $uni-color-info-soft;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-color-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  line-height: 1;
}

.share-btn::after {
  border: none;
}

.share-btn:active {
  opacity: 0.85;
  transform: scale(0.96);
}

.draft-btn {
  flex: 1;
  height: 84rpx;
  background: $uni-bg-color;
  border: 1rpx solid $uni-border-color;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.draft-btn::after {
  border: none;
}

.draft-btn:active {
  opacity: 0.85;
  transform: scale(0.96);
}

/* 主按钮（原稿 ab-btn.primary：flex:2 蓝底白字阴影 + 箭头） */
.submit-btn {
  flex: 2;
  height: 84rpx;
  background: $uni-color-primary;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

.ab-arrow {
  width: 28rpx;
  height: 28rpx;
}

.submit-btn::after {
  border: none;
}

/* 次要按钮（ghost：保存/分享）：覆盖主按钮蓝底，与主操作分层 */
.submit-btn.draft-btn,
.submit-btn.share-btn {
  background: $uni-bg-color;
  border: 1rpx solid $uni-border-color;
  color: $uni-text-color;
  font-weight: 600;
  box-shadow: none;
}

.submit-btn.share-btn {
  background: $uni-color-primary-soft;
  border-color: $uni-color-info-soft;
  color: $uni-color-primary;
}

.submit-btn--disabled {
  opacity: 0.5;
}

.safe-bottom {
  height: 40rpx;
}

.field-error {
  margin-top: $uni-spacing-xs;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

/* 出货占位（后端接口待开放） */
.doc-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $uni-spacing-sm;
  padding: 80rpx $uni-spacing-lg;
}
.placeholder-icon {
  font-size: 80rpx;
  line-height: 1;
}
.placeholder-text {
  font-size: 28rpx;
  color: $uni-gray-500;
  text-align: center;
}

/* 收款金额输入行 */
.amount-input-row {
  display: flex;
  align-items: center;
  gap: $uni-spacing-xs;
}
.amount-input-row .discount-input {
  flex: 1;
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-text-color;
}

/* ========== 弹窗样式 ========== */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $zx-black-500;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}


.picker-popup {
  width: 100%;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm $uni-border-radius-sm 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.picker-popup--large {
  max-height: 85vh;
}

.picker-popup--product {
  max-height: 90vh;
  border-radius: $uni-border-radius-sm $uni-border-radius-sm 0 0;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.picker-close {
  font-size: 48rpx;
  color: $uni-gray-400;
  line-height: 1;
}

.picker-search {
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}


.picker-content {
  flex: 1;
  overflow-y: auto;
}

.picker-content--with-search {
  max-height: 60vh;
}


/* 客户列表项 */
.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-base $uni-spacing-lg;
  border-bottom: 1rpx solid $uni-gray-50;
}

.picker-item--customer {
  flex-wrap: wrap;
}

.customer-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.customer-item-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.customer-item-phone {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.customer-item-type {
  font-size: 22rpx;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  padding: 4rpx $uni-spacing-sm;
  border-radius: 8rpx;
  margin-right: $uni-spacing-sm;
}

.picker-item--active .customer-item-name {
  color: $uni-color-primary;
  font-weight: 600;
}

.picker-check {
  font-size: 32rpx;
  color: $uni-color-primary;
  font-weight: 600;
}


/* 加载更多 */
.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $uni-spacing-base 0;
  gap: $uni-spacing-sm;
}

.loading-more-spinner {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.load-more-text {
  font-size: 22rpx;
  color: $uni-gray-300;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 加载中 */
.customer-loading,
.product-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-top: $uni-spacing-md;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-300;
}

/* 出货：对接销售单只读摘要 */
.ship-summary {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-sm 0;
}
.ship-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ship-lab {
  color: $uni-gray-600;
  font-size: 26rpx;
}
.ship-val {
  color: $uni-text-color;
  font-size: 26rpx;
  font-weight: 500;
}
.ship-tip {
  margin-top: $uni-spacing-sm;
  font-size: 24rpx;
  color: $uni-gray-400;
}

/* ========== 对齐 HTML 打磨版新增的视觉元素 ========== */
/* 收款方式胶囊（HTML .chip / .chip-row：active 蓝字浅蓝底） */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.chip {
  padding: 14rpx 28rpx;
  background: $uni-gray-50;
  border: 1rpx solid $uni-border-color;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: $uni-gray-600;
  transition: all 0.15s ease;
}
.chip:active {
  transform: scale(0.95);
}
.chip--active {
  background: $uni-color-primary-soft;
  border-color: $zx-primary-200;
  color: $uni-color-primary;
  font-weight: 600;
}

/* 键盘聚焦隐藏底部操作栏（原稿 .action-bar.hidden） */
.bottom-bar--hidden {
  display: none;
}

/* ========== 商品选择子页面（原稿 subpage：全屏侧滑转场） ========== */
.subpage {
  position: fixed;
  inset: 0;
  background: $uni-bg-color-grey;
  z-index: 360;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  visibility: hidden;
  opacity: 0;
  box-shadow: -20rpx 0 60rpx $zx-black-160;
  will-change: transform, opacity;
  /* 退出：先滑出并淡出，结束后再置为 hidden */
  transition:
    transform var(--dur-3) var(--ease-page),
    opacity var(--dur-3) var(--ease-in),
    visibility 0s linear var(--dur-3);
}

.subpage--show {
  transform: translateX(0);
  visibility: visible;
  opacity: 1;
  /* 进入：立即可见，减速滑入 + 淡入 */
  transition:
    transform var(--dur-3) var(--ease-page),
    opacity var(--dur-2) var(--ease-out),
    visibility 0s;
}

/* 子页面内容轻微上浮入场（仅打开时播放一次） */
@keyframes ppListIn {
  from {
    opacity: 0;
    transform: translateY(24rpx);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.subpage--show .pp-list {
  animation: ppListIn var(--dur-4) var(--ease-out) both;
}

/* 顶栏右侧操作（无库存开关 + 新增商品） */
.pp-hd-acts {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-shrink: 0;
}

.pp-hd-btn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  transition: all 0.15s;
  white-space: nowrap;
}

.pp-hd-btn:active {
  transform: scale(0.94);
}

.pp-hd-btn--on {
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  border-color: $zx-primary-250;
}

.pp-hd-btn--plus {
  width: 60rpx;
  padding: 0;
  justify-content: center;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  border-color: $zx-primary-250;
}

.pp-hd-ico {
  width: 28rpx;
  height: 28rpx;
}

/* 搜索 */
.pp-search {
  padding: 20rpx 32rpx;
  background: $uni-bg-color;
  flex-shrink: 0;
  border-bottom: 1rpx solid $zx-black-40;
}

.pp-search-inner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 76rpx;
  background: $uni-gray-50;
  border-radius: 999rpx;
  padding: 0 28rpx;
}

.pp-search-ico {
  width: 34rpx;
  height: 34rpx;
  flex-shrink: 0;
  opacity: 0.5;
}

.pp-search-input {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
  background: transparent;
}

.pp-search-ph {
  color: $uni-gray-400;
}

.pp-search-clear {
  color: $uni-gray-400;
  font-size: 38rpx;
  line-height: 1;
  padding: 0 8rpx;
}

/* 分类胶囊 */
.pp-cats {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  background: $uni-bg-color;
  white-space: nowrap;
  flex-shrink: 0;
  border-bottom: 1rpx solid $zx-black-40;
}

.pp-cat {
  display: inline-block;
  padding: 14rpx 30rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: $uni-gray-500;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  flex-shrink: 0;
  transition: all 0.15s;
}

.pp-cat--active {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  font-weight: 700;
  border-color: $zx-primary-220;
}

/* 商品列表：overflow-y auto 保证商品多时列表内部滚动，头部/底部已选栏不随列表滚走 */
.pp-list {
  flex: 1;
  min-height: 0;
  padding: 20rpx 32rpx 32rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.pp-empty {
  text-align: center;
  padding: 140rpx 40rpx;
  color: $uni-gray-400;
  font-size: 26rpx;
}

.pp-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-60, 0 2rpx 6rpx $zx-black-40;
  border: 1rpx solid transparent;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.pp-item--sel {
  border-color: $zx-primary-280;
  box-shadow: 0 6rpx 20rpx $zx-primary-100;
}

.pp-item--nostock {
  opacity: 0.62;
}

.pp-thumb {
  width: 92rpx;
  height: 92rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pp-thumb-letter {
  font-size: 36rpx;
  font-weight: 800;
}

.pp-body {
  flex: 1;
  min-width: 0;
}

.pp-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.pp-name > text:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-nostock-tag {
  margin-left: 12rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: $uni-color-error;
  background: $zx-badge-danger-bg;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.pp-desc {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 10rpx;
}

.pp-price {
  font-size: 28rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-color-primary;
}

.pp-retail {
  font-size: 20rpx;
  color: $uni-gray-400;
  font-weight: 500;
}

/* 数量区：未选显示 +，已选显示步进器 */
.pp-act {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.pp-add {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 3rpx solid $uni-color-primary;
  color: $uni-color-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.pp-add:active {
  transform: scale(0.9);
  background: $uni-color-primary-soft;
}

.pp-add-ico {
  width: 30rpx;
  height: 30rpx;
}

.pp-qty {
  display: flex;
  align-items: center;
  border: 1rpx solid $uni-border-color;
  border-radius: 999rpx;
  overflow: hidden;
}

.pp-qty-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: $uni-text-color;
  line-height: 1;
}

.pp-qty-btn:active {
  background: $zx-black-50;
}

.pp-qty-num {
  font-size: 28rpx;
  font-weight: 700;
  min-width: 72rpx;
  text-align: center;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
  border-left: 1rpx solid $uni-border-color;
  border-right: 1rpx solid $uni-border-color;
  line-height: 60rpx;
}

/* 底部已选汇总栏（原稿 pp-bar：左数量金额 + 右「选好了」） */
.pp-bar {
  flex-shrink: 0;
  margin: 0 24rpx calc(24rpx + env(safe-area-inset-bottom));
  background: transparent;
  box-shadow: none;
}

.pp-bar-inner {
  display: flex;
  align-items: center;
  gap: 32rpx;
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 8rpx 32rpx $zx-black-90;
}

.pp-sum {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding-left: 4rpx;
}

.pp-sum-l {
  font-size: 24rpx;
  color: $uni-gray-500;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-sum-amt {
  font-size: 36rpx;
  font-weight: 800;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-color-primary;
  letter-spacing: -0.6rpx;
  line-height: 1.2;
}

.pp-sum-amt--zero {
  color: $uni-gray-300;
}

.pp-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 0.6rpx;
  background: $uni-color-primary;
  color: $uni-gray-0;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

.pp-btn:active {
  transform: scale(0.96);
  opacity: 0.85;
}

.pp-btn--dis {
  background: $uni-gray-300;
  box-shadow: none;
  pointer-events: none;
}

/* ========== 快速新增商品（原稿 qa-*） ========== */
.qa-scroll {
  max-height: 70vh;
}

.qa-tip {
  font-size: 22rpx;
  color: $uni-gray-400;
  padding: 20rpx 40rpx 0;
  line-height: 1.5;
}

.qa-body {
  padding: 4rpx 0 12rpx;
}

.qa-field {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 22rpx 40rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.qa-field:last-child {
  border-bottom: none;
}

.qa-label {
  width: 104rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}

.qa-input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $uni-text-color;
  background: transparent;
}

.qa-ph {
  color: $uni-gray-300;
}

.qa-actions {
  display: flex;
  gap: 20rpx;
  padding: 28rpx 40rpx calc(28rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid $uni-gray-100;
}

.qa-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  transition: all 0.15s;
}

.qa-btn:active {
  transform: scale(0.97);
  opacity: 0.85;
}

.qa-btn--ghost {
  background: $uni-gray-50;
  color: $uni-gray-500;
  border: 1rpx solid $uni-border-color;
  font-weight: 500;
}

.qa-btn--primary {
  flex: 1.4;
  background: $uni-color-primary;
  color: $uni-gray-0;
  box-shadow: 0 8rpx 24rpx $zx-primary-280;
}

/* 收款单等 picker 行的值文字（原稿 fr-value 同级样式） */
.qc-val {
  font-size: 28rpx;
  color: $uni-text-color;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qc-chev {
  font-size: 22rpx;
  color: $uni-gray-300;
  margin-left: 8rpx;
}

/* ---------- 退货关联原单（原稿 link-box） ---------- */
.link-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: $uni-color-primary-soft;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
  position: relative;
}
.lb-ico {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}
.lb-text {
  flex: 1;
  font-size: 24rpx;
  color: $uni-color-primary;
}
.lb-arrow {
  color: $uni-color-primary;
  opacity: 0.6;
  font-size: 28rpx;
  line-height: 1;
}

/* ---------- 状态卡（原稿 status-pill） ---------- */
.status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.status-label {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.status-pill::before {
  content: '';
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: currentColor;
}
.status-pill--pending {
  background: $zx-badge-warning-bg;
  color: $zx-badge-warning-strong;
}
.status-pill--confirmed {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}
.status-pill--paid {
  background: $zx-badge-success-bg;
  color: $zx-badge-success-strong;
}

/* ---------- 待核销单据（原稿 verify-item） ---------- */
.verify-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
}
.verify-item:last-of-type {
  border-bottom: none;
}
.verify-check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 4rpx solid $uni-gray-300;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.verify-check--checked {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}
.verify-check-mark {
  font-size: 22rpx;
  color: $uni-gray-0;
  font-weight: 700;
  line-height: 1;
}
.verify-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.verify-no {
  font-size: 24rpx;
  color: $uni-gray-400;
}
.verify-amount {
  font-size: 28rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
}
.verify-input {
  width: 160rpx;
  height: 64rpx;
  border: 1rpx solid $uni-border-color;
  border-radius: 16rpx;
  text-align: right;
  padding: 0 16rpx;
  font-size: 26rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  box-sizing: border-box;
}

/* ---------- 特殊字段行（原稿 special-field） ---------- */
.special-field {
  position: relative; /* 容纳行内 absolute 铺满的 form-row-picker（有效期至日期），防止响应层越界盖住其他按钮 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
  gap: 20rpx;
}
.special-field:last-child {
  border-bottom: none;
}
.sf-label {
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}
.sf-value {
  font-size: 26rpx;
  font-weight: 500;
  color: $uni-text-color;
}
.sf-value--blue {
  color: $uni-color-primary;
  font-weight: 600;
}
.sf-value--placeholder {
  color: $uni-gray-300;
  font-weight: 400;
}
.sf-input {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 26rpx;
  color: $uni-text-color;
}
.sf-input--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-color-primary;
  font-weight: 600;
}
.sf-input--money {
  width: 200rpx;
  flex: none;
  height: 64rpx;
  border: 1rpx solid $uni-border-color;
  border-radius: 16rpx;
  padding: 0 16rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
  box-sizing: border-box;
}
.sf-input--inline {
  width: 140rpx;
  height: 56rpx;
}
.sf-placeholder {
  color: $uni-gray-300;
}
.sf-badge {
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
.sf-badge--green {
  background: $zx-badge-success-bg;
  color: $zx-badge-success-strong;
}
.sf-badge--orange {
  background: $zx-badge-warning-bg;
  color: $zx-badge-warning-strong;
}

/* ---------- 含税 toggle（原稿 tax-toggle / toggle-switch） ---------- */
.tax-toggle {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.tax-toggle-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}
.tax-toggle-text--on {
  color: $uni-color-primary;
}
.toggle-switch {
  width: 80rpx;
  height: 44rpx;
  background: $uni-gray-300;
  border-radius: 999rpx;
  position: relative;
  transition: background 0.2s;
}
.toggle-switch--on {
  background: $uni-color-primary;
}
.toggle-knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 36rpx;
  height: 36rpx;
  background: $uni-gray-0;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 2rpx 6rpx $zx-black-150;
}
.toggle-switch--on .toggle-knob {
  transform: translateX(36rpx);
}
.tax-rate-wrap {
  position: relative;
}

/* ---------- 金额汇总补充（原稿 summary-card） ---------- */
.sum-divider {
  height: 1rpx;
  background: $uni-gray-100;
  margin: 16rpx 0;
}
.amount-value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 500;
}
.amount-value--red {
  color: $uni-color-error;
}
.amount-value--green {
  color: $uni-color-success;
}
.amount-label--red {
  color: $uni-color-error;
}
.amount-label--green {
  color: $uni-color-success;
}
.amount-label--orange {
  color: $uni-color-error;
}
.amount-label--strong {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}
.deposit-input-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $uni-gray-100;
}

/* 抹零 chips / 配送费行 */
.round-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.round-chips {
  display: flex;
  gap: 8rpx;
}
.chip--sm {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
}

/* 物流单号行 */
.logi-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  justify-content: flex-end;
  min-width: 0;
}
.logi-input {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: $uni-text-color;
  text-align: right;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.logi-scan {
  font-size: 22rpx;
  color: $uni-color-primary;
  font-weight: 600;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.logi-scan-img {
  width: 26rpx;
  height: 26rpx;
}
.logi-scan:active {
  opacity: 0.6;
}

/* 出货占位图标 */
.placeholder-img {
  width: 92rpx;
  height: 92rpx;
}
</style>
