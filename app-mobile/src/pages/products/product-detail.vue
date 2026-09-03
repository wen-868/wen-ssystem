<template>
  <view class="pd-page">
    <!-- 页头（原稿 pg-hd：返回 + 商品信息 + 三态徽标） -->
    <view class="pg-hd">
      <view class="hd-back" @tap="goBack">
        <image class="hd-back-img" src="/static/icons/ic/back.svg" mode="aspectFit" />
      </view>
      <text class="hd-title">商品信息</text>
      <view class="hd-status" :class="dirty ? 'hd-status--draft' : editable ? 'hd-status--editing' : 'hd-status--saved'">
        <text class="hd-status-text">{{ editable ? (dirty ? '未保存' : '编辑中') : '已保存' }}</text>
      </view>
    </view>

    <!-- 加载骨架（原稿 skl） -->
    <view v-if="loading" class="pd-skeleton">
      <view class="skl skl-thumb"></view>
      <view class="skl skl-line" style="width: 56%;"></view>
      <view class="skl skl-line" style="width: 86%;"></view>
      <view class="skl skl-line" style="width: 72%;"></view>
      <view class="skl skl-block"></view>
      <view class="skl skl-block"></view>
    </view>

    <scroll-view v-else class="content-area" scroll-y>
      <view class="content-inner" :class="{ locked: !editable }">
        <!-- 基本信息 -->
        <view class="pd-group">
          <view class="pd-gtitle"><text class="gt-bar"></text><text>基本信息</text></view>
          <view class="pd-basic">
            <view class="pd-thumb" :style="form.mainImage ? '' : { background: thumbTint, color: thumbColor }" @tap="onThumbTap">
              <image v-if="form.mainImage" class="pd-thumb-img" :src="form.mainImage" mode="aspectFill" />
              <text v-else class="ph">{{ (form.name || '商').charAt(0) }}</text>
              <view class="pd-add">+</view>
            </view>
            <view class="pd-basic-fields">
              <view class="f-row static">
                <text class="f-label">商品名称</text>
                <input class="f-input" v-model="form.name" placeholder="请输入商品名称" placeholder-class="f-ph" @input="markField('name')" />
              </view>
              <view class="f-row static" :class="{ 'f-row--active': dropOpen === 'brand' }" @tap="toggleDrop('brand')">
                <text class="f-label">商品品牌</text>
                <text class="f-value" :class="{ 'f-value--ph': !form.brandName }">{{ form.brandName || '请选择' }}</text>
                <view class="f-arrow" :class="{ 'f-arrow--up': dropOpen === 'brand' }"></view>
              </view>
              <view v-if="editable && dropOpen === 'brand'" class="f-drop">
                <view class="f-drop-list">
                  <view class="f-drop-item" :class="{ 'f-drop-item--sel': form.brandName === b.name }" v-for="b in brandOptions" :key="b.id" @tap="pickBrand(b.name)">
                    <text>{{ b.name }}</text>
                    <text v-if="form.brandName === b.name" class="f-drop-ck">✓</text>
                  </view>
                  <view v-if="!brandOptions.length" class="f-drop-empty">暂无品牌库数据，可直接输入自定义品牌</view>
                </view>
                <view class="f-drop-custom">
                  <input class="f-input" v-model="brandCustom" placeholder="自定义品牌" placeholder-class="f-ph" confirm-type="done" @confirm="pickBrand(brandCustom)" />
                  <view class="f-drop-custom-btn" @tap="pickBrand(brandCustom)">确定</view>
                </view>
              </view>
              <view class="f-row static" @tap="openCatPicker">
                <text class="f-label">商品分类</text>
                <text class="f-value" :class="{ 'f-value--ph': !form.categoryName }">{{ form.categoryName || '请选择' }}</text>
                <view class="f-arrow"></view>
              </view>
            </view>
          </view>
          <view class="f-row static" :class="{ 'f-row--active': dropOpen === 'spec' }" @tap="toggleDrop('spec')">
            <text class="f-label">规格/净含量</text>
            <text class="f-value" :class="{ 'f-value--ph': !form.specs }">{{ form.specs || '请选择' }}</text>
            <view class="f-arrow" :class="{ 'f-arrow--up': dropOpen === 'spec' }"></view>
          </view>
          <view v-if="editable && dropOpen === 'spec'" class="f-drop">
            <view class="f-drop-list">
              <view class="f-drop-item" :class="{ 'f-drop-item--sel': form.specs === s }" v-for="s in specOptions" :key="s" @tap="pickSpec(s)">
                <text>{{ s }}</text>
                <text v-if="form.specs === s" class="f-drop-ck">✓</text>
              </view>
              <view v-if="!specOptions.length" class="f-drop-empty">暂无规格库数据，可直接输入自定义规格</view>
            </view>
            <view class="f-drop-custom">
              <input class="f-input" v-model="specCustom" placeholder="自定义规格" placeholder-class="f-ph" confirm-type="done" @confirm="pickSpec(specCustom)" />
              <view class="f-drop-custom-btn" @tap="pickSpec(specCustom)">确定</view>
            </view>
          </view>
          <view class="f-row static" :class="{ 'f-row--active': dropOpen === 'unit' }" @tap="toggleDrop('unit')">
            <text class="f-label">基础单位</text>
            <text class="f-value" :class="{ 'f-value--ph': !form.unit }">{{ form.unit || '请选择' }}</text>
            <view class="f-arrow" :class="{ 'f-arrow--up': dropOpen === 'unit' }"></view>
          </view>
          <view v-if="editable && dropOpen === 'unit'" class="f-drop">
            <view class="f-drop-list">
              <view
                class="f-drop-item"
                :class="{ 'f-drop-item--sel': form.unit === u.name, 'f-drop-item--used': usedUnitNames.includes(u.name) }"
                v-for="u in unitOptions"
                :key="u.id"
                @tap="!usedUnitNames.includes(u.name) && pickUnit(u.name)"
              >
                <text>{{ u.name }}</text>
                <text v-if="form.unit === u.name" class="f-drop-ck">✓</text>
                <text v-else-if="usedUnitNames.includes(u.name)" class="f-drop-used-tag">已用作辅单位</text>
              </view>
              <view v-if="!unitOptions.length" class="f-drop-empty">暂无单位库数据，可直接输入自定义单位</view>
            </view>
            <view class="f-drop-custom">
              <input class="f-input" v-model="unitCustom" placeholder="自定义单位，如「听」「提」" placeholder-class="f-ph" confirm-type="done" @confirm="pickUnit(unitCustom)" />
              <view class="f-drop-custom-btn" @tap="pickUnit(unitCustom)">确定</view>
            </view>
          </view>
          <view class="f-row static">
            <text class="f-label">商品条码</text>
            <input class="f-input f-input--mono" v-model="form.barcode" placeholder="录入或扫描条码" placeholder-class="f-ph" @input="markField('barcode')" />
            <view class="f-scan" @tap="openScanner('base')">
              <view class="scan-ic">
                <view class="scan-ic-c scan-ic-c--tl"></view>
                <view class="scan-ic-c scan-ic-c--tr"></view>
                <view class="scan-ic-c scan-ic-c--bl"></view>
                <view class="scan-ic-c scan-ic-c--br"></view>
                <view class="scan-ic-line"></view>
              </view>
            </view>
          </view>
          <view class="f-row static" :class="{ 'f-row--active': dropOpen === 'origin' }" @tap="toggleDrop('origin')">
            <text class="f-label">产地</text>
            <text class="f-value" :class="{ 'f-value--ph': !form.origin }">{{ form.origin || '请选择' }}</text>
            <view class="f-arrow" :class="{ 'f-arrow--up': dropOpen === 'origin' }"></view>
          </view>
          <view v-if="editable && dropOpen === 'origin'" class="f-drop">
            <view class="f-drop-list">
              <view class="f-drop-item" :class="{ 'f-drop-item--sel': form.origin === s }" v-for="s in originOptions" :key="s" @tap="pickOrigin(s)">
                <text>{{ s }}</text>
                <text v-if="form.origin === s" class="f-drop-ck">✓</text>
              </view>
              <view v-if="!originOptions.length" class="f-drop-empty">暂无产地库数据，可直接输入自定义产地</view>
            </view>
            <view class="f-drop-custom">
              <input class="f-input" v-model="originCustom" placeholder="自定义产地" placeholder-class="f-ph" confirm-type="done" @confirm="pickOrigin(originCustom)" />
              <view class="f-drop-custom-btn" @tap="pickOrigin(originCustom)">确定</view>
            </view>
          </view>
          <view class="f-row static">
            <text class="f-label">酒精度</text>
            <input class="f-input f-input--mono" v-model="form.alcoholContent" placeholder="%vol，非酒类可不填" placeholder-class="f-ph" @input="markField('alcohol')" />
            <text class="f-unit">%vol</text>
          </view>
          <view class="chips-row">
            <text class="chips-label">销售渠道</text>
            <view
              class="chip"
              v-for="c in channelOptions"
              :key="c.value"
              :class="{ 'chip--on': form.saleChannels.includes(c.value) }"
              @tap="toggleChannel(c.value)"
            >{{ c.label }}</view>
          </view>
          <view class="chips-row chips-row--last">
            <text class="chips-label">状态</text>
            <view class="chip" :class="{ 'chip--on': form.status === 'ON_SALE' }" @tap="setStatus('ON_SALE')">上架</view>
            <view class="chip" :class="{ 'chip--on': form.status === 'OFF_SALE' }" @tap="setStatus('OFF_SALE')">下架</view>
          </view>
        </view>

        <!-- 单位信息（原稿：辅单位行内编辑——比例输入 + 条码框内嵌扫码 + 直接删除） -->
        <view class="pd-group">
          <view class="pd-gtitle"><text class="gt-bar"></text><text>单位信息</text></view>
          <view class="rt-sub" v-if="units.length > 1">辅单位换算（逐级折算，主单位在前）</view>
          <view class="rt-empty" v-if="units.length < 2">当前只有基础单位，无需换算。添加辅单位后可逐级设置换算。</view>
          <view class="rt-row" v-for="(u, i) in units" :key="i" v-show="i > 0">
            <text class="rt-name">{{ u.unitName }}</text>
            <view class="rt-eq">
              <input class="rt-in" type="digit" :disabled="!editable" :value="abValue(i, 'a')" placeholder="1" @input="onSubRatio(i, 'a', $event)" @blur="onSubRatioBlur(i, 'a', $event)" />
              <text class="rt-bu">{{ units[i - 1].unitName }}</text>
              <text class="rt-eqsign">=</text>
              <input class="rt-in" type="digit" :disabled="!editable" :value="abValue(i, 'b')" placeholder="1" @input="onSubRatio(i, 'b', $event)" @blur="onSubRatioBlur(i, 'b', $event)" />
              <text class="rt-bu">{{ u.unitName }}</text>
            </view>
            <view class="rt-bcw">
              <view class="rt-scan" v-if="editable" @tap="openScanner('unit', i)">
                <view class="scan-ic scan-ic--sm">
                  <view class="scan-ic-c scan-ic-c--tl"></view>
                  <view class="scan-ic-c scan-ic-c--tr"></view>
                  <view class="scan-ic-c scan-ic-c--bl"></view>
                  <view class="scan-ic-c scan-ic-c--br"></view>
                  <view class="scan-ic-line"></view>
                </view>
              </view>
              <input class="rt-bc" :disabled="!editable" :value="u.barcode || ''" placeholder="条码" @input="onUnitBarcode(i, $event)" />
            </view>
            <view class="rt-del" v-if="editable" @tap.stop="removeUnit(i)">×</view>
          </view>
          <view class="rt-chain" v-if="units.length > 1">{{ chainText }}</view>
          <view class="add-unit" v-if="editable" @tap="openUnitAddPicker">
            <text class="add-unit-icon">＋</text>
            <text>添加辅单位</text>
          </view>
        </view>

        <!-- 价格信息（价格属 SKU 域：后端商品更新接口不含价格字段，展示为只读） -->
        <view class="pd-group">
          <view class="pd-gtitle"><text class="gt-bar"></text><text>价格信息</text></view>
          <view class="pt-wrap">
            <view class="ptable">
              <view class="pt-tr pt-head">
                <view class="pt-th pt-rh"></view>
                <view class="pt-th" v-for="(u, i) in units" :key="i">
                  <text class="pt-utag" :class="{ 'pt-utag--base': u.isBase }">{{ u.isBase ? '基础单位' : '辅单位' }}</text>
                  <text class="pt-ubadge">{{ u.unitName }}</text>
                </view>
              </view>
              <view class="pt-tr" v-for="row in priceRows" :key="row.key">
                <view class="pt-th">{{ row.label }}</view>
                <view class="pt-td">
                  <input
                    v-if="editable"
                    class="pt-input"
                    :value="priceForm[row.key]"
                    type="digit"
                    @input="onPriceInput(row.key, $event)"
                  />
                  <text v-else>{{ priceForm[row.key] }}</text>
                </view>
                <!-- 辅单位列：只遍历辅单位。四档价存 unitPriceForm（保存走 updateSkuUnit）；
                     进货价后端无单位级字段，显示为「基础进货价 ÷ 换算率」派生值，改它即反推基础进货价（保存走 updateSkuPrice） -->
                <view class="pt-td" v-for="(u, si) in subUnits" :key="'u' + si">
                  <input
                    v-if="editable"
                    class="pt-input"
                    :value="unitCellDisplay(si, row.key)"
                    type="digit"
                    @input="onUnitCellInput(si, row.key, $event)"
                  />
                  <text v-else>{{ unitCellDisplay(si, row.key) || '—' }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="pt-note">主辅单位价格双向自动换算填充：修改任一单位价格，其余单位价格按换算率联动重算</view>
          <view class="f-derived">
            <text class="fd-label">零售毛利 / 毛利率</text>
            <text class="fd-value fd-value--blue">{{ marginText }}</text>
          </view>
        </view>

        <!-- 库存信息 -->
        <view class="pd-group">
          <view class="pd-gtitle">
            <text class="gt-bar"></text><text>库存信息</text>
            <text class="pd-badge" :class="stockBadgeCls">{{ stockBadgeTxt }}</text>
          </view>
          <view class="f-row static">
            <text class="f-label">当前库存</text>
            <text class="f-value f-value--mono">{{ stock }}</text>
            <text class="f-unit">{{ form.unit }}</text>
          </view>
          <view class="f-row static">
            <text class="f-label">预警阈值</text>
            <input
              v-if="editable"
              class="f-input f-input--mono"
              type="digit"
              :value="String(warningThreshold)"
              placeholder="0"
              placeholder-class="f-ph"
              @input="onWarningThreshold"
            />
            <text v-else class="f-value f-value--mono">{{ warningThreshold }}</text>
            <text class="f-unit">{{ form.unit }}</text>
          </view>
          <view class="f-derived">
            <text class="fd-label">按成本价计算的库存金额</text>
            <text class="fd-value" :class="{ 'fd-value--muted': stockAmount === '¥—' }">{{ stockAmount }}</text>
          </view>
        </view>

        <!-- 扩展信息（原稿：原扩展信息/商品标签/其它设置三组合并；标签与标记移至最末尾组） -->
        <view class="pd-group">
          <view class="pd-gtitle"><text class="gt-bar"></text><text>扩展信息</text></view>
          <view class="f-row static">
            <text class="f-label">商品启用</text>
            <text class="f-hint">停用后开单/采购选不到该商品，历史单据不受影响</text>
            <view class="sw" :class="{ on: form.enabled }" @tap="toggleEnabled"><view class="sw-knob"></view></view>
          </view>
          <view class="f-row static">
            <text class="f-label">启用追溯码</text>
            <text class="f-hint">开单时需扫码录入追溯信息</text>
            <view class="sw" :class="{ on: traceEnabled }" @tap="toggleTrace"><view class="sw-knob"></view></view>
          </view>
          <view class="f-row static">
            <text class="f-label">保质期</text>
            <text class="f-hint">开单时需录入生产日期与保质期</text>
            <view class="sw" :class="{ on: form.shelfLifeOn }" @tap="toggleShelfLife"><view class="sw-knob"></view></view>
          </view>
          <view class="f-row static">
            <text class="f-label">批次</text>
            <text class="f-hint">开单时需选择商品批次</text>
            <view class="sw" :class="{ on: form.batchOn }" @tap="toggleBatch"><view class="sw-knob"></view></view>
          </view>
          <view class="f-row static">
            <text class="f-label">上架销售</text>
            <text class="f-hint">关闭后开单时不再显示</text>
            <view class="sw" :class="{ on: form.status === 'ON_SALE' }" @tap="toggleOnSale"><view class="sw-knob"></view></view>
          </view>
          <view class="f-derived"><text class="fd-label">创建时间</text><text class="fd-value">{{ createdAt }}</text></view>
          <view class="f-derived"><text class="fd-label">更新时间</text><text class="fd-value">{{ updatedAt }}</text></view>
        </view>

        <!-- 标签与标记（原稿：商品标签 + 商品标记合并，置于页面最末尾） -->
        <view class="pd-group">
          <view class="pd-gtitle"><text class="gt-bar"></text><text>标签与标记</text></view>
          <view class="tag-box">
            <view class="tag-list" v-if="tags.length">
              <view class="tag-item" v-for="(t, i) in tags" :key="i" @tap="removeTag(i)">{{ t }}<text class="rm">×</text></view>
            </view>
            <input class="tag-input" v-model="tagInput" placeholder="输入标签，回车添加" placeholder-class="f-ph" confirm-type="done" @confirm="addTag" />
          </view>
          <view class="chips-row chips-row--last">
            <text class="chips-label">商品标记</text>
            <view class="chip" :class="{ 'chip--on': form.isNew }" @tap="toggleNew">新品</view>
            <view class="chip" :class="{ 'chip--on': form.isRecommend }" @tap="toggleRecommend">推荐</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底栏（原稿 pp-bar：N 项改动未保存 + 取消/修改或保存） -->
    <view class="pp-bar">
      <view class="pp-bar-inner">
        <view class="pp-sum">
          <view class="pp-sum-l"><template v-if="dirty">有 <text class="pp-sum-n">{{ dirtyCount }}</text> 项改动未保存</template><template v-else>内容未变更</template></view>
          <view class="pp-sum-amt" :class="{ 'pp-sum-amt--zero': stock <= 0 }">{{ stockAmount }}</view>
        </view>
        <view class="pp-acts">
          <view class="pp-btn pp-btn--ghost" v-if="editable" @tap="cancelEdit">取消</view>
          <view class="pp-btn" :class="{ 'pp-btn--dis': editable && !dirty }" @tap="onMainAction">{{ editable ? '保存' : '修改' }}</view>
        </view>
      </view>
    </view>

    <!-- 添加辅单位弹层（原稿 openUnitPicker：单位库搜索 + chips（已用置灰）+ 自定义兜底） -->
    <view class="qa-mask" v-if="unitPicker" @tap="unitPicker = false">
      <view class="qa-popup" @tap.stop>
        <view class="qa-header">
          <text class="qa-title">添加辅单位</text>
          <text class="qa-close" @tap="unitPicker = false">×</text>
        </view>
        <view class="qa-body">
          <view class="qa-tip">从单位库中选择，或直接输入自定义单位。新辅单位接在当前最后一个单位之后，价格按换算率自动填充。</view>
          <view class="ul-search">
            <input class="ul-input" v-model="unitKw" placeholder="搜索单位库" confirm-type="search" />
          </view>
          <view class="md-chips">
            <view
              class="ul-chip"
              v-for="u in unitLibFiltered"
              :key="u"
              :class="{ 'ul-chip--used': usedUnitNames.includes(u) }"
              @tap="!usedUnitNames.includes(u) && addUnitByName(u)"
            >{{ u }}</view>
            <view v-if="!unitLibFiltered.length" class="ul-empty">单位库中没有「{{ unitKw }}」<br>可在下方自定义输入后添加</view>
          </view>
          <view class="md-sep"></view>
          <view class="md-subt">自定义单位</view>
          <view class="md-row">
            <input class="ul-input ul-input--row" v-model="unitCustomName" placeholder="如「听」「提」「扎」" confirm-type="done" @confirm="addUnitCustom" />
            <view class="md-add-btn" @tap="addUnitCustom">添加</view>
          </view>
        </view>
        <view class="qa-actions">
          <view class="qa-btn qa-btn--ghost" @tap="unitPicker = false">取消</view>
        </view>
      </view>
    </view>

    <!-- 扫码面板（原稿 openScanner：摄像头 + BarcodeDetector，不支持时提示手动输入） -->
    <view class="qa-mask" v-if="scanner.open" @tap="closeScanner">
      <view class="qa-popup" @tap.stop>
        <view class="qa-header">
          <text class="qa-title">扫描条码</text>
          <text class="qa-close" @tap="closeScanner">×</text>
        </view>
        <view class="sc-cam">
          <video id="scVideo" class="sc-video" autoplay playsinline muted :controls="false"></video>
          <view class="sc-frame">
            <view class="sc-c sc-c--tl"></view>
            <view class="sc-c sc-c--tr"></view>
            <view class="sc-c sc-c--bl"></view>
            <view class="sc-c sc-c--br"></view>
            <view class="sc-line"></view>
          </view>
        </view>
        <view class="sc-tip">将条码对准取景框，识别成功后自动填入<br>正在录入：<text class="sc-tip-b">{{ scannerLabel }}</text></view>
        <view class="qa-actions">
          <view class="qa-btn qa-btn--ghost" @tap="closeScanner">取消</view>
        </view>
      </view>
    </view>

    <!-- 分类选择弹窗（原稿 openPicker('cat')） -->
    <view class="qa-mask" v-if="catModal" @tap="catModal = false">
      <view class="qa-popup" @tap.stop>
        <view class="qa-header">
          <text class="qa-title">选择分类</text>
          <text class="qa-close" @tap="catModal = false">×</text>
        </view>
        <view class="qa-list">
          <view class="qa-opt" :class="{ 'qa-opt--sel': form.categoryId === c.id }" v-for="c in categoryOptions" :key="c.id" @tap="pickCategory(c)">
            <text>{{ c.name }}</text>
            <text v-if="form.categoryId === c.id" class="qa-opt-ck">✓</text>
          </view>
          <view v-if="!categoryOptions.length" class="qa-empty">暂无分类数据，请先在分类管理中创建</view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload, onHide } from '@dcloudio/uni-app'
