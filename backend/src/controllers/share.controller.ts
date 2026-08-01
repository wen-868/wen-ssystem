import { ok, fail } from "../shared/response";
import * as shareService from "../services/share.service";
import { env } from "../config/env";

export async function getCollectionLink(req: any, res: any) {
  const link = await shareService.getCollectionLink(req.params.token);
  res.json(ok(link));
}

export async function getCollectionPage(req: any, res: any) {
  const result = await shareService.getCollectionPage(req.params.token);
  if (result.error) {
    res.status(result.status).json(fail(result.error, String(result.status)));
    return;
  }
  res.json(ok(result.data));
}

export async function payCollection(req: any, res: any) {
  const result = await shareService.payCollection(req.params.token);
  res.json(ok(result));
}

export async function wxNotifyCollection(req: any, res: any) {
  const { WechatPay } = await import("../shared/wechat-pay.js");
  const wechatPay = new WechatPay();
  const headers = req.headers as Record<string, string>;
  const bodyStr = JSON.stringify(req.body);

  // Mock 模式（USE_MOCK_DB）下跳过微信签名验证，允许本地/测试环境模拟支付成功回调；
  // 生产环境仍必须通过真实微信签名验证（R71 脚本测试暴露）。
  if (!env.USE_MOCK_DB && !wechatPay.verifyNotifySignature(headers, bodyStr)) {
    res.status(401).json(fail("签名验证失败", "401"));
    return;
  }

  const { resource } = req.body;
  let payNo: string | undefined, transactionId: string | undefined, payAmount: number | undefined;
  if (resource && resource.ciphertext) {
    try {
      const decrypted = wechatPay.decryptNotifyData(resource.associated_data, resource.nonce, resource.ciphertext);
      const data = JSON.parse(decrypted);
      payNo = data.out_trade_no;
      transactionId = data.transaction_id;
      payAmount = data.amount?.payer_total ? Number(data.amount.payer_total) / 100 : undefined;
    } catch {
      res.status(400).json(fail("通知数据解密失败", "400"));
      return;
    }
  } else {
    payNo = req.body.payNo ?? req.body.out_trade_no;
    transactionId = req.body.transactionId ?? req.body.transaction_id;
    payAmount = req.body.payAmount ?? req.body.total_fee;
  }

  const result = await shareService.wxNotifyCollection(req.params.token, {
    payNo,
    transactionId,
    payAmount,
  });

  if (result.error) {
    res.status(result.status).json(fail(result.error, String(result.status)));
    return;
  }

  res.json(ok(result.data));
}
