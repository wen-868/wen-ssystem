#!/usr/bin/env bash
# QODER-27 反测驱动：每一路「注入⇒红并点名⇒cp 复原⇒SHA 恒等⇒残字归零⇒复跑绿」
# 硬闸：INJECT_EXIT≠0 / VERIFY_EXIT≠0 直接 abort（return 3），绝不把"没落地的注入"算成红。
set -u
TREE=/d/Users/ZXQL/wt-agents/QODER-27
TOOL=/d/Users/ZXQL/wt-agents/_qoder27_setup
RAW=$TREE/docs/evidence/qoder-27/raw/anti
mkdir -p "$RAW"
cd "$TREE/app-mobile" || exit 2
VITEST=../node_modules/vitest/vitest.mjs
LAST_NEW=''

strip() { sed 's/\x1b\[[0-9;]*m//g' "$1"; }

# inject_pair <abs> <file-rel> <old> <new> <log>
inject_pair() {
  local abs=$1 rel=$2 old=$3 new=$4 log=$5
  {
    echo "\$ node inject.cjs inject --file $rel"
    echo "  old=$(printf '%q' "$old")"
    echo "  new=$(printf '%q' "$new")"
  } >> "$log"
  node "$TOOL/inject.cjs" inject --file "$abs" --old "$old" --new "$new" >> "$log" 2>&1
  local i=$?
  echo "INJECT_EXIT=$i" >> "$log"
  [ $i -ne 0 ] && return 3
  node "$TOOL/inject.cjs" verify --file "$abs" --has "$new" --not-has "$old" >> "$log" 2>&1
  local v=$?
  echo "VERIFY_EXIT=$v" >> "$log"
  [ $v -ne 0 ] && return 3
  LAST_NEW=$new
  return 0
}

