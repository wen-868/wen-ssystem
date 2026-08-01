const path = require('path')

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
    BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE || '')
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
    data: `@import "@/styles/variables.scss";`
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