import {
  getProductDetail,
  updateProduct,
  updateSkuPrice,
  updateSku,
  addSkuUnit,
  updateSkuUnit,
  deleteSkuUnit,
  setMarketingTags,
  uploadImage,
  listBrands,
  listUnits,
  productsApi,
  type ProductDetail,
  type BrandItem,
  type UnitItem,
} from '@/api/modules/products'
import { categoriesApi, type CategoryInfo } from '@/api/modules/categories'
import { PRODUCT_DETAIL_THUMB_COLORS } from '@/constants/colors'

const spuId = ref(0)
const editable = ref(false)
const loading = ref(false)
const stock = ref(0)
const warningThreshold = ref(0)
const traceEnabled = ref(false)
const units = ref<ProductDetail['skus'][0]['units']>([])
const sku = ref<ProductDetail['skus'][0] | null>(null)
const createdAt = ref('')
const updatedAt = ref('')
const original = ref<ProductDetail | null>(null)

// 改动项统计（原稿 changedCount）：每个被编辑的字段记一笔，dirty = 存在改动
const dirtyKeys = reactive<Record<string, boolean>>({})
const dirtyCount = computed(() => Object.keys(dirtyKeys).filter(k => dirtyKeys[k]).length)
const dirty = computed(() => dirtyCount.value > 0)
function markField(key: string) {
  dirtyKeys[key] = true
  if (!editable.value) editable.value = true
}

