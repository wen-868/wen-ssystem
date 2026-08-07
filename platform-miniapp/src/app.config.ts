export default {
  pages: [
    'pages/index/index',
    'pages/plans/index',
    'pages/subscribe/index',
    'pages/my-applications/index',
    'pages/about/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#1e3a8a',
    navigationBarTitleText: '智享全链',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f7fa'
  },
  tabBar: {
    color: '#8a94a6',
    selectedColor: '#2563eb',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/plans/index',
        text: '套餐'
      },
      {
        pagePath: 'pages/my-applications/index',
        text: '我的申请'
      }
    ]
  },
  style: 'v2',
  sitemapLocation: 'sitemap.json'
}
