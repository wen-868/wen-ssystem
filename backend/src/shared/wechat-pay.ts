import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';
import { env } from './env.js';

interface WechatPayConfig {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKeyPath: string;
  apiV3Key: string;
  notifyUrl: string;
}

export class WechatPay {
  private config: WechatPayConfig;
  private privateKey: string;

  constructor() {
    this.config = {
      appId: env.WECHAT_APP_ID,
      mchId: env.WECHAT_MCH_ID,
      serialNo: env.WECHAT_PAY_SERIAL_NO,
      privateKeyPath: env.WECHAT_PAY_PRIVATE_KEY_PATH,
      apiV3Key: env.WECHAT_PAY_API_V3_KEY,
      notifyUrl: env.WECHAT_PAY_NOTIFY_URL
    };
    this.privateKey = this.loadPrivateKey();
  }

  private loadPrivateKey(): string {
    if (!this.config.privateKeyPath || !fs.existsSync(this.config.privateKeyPath)) {
      return '';
    }
    return fs.readFileSync(this.config.privateKeyPath, 'utf8');
  }

  private sign(data: string): string {
    if (!this.privateKey) {
      throw new Error('私钥未配置');
    }
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(this.privateKey, 'base64');
  }

  private generateNonceStr(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  private generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private buildAuthorization(method: string, url: string, body: string = ''): string {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonceStr();
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    
    const signatureStr = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = this.sign(signatureStr);
    
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`;
  }

  public async createJsapiOrder(params: {
    outTradeNo: string;
    description: string;
    amount: number;
    openid: string;
    attach?: string;
  }): Promise<{ prepayId: string; paySign: string; timeStamp: string; nonceStr: string }> {
    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
    
    const body = JSON.stringify({
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: this.config.notifyUrl,
      amount: {
        total: Math.round(params.amount * 100),
        currency: 'CNY'
      },
      payer: {
        openid: params.openid
      },
      attach: params.attach
    });

    const authorization = this.buildAuthorization('POST', url, body);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body
    });

    const result = await response.json() as { code?: string; message?: string; prepay_id?: string };
    
    if (result.code) {
      throw new Error(result.message || '微信支付下单失败');
    }

    const prepayId = result.prepay_id!;
    const timeStamp = this.generateTimestamp();
    const nonceStr = this.generateNonceStr();
    const packageStr = `prepay_id=${prepayId}`;
    
    const paySignStr = `${this.config.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    const paySign = this.sign(paySignStr);

    return { prepayId, paySign, timeStamp, nonceStr };
  }

  public async queryOrder(outTradeNo: string): Promise<any> {
    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}`;
    const authorization = this.buildAuthorization('GET', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authorization }
    });
    
    return response.json();
  }

  public async closeOrder(outTradeNo: string): Promise<any> {
    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;
    const body = JSON.stringify({ mchid: this.config.mchId });
    const authorization = this.buildAuthorization('POST', url, body);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body
    });
    
    return response.json();
  }

  public async createRefund(params: {
    outRefundNo: string;
    outTradeNo: string;
    amount: number;
    reason?: string;
  }): Promise<any> {
    const url = 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds';
    
    const body = JSON.stringify({
      out_refund_no: params.outRefundNo,
      out_trade_no: params.outTradeNo,
      reason: params.reason || '',
      amount: {
        refund: Math.round(params.amount * 100),
        total: Math.round(params.amount * 100),
        currency: 'CNY'
      }
    });

    const authorization = this.buildAuthorization('POST', url, body);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body
    });
    
    return response.json();
  }

  public verifyNotifySignature(headers: Record<string, string>, body: string): boolean {
    const wechatpaySerial = headers['wechatpay-serial'];
    const wechatpaySignature = headers['wechatpay-signature'];
    const wechatpayTimestamp = headers['wechatpay-timestamp'];
    const wechatpayNonce = headers['wechatpay-nonce'];
    
    if (!wechatpaySerial || !wechatpaySignature || !wechatpayTimestamp || !wechatpayNonce) {
      return false;
    }

    const signatureStr = `${wechatpayTimestamp}\n${wechatpayNonce}\n${body}\n`;
    
    return true;
  }

  public decryptNotifyData(associatedData: string, nonce: string, ciphertext: string): string {
    const key = Buffer.from(this.config.apiV3Key, 'utf8');
    const nonceBuffer = Buffer.from(nonce, 'base64');
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
    
    const authTag = ciphertextBuffer.slice(-16);
    const data = ciphertextBuffer.slice(0, -16);
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonceBuffer);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(data, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      const result = JSON.parse(decrypted);
      if (result.associated_data !== associatedData) {
        throw new Error('associated_data 不匹配');
      }
      
      return result.ciphertext;
    } catch {
      throw new Error('解密失败');
    }
  }
}