// 销售渠道（真实渠道体系：门店零售/门店批发/小程序零售/小程序批发 + 即时零售三平台）
// 即时零售平台代码 jd/mt/ele 与单据管理即时零售平台一致（orders.vue PLATFORM_NAME）
const channelOptions = [
  { label: '门店零售', value: 'STORE_RETAIL' },
  { label: '门店批发', value: 'STORE_WHOLESALE' },
  { label: '小程序零售', value: 'MINIAPP_RETAIL' },
  { label: '小程序批发', value: 'MINIAPP_WHOLESALE' },
  { label: '京东秒送', value: 'jd' },
  { label: '美团', value: 'mt' },
  { label: '饿了么', value: 'ele' },
]
// 旧渠道值映射（历史数据 MINIAPP/STORE/WHOLESALE → 新枚举；ECOMMERCE 新体系无对应不映射）
const LEGACY_CHANNEL_MAP: Record<string, string> = {
  MINIAPP: 'MINIAPP_RETAIL',
  STORE: 'STORE_RETAIL',
  WHOLESALE: 'STORE_WHOLESALE',
}

const form = reactive({
  name: '',
  brandName: '',
  categoryId: 0,
  categoryName: '',
  unit: '',
  specs: '',
  origin: '',
  alcoholContent: '',
  barcode: '',
  saleChannels: [] as string[],
  status: 'ON_SALE',
  isNew: false,
  isRecommend: false,
  // 其他设置（原稿五开关中的商品级三项，t_product_spu 真实字段）
  enabled: true,
  shelfLifeOn: true,
  batchOn: false,
  mainImage: '',
})

// 商品标签（PUT /admin/products/:spuId/marketing-tags）
const tags = ref<string[]>([])
const tagInput = ref('')

// 品牌/基础单位/规格/产地内联下拉 + 分类选择（原稿 f-drop / openPicker）：
// 品牌与单位来自真实基础库接口（listBrands/listUnits），规格/产地无独立库表，
// 用本租户商品中已使用过的值做库（productsApi.list 派生），自定义输入兜底（不硬编码打样数据）
const dropOpen = ref('') // '' | 'brand' | 'unit' | 'spec' | 'origin'
const brandOptions = ref<BrandItem[]>([])
const unitOptions = ref<UnitItem[]>([])
const categoryOptions = ref<CategoryInfo[]>([])
const specOptions = ref<string[]>([])
const originOptions = ref<string[]>([])
const brandCustom = ref('')
const unitCustom = ref('')
const specCustom = ref('')
const originCustom = ref('')
const catModal = ref(false)
let brandsLoaded = false
let unitsLoaded = false
let catsLoaded = false
let libsLoaded = false

async function ensureBrands() {
  if (brandsLoaded) return
  brandsLoaded = true
  try { brandOptions.value = await listBrands() } catch { /* 库拉取失败静默，仍可自定义输入 */ }
}

async function ensureUnits() {
  if (unitsLoaded) return
  unitsLoaded = true
  try { unitOptions.value = await listUnits() } catch { /* 库拉取失败静默，仍可自定义输入 */ }
}

async function ensureCategories() {
  if (catsLoaded) return
  catsLoaded = true
  try { categoryOptions.value = await categoriesApi.list() } catch { /* 库拉取失败静默 */ }
}

// 规格/产地库：本租户商品中已使用过的去重值（原稿注释：由系统基础数据模块维护，接入时替换 lib 实现）
async function ensureSpecOriginLibs() {
  if (libsLoaded) return
  libsLoaded = true
  try {
    const r = await productsApi.list({ page: 1, pageSize: 200 })
    const specs = new Set<string>()
    const origins = new Set<string>()
    for (const p of r.list) {
      if (p.specs && p.specs.trim()) specs.add(p.specs.trim())
      if (p.origin && p.origin.trim()) origins.add(p.origin.trim())
    }
    specOptions.value = [...specs]
    originOptions.value = [...origins]
  } catch { /* 拉取失败静默，仍可自定义输入 */ }
}

function toggleDrop(key: 'brand' | 'unit' | 'spec' | 'origin') {
  if (!editable.value) { needEdit(); return }
  if (dropOpen.value === key) { dropOpen.value = ''; return }
  dropOpen.value = key
  if (key === 'brand') ensureBrands()
  else if (key === 'unit') ensureUnits()
  else ensureSpecOriginLibs()
}

function pickBrand(name: string) {
  const v = (name || '').trim()
  if (!v) return
  form.brandName = v
  brandCustom.value = ''
  dropOpen.value = ''
  markField('brand')
  uni.showToast({ title: `品牌已设为「${v}」`, icon: 'none' })
}

function pickUnit(name: string) {
  const v = (name || '').trim()
  if (!v) return
  if (usedUnitNames.value.includes(v)) {
    uni.showToast({ title: `单位「${v}」已被辅单位使用`, icon: 'none' })
    return
  }
  if (form.unit === v) { dropOpen.value = ''; return }
  form.unit = v
  unitCustom.value = ''
  dropOpen.value = ''
  markField('unit')
  uni.showToast({ title: `基础单位已设为「${v}」`, icon: 'none' })
}

function pickSpec(v: string) {
  const s = (v || '').trim()
  if (!s) return
  form.specs = s
  specCustom.value = ''
  dropOpen.value = ''
  markField('specs')
  uni.showToast({ title: `规格已设为「${s}」`, icon: 'none' })
}

function pickOrigin(v: string) {
  const s = (v || '').trim()
  if (!s) return
  form.origin = s
  originCustom.value = ''
  dropOpen.value = ''
  markField('origin')
  uni.showToast({ title: `产地已设为「${s}」`, icon: 'none' })
}

function openCatPicker() {
  if (!editable.value) { needEdit(); return }
  ensureCategories()
  catModal.value = true
}

function pickCategory(cat: CategoryInfo) {
  if (!cat?.name) return
  form.categoryName = cat.name
  form.categoryId = Number(cat.id) || 0
  catModal.value = false
  markField('category')
}

// 五档价格（SKU 级，编辑态可改，保存走 PUT /admin/products/:skuId/price）
const priceForm = reactive({
  costPrice: '0.00',
  wholesalePrice: '0.00',
  retailPrice: '0.00',
  miniappPrice: '0.00',
  storePrice: '0.00',
})

function onPriceInput(key: string, e: any) {
  ;(priceForm as any)[key] = e.detail.value || ''
  markField('price:' + key)
  if (key === 'costPrice') {
    // 辅单位进货价是「基础进货价 ÷ 换算率」的派生值，基础价变化即自动重算（清手改暂存）
    Object.keys(unitCostManual.value).forEach(k => delete unitCostManual.value[Number(k)])
    return
  }
  // 主辅单位价格双向自动换算：改基础单位价格 → 各辅单位按换算率联动重算（基础价清空时保留辅单位原值）
  syncUnitPricesFrom(key, e.detail.value || '')
}

// 单位级价格档（后端 units 无 costPrice 字段，成本价不参与换算）
const UNIT_PRICE_KEYS = ['retailPrice', 'wholesalePrice', 'storePrice', 'miniappPrice']

function syncUnitPricesFrom(key: string, v: string) {
  if (!UNIT_PRICE_KEYS.includes(key)) return
  const base = parseFloat(v)
  if (!isFinite(base)) return
  for (let i = 1; i < units.value.length; i++) {
    const f = unitFactor(i)
    if (!f) continue
    const nv = (Math.round((base / f) * 100) / 100).toFixed(2)
    if (!unitPriceForm.value[i]) unitPriceForm.value[i] = {}
    unitPriceForm.value[i][key] = nv
    if (!unitPriceEdits[i]) unitPriceEdits[i] = {}
    unitPriceEdits[i][key] = nv
    markField(`unitPrice:${i}:${key}`)
  }
}

// 价格表格行（基础单位列 = 可编辑 priceForm；辅单位列由模板读 units 冗余展示）
const priceRows = computed(() => [
  { key: 'costPrice', label: '进货价' },
  { key: 'wholesalePrice', label: '批发价' },
  { key: 'retailPrice', label: '零售价' },
  { key: 'miniappPrice', label: '小程序价' },
  { key: 'storePrice', label: '门店价' },
])

// 辅单位列表（价格表辅列遍历用；units[0] 为基础单位，不生成辅列）
const subUnits = computed(() => units.value.slice(1))

const stockBadgeCls = computed(() => {
  if (stock.value <= 0) return 'pd-badge--out'
  if (warningThreshold.value > 0 && stock.value <= warningThreshold.value) return 'pd-badge--warn'
  return 'pd-badge--ok'
})

const stockBadgeTxt = computed(() => {
  if (stock.value <= 0) return '已缺货'
  if (warningThreshold.value > 0 && stock.value <= warningThreshold.value) return '库存预警'
  return '库存充足'
})

// 零售毛利 / 毛利率：原稿带 ¥ 前缀 + 百分比
const marginText = computed(() => {
  const cost = Number(priceForm.costPrice)
  const retail = Number(priceForm.retailPrice)
  if (!(retail > 0)) return '—'
  return `¥${(retail - cost).toFixed(2)} · ${((retail - cost) / retail * 100).toFixed(1)}%`
})