# run_round <name> <relfile> <spec>   —— 注入对在函数体内按 name 分支硬编码（可读性优先于复用）
run_round() {
  local name=$1 file=$2 spec=$3
  shift 3
  local log=$RAW/$name.log
  local abs="$TREE/app-mobile/$file"
  : > "$log"
  {
    echo "# 反测 $name · 靶文件 $file · 判据 $spec（2026-10-22，Qoder 亲跑）"
    echo
    echo '## 注入前'
    echo '```'
  } >> "$log"
  local sha_before sha_after rc_pair
  sha_before=$(node "$TOOL/inject.cjs" sha --file "$abs" | awk '{print $NF}')
  # 硬闸：SHA 必须是 64 位十六进制，否则 BYTE_IDENTICAL 会拿"空==空"造假证据
  if [ ${#sha_before} -ne 64 ]; then
    echo "SHA_BEFORE=$sha_before（长度 ${#sha_before}）⇒ 量具坏，本轮作废" | tee -a "$log"
    return 7
  fi
  echo "SHA_BEFORE=$sha_before" >> "$log"
  echo '```' >> "$log"

  while [ $# -ge 2 ]; do
    echo '```' >> "$log"
    inject_pair "$abs" "$file" "$1" "$2" "$log"
    rc_pair=$?
    echo '```' >> "$log"
    [ $rc_pair -ne 0 ] && {
      # 半途 abort 也必须复原：pair-1 可能已写盘，否则脏文件会污染后续轮次
      cp "/tmp/q27-$name.bak" "$abs"
      echo "ABORT($name)：注入/回证未通过 ⇒ 本轮读数作废（已 cp 复原靶文件，见上一行 SHA 对照）"
      node "$TOOL/inject.cjs" sha --file "$abs" | awk -v b="$sha_before" '{print ($NF==b)?"ABORT_RESTORE_BYTE_IDENTICAL=true":"ABORT_RESTORE_BYTE_IDENTICAL=FALSE"}'
      return 3
    }
    shift 2
  done

  {
    echo
    echo "## 红跑（判据：$spec 必须 FAILED 且点名用例）"
    echo '```'
    echo "\$ node $VITEST run $spec"
  } >> "$log"
  node "$VITEST" run "$spec" > "$RAW/$name.red.raw.log" 2>&1
  local red_exit=$?
  {
    echo "RED_EXIT=$red_exit（期望 ≠0）"
    echo '—— 剥 ANSI 后的红点名（原文未改写，仅另段摘录）——'
    strip "$RAW/$name.red.raw.log" | grep -E 'FAIL |^ *× |Test Files|Tests +[0-9]|AssertionError|→ ' | head -30
    echo '```'
  } >> "$log"
  if [ $red_exit -eq 0 ]; then
    echo "!! $name 红跑却 EXIT=0 ⇒ 守卫是恒绿摆设，本轮判定失败" >> "$log"
    return 5
  fi

  {
    echo
    echo '## 复原与字节恒等'
    echo '```'
    echo "\$ cp /tmp/q27-$name.bak → $file"
  } >> "$log"
  cp "/tmp/q27-$name.bak" "$abs"
  sha_after=$(node "$TOOL/inject.cjs" sha --file "$abs" | awk '{print $NF}')
  {
    echo "SHA_AFTER=$sha_after"
    if [ "$sha_before" = "$sha_after" ]; then echo 'BYTE_IDENTICAL=true'; else echo 'BYTE_IDENTICAL=FALSE'; fi
    printf '%s' "\$ rg --no-heading -n -F -e '<最后一个注入串>' $file ⇒ "
  } >> "$log"
  rg --no-heading -n -F -e "$LAST_NEW" "$file" > /dev/null 2>&1
  echo "MARKER_RG_EXIT=$?（1=已无残留）" >> "$log"
  echo '```' >> "$log"

  {
    echo
    echo '## 复跑（复原后必须绿）'
    echo '```'
    echo "\$ git status --porcelain $file ⇒ $(git -C "$TREE" status --porcelain -- "$file" | wc -l) 行（0=与 HEAD 一致）"
  } >> "$log"
  node "$VITEST" run "$spec" > "$RAW/$name.green.raw.log" 2>&1
  local green_exit=$?
  {
    echo "GREEN_EXIT=$green_exit（期望 0）"
    strip "$RAW/$name.green.raw.log" | grep -E 'Test Files|Tests +[0-9]'
    echo '```'
  } >> "$log"
  [ $green_exit -ne 0 ] && return 6
  return 0
}

cp "$TREE/app-mobile/src/utils/crypto.ts" /tmp/q27-R-IV.bak
cp "$TREE/app-mobile/src/pages/ai-chat/ai-chat.vue" /tmp/q27-R-TAB.bak
cp "$TREE/app-mobile/src/pages/ai-chat/ai-chat.vue" /tmp/q27-R-REACT.bak
cp "$TREE/app-mobile/src/api/modules/products.ts" /tmp/q27-R-SKU.bak

TAB_TAG_OLD='<app-tab-bar :current="'"'"'ai'"'"'"'
TAB_TAG_NEW='<custom-tab-bar :current="'"'"'ai'"'"'"'
# ★ 工作树是 worktree-crlf 形态：ai-chat.vue 实测 1980 个 CRLF、0 个裸 LF ⇒
#   跨行 needle 必须写 \r\n，写 \n 会 0 命中（injector 的 hits!==1 硬闸正好拦住这种假注入）。
REACT_CLOSE_OLD=$(printf '    streaming: true\r\n  })')
REACT_CLOSE_NEW=$(printf '    streaming: true\r\n  }')

echo "===== R-IV ====="
run_round R-IV src/utils/crypto.ts tests/storage-crypto.spec.ts \
  'if (iv.length !== 12) return null' 'if (false && iv.length !== 12) return null'
echo "R_IV_RC=$?"

echo "===== R-TAB ====="
run_round R-TAB src/pages/ai-chat/ai-chat.vue tests/tabbar-name-reactivity.spec.ts \
  "$TAB_TAG_OLD" "$TAB_TAG_NEW" \
  "components/app-tab-bar.vue'" "components/custom-tab-bar.vue'"
echo "R_TAB_RC=$?"

echo "===== R-REACT ====="
run_round R-REACT src/pages/ai-chat/ai-chat.vue tests/tabbar-name-reactivity.spec.ts \
  'const aiMsg = reactive<ChatMessage>({' 'const aiMsg: ChatMessage = {' \
  "$REACT_CLOSE_OLD" "$REACT_CLOSE_NEW"
echo "R_REACT_RC=$?"

echo "===== R-SKU ====="
run_round R-SKU src/api/modules/products.ts tests/product-sku-dimension.spec.ts \
  '      id: skuId,' '      id: r.spuId ?? r.id,'
echo "R_SKU_RC=$?"
