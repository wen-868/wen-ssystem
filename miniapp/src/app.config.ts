export default {
  pages: [
    'pages/index/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/profile/index',
    'pages/order/list/index',
    'pages/order/detail/index',
    'pages/order/confirm/index',
    'pages/order/pay/index',
    'pages/order/track/index',
    'pages/member/index',
    'pages/address/list/index',
    'pages/address/edit/index',
    'pages/coupon/list/index',
    'pages/coupon/center/index',
    'pages/aftersale/apply/index',
    'pages/aftersale/list/index',
    'pages/aftersale/detail/index',
    'pages/points/index',
    'pages/points/records',
    'pages/stored/index',
    'pages/stored/recharge',
    'pages/setting/index',
    'pages/setting/profile-edit',
    'pages/setting/password',
    'pages/about/index',
    'pages/wholesale/index',
    'pages/wholesale/product/index',
    'pages/wholesale/cart/index',
    'pages/wholesale/order-list/index',
    'pages/wholesale/order-detail/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '智享全链',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#4080ff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png'
      },
      {
        pagePath: 'pages/category/index',
        text: '分类',
        iconPath: 'assets/tab/category.png',
        selectedIconPath: 'assets/tab/category-active.png'
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
        iconPath: 'assets/tab/cart.png',
        selectedIconPath: 'assets/tab/cart-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png'
      }
    ]
  },
  style: 'v2',
  sitemapLocation: 'sitemap.json'
}