// 按成本价计算的库存金额：成本价无权限时为 null，如实显示 ¥—（不造假）
const stockAmount = computed(() => {
  const cp = sku.value ? Number(sku.value.costPrice) : NaN
  if (!(cp > 0)) return '¥—'
  return '¥' + (stock.value * cp).toFixed(2)
})

// 缩略图：有主图显示主图；无主图显示首字母 + 名称哈希取色（原稿 NEW_COLORS 取色）
const THUMB_COLORS = PRODUCT_DETAIL_THUMB_COLORS
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const thumbColor = computed(() => THUMB_COLORS[hashStr(form.name || '商') % THUMB_COLORS.length])
const thumbTint = computed(() => thumbColor.value + '1A')

// 单位换算链文案（原稿 chainText：逐级展示原始 a/b 关系，如 1 箱 = 12 瓶，6 瓶 = 1 箱）
const chainText = computed(() => {
  if (units.value.length < 2) return ''
  const segs: string[] = []
  for (let i = 1; i < units.value.length; i++) {
    const { a, b } = unitAb(i)
    segs.push(`${a} ${units.value[i - 1]?.unitName || ''} = ${b} ${units.value[i]?.unitName || ''}`)
  }
  return segs.join('，')
})

function toggleChannel(v: string) {
  if (!editable.value) { needEdit(); return }
  const idx = form.saleChannels.indexOf(v)
  if (idx >= 0) form.saleChannels.splice(idx, 1)
  else form.saleChannels.push(v)
  markField('channels')
}

function setStatus(v: string) {
  if (!editable.value) { needEdit(); return }
  form.status = v
  markField('status')
}

function toggleNew() {
  if (!editable.value) { needEdit(); return }
  form.isNew = !form.isNew
  markField('isNew')
}

function toggleRecommend() {
  if (!editable.value) { needEdit(); return }
  form.isRecommend = !form.isRecommend
  markField('isRecommend')
}

function onWarningThreshold(e: any) {
  if (!editable.value) return
  const v = Number(e.detail.value)
  warningThreshold.value = Number.isFinite(v) ? v : 0
  markField('warningThreshold')
}

function toggleTrace() {
  if (!editable.value) { needEdit(); return }
  traceEnabled.value = !traceEnabled.value
  markField('traceEnabled')
}

// 商品启用/停用（原稿 toggleEnabled）：停用是档案级操作，弹确认说明影响；启用直接生效
function toggleEnabled() {
  if (!editable.value) { needEdit(); return }
  if (form.enabled) {
    uni.showModal({
      title: '停用该商品？',
      content: '停用后开单、采购将无法选择该商品，列表中置灰显示、不再计入库存金额统计。已保存的单据与历史数据不受影响，可随时重新启用。',
      confirmText: '停用商品',
      cancelText: '再想想',
      success: (r) => {
        if (!r.confirm) return
        form.enabled = false
        markField('enabled')
        uni.showToast({ title: '商品已停用，保存后生效', icon: 'none' })
      },
    })
  } else {
    form.enabled = true
    markField('enabled')
    uni.showToast({ title: '已恢复启用，保存后生效', icon: 'none' })
  }
}

function toggleShelfLife() {
  if (!editable.value) { needEdit(); return }
  form.shelfLifeOn = !form.shelfLifeOn
  markField('shelfLifeOn')
}

function toggleBatch() {
  if (!editable.value) { needEdit(); return }
  form.batchOn = !form.batchOn
  markField('batchOn')
}

// 上架销售开关与状态 chips 同源（后端只有一个 status 字段：ON_SALE/OFF_SALE）
function toggleOnSale() {
  if (!editable.value) { needEdit(); return }
  form.status = form.status === 'ON_SALE' ? 'OFF_SALE' : 'ON_SALE'
  markField('status')
}

// 商品标签增删
function addTag() {
  if (!editable.value) { needEdit(); return }
  const t = tagInput.value.trim()
  if (!t) return
  if (!tags.value.includes(t)) {
    tags.value.push(t)
    markField('tags')
  }
  tagInput.value = ''
}

function removeTag(i: number) {
  if (!editable.value) { needEdit(); return }
  tags.value.splice(i, 1)
  markField('tags')
}

// 编辑守卫（原稿 needEdit）：只读态拦截可改动入口并给出引导
function needEdit() {
  uni.showToast({ title: '已保存状态不可修改，请点底部「修改」', icon: 'none' })
  return false
}

