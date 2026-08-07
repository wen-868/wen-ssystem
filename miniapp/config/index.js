const path = require('path')
const { resolveThemeId, resolveTheme } = require('./resolve-theme')

// 编译期主题（R96-01）：UNI_THEME ∈ {a, b, c}，默认 a
const themeId = resolveThemeId()
const theme = resolveTheme()

const config = {
  projectName: '智享全链小程序',
  date: '2026-07-13',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-vue3', '@tarojs/plugin-html'],
  defineConstants: {
    // API 地址通过环境变量注入（Taro 构建期替换），源码不写死域名，避免正式包泄漏本地地址
    BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE || ''),
    // 当前主题配置（R96-01）：品牌文案等随模板切换
    __THEME__: JSON.stringify(theme)
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'vue3',
  compiler: 'webpack5',
  cache: {
    enable: false
  },
  sass: {
    // 主题变量按 UNI_THEME 全局注入（R96-01），默认 theme-a
    data: `@import "@/styles/themes/theme-${themeId}.scss";`
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 10240
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    optimizeMainPackage: {
      enable: true
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    devServer: {
      port: 10086,
      hot: true
    }
  },
  alias: {
    '@': path.resolve(__dirname, '../src')
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
