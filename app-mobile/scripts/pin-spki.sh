#!/usr/bin/env bash
# =====================================================================
# pin-spki.sh — SSL Pinning 证书指纹（SPKI-SHA256）只读采集脚本（QODER-12 交付②）
#
# 职责（只读）：
#   对目标域名发起一次 443 端口 TLS 连接，打印证书链中【叶子证书】与
#   【第一张中间证书】的 SPKI SHA-256（base64）+ notAfter，供人工核对、
#   粘贴到 app-mobile/src/utils/pin-ssl.ts 的 PINNED_CERTS。
#   本脚本不写入任何文件、不修改任何代码、不做任何接线；
#   维护口径与接线前置见 app-mobile/docs/pin-ssl指纹维护口径.md。
#
# 默认域名：api.onepan.cn — 字面抄录自 app-mobile/src/config/env.ts
#   API_BASE_NATIVE 回退值 "https://api.onepan.cn/api"（仅作只读取参考，
#   本脚本不读取源码文件；env.ts 域名变更时请同步修改本脚本默认值）。
#
# 退出码：
#   0 = 采集成功（已打印叶子 + 中间两条指纹）
#   1 = 本机依赖缺失（openssl 不可用）
#   2 = 对端不可达（无网 / DNS 失败 / 端口封锁 / TLS 握手失败 / 未给出证书链）
#   3 = 对端链不足 2 张证书（叶子+中间双指纹无法成对；叶子读数仍会打印）
#   4 = 本机解析失败（链内取证书块失败，或公钥/SPKI 计算失败）
# =====================================================================
set -u

usage() {
  cat <<'USAGE'
用法: bash app-mobile/scripts/pin-spki.sh [域名|-h|--help]
  域名   可选，缺省 api.onepan.cn（直接传裸域名，不带端口与协议）。
  只读：仅打印对端证书链的叶子/中间 SPKI-SHA256 与 notAfter，不写任何文件。
  退出码：0 成功；1 缺 openssl；2 连接/握手失败或未取得链；3 链不足 2 张；4 本机解析失败。
USAGE
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac

HOST="${1:-api.onepan.cn}"
PORT=443

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR[exit 1]: 未找到 openssl，无法采集（本脚本未写入任何文件）。" >&2
  exit 1
fi

echo "TARGET  : ${HOST}:${PORT} (SNI=${HOST}) — 只读采集，不写文件"

chain="$(openssl s_client -showcerts -connect "${HOST}:${PORT}" -servername "${HOST}" </dev/null 2>/dev/null)"
sc_status=$?
cert_count="$(printf '%s\n' "${chain}" | grep -c -- '-----BEGIN CERTIFICATE-----')"

if [ "${sc_status}" -ne 0 ] || [ "${cert_count}" -lt 1 ]; then
  echo "ERROR[exit 2]: 无法连接 ${HOST}:${PORT} 或 TLS 握手失败/对端未给出证书链（无网络、DNS 解析失败、端口封锁、主机不可达、握手中断均属本类）。本脚本未写入任何文件。" >&2
  exit 2
fi

pem_block() {  # $1 = 链内序号（1 = 叶子）；输出该张证书的 PEM
  printf '%s\n' "${chain}" | awk -v want="$1" '
    /-----BEGIN CERTIFICATE-----/ { inblk = 1; n += 1; buf = "" }
    inblk { buf = buf $0 "\n" }
    /-----END CERTIFICATE-----/   { inblk = 0; if (n == want) out = buf }
    END { printf "%s", out }'
}

spki_pin() {   # $1 = PEM；输出 <base64(SHA256(SPKI DER))>，失败时为空
  printf '%s\n' "$1" \
    | openssl x509 -pubkey -noout 2>/dev/null \
    | openssl pkey -pubin -outform der 2>/dev/null \
    | openssl dgst -sha256 -binary \
    | openssl enc -base64 -A 2>/dev/null
}

days_left() {  # $1 = notAfter（openssl 打印格式）；输出剩余天数，无法解析则输出空
  local epoch now
  epoch="$(date -d "$1" +%s 2>/dev/null)" || return 0
  [ -n "${epoch}" ] || return 0
  now="$(date +%s)"
  printf '%s' $(( (epoch - now) / 86400 ))
}

emit_cert() {  # $1 = 角色标签(LEAF/MIDDLE)，$2 = 链内序号
  local label="$1" idx="$2" pem subj endline end pin dl
  pem="$(pem_block "${idx}")"
  if [ -z "${pem}" ]; then
    echo "ERROR[exit 4]: 未能从 ${HOST} 的链中截取第 ${idx} 张（${label}）证书块。未写入文件。" >&2
    exit 4
  fi
  subj="$(printf '%s\n' "${pem}" | openssl x509 -noout -subject 2>/dev/null)"
  endline="$(printf '%s\n' "${pem}" | openssl x509 -noout -enddate 2>/dev/null)"
  end="${endline#notAfter=}"
  pin="$(spki_pin "${pem}")"
  if [ -z "${pin}" ]; then
    echo "ERROR[exit 4]: ${label}（第 ${idx} 张）SPKI-SHA256 计算失败（提取公钥/DER 失败）。未写入文件。" >&2
    exit 4
  fi
  dl="$(days_left "${end}")"
  printf '[%s #%s] %s\n' "${label}" "${idx}" "${subj#subject= }"
  printf '    notAfter : %s\n' "${end}"
  if [ -n "${dl}" ]; then
    printf '    剩余     : %s 天\n' "${dl}"
    if [ "${dl}" -le 30 ]; then
      printf '    WARN     : 剩余 <= 30 天，命中口径文档 §三「到期前 30 天」提醒口径，请与证书轮换同 PR 处理。\n'
    fi
  fi
  printf '    SPKI pin : sha256/%s\n\n' "${pin}"
}

echo "CHAIN   : 对端给出 ${cert_count} 张证书"
emit_cert LEAF 1

if [ "${cert_count}" -lt 2 ]; then
  echo "ERROR[exit 3]: ${HOST} 的链只有 1 张证书，无法按「叶子+中间双指纹成对」口径（见维护口径 §二）打印第二条。叶子读数已在上方，本退出为提示性报警，非接线动作。" >&2
  exit 3
fi
emit_cert MIDDLE 2

echo "RESULT  : 已打印 2 条（叶子 + 中间）。仅供人工核对/粘贴到 app-mobile/src/utils/pin-ssl.ts 的 '${HOST}' 条目。"
echo "          本卡口径【未接线】：接线须先满足维护口径 §五 双前置，本脚本未执行任何写入或接线。"
exit 0