async function loadDetail(id: number) {
  if (loading.value) return
  loading.value = true
  try {
    const d = await getProductDetail(id)
    original.value = d
    applyDetail(d)
    resetDirty()
    editable.value = false
  } catch (err: any) {
    console.error('加载商品详情失败:', err)
    uni.showToast({ title: err?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function resetDirty() {
  Object.keys(dirtyKeys).forEach(k => { dirtyKeys[k] = false })
}

function applyDetail(d: ProductDetail) {
  const skuItem = d.skus?.[0]
  spuId.value = d.id
  form.name = d.name || ''
  form.brandName = d.brandName || ''
  form.categoryId = d.categoryId
  form.categoryName = d.categoryName || ''
  form.unit = d.unit || ''
  form.specs = d.specs || ''
  form.origin = d.origin || ''
  form.alcoholContent = d.alcoholContent || ''
  form.barcode = skuItem?.barcode || ''
  // 历史渠道值映射到新枚举（MINIAPP→小程序零售 等）
  form.saleChannels = (d.saleChannels || []).map(c => LEGACY_CHANNEL_MAP[c] || c)
  form.status = d.status || 'ON_SALE'
  form.isNew = !!d.isNew
  form.isRecommend = !!d.isRecommend
  form.mainImage = d.mainImage || ''
  tags.value = Array.isArray(d.marketingTags) ? d.marketingTags : []
  // 深拷贝单位行：行内编辑直接改 units 元素，必须与 original 隔离，取消编辑才能回滚
  // 派生 a/b 时把 ratio 还原成用户输入习惯的形式：1/r 为整数则 a=1/r, b=1（如 ratio=1/6 → 6 瓶 = 1 包）
  units.value = (skuItem?.units || []).map(u => {
    const r = Number(u.ratio) || 1
    const inv = 1 / r
    const useInverse = Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) !== 1
    const a = useInverse ? Math.round(inv) : 1
    const b = useInverse ? 1 : Math.round(r * 10000) / 10000
    return { ...u, a, b }
  })
  sku.value = skuItem || null
  if (skuItem) {
    priceForm.costPrice = Number(skuItem.costPrice).toFixed(2)
    priceForm.wholesalePrice = Number(skuItem.wholesalePrice).toFixed(2)
    priceForm.retailPrice = Number(skuItem.retailPrice).toFixed(2)
    priceForm.miniappPrice = skuItem.miniappPrice != null ? Number(skuItem.miniappPrice).toFixed(2) : ''
    priceForm.storePrice = skuItem.storePrice != null ? Number(skuItem.storePrice).toFixed(2) : ''
  }
  // 辅单位价格格 + 行内编辑暂存复位
  const upf: Record<number, Record<string, string>> = {}
  units.value.forEach((u, i) => {
    if (i > 0) {
      upf[i] = {
        retailPrice: u.retailPrice != null && u.retailPrice !== '' ? Number(u.retailPrice).toFixed(2) : '',
        wholesalePrice: u.wholesalePrice != null && u.wholesalePrice !== '' ? Number(u.wholesalePrice).toFixed(2) : '',
        miniappPrice: u.miniappPrice != null && u.miniappPrice !== '' ? Number(u.miniappPrice).toFixed(2) : '',
        storePrice: u.storePrice != null && u.storePrice !== '' ? Number(u.storePrice).toFixed(2) : '',
      }
    }
  })
  unitPriceForm.value = upf
  // 辅单位进货价派生显示复位（清手改暂存）+ 本地增删暂存复位
  Object.keys(unitCostManual.value).forEach(k => delete unitCostManual.value[Number(k)])
  removedUnitIds.value = []
  Object.keys(unitEdits).forEach(k => delete unitEdits[Number(k)])
  Object.keys(unitPriceEdits).forEach(k => delete unitPriceEdits[Number(k)])
  stock.value = skuItem?.availableQty ?? 0
  warningThreshold.value = skuItem?.warningThreshold ?? 0
  traceEnabled.value = !!skuItem?.traceEnabled
  // 其他设置开关（后端缺列时字段缺省 → 启用/保质期默认开，批次默认关，与原稿新商品默认一致）
  form.enabled = d.enabled === undefined ? true : !!d.enabled
  form.shelfLifeOn = d.shelfLifeOn === undefined ? true : !!d.shelfLifeOn
  form.batchOn = !!d.batchOn
  createdAt.value = (d.createdAt || '').replace('T', ' ').slice(0, 19)
  updatedAt.value = (d.updatedAt || '').replace('T', ' ').slice(0, 19)
}

function doCancelEdit() {
  if (original.value) applyDetail(original.value)
  resetDirty()
  editable.value = false
  uni.showToast({ title: '已还原改动', icon: 'none' })
}

function cancelEdit() {
  if (!editable.value) return
  if (dirty.value) {
    uni.showModal({
      title: '放弃未保存的改动？',
      content: `该商品有 ${dirtyCount.value} 项修改尚未保存，退出编辑后改动将丢失。`,
      confirmText: '放弃改动',
      cancelText: '继续编辑',
      success: (r) => { if (r.confirm) doCancelEdit() },
    })
  } else {
    doCancelEdit()
  }
}

async function onMainAction() {
  if (!editable.value) {
    editable.value = true
    uni.showToast({ title: '已进入编辑模式', icon: 'none' })
    return
  }
  if (!dirty.value) {
    editable.value = false
    uni.showToast({ title: '内容未变更', icon: 'none' })
    return
  }
  await save()
}

async function save() {
  if (!spuId.value) return
  if (!form.name.trim()) { uni.showToast({ title: '请填写商品名称', icon: 'none' }); return }
  uni.showLoading({ title: '保存中...' })
  try {
    // 严格按后端契约（product.service.ts#updateProduct）：仅 SPU 字段，价格/单位数组不在该接口
    await updateProduct(spuId.value, {
      name: form.name.trim(),
      // 品牌/分类按字符串名提交，后端 updateProduct 解析为对应 id（见 product.service.ts#updateProduct）
      brand: form.brandName.trim() || undefined,
      category: form.categoryName.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      unit: form.unit.trim() || undefined,
      specs: form.specs.trim() || undefined,
      origin: form.origin.trim() || undefined,
      alcoholContent: form.alcoholContent ? Number(form.alcoholContent) : null,
      saleChannels: form.saleChannels,
      status: (form.status === 'OFF_SALE' ? 'OFF_SALE' : 'ON_SALE'),
      isNew: form.isNew,
      isRecommend: form.isRecommend,
      enabled: form.enabled,
      shelfLifeOn: form.shelfLifeOn,
      batchOn: form.batchOn,
      mainImage: form.mainImage || undefined,
    })
    const skuItem = original.value?.skus?.[0]
    if (skuItem) {
      // 五档价格：SKU 级接口（PUT /admin/products/:skuId/price）
      await updateSkuPrice(skuItem.id, {
        costPrice: Number(priceForm.costPrice) || 0,
        wholesalePrice: Number(priceForm.wholesalePrice) || 0,
        retailPrice: Number(priceForm.retailPrice) || 0,
        miniappPrice: priceForm.miniappPrice === '' ? null : Number(priceForm.miniappPrice),
        storePrice: priceForm.storePrice === '' ? null : Number(priceForm.storePrice),
      })
      // 追溯开关 + 预警阈值：PUT /admin/products/skus/:skuId
      if (dirtyKeys['traceEnabled'] || dirtyKeys['warningThreshold']) {
        await updateSku(skuItem.id, {
          traceEnabled: traceEnabled.value,
          warningThreshold: warningThreshold.value,
        })
      }
      // 基础单位改名：同步基础单位行名称（SPU unit 已随 updateProduct 提交）
      if (dirtyKeys['unit']) {
        const baseUnit = units.value.find(u => Number(u.isBase) === 1)
        if (baseUnit && form.unit.trim() && baseUnit.unitName !== form.unit.trim()) {
          await updateSkuUnit(skuItem.id, Number(baseUnit.id), { unitName: form.unit.trim() })
        }
      }
      // 辅单位增删改统一提交：先删（已落库的本地删除）→ 再改（行内编辑）→ 后增（本地新增）
      for (const delId of removedUnitIds.value) {
        await deleteSkuUnit(skuItem.id, delId)
      }
      removedUnitIds.value = []
      // 修改：已落库行（id>0）的行内编辑（比值/条码/价格）按行合并为一次 updateSkuUnit
      const unitIdxs = new Set<number>([...Object.keys(unitEdits), ...Object.keys(unitPriceEdits)].map(Number))
      for (const i of unitIdxs) {
        const u = units.value[i] as any
        if (!u || !u.id) continue
        const body: Record<string, unknown> = {}
        const edit = unitEdits[i] || {}
        if (edit.ratio !== undefined) body.ratio = edit.ratio
        if (edit.barcode !== undefined) body.barcode = edit.barcode
        const priceEdit = unitPriceEdits[i] || {}
        for (const pk of Object.keys(priceEdit)) {
          const v = priceEdit[pk]
          body[pk] = v === '' ? null : Number(v)
        }
        if (Object.keys(body).length) {
          await updateSkuUnit(skuItem.id, Number(u.id), body)
        }
      }
      // 新增：本地追加的行（id=0），价格取行内当前值（按换算率自动填充的结果）
      for (let i = 1; i < units.value.length; i++) {
        const u = units.value[i] as any
        if (u.id) continue
        const pf = unitPriceForm.value[i] || {}
        await addSkuUnit(skuItem.id, {
          unitName: (u.unitName || '').trim(),
          ratio: Number(u.ratio) || 1,
          retailPrice: pf.retailPrice === '' || pf.retailPrice == null ? null : Number(pf.retailPrice),
          wholesalePrice: pf.wholesalePrice === '' || pf.wholesalePrice == null ? null : Number(pf.wholesalePrice),
          storePrice: pf.storePrice === '' || pf.storePrice == null ? null : Number(pf.storePrice),
          miniappPrice: pf.miniappPrice === '' || pf.miniappPrice == null ? null : Number(pf.miniappPrice),
        })
      }
    }
    // 商品标签：PUT /admin/products/:spuId/marketing-tags
    if (dirtyKeys['tags']) {
      await setMarketingTags(spuId.value, tags.value)
    }
    uni.hideLoading()
    uni.showToast({ title: '已保存', icon: 'success' })
    await loadDetail(spuId.value)
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
}

function goBack() {
  if (dirty.value) {
    uni.showModal({
      title: '放弃未保存的改动？',
      content: `该商品有 ${dirtyCount.value} 项修改尚未保存，返回后改动将丢失。`,
      confirmText: '放弃改动',
      cancelText: '继续编辑',
      success: (r) => {
        if (r.confirm) {
          resetDirty()
          uni.navigateBack()
          uni.showToast({ title: '已放弃改动', icon: 'none' })
        }
      },
    })
    return
  }
  uni.navigateBack()
}

// ---- 扫码录入（原稿 openScanner：H5 走 getUserMedia + BarcodeDetector，环境不支持时提示手动输入） ----
const scanner = reactive({ open: false, type: 'base' as 'base' | 'unit', index: -1 })
let scanStream: MediaStream | null = null
let scanRaf = 0

const scannerLabel = computed(() =>
  scanner.type === 'unit' ? `辅单位「${units.value[scanner.index]?.unitName || ''}」条码` : '商品条码'
)

function openScanner(type: 'base' | 'unit', index = -1) {
  if (!editable.value) { needEdit(); return }
  // #ifdef MP-WEIXIN
  uni.scanCode({
    success: (res) => applyScanned(type, index, res.result || ''),
    fail: () => {},
  })
  return
  // #endif
  // #ifdef H5
  const supported = !!(navigator.mediaDevices && (navigator.mediaDevices as any).getUserMedia && 'BarcodeDetector' in window)
  if (!supported) {
    uni.showToast({ title: '当前环境不支持扫码，请手动输入', icon: 'none' })
    return
  }
  // #endif
  scanner.type = type
  scanner.index = index
  scanner.open = true
  setTimeout(startScan, 320)
}

// #ifdef H5
function scanVideoEl(): HTMLVideoElement | null {
  return (document.querySelector('#scVideo video') || document.getElementById('scVideo')) as HTMLVideoElement | null
}

async function startScan() {
  if (!scanner.open) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    if (!scanner.open) { stream.getTracks().forEach(t => t.stop()); return }
    scanStream = stream
    const v = scanVideoEl()
    if (v) {
      ;(v as any).srcObject = stream
      const p = v.play()
      if (p && p.catch) p.catch(() => {})
    }
    let det: any
    try {
      det = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code'] })
    } catch {
      det = new (window as any).BarcodeDetector()
    }
    const loop = async () => {
      if (!scanner.open) return
      const el = scanVideoEl()
      if (!el || el.readyState < 2) { scanRaf = requestAnimationFrame(loop); return }
      try {
        const codes = await det.detect(el)
        if (codes && codes.length && codes[0].rawValue) {
          applyScanned(scanner.type, scanner.index, String(codes[0].rawValue))
          return
        }
      } catch { /* 单帧识别失败继续下一帧 */ }
      if (scanner.open) scanRaf = requestAnimationFrame(loop)
    }
    loop()
  } catch {
    uni.showToast({ title: '无法访问摄像头，请检查权限', icon: 'none' })
    closeScanner()
  }
}
// #endif

function stopScan() {
  // #ifdef H5
  if (scanRaf) { cancelAnimationFrame(scanRaf); scanRaf = 0 }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null }
  const v = scanVideoEl()
  if (v && (v as any).srcObject) (v as any).srcObject = null
  // #endif
}

function closeScanner() {
  scanner.open = false
  stopScan()
}

function applyScanned(type: 'base' | 'unit', index: number, code: string) {
  closeScanner()
  if (!code) return
  if (type === 'unit') {
    const u = units.value[index]
    if (!u) return
    u.barcode = code
    unitEdits[index] = { ...(unitEdits[index] || {}), barcode: code }
    markField(`unit:${index}:barcode`)
    uni.showToast({ title: `已录入「${u.unitName || '辅单位'}」条码 ${code}`, icon: 'none' })
  } else {
    form.barcode = code
    markField('barcode')
    uni.showToast({ title: `已录入商品条码 ${code}`, icon: 'none' })
  }
}

// ---- 主图操作面板（原稿 sheetOpt：拍照/相册/链接/删除主图） ----
function onThumbTap() {
  if (!editable.value) { needEdit(); return }
  const items: string[] = ['拍照', '从相册选择', '输入图片链接']
  if (form.mainImage) items.push('删除主图')
  uni.showActionSheet({
    itemList: items,
    success: (r) => {
      const action = items[r.tapIndex]
      if (action === '拍照' || action === '从相册选择') pickImage(action === '拍照' ? 'camera' : 'album')
      else if (action === '输入图片链接') inputImageLink()
      else if (action === '删除主图') clearImage()
    },
  })
}

function pickImage(source: 'camera' | 'album') {
  uni.chooseImage({
    count: 1,
    sourceType: [source],
    success: async (res) => {
      const file = res.tempFilePaths?.[0]
      if (!file) return
      uni.showLoading({ title: '上传中...' })
      try {
        const url = await uploadImage(file)
        form.mainImage = url
        markField('mainImage')
        uni.hideLoading()
        uni.showToast({ title: source === 'camera' ? '拍照完成，主图已更新' : '已设为主图', icon: 'none' })
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '图片上传失败', icon: 'none' })
      }
    },
  })
}

function inputImageLink() {
  uni.showModal({
    title: '输入图片链接',
    editable: true,
    placeholderText: 'https://...',
    success: (r) => {
      if (r.confirm && r.content) {
        form.mainImage = r.content.trim()
        markField('mainImage')
      }
    },
  })
}

function clearImage() {
  form.mainImage = ''
  markField('mainImage')
}

// ---- 辅单位：行内编辑（原稿 rt-row：比例/条码就地改，保存时批量提交）+ 添加弹层 + 直接删除 ----
// 已被辅单位占用的单位名（基础单位下拉禁用 + 添加弹层置灰）
const usedUnitNames = computed(() => {
  const names: string[] = []
  for (let i = 1; i < units.value.length; i++) {
    const n = (units.value[i]?.unitName || '').trim()
    if (n) names.push(n)
  }
  return names
})

// 行内编辑暂存：index → { ratio?, barcode? }；取消编辑即丢弃，保存时批量 updateSkuUnit
const unitEdits = reactive<Record<number, { ratio?: number; barcode?: string }>>({})
// 辅单位价格格暂存：index → { retailPrice?, wholesalePrice?, storePrice?, miniappPrice? }
const unitPriceEdits = reactive<Record<number, Record<string, string>>>({})
// 辅单位价格格当前值（模板展示 + 编辑绑定）
const unitPriceForm = ref<Record<number, Record<string, string>>>({})
// 本地删除的已落库辅单位 id：保存时统一提交删除
const removedUnitIds = ref<number[]>([])

/** 第 i 个单位的 a/b 双向比值（存在本地 units 元素上，删除/重排自动跟随；未编辑时由后端 ratio 派生为 1 上级 = ratio 本级） */
function unitAb(i: number): { a: number; b: number } {
  const u = units.value[i]
  if (!u) return { a: 1, b: 1 }
  const a = Number((u as any).a) > 0 ? Number((u as any).a) : 1
  const b = Number((u as any).b) > 0 ? Number((u as any).b) : 1
  return { a, b }
}
function abValue(i: number, side: 'a' | 'b'): string {
  const u = units.value[i] as any
  if (!u) return '1'
  const v = u[side]
  if (v !== undefined && v !== null && v !== '') return String(v)
  return side === 'a' ? '1' : String(Number(u.ratio) || 1)
}
/** 链式换算系数：1 个基础单位 = f 个 units[i]（f = ∏ b_j/a_j） */
function unitFactor(i: number): number {
  let f = 1
  for (let j = 1; j <= i; j++) {
    const { a, b } = unitAb(j)
    f *= b / a
  }
  return f
}

