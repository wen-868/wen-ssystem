# 智享打印助手（本地原生打印客户端）

热敏小票 / 针式 / A4 / 标签打印的本地原生服务。常驻系统托盘，工作台与收银台通过
本地 HTTP 服务（默认 `http://127.0.0.1:5178`）调用，直出本机打印机。

## 功能

- 系统托盘常驻，所有窗口关闭不退出，可开机自启（Windows 安装版自动配置）
- 本地 HTTP 服务：健康检查 / 打印机枚举 / 静默打印 / 原始指令通道（ESC/POS）
- 设置窗口：默认打印机、份数、测试打印、服务状态
- 静默直出：打印不弹系统对话框，适合收银小票、针式单据、标签

## HTTP API

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/health` | GET | 服务状态（ok/版本/当前打印机） |
| `/printers` | GET | 本机打印机列表 |
| `/print` | POST | 静默打印 HTML：`{ html, printerName?, copies? }` |
| `/print-raw` | POST | 原始指令打印：`{ base64, printerName? }`（ESC/POS，Windows） |

所有接口允许跨域（CORS `*`），仅监听 `127.0.0.1`，不对外网开放。

## 开发

```bash
npm install
npm run build       # 编译 TS + 拷贝设置窗口静态资源
npm run dev         # 编译后启动 Electron
```

冒烟自检（不弹界面）：

```powershell
$env:ZX_PRINT_AGENT_SMOKE='1'
.\node_modules\.bin\electron.cmd . --no-sandbox
```

## 打包发布

```bash
npm run dist           # 生成 NSIS 安装包 + 便携版
npm run dist:portable  # 仅便携版
```

产物输出到 `release/`：

- `智享打印助手-1.0.0-setup.exe`（安装版，推荐门店部署）
- `智享打印助手-1.0.0-portable.exe`（免安装版，临时终端）

## 与工作台对接

1. 门店电脑安装并启动打印助手（托盘常驻）
2. 工作台「系统设置 → 打印模板 → 本机打印设置」：
   - 开启「本地打印助手」
   - 点击「检测」确认服务在线（默认 `http://127.0.0.1:5178`）
   - 选择本机默认打印机
3. 收银结算后小票自动直出；单据打印走销售单/标签等模板

## 目录结构

```text
print-agent/
  src/
    main.ts              # 主进程：HTTP 服务 / 托盘 / 静默打印 / 原始指令
    preload.ts           # 设置窗口安全桥接
    renderer/            # 设置窗口（原生 HTML/TS）
  scripts/copy-renderer.js  # 构建时拷贝设置窗口静态资源
```
