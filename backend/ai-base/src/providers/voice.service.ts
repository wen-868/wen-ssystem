/**
 * VoiceService — 语音合成（输出·说，手机端语音对话必备）
 *
 * TTS：微软 Edge TTS WebSocket 协议直连（免费、无需 Key、无第三方依赖，复用 ws），
 *      中文晓晓音色，输出 mp3；文本上限 1000 字（超出截断），单次合成超时兜底。
 * ASR：网关预留（讯飞/阿里等云端识别需配置），当前手机端用系统/浏览器原生识别。
 *
 * 环境变量：TTS_VOICE（可选，默认 zh-CN-XiaoxiaoNeural）、TTS_TIMEOUT_MS
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-16
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

/** Edge TTS WebSocket 端点（TrustedClientToken 为 Edge 公开常量） */
const EDGE_TTS_WSS =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
  '?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

/** 转义 SSML 特殊字符 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 构建 SSML 消息 */
function buildSsml(text: string, voice: string): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
    `<voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>` +
    `${escapeXml(text)}</prosody></voice></speak>`
  );
}

/**
 * Edge TTS 合成（WebSocket 协议）
 *
 * @returns mp3 音频 Buffer；超时/失败抛错
 */
function edgeTts(
  text: string,
  voice: string,
  timeoutMs: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${EDGE_TTS_WSS}${randomUUID()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      },
    });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('TTS 合成超时'));
    }, timeoutMs);

    ws.on('open', () => {
      // 1. speech.config（输出格式 mp3）
      ws.send(
        `X-Timestamp:${new Date().toISOString()}\r\n` +
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
      );
      // 2. ssml 合成请求
      ws.send(
        `X-RequestId:${randomUUID()}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${new Date().toISOString()}Z\r\n` +
          `Path:ssml\r\n\r\n${buildSsml(text, voice)}`,
      );
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        chunks.push(Buffer.from(data as Buffer));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
  });
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 文本转语音（mp3 base64）
   *
   * @param text 待合成文本（≤1000 字）
   * @returns { audioBase64, format }；失败返回 null
   */
  async tts(
    text: string,
  ): Promise<{ audioBase64: string; format: 'mp3' } | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const payload = trimmed.slice(0, 1000);
    const timeoutMs = this.config.get<number>('TTS_TIMEOUT_MS', 20000);
    const voice = this.config.get<string>('TTS_VOICE', DEFAULT_VOICE);

    try {
      const audio = await edgeTts(payload, voice, timeoutMs);
      if (audio.length === 0) {
        this.logger.warn('TTS 合成结果为空');
        return null;
      }
      return { audioBase64: audio.toString('base64'), format: 'mp3' };
    } catch (err) {
      this.logger.warn(
        `TTS 合成失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