/** 双向比值输入：a/b 任一改动 → ratio = b/a 落到后端契约，并重算第 i 级及其后代的辅单位价格 */
function onSubRatio(i: number, side: 'a' | 'b', e: any) {
  if (!editable.value) return
  const u = units.value[i] as any
  if (!u) return
  const raw = e?.detail?.value ?? ''
  const n = Number(raw)
  u[side] = raw === '' || !isFinite(n) ? '' : String(n)
  const { a, b } = unitAb(i)
  const ratio = b / a
  ;(u as any).ratio = ratio
  unitEdits[i] = { ...(unitEdits[i] || {}), ratio }
  markField(`unit:${i}:ratio`)
  // 换算率变化后派生关系整体改变，进货价手改暂存作废
  Object.keys(unitCostManual.value).forEach(k => delete unitCostManual.value[Number(k)])
  // 换算率变化 → 该级及其后各级价格按新系数重算（基础价未填时保留原值）
  for (let j = i; j < units.value.length; j++) {
    const f = unitFactor(j)
    if (!f) continue
    UNIT_PRICE_KEYS.forEach((k) => {
      const base = Number(priceForm[k as keyof typeof priceForm])
      if (priceForm[k as keyof typeof priceForm] === '' || !isFinite(base)) return
      const nv = (Math.round((base / f) * 100) / 100).toFixed(2)
      if (!unitPriceForm.value[j]) unitPriceForm.value[j] = {}
      unitPriceForm.value[j][k] = nv
      if (!unitPriceEdits[j]) unitPriceEdits[j] = {}
      unitPriceEdits[j][k] = nv
      markField(`unitPrice:${j}:${k}`)
    })
  }
}

/** 失焦兜底：输入法/热更新等场景 input 事件可能丢失，以 DOM 当前值强制同步一次 */
function onSubRatioBlur(i: number, side: 'a' | 'b', e: any) {
  const dom = e?.detail?.value ?? (e?.target as HTMLInputElement | undefined)?.value
  if (dom == null) return
  if (String(dom) !== abValue(i, side)) onSubRatio(i, side, { detail: { value: String(dom) } })
}

function onUnitBarcode(i: number, e: any) {
  if (!editable.value) return
  const u = units.value[i]
  if (!u) return
  u.barcode = e.detail.value || ''
  unitEdits[i] = { ...(unitEdits[i] || {}), barcode: u.barcode }
  markField(`unit:${i}:barcode`)
}

/** 辅单位进货价手改暂存（纯前端派生值不落库：后端 units 无成本字段，改它即反推基础进货价随保存落库） */
const unitCostManual = ref<Record<number, string>>({})

/** 价格表单元格显示值：四档价读 unitPriceForm（保存走 updateSkuUnit）；
 *  进货价辅列为「基础进货价 ÷ 换算率」派生值 */
function unitCellDisplay(si: number, key: string): string {
  if (key === 'costPrice') {
    const m = unitCostManual.value[si + 1]
    if (m !== undefined && m !== '') {
      const mv = parseFloat(m)
      if (isFinite(mv)) return String(mv)
    }
    const base = parseFloat(priceForm.costPrice)
    const f = unitFactor(si + 1)
    if (!isFinite(base) || !f) return ''
    return (Math.round((base / f) * 100) / 100).toFixed(2)
  }
  return unitPriceForm.value[si + 1]?.[key] ?? ''
}

function onUnitCellInput(si: number, key: string, e: any) {
  if (key === 'costPrice') onUnitCostInput(si, e)
  else onUnitPrice(si + 1, key, e)
}

/** 改辅单位进货价：反推基础进货价（随保存落库），其余辅单位进货价按新基础价自动重算 */
function onUnitCostInput(si: number, e: any) {
  if (!editable.value) return
  const i = si + 1
  const v = e?.detail?.value ?? ''
  unitCostManual.value[i] = v
  const val = parseFloat(v)
  if (!isFinite(val)) return
  const f = unitFactor(i) || 1
  ;(priceForm as any).costPrice = (Math.round(val * f * 100) / 100).toFixed(2)
  markField('price:costPrice')
  Object.keys(unitCostManual.value).forEach(k => {
    if (Number(k) !== i) delete unitCostManual.value[Number(k)]
  })
}

/** 辅单位价格输入：全双向联动——先反推基础单位价，再按换算率重算其余各辅单位（正在编辑的行保留输入串） */
function onUnitPrice(i: number, key: string, e: any) {
  if (!editable.value) return
  const v = e.detail.value || ''
  if (!unitPriceForm.value[i]) unitPriceForm.value[i] = {}
  unitPriceForm.value[i][key] = v
  if (!unitPriceEdits[i]) unitPriceEdits[i] = {}
  unitPriceEdits[i][key] = v
  markField(`unitPrice:${i}:${key}`)
  const val = parseFloat(v)
  if (!isFinite(val)) return
  const fEdit = unitFactor(i) || 1
  const base = Math.round(val * fEdit * 100) / 100
  // 反推并回写基础单位价
  priceForm[key as keyof typeof priceForm] = base.toFixed(2)
  markField('price:' + key)
  if (key === 'costPrice') return // 单位级无成本价字段，成本价不联动辅单位
  // 重算其余各辅单位（跳过正在编辑的第 i 行，避免覆盖输入串）
  for (let j = 1; j < units.value.length; j++) {
    if (j === i) continue
    const f = unitFactor(j)
    if (!f) continue
    const nv = (Math.round((base / f) * 100) / 100).toFixed(2)
    if (!unitPriceForm.value[j]) unitPriceForm.value[j] = {}
    unitPriceForm.value[j][key] = nv
    if (!unitPriceEdits[j]) unitPriceEdits[j] = {}
    unitPriceEdits[j][key] = nv
    markField(`unitPrice:${j}:${key}`)
  }
}

// 添加辅单位弹层（原稿 openUnitPicker：单位库搜索 + chips + 自定义兜底）
const unitPicker = ref(false)
const unitKw = ref('')
const unitCustomName = ref('')

const unitLibFiltered = computed(() => {
  const kw = unitKw.value.trim().toLowerCase()
  const lib = unitOptions.value.map(u => u.name)
  if (!kw) return lib
  return lib.filter(n => n.toLowerCase().includes(kw))
})

function openUnitAddPicker() {
  if (!editable.value) { needEdit(); return }
  ensureUnits()
  unitKw.value = ''
  unitCustomName.value = ''
  unitPicker.value = true
}

/** 添加辅单位（原稿 addUnit 语义：编辑态纯本地追加，点保存才落库）；
 *  初始 a=b=1 与上一级同价，价格按换算率自动填充 */
function addUnitByName(name: string) {
  const nm = (name || '').trim()
  if (!nm) return
  if (units.value.some(u => (u.unitName || '').trim() === nm)) {
    uni.showToast({ title: `单位「${nm}」已存在`, icon: 'none' })
    return
  }
  if (!editable.value) { needEdit(); return }
  const idx = units.value.length
  // 新行 id=0 表示"本地新增、待保存落库"；价格 = 基础价 ÷ 上一级换算系数（初始 ratio=1 与上一级同价）
  const f = unitFactor(idx - 1)
  const pf: Record<string, string> = {}
  UNIT_PRICE_KEYS.forEach((k) => {
    const base = Number(priceForm[k as keyof typeof priceForm])
    pf[k] = isFinite(base) && f ? (Math.round((base / f) * 100) / 100).toFixed(2) : ''
  })
  units.value.push({ id: 0, unitName: nm, ratio: 1, barcode: '', isBase: 0, a: 1, b: 1 } as any)
  unitPriceForm.value[idx] = pf
  markField(`unit:add:${idx}`)
  unitPicker.value = false
  uni.showToast({ title: `已添加辅单位「${nm}」，价格已按换算率自动填充`, icon: 'none' })
}

function addUnitCustom() {
  const v = unitCustomName.value.trim()
  if (!v) { uni.showToast({ title: '请输入单位名称', icon: 'none' }); return }
  addUnitByName(v)
}

// 删除辅单位（原稿 removeUnit 语义：编辑态本地删除 + 链合并，点保存才落库）。
// 已落库的记入 removedUnitIds 保存时统一删除；本地新增的（id=0）直接移除。
function removeUnit(i: number) {
  if (!editable.value) { needEdit(); return }
  const u = units.value[i] as any
  if (!u || i === 0) return
  if (units.value.length <= 1) { uni.showToast({ title: '至少保留一个单位', icon: 'none' }); return }
  if (u.id) removedUnitIds.value.push(Number(u.id))
  const removedAb = unitAb(i)
  // 下一级的原 a/b 必须在 splice 前取（删除后索引前移）
  const nextOrig = units.value[i + 1] as any
  const nab = nextOrig ? unitAb(i + 1) : null
  units.value.splice(i, 1)
  // 链合并（原稿）：被删单位的 a/b 乘进下一级，整链折算不变；价格按新系数重算
  const next = units.value[i] as any
  if (next && nab) {
    next.a = removedAb.a * nab.a
    next.b = removedAb.b * nab.b
    next.ratio = next.b / next.a
    unitEdits[i] = { ...(unitEdits[i] || {}), ratio: next.ratio }
    markField(`unit:${i}:ratio`)
  }
  markField(`unit:del:${u.id || u.unitName || 'x'}`)
  // 删除后索引整体前移，暂存表同步重排
  reindexAfterRemove(i)
  uni.showToast({ title: `已删除辅单位「${u.unitName}」，保存后生效`, icon: 'none' })
}

/** 删除某行后，把按行索引的暂存表整体前移一格 */
function reindexAfterRemove(removedIdx: number) {
  const move = (src: Record<number, any>): Record<number, any> => {
    const out: Record<number, any> = {}
    Object.keys(src).forEach(k => {
      const ki = Number(k)
      if (ki === removedIdx) return
      out[ki > removedIdx ? ki - 1 : ki] = src[ki]
    })
    return out
  }
  const ne = move({ ...unitEdits })
  Object.keys(unitEdits).forEach(k => delete unitEdits[Number(k)])
  Object.assign(unitEdits, ne)
  const pe = move({ ...unitPriceEdits })
  Object.keys(unitPriceEdits).forEach(k => delete unitPriceEdits[Number(k)])
  Object.assign(unitPriceEdits, pe)
  unitPriceForm.value = move(unitPriceForm.value)
  unitCostManual.value = move(unitCostManual.value)
}

onLoad((options: any) => {
  const id = options?.id ? Number(options.id) : 0
  if (id > 0) {
    loadDetail(id)
  }
})

// 离开页面/切后台释放摄像头（原稿 stopScan 语义：切商品、关弹层、离开都释放）
onUnload(() => closeScanner())
onHide(() => closeScanner())
</script>

