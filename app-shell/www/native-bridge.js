/**
 * 智享全链 - 原生桥接层
 *
 * 封装 HBuilder 5+App 原生能力，向下兼容浏览器环境。
 * 能力覆盖：持久化存储、缓存管理、原生UI、运行时、网络、设备信息
 *
 * 使用方式：
 *   <script src="native-bridge.js"></script>
 *   然后通过 window.__NATIVE__ 访问所有 API
 */

(function () {
  'use strict';

  // ========== 环境检测 ==========
  var isNative = typeof window.plus !== 'undefined';
  var isAndroid = isNative && /Android/i.test(navigator.userAgent);
  var isIOS = isNative && /iPhone|iPad/i.test(navigator.userAgent);

  // ========== 内部工具 ==========
  function noop() {}

  /**
   * 等待 plus 就绪（HBuilder 5+App 中 plus 异步注入）
   */
  function waitForPlus(callback) {
    if (window.plus) {
      callback();
    } else {
      document.addEventListener('plusready', callback, false);
    }
  }

  // ========== 1. 持久化存储 (plus.storage) ==========
  // 比 localStorage 更可靠：不会被系统清理、容量更大、支持加密
  var Storage = {
    /**
     * 写入存储
     * @param {string} key
     * @param {*} value
     */
    set: function (key, value) {
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      if (isNative) {
        plus.storage.setItem(key, str);
      } else {
        try { localStorage.setItem(key, str); } catch (e) { /* 配额满了 */ }
      }
    },

    /**
     * 读取存储
     * @param {string} key
     * @param {*} fallback 默认值
     * @returns {*}
     */
    get: function (key, fallback) {
      var raw;
      if (isNative) {
        raw = plus.storage.getItem(key);
      } else {
        raw = localStorage.getItem(key);
      }
      if (raw === null || raw === undefined) return fallback !== undefined ? fallback : null;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    },

    /**
     * 删除存储
     * @param {string} key
     */
    remove: function (key) {
      if (isNative) {
        plus.storage.removeItem(key);
      } else {
        localStorage.removeItem(key);
      }
    },

    /**
     * 清空所有存储
     */
    clear: function () {
      if (isNative) {
        plus.storage.clear();
      } else {
        localStorage.clear();
      }
    },

    /**
     * 获取存储占用大小
     * @returns {Promise<number>} 字节数
     */
    getSize: function () {
      return new Promise(function (resolve) {
        if (isNative) {
          plus.storage.getLength(function (length) {
            resolve(length);
          });
        } else {
          var size = 0;
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            size += k.length + (localStorage.getItem(k) || '').length;
          }
          resolve(size * 2); // UTF-16
        }
      });
    },

    /**
     * 获取所有 key 列表
     * @returns {string[]}
     */
    keys: function () {
      var list = [];
      if (isNative) {
        for (var i = 0; i < plus.storage.getLength(); i++) {
          list.push(plus.storage.key(i));
        }
      } else {
        for (var i = 0; i < localStorage.length; i++) {
          list.push(localStorage.key(i));
        }
      }
      return list;
    }
  };

  // ========== 2. 缓存管理 (plus.cache) ==========
  var Cache = {
    /**
     * 计算缓存大小
     * @returns {Promise<number>} 字节数
     */
    calculate: function () {
      return new Promise(function (resolve) {
        if (isNative) {
          plus.cache.calculate(function (size) {
            resolve(size);
          });
        } else {
          resolve(0);
        }
      });
    },

    /**
     * 清除缓存
     * @returns {Promise<void>}
     */
    clear: function () {
      return new Promise(function (resolve) {
        if (isNative) {
          plus.cache.clear(function () {
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    /**
     * 获取缓存目录路径
     * @returns {string}
     */
    getCacheDir: function () {
      if (isNative && plus.io) {
        return '_doc/';
      }
      return '';
    }
  };

  // ========== 3. 原生 UI 控制 ==========
  var UI = {
    /**
     * 显示原生 Toast
     * @param {string} message
     * @param {'short'|'long'} duration
     */
    toast: function (message, duration) {
      duration = duration || 'short';
      if (isNative && plus.nativeUI) {
        plus.nativeUI.toast(message, { duration: duration });
      } else {
        console.log('[Toast]', message);
      }
    },

    /**
     * 显示原生 Loading
     * @param {string} title
     */
    showLoading: function (title) {
      if (isNative && plus.nativeUI) {
        plus.nativeUI.showWaiting(title || '加载中...');
      }
    },

    /**
     * 隐藏原生 Loading
     */
    hideLoading: function () {
      if (isNative && plus.nativeUI) {
        plus.nativeUI.closeWaiting();
      }
    },

    /**
     * 原生确认对话框
     * @param {string} message
     * @param {string} title
     * @returns {Promise<boolean>}
     */
    confirm: function (message, title) {
      return new Promise(function (resolve) {
        if (isNative && plus.nativeUI) {
          plus.nativeUI.confirm(message, function (e) {
            resolve(e.index === 0); // index 0 = 确定按钮
          }, title || '提示', ['确定', '取消']);
        } else {
          resolve(confirm(message));
        }
      });
    },

    /**
     * 原生提示对话框
     * @param {string} message
     * @param {string} title
     * @returns {Promise<void>}
     */
    alert: function (message, title) {
      return new Promise(function (resolve) {
        if (isNative && plus.nativeUI) {
          plus.nativeUI.alert(message, function () {
            resolve();
          }, title || '提示', '确定');
        } else {
          alert(message);
          resolve();
        }
      });
    },

    /**
     * 设置状态栏样式
     * @param {'light'|'dark'} style  light=浅色背景深色文字, dark=深色背景浅色文字
     * @param {string} backgroundColor 背景色 hex
     */
    setStatusBar: function (style, backgroundColor) {
      if (isNative && plus.navigator) {
        plus.navigator.setStatusBarStyle(style || 'dark');
        if (backgroundColor) {
          plus.navigator.setStatusBarBackground(backgroundColor);
        }
      }
    },

    /**
     * 设置屏幕亮度
     * @param {number} brightness 0-1
     */
    setBrightness: function (brightness) {
      if (isNative && plus.screen) {
        plus.screen.setBrightness(brightness);
      }
    },

    /**
     * 振动反馈
     * @param {number} duration 毫秒
     */
    vibrate: function (duration) {
      if (isNative && plus.device) {
        plus.device.vibrate(duration || 50);
      } else if (navigator.vibrate) {
        navigator.vibrate(duration || 50);
      }
    }
  };

  // ========== 4. 运行时信息 ==========
  var Runtime = {
    /**
     * 获取 App 版本信息
     * @returns {{ name: string, code: number }}
     */
    getVersion: function () {
      if (isNative && plus.runtime) {
        return {
          name: plus.runtime.version || '',
          code: parseInt(plus.runtime.versionCode) || 0
        };
      }
      return { name: '1.0.0', code: 100 };
    },

    /**
     * 获取设备信息
     * @returns {object}
     */
    getDeviceInfo: function () {
      if (isNative && plus.device) {
        return {
          imei: plus.device.imei || '',
          imsi: plus.device.imsi || '',
          model: plus.device.model || '',
          vendor: plus.device.vendor || '',
          uuid: plus.device.uuid || '',
          resolution: plus.screen ? plus.screen.resolutionHeight + 'x' + plus.screen.resolutionWidth : ''
        };
      }
      return {
        model: navigator.userAgent,
        vendor: 'Browser',
        uuid: ''
      };
    },

    /**
     * 获取操作系统信息
     * @returns {object}
     */
    getOSInfo: function () {
      if (isNative && plus.os) {
        return {
          name: plus.os.name || '',
          version: plus.os.version || '',
          language: plus.os.language || ''
        };
      }
      return {
        name: 'Browser',
        version: '',
        language: navigator.language || 'zh-CN'
      };
    },

    /**
     * 退出应用
     */
    quit: function () {
      if (isNative && plus.runtime) {
        plus.runtime.quit();
      }
    },

    /**
     * 重启应用
     */
    restart: function () {
      if (isNative && plus.runtime) {
        plus.runtime.restart();
      }
    },

    /**
     * 获取应用启动参数
     * @returns {object}
     */
    getArguments: function () {
      if (isNative && plus.runtime) {
        return plus.runtime.arguments || '';
      }
      return '';
    }
  };

  // ========== 5. 网络状态 ==========
  var Network = {
    /**
     * 获取当前网络类型
     * @returns {Promise<string>} wifi|4g|3g|2g|none|unknown
     */
    getType: function () {
      return new Promise(function (resolve) {
        if (isNative && plus.networkinfo) {
          resolve(plus.networkinfo.getCurrentType());
        } else {
          resolve(navigator.onLine ? 'unknown' : 'none');
        }
      });
    },

    /**
     * 检查是否在线
     * @returns {boolean}
     */
    isOnline: function () {
      if (isNative && plus.networkinfo) {
        return plus.networkinfo.getCurrentType() !== 'none';
      }
      return navigator.onLine;
    },

    /**
     * 监听网络变化
     * @param {function} callback
     */
    onChange: function (callback) {
      if (isNative && plus.networkinfo) {
        document.addEventListener('netchange', function () {
          callback(plus.networkinfo.getCurrentType());
        }, false);
      } else {
        window.addEventListener('online', function () { callback('online'); });
        window.addEventListener('offline', function () { callback('offline'); });
      }
    }
  };

  // ========== 6. 应用更新 ==========
  var Updater = {
    /**
     * 检查更新（需配合服务端 wgt 更新包）
     * @param {string} updateUrl 更新检测地址
     */
    check: function (updateUrl) {
      if (!isNative || !plus.runtime) return;
      plus.runtime.getProperty(plus.runtime.appid, function (info) {
        // 将当前版本信息发送到 updateUrl 进行比对
        // 服务端返回 { hasUpdate: boolean, version: string, url: string, force: boolean }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', updateUrl + '?current=' + info.version + '&code=' + info.versionCode);
        xhr.onload = function () {
          try {
            var res = JSON.parse(xhr.responseText);
            if (res.hasUpdate) {
              // 触发下载更新
              UI.confirm('发现新版本 v' + res.version + '，是否立即更新？', '版本更新')
                .then(function (ok) {
                  if (ok) {
                    plus.runtime.openURL(res.url);
                  }
                });
            }
          } catch (e) { /* 忽略解析错误 */ }
        };
        xhr.send();
      });
    },

    /**
     * 安装 wgt 热更新包
     * @param {string} wgtUrl wgt 包下载地址
     * @returns {Promise<void>}
     */
    installWgt: function (wgtUrl) {
      return new Promise(function (resolve, reject) {
        if (!isNative || !plus.runtime) {
          reject(new Error('非原生环境'));
          return;
        }
        var task = plus.downloader.createDownload(wgtUrl, { filename: '_doc/update/' }, function (d, status) {
          if (status === 200) {
            plus.runtime.install(d.filename, {}, function () {
              resolve();
            }, function (err) {
              reject(err);
            });
          } else {
            reject(new Error('下载失败: ' + status));
          }
        });
        task.start();
      });
    }
  };

  // ========== 7. 系统配置加载 ==========
  var Config = {
    _config: null,

    /**
     * 加载系统配置
     * @returns {Promise<object>}
     */
    load: function () {
      var self = this;
      if (self._config) return Promise.resolve(self._config);

      return fetch('./config.json?t=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (config) {
          self._config = config;
          // 缓存到原生存储
          Storage.set('__sys_config', config);
          return config;
        })
        .catch(function () {
          // 离线时从缓存读取
          var cached = Storage.get('__sys_config');
          if (cached) {
            self._config = cached;
            return cached;
          }
          return {
            environment: 'production',
            apiBaseURL: 'https://api.onepan.cn/api',
            version: '1.0.0',
            versionCode: 100
          };
        });
    },

    /**
     * 获取当前配置
     * @returns {object}
     */
    get: function () {
      return this._config || {};
    },

    /**
     * 获取 API 基础地址
     * @returns {string}
     */
    getApiBase: function () {
      return (this._config && this._config.apiBaseURL) || 'https://api.onepan.cn/api';
    }
  };

  // ========== 构建统一 API ==========
  var NATIVE = {
    // 环境信息
    isNative: isNative,
    isAndroid: isAndroid,
    isIOS: isIOS,

    // 各模块
    storage: Storage,
    cache: Cache,
    ui: UI,
    runtime: Runtime,
    network: Network,
    updater: Updater,
    config: Config,

    /**
     * 初始化（应在应用启动时调用）
     * @returns {Promise<void>}
     */
    init: function () {
      return new Promise(function (resolve) {
        waitForPlus(function () {
          // 更新环境检测
          isNative = true;
          isAndroid = /Android/i.test(navigator.userAgent);
          isIOS = /iPhone|iPad/i.test(navigator.userAgent);
          NATIVE.isNative = true;
          NATIVE.isAndroid = isAndroid;
          NATIVE.isIOS = isIOS;

          // 加载系统配置
          Config.load().then(function () {
            // 应用系统配置中的状态栏设置
            var cfg = Config.get();
            if (cfg.statusBar) {
              UI.setStatusBar(cfg.statusBar.style, cfg.statusBar.backgroundColor);
            }
            resolve();
          }).catch(function () {
            resolve();
          });
        });
      });
    }
  };

  // 暴露到全局
  window.__NATIVE__ = NATIVE;

  // 兼容旧代码：同步 localStorage 和原生存储
  if (isNative) {
    // 将关键 token 从 localStorage 迁移到原生存储
    var token = localStorage.getItem('merchant_token');
    if (token) {
      plus.storage.setItem('merchant_token', token);
    }
    var user = localStorage.getItem('merchant_user');
    if (user) {
      plus.storage.setItem('merchant_user', user);
    }
  }
})();