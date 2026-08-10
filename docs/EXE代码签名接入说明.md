# EXE 代码签名接入说明

> 目标：让 Windows 安装 `智享全链管理系统` EXE 时不再提示"未知发布者"，可对外正式分发。

## 一、为什么需要代码签名证书

- Windows 对未签名的 EXE 会显示 SmartScreen"未知发布者"警告，影响商家安装信任度。
- 代码签名证书由受信任的 CA（证书颁发机构）签发后，安装时会显示"发布者：深圳市宝安区智享全链软件工作室"。
- **自签名证书无法消除该提示**（系统不信任），必须使用 CA 签发的证书。

## 二、证书选择（OV / EV / Azure Trusted Signing）

| 类型 | 费用（约） | 周期 | 说明 |
|------|-----------|------|------|
| OV 代码签名 | 数百~数千元/年 | 1~3 个工作日 | 需营业执照等主体审核，性价比高，推荐 |
| EV 代码签名 | 数千元/年 | 需 USB Key | 首次运行即可获得更高信任，价格贵、流程重 |
| Azure Trusted Signing | 按用量 | 当天 | 微软云签名，无需 USB Key，与 signtool 集成，适合长期自动化 |

## 三、购买与获取证书（需你本人操作）

1. 选择 CA：DigiCert / Sectigo / GlobalSign，或国内渠道：腾讯云（数字证书）、CFCA、亚洲诚信。
2. 提交主体资料：营业执照（个体工商户执照即可）、经营者身份信息、联系方式；部分 CA 需要电话/邮件确认。
3. 收到证书后，用私钥导出 **.pfx 文件** 并设置 **私钥密码**（妥善保管，丢失无法找回）。

## 四、接入打包（已预埋，证书到手即可用）

### GitHub Actions（CI 自动签名）

仓库 → Settings → Secrets and variables → Actions，新增两个 Secret：

| Secret 名 | 值 |
|-----------|-----|
| `CSC_LINK` | pfx 文件的 base64 内容，或可下载的 URL |
| `CSC_KEY_PASSWORD` | pfx 私钥密码 |

base64 生成（本地）：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\code-sign.pfx"))
```

配置后推送代码，`Build Windows EXE` 工作流会自动签名（electron-builder 已读取这两个环境变量）。

### 本地打包签名

```powershell
$env:CSC_LINK = "C:\path\code-sign.pfx"          # 本地可直接用文件路径
$env:CSC_KEY_PASSWORD = "你的私钥密码"
cd admin-web
npx electron-builder --win --publish=never
```

## 五、验证签名

```powershell
Get-AuthenticodeSignature "admin-web\release\智享全链管理系统 Setup 0.1.0.exe"
# Status 应为 Valid，SignerCertificate 为你的证书
```

## 六、其他说明

- 证书到期前需续费并更新 Secrets，否则签名失效（Windows 仍可运行，但提示会回来）。
- 未配置 Secrets 时，当前工作流会照常产出**未签名**版本，不影响内部测试。
- 若使用 Azure Trusted Signing，另行接入 `signtool` 脚本（需要 Azure 订阅），可联系维护。