<style lang="scss" scoped>
.pd-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
}

/* 页头（原稿 pg-hd：88rpx 行高，已保存/草稿徽标）
   sticky：H5 整文档滚动，sticky 保证标题栏不随表单滚出视口（与 page-header 组件一致） */
.pg-hd {
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

/* 已保存/草稿徽标（原稿 hd-status） */
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

.hd-status--saved {
  background: $zx-badge-success-bg;
  color: $zx-badge-success-strong;
}

.hd-status--draft {
  background: $zx-badge-draft-bg;
  color: $zx-badge-draft-strong;
}

.hd-status--editing {
  background: $zx-badge-warning-bg;
  color: $zx-badge-warning-strong;
}

/* 加载骨架（原稿 skl 灰块） */
.pd-skeleton {
  flex: 1;
  min-height: 0;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.skl {
  background: linear-gradient(90deg, $uni-gray-100 25%, $uni-gray-50 50%, $uni-gray-100 75%);
  background-size: 400% 100%;
  animation: sklShimmer 1.4s infinite;
  border-radius: 16rpx;
}

.skl-thumb {
  width: 164rpx;
  height: 164rpx;
  border-radius: 24rpx;
}

.skl-line {
  height: 36rpx;
}

.skl-block {
  height: 180rpx;
  border-radius: 32rpx;
}

@keyframes sklShimmer {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}

/* 内容区 */
.content-area {
  flex: 1;
  min-height: 0;
}

.content-inner {
  padding: 28rpx 28rpx 200rpx;
  animation: pdFadeUp 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@keyframes pdFadeUp {
  from {
    opacity: 0;
    transform: translateY(28rpx);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* 只读锁定态（原稿 locked：隐藏操作元素 + 输入只读） */
.content-inner.locked .f-input,
.content-inner.locked .chip,
.content-inner.locked .sw,
.content-inner.locked .tag-input {
  pointer-events: none;
}

.content-inner.locked .f-input,
.content-inner.locked .chip,
.content-inner.locked .tag-input {
  color: $uni-text-color-secondary;
}

.content-inner.locked .f-scan,
.content-inner.locked .rt-scan,
.content-inner.locked .rt-del,
.content-inner.locked .add-unit,
.content-inner.locked .pd-add,
.content-inner.locked .tag-item .rm {
  display: none;
}

/* 分组（原稿 pd-group / pd-gtitle） */
.pd-group {
  background: $uni-bg-color;
  border-radius: 32rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-60, 0 2rpx 6rpx $zx-black-40;
  margin-bottom: 28rpx;
  overflow: hidden;
}

.pd-gtitle {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 32rpx 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-gray-500;
}

.gt-bar {
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}

.pd-note {
  margin-left: auto;
  font-size: 20rpx;
  font-weight: 400;
  color: $uni-gray-400;
}

/* 基本信息：左缩略图 + 右字段（原稿 pd-basic） */
.pd-basic {
  display: flex;
  gap: 28rpx;
  padding: 8rpx 32rpx 24rpx;
  border-bottom: 1rpx solid $uni-gray-100;
  align-items: stretch;
}

.pd-thumb {
  position: relative;
  width: 164rpx;
  flex-shrink: 0;
  border-radius: 24rpx;
  background: $uni-gray-50;
  box-shadow: inset 0 0 0 1rpx $uni-gray-100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.pd-thumb .ph {
  font-size: 56rpx;
  font-weight: 800;
  letter-spacing: -2rpx;
}

.pd-thumb-img {
  width: 100%;
  height: 100%;
}

/* 缩略图右下角「+」：极淡字符，点整块缩略图即触发（原稿 pd-add） */
.pd-add {
  position: absolute;
  right: 10rpx;
  bottom: 2rpx;
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 34rpx;
  font-weight: 300;
  line-height: 1;
  color: $uni-gray-300;
  opacity: 0.55;
}

.pd-basic-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pd-basic-fields .f-row {
  padding: 12rpx 0;
  border-bottom: none;
}

/* 字段行（原稿 f-row：label 定宽 + 右对齐输入） */
.f-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.f-row:last-child {
  border-bottom: none;
}

.f-label {
  width: 152rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}

.f-input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $uni-text-color;
  text-align: right;
}

.f-input--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
}

.f-ph {
  color: $uni-gray-300;
}

.f-value {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $uni-text-color;
  text-align: right;
  font-weight: 500;
}

.f-value--ph {
  color: $uni-gray-300;
  font-weight: 400;
}

.f-value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 700;
}

.f-unit {
  font-size: 24rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

/* 下拉箭头（原稿 f-arrow 右 chevron，展开 rotate 90° 变下指 + 变蓝；只读态隐藏） */
.f-arrow {
  flex-shrink: 0;
  width: 16rpx;
  height: 16rpx;
  border-right: 4rpx solid $uni-gray-300;
  border-bottom: 4rpx solid $uni-gray-300;
  transform: rotate(-45deg);
  transition: transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1), border-color 0.22s;
}

.f-arrow--up {
  transform: rotate(45deg);
  border-right-color: $uni-color-primary;
  border-bottom-color: $uni-color-primary;
}

.content-inner.locked .f-arrow {
  display: none;
}

/* 展开中的字段行高亮（原稿 .f-row.open：底灰 + 值变蓝） */
.f-row--active {
  background: $uni-gray-50;
}

.f-row--active .f-value {
  color: $uni-color-primary;
}

/* 下拉面板（原稿 f-drop：库列表 + 自定义输入兜底；H5 用 overflow 自滚，scroll-view 内部不滚动） */
.f-drop {
  border-top: 1rpx solid $uni-gray-100;
  background: $uni-bg-color;
}

.f-drop-list {
  max-height: 472rpx;
  overflow-y: auto;
}

.f-drop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80rpx;
  padding: 0 36rpx;
  font-size: 28rpx;
  color: $uni-text-color;
  border-bottom: 1rpx solid $uni-gray-50;
}

.f-drop-item:active {
  background: $uni-gray-100;
}

.f-drop-item--sel {
  color: $uni-color-primary;
  font-weight: 700;
}

/* 已被辅单位占用的单位项：置灰不可选（原稿 .f-drop-item.used） */
.f-drop-item--used {
  opacity: 0.45;
}

.f-drop-ck {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-color-primary;
  flex-shrink: 0;
}

.f-drop-used-tag {
  font-size: 22rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.f-drop-empty {
  padding: 28rpx 36rpx;
  font-size: 24rpx;
  color: $uni-gray-400;
}

.f-drop-custom {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 36rpx 24rpx;
  background: $uni-gray-50;
}

.f-drop-custom .f-input {
  text-align: left;
  height: 72rpx;
  padding: 0 20rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
}

.f-drop-custom-btn {
  flex-shrink: 0;
  padding: 14rpx 30rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $ai-bg-page;
  background: $uni-color-primary;
  border-radius: 16rpx;
}

.f-drop-custom-btn:active {
  opacity: 0.85;
}

/* 扫码图标（原稿 ICO_SC 四角框 + 扫描线的 CSS 实现） */
.f-scan {
  flex-shrink: 0;
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: $uni-color-primary;
}

.f-scan:active {
  background: $uni-color-primary-soft;
}

.scan-ic {
  position: relative;
  width: 32rpx;
  height: 32rpx;
}

.scan-ic--sm {
  width: 26rpx;
  height: 26rpx;
}

.scan-ic-c {
  position: absolute;
  width: 10rpx;
  height: 10rpx;
  border-color: currentColor;
  border-style: solid;
  border-width: 0;
}

.scan-ic--sm .scan-ic-c {
  width: 8rpx;
  height: 8rpx;
}

.scan-ic-c--tl {
  left: 0;
  top: 0;
  border-left-width: 3rpx;
  border-top-width: 3rpx;
  border-top-left-radius: 4rpx;
}

.scan-ic-c--tr {
  right: 0;
  top: 0;
  border-right-width: 3rpx;
  border-top-width: 3rpx;
  border-top-right-radius: 4rpx;
}

.scan-ic-c--bl {
  left: 0;
  bottom: 0;
  border-left-width: 3rpx;
  border-bottom-width: 3rpx;
  border-bottom-left-radius: 4rpx;
}

.scan-ic-c--br {
  right: 0;
  bottom: 0;
  border-right-width: 3rpx;
  border-bottom-width: 3rpx;
  border-bottom-right-radius: 4rpx;
}

.scan-ic-line {
  position: absolute;
  left: 3rpx;
  right: 3rpx;
  top: 50%;
  height: 3rpx;
  border-radius: 3rpx;
  background: currentColor;
  opacity: 0.9;
}

.f-hint {
  flex: 1;
  min-width: 0;
  font-size: 22rpx;
  color: $uni-gray-400;
  text-align: right;
}

/* chips（渠道/状态/标记） */
.chips-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 32rpx 24rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.chips-row--last {
  border-bottom: none;
}

.chips-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-right: 8rpx;
}

.chip {
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 500;
  color: $uni-gray-500;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  transition: all 0.15s;
}

.chip:active {
  transform: scale(0.94);
}

.chip--on {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  font-weight: 700;
  border-color: $zx-primary-250;
}

/* 单位换算（原稿 rt-*） */
.rt-sub {
  padding: 16rpx 32rpx 10rpx;
  font-size: 14px;
  font-weight: 600;
  color: $uni-gray-400;
  background: $uni-gray-50;
  border-top: 1rpx solid $uni-gray-100;
}

.rt-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.rt-row:last-child {
  border-bottom: none;
}

.rt-name {
  font-size: 26rpx;
  font-weight: 700;
  color: $uni-text-color;
  flex-shrink: 0;
  min-width: 52rpx;
}

/* 双向比值：a 上级 = b 本级（原稿 rt-eq / rt-bu / rt-eqsign） */
.rt-eq {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;
}

.rt-eqsign {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-gray-500;
  flex-shrink: 0;
}

.rt-bu {
  font-size: 24rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
  max-width: 64rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 比例行内输入（原稿 rt-in） */
.rt-in {
  width: 80rpx;
  flex-shrink: 0;
  height: 68rpx;
  border-radius: 16rpx;
  background: $uni-gray-50;
  padding: 0 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
  text-align: center;
  box-sizing: border-box;
}

/* 只读锁定（原稿 locked）：换算/条码输入禁用置灰 */
.rt-in:disabled,
.rt-bc:disabled {
  color: $uni-gray-400;
  -webkit-text-fill-color: $uni-gray-400;
  opacity: 1;
}

/* 条码框容器（原稿 rt-bcw）+ 内嵌扫码图标（rt-scan） */
.rt-bcw {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.rt-scan {
  position: absolute;
  left: 14rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 28rpx;
  height: 28rpx;
  color: $uni-gray-400;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.rt-scan:active {
  color: $uni-color-primary;
}

/* 辅单位条码输入（原稿 rt-bc：左侧留扫码图标位） */
.rt-bc {
  width: 100%;
  min-width: 0;
  height: 68rpx;
  border-radius: 16rpx;
  background: $uni-gray-50;
  padding: 0 18rpx 0 56rpx;
  font-size: 24rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
}

.rt-empty {
  padding: 36rpx 32rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: $uni-gray-400;
  background: $uni-gray-50;
}

.rt-del {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $uni-gray-100;
  color: $uni-gray-500;
  font-size: 30rpx;
  line-height: 40rpx;
  text-align: center;
  flex-shrink: 0;
}

.rt-del:active {
  background: $zx-badge-danger-bg;
  color: $zx-badge-danger-strong;
}

/* 添加辅单位（原稿 add-unit：虚线框按钮） */
.add-unit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 84rpx;
  margin: 20rpx 32rpx 28rpx;
  border: 3rpx dashed $uni-border-color;
  border-radius: 24rpx;
  background: $uni-bg-color;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color-secondary;
}

.add-unit:active {
  background: $uni-gray-50;
}

.add-unit-icon {
  font-size: 30rpx;
  line-height: 1;
}

.rt-chain {
  padding: 18rpx 32rpx;
  font-size: 14px;
  color: $uni-gray-400;
  line-height: 1.6;
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: $uni-gray-50;
  border-top: 1rpx solid $uni-gray-100;
}

/* 价格表格（原稿 ptable：列=单位，行=价格类型） */
.pt-wrap {
  padding: 0 32rpx 24rpx;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* 价格表下方说明（原稿 pt-note：一段小灰字；左缘与表格行标题"进货价/门店价"对齐） */
.pt-note {
  padding: 4rpx 0 16rpx 56rpx;
  font-size: 14px;
  color: $uni-gray-400;
  line-height: 1.6;
}

.ptable {
  border: 1rpx solid $uni-gray-100;
  border-radius: 24rpx;
  overflow: hidden;
  /* 多单位时列数不定：按内容自然撑开，超出容器横向滚动（原稿 pt-wrap overflow-x 语义） */
  min-width: max-content;
  background: $uni-bg-color;
}

.pt-tr {
  display: flex;
}

.pt-tr + .pt-tr {
  border-top: 1rpx solid $uni-gray-100;
}

.pt-th,
.pt-td {
  flex: 1;
  min-width: 150rpx;
  padding: 18rpx 12rpx;
  text-align: center;
  font-size: 24rpx;
  border-left: 1rpx solid $uni-gray-100;
  box-sizing: border-box;
}

.pt-th:first-child,
.pt-td:first-child {
  border-left: none;
  flex: 1.2;
  text-align: left;
  padding-left: 24rpx;
  font-weight: 500;
  color: $uni-gray-500;
  background: $uni-gray-50;
}

.pt-head .pt-th {
  background: $uni-gray-50;
  font-weight: 600;
  color: $uni-gray-500;
}

.pt-utag {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $uni-gray-500;
}

.pt-utag--base {
  color: $uni-color-primary;
}

.pt-ubadge {
  display: block;
  font-size: 18rpx;
  font-weight: 600;
  margin-top: 2rpx;
  color: $uni-gray-400;
}

.pt-td {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
  color: $uni-text-color;
}

/* 编辑态价格输入（pt-in） */
.pt-input {
  width: 100%;
  min-width: 0;
  height: 56rpx;
  text-align: center;
  font-size: 24rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 700;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.pt-td--ro {
  color: $uni-gray-400;
  font-weight: 500;
}

/* 库存徽标（原稿 pd-badge） */
.pd-badge {
  margin-left: auto;
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}

.pd-badge--ok {
  background: $zx-badge-success-bg;
  color: $zx-badge-success-strong;
}

.pd-badge--warn {
  background: $zx-badge-warning-bg;
  color: $zx-badge-warning-strong;
}

.pd-badge--out {
  background: $zx-badge-danger-bg;
  color: $zx-badge-danger-strong;
}

/* 派生数据行（原稿 f-derived） */
.f-derived {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 32rpx;
  background: $uni-gray-50;
  border-bottom: 1rpx solid $uni-gray-100;
}

.f-derived:last-child {
  border-bottom: none;
}

.fd-label {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.fd-value {
  font-size: 26rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
}

.fd-value--blue {
  color: $uni-color-primary;
}

.fd-value--muted {
  color: $uni-gray-300;
}

/* 分组小标题（标签组用） */
.pd-gtitle--sub {
  margin-top: 8rpx;
}

/* 启用追溯码开关（原稿 sw） */
.sw {
  position: relative;
  width: 88rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: $uni-gray-200;
  transition: background 0.2s;
  flex-shrink: 0;
}

.sw .sw-knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $ai-bg-page;
  box-shadow: 0 2rpx 6rpx $zx-black-180;
  transition: transform 0.2s;
}

/* 开关 on 态：原稿为 success 绿 */
.sw.on {
  background: $zx-green-600;
}

.sw.on .sw-knob {
  transform: translateX(36rpx);
}

/* 商品标签（原稿 tag-box：标签列表 + 回车添加输入框） */
.tag-box {
  padding: 10rpx 32rpx 24rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
}

.tag-item .rm {
  font-size: 28rpx;
  line-height: 1;
  color: $zx-primary-600;
}

/* 标签输入（原稿 tag-input：灰底胶囊，回车添加） */
.tag-input {
  width: 100%;
  min-width: 0;
  height: 68rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: $uni-text-color;
  background: $uni-gray-50;
  border-radius: 999rpx;
  box-sizing: border-box;
}

.pp-sum-n {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 800;
  color: $uni-color-primary;
}

/* 辅单位弹窗（原稿 openUnitPicker） */
.qa-mask {
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

.qa-popup {
  width: 100%;
  background: $uni-bg-color;
  border-radius: 40rpx 40rpx 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.qa-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-100;
  flex-shrink: 0;
}

.qa-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.qa-close {
  font-size: 48rpx;
  color: $uni-gray-400;
  line-height: 1;
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
  width: 140rpx;
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
  text-align: right;
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
  background: $uni-color-primary;
  color: $ai-bg-page;
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

/* 分类选择列表（原稿 openPicker('cat')） */
.qa-list {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.qa-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 40rpx;
  font-size: 30rpx;
  color: $uni-text-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.qa-opt:active {
  background: $uni-gray-50;
}

.qa-opt--sel {
  color: $uni-color-primary;
  font-weight: 700;
}

.qa-opt-ck {
  color: $uni-color-primary;
  font-size: 32rpx;
  font-weight: 800;
}

.qa-empty {
  padding: 48rpx 40rpx;
  font-size: 26rpx;
  color: $uni-gray-400;
  text-align: center;
}

/* 添加辅单位弹层（原稿 openUnitPicker：搜索 + 单位库 chips + 自定义） */
.qa-tip {
  font-size: 14px;
  color: $uni-gray-400;
  padding: 20rpx 40rpx 0;
  line-height: 1.5;
}

.ul-search {
  padding: 20rpx 40rpx 0;
}

.ul-input {
  width: 100%;
  height: 84rpx;
  border-radius: 16rpx;
  background: $uni-gray-50;
  border: 1rpx solid $uni-border-color;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-text-color;
  box-sizing: border-box;
}

.ul-input--row {
  flex: 1;
  min-width: 0;
  width: auto;
}

.md-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 20rpx 40rpx 8rpx;
}

.ul-chip {
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 500;
  color: $uni-text-color-secondary;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
}

.ul-chip:active {
  transform: scale(0.94);
}

/* 已被本商品使用的单位：置灰划线不可选（原稿 .chip.used） */
.ul-chip--used {
  opacity: 0.4;
  text-decoration: line-through;
  pointer-events: none;
}

.ul-empty {
  padding: 32rpx 20rpx;
  text-align: center;
  font-size: 24rpx;
  color: $uni-gray-400;
  line-height: 1.7;
  width: 100%;
}

.md-sep {
  height: 12rpx;
  background: $uni-gray-50;
  border-top: 1rpx solid $uni-gray-100;
  border-bottom: 1rpx solid $uni-gray-100;
  margin-top: 16rpx;
}

.md-subt {
  font-size: 24rpx;
  color: $uni-text-color-secondary;
  font-weight: 600;
  padding: 20rpx 40rpx 16rpx;
}

.md-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  padding: 0 40rpx 24rpx;
}

.md-add-btn {
  flex-shrink: 0;
  height: 84rpx;
  padding: 0 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 600;
  color: $ai-bg-page;
  background: $uni-color-primary;
  border-radius: 16rpx;
}

.md-add-btn:active {
  opacity: 0.85;
}

/* 扫码面板（原稿 openScanner：取景框 + 扫描线动画） */
.sc-cam {
  position: relative;
  height: 504rpx;
  background: $zx-nearblack;
  overflow: hidden;
}

.sc-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sc-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 432rpx;
  height: 236rpx;
  border: 3rpx solid $zx-white-850;
  border-radius: 20rpx;
  overflow: hidden;
}

.sc-c {
  position: absolute;
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid $uni-color-primary;
}

.sc-c--tl {
  left: -3rpx;
  top: -3rpx;
  border-right: none;
  border-bottom: none;
  border-radius: 16rpx 0 0 0;
}

.sc-c--tr {
  right: -3rpx;
  top: -3rpx;
  border-left: none;
  border-bottom: none;
  border-radius: 0 16rpx 0 0;
}

.sc-c--bl {
  left: -3rpx;
  bottom: -3rpx;
  border-right: none;
  border-top: none;
  border-radius: 0 0 0 16rpx;
}

.sc-c--br {
  right: -3rpx;
  bottom: -3rpx;
  border-left: none;
  border-top: none;
  border-radius: 0 0 16rpx 0;
}

.sc-line {
  position: absolute;
  left: 12rpx;
  right: 12rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
  box-shadow: 0 0 16rpx $uni-color-primary;
  animation: scLine 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes scLine {
  0% { top: 12rpx; opacity: 0; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { top: 212rpx; opacity: 0; }
}

.sc-tip {
  text-align: center;
  font-size: 24rpx;
  color: $uni-gray-400;
  padding: 26rpx 32rpx 6rpx;
  line-height: 1.6;
}

.sc-tip-b {
  color: $uni-text-color-secondary;
  font-weight: 600;
}

/* 底栏（原稿 pp-bar：内容状态 + 取消/修改保存；fixed 固定不随页面滚动） */
.pp-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
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

.pp-acts {
  display: flex;
  gap: 20rpx;
  flex-shrink: 0;
}

.pp-btn {
  height: 84rpx;
  padding: 0 40rpx;
  min-width: 150rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 0.6rpx;
  background: $uni-color-primary;
  color: $ai-bg-page;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

.pp-btn:active {
  transform: scale(0.96);
  opacity: 0.85;
}

.pp-btn--ghost {
  background: $uni-gray-50;
  color: $uni-gray-500;
  box-shadow: none;
  border: 1rpx solid $uni-border-color;
}

/* 编辑中无改动：保存置灰不可点（原稿 .pp-btn.dis） */
.pp-btn--dis {
  background: $uni-gray-300;
  box-shadow: none;
  pointer-events: none;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
