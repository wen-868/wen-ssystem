#!/usr/bin/env bash
# ============================================================
# 进程内存 / 缓存命中率采样脚本（验收项：内存曲线 / 缓存命中率）
# 用法：bash deploy/memory-sample.sh   （配合 cron 每小时采样）
# 建议 cron：0 * * * * root bash /opt/zhixiang/liquor-inventory-system/deploy/memory-sample.sh >> /var/log/zhixiang-memory.log 2>&1
# ============================================================
set -euo pipefail

TS="$(date '+%F %T')"
API_RSS=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const p=a.find(x=>x.name==='zhixiang-api');console.log(p?Math.round(p.monit.memory/1048576):'N/A')})" 2>/dev/null || echo "N/A")
AI_RSS=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const p=a.find(x=>x.name==='zhixiang-ai-base');console.log(p?Math.round(p.monit.memory/1048576):'N/A')})" 2>/dev/null || echo "N/A")

if redis-cli ping >/dev/null 2>&1; then
  HITS=$(redis-cli INFO stats 2>/dev/null | grep '^keyspace_hits:' | cut -d: -f2 | tr -d '\r')
  MISSES=$(redis-cli INFO stats 2>/dev/null | grep '^keyspace_misses:' | cut -d: -f2 | tr -d '\r')
  RATE="N/A"
  if [[ "${HITS}" =~ ^[0-9]+$ ]] && [[ "${MISSES}" =~ ^[0-9]+$ ]] && [[ $((HITS + MISSES)) -gt 0 ]]; then
    RATE=$(awk "BEGIN{printf \"%.1f%%\", ${HITS}*100/(${HITS}+${MISSES})}")
  fi
else
  HITS="N/A"; MISSES="N/A"; RATE="N/A"
fi

echo "${TS} api_rss=${API_RSS}MB ai_base_rss=${AI_RSS}MB redis_hits=${HITS} misses=${MISSES} hit_rate=${RATE}"
