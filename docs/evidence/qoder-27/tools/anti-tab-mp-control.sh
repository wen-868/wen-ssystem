#!/usr/bin/env bash
# QODER-27 反测加测 R-TAB-B：给"MP 撞名警告 0"这条读数做**正对照**（防假 0）。
# 复现 25 卡原始缺陷条件：①组件文件名回到 src/components/custom-tab-bar.vue（easycom 会把保留名标签映射到它）
#                              ②AI 页标签与 import 同时注回 custom-tab-bar。
# 判据：mp-weixin 构建日志里撞名警告必须从 0 变成非 0（否则我的"0"读数不可证伪）。
set -u
TREE=/d/Users/ZXQL/wt-agents/QODER-27
TOOL=/d/Users/ZXQL/wt-agents/_qoder27_setup
RAW=$TREE/docs/evidence/qoder-27/raw/anti
LOG=$RAW/R-TAB-B.log
cd "$TREE/app-mobile" || exit 2
AI=src/pages/ai-chat/ai-chat.vue
: > "$LOG"

{
  echo "# 反测加测 R-TAB-B · MP 保留名警告正对照（2026-10-22，Qoder 亲跑）"
  echo
  echo "目的：raw/22 读到「mp-weixin 构建日志里 custom-tab-bar 命中 0」——0 读数必须有正对照才算可证伪。"
  echo '```'
} >> "$LOG"

cp "$AI" /tmp/q27-R-TAB-B.bak
cp src/components/app-tab-bar.vue src/components/custom-tab-bar.vue
echo "\$ cp src/components/app-tab-bar.vue src/components/custom-tab-bar.vue（复现 25 卡缺陷形态）" >> "$LOG"
node "$TOOL/inject.cjs" inject --file "$TREE/app-mobile/$AI" \
  --old '<app-tab-bar :current="'"'"'ai'"'"'"' \
  --new '<custom-tab-bar :current="'"'"'ai'"'"'"' >> "$LOG" 2>&1
I1=$?
node "$TOOL/inject.cjs" inject --file "$TREE/app-mobile/$AI" \
  --old "components/app-tab-bar.vue'" \
  --new "components/custom-tab-bar.vue'" >> "$LOG" 2>&1
I2=$?
echo "INJECT_EXIT_TAG=$I1 INJECT_EXIT_IMPORT=$I2" >> "$LOG"
if [ $I1 -ne 0 ] || [ $I2 -ne 0 ]; then
  echo "ABORT：注入未落地 ⇒ 正对照作废" >> "$LOG"
  rm -f src/components/custom-tab-bar.vue
  cp /tmp/q27-R-TAB-B.bak "$AI"
  exit 3
fi

npm run build:mp-weixin > "$RAW/R-TAB-B.build.raw.log" 2>&1
BUILD_EXIT=$?
sed 's/\x1b\[[0-9;]*m//g' "$RAW/R-TAB-B.build.raw.log" > "$RAW/R-TAB-B.build.log"
{
  echo '```'
  echo '## 正对照读数'
  echo '```'
  echo "\$ BUILD_EXIT_mp-weixin=$BUILD_EXIT"
  echo -n "\$ grep -c 'custom-tab-bar' = "
  grep -c 'custom-tab-bar' "$RAW/R-TAB-B.build.log"
  echo -n "\$ grep -cE '专用组件|已内置|保留名' = "
  grep -cE '专用组件|已内置|保留名' "$RAW/R-TAB-B.build.log"
  echo '—— 命中行原文（最多 12 行）——'
  grep -nE 'custom-tab-bar|专用组件|已内置|保留名' "$RAW/R-TAB-B.build.log" | head -12
  echo '```'
} >> "$LOG" 2>&1

{
  echo
  echo '## 复原'
  echo '```'
  rm -f src/components/custom-tab-bar.vue
  echo "\$ rm -f src/components/custom-tab-bar.vue"
  cp /tmp/q27-R-TAB-B.bak "$AI"
  echo "\$ cp /tmp/q27-R-TAB-B.bak $AI"
  echo "EXTRA_FILE_GONE=$([ -f src/components/custom-tab-bar.vue ] && echo FALSE || echo true)"
  echo -n "\$ git status --porcelain app-mobile ⇒ "
  git -C "$TREE" status --porcelain -- app-mobile | wc -l
  echo -n "\$ git ls-files --others --exclude-standard app-mobile ⇒ "
  git -C "$TREE" ls-files --others --exclude-standard -- app-mobile | wc -l
  echo '```'
} >> "$LOG" 2>&1
exit 0
