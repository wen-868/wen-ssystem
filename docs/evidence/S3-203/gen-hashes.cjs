/**
 * S3-203 证据脚本 ①：账号口径统一所需的 bcrypt 哈希生成（v2$ 前缀口径，与 backend/src/shared/password.ts 一致）
 *
 * 用途：生成迁移 200 所需的哈希值。明文口令**只写在本脚本的运行输出里**（不入仓的 `S3-203-new-passwords.txt`），
 * 仓内文件只落哈希。复跑命令：node docs/evidence/S3-203/gen-hashes.cjs
 */
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const SALT_ROUNDS = 12;
const PREFIX = "v2$";

/** 生成满足「≥大写+小写+数字+特殊字符」的强口令 */
function strongPassword(len) {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnopqrstuvwxyz";
  const D = "23456789";
  const S = "!@#$%^&*-_=+";
  const all = U + L + D + S;
  const pick = (s) => s[crypto.randomInt(s.length)];
  const out = [pick(U), pick(L), pick(D), pick(S)];
  while (out.length < len) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

const hash = (pw) => PREFIX + bcrypt.hashSync(pw, SALT_ROUNDS);
const verify = (pw, h) => bcrypt.compareSync(pw, h.slice(PREFIX.length));

const ADMIN_PW = "admin@2026";
const SM_PW = strongPassword(16);
const SO_PW = strongPassword(16);
const DEMO_OLD_PW = "Demo@2026";

const HASH_ADMIN = hash(ADMIN_PW);
const HASH_SM = hash(SM_PW);
const HASH_SO = hash(SO_PW);
const HASH_DEMO_RANDOM = hash(strongPassword(24));

// 自证：哈希与口令对应关系正确、旧口径口令确实不匹配新哈希
const checks = {
  admin_hash_matches_admin_2026: verify(ADMIN_PW, HASH_ADMIN),
  admin_hash_rejects_old_demo_password: !verify(DEMO_OLD_PW, HASH_ADMIN),
  store_manager_hash_matches_new_password: verify(SM_PW, HASH_SM),
  store_manager_hash_rejects_old_demo_password: !verify(DEMO_OLD_PW, HASH_SM),
  store_operator_hash_matches_new_password: verify(SO_PW, HASH_SO),
  store_operator_hash_rejects_old_demo_password: !verify(DEMO_OLD_PW, HASH_SO),
};

if (Object.values(checks).some((v) => v !== true)) {
  console.error("FATAL: 哈希自证未全部通过", checks);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      note: "明文口令见同目录 S3-203-new-passwords.txt（不入仓）；本文件只落哈希与自证结果",
      alg: { bcrypt_cost: SALT_ROUNDS, prefix: PREFIX },
      hashes: {
        HASH_ADMIN,
        HASH_STORE_MANAGER: HASH_SM,
        HASH_STORE_OPERATOR: HASH_SO,
        HASH_DEMO_RANDOM,
      },
      checks,
    },
    null,
    2
  )
);

// 明文写入 stdout 之外的第二通道，便于人工转交；不写入任何被 git 跟踪的文件
console.error(
  JSON.stringify({
    ADMIN_PW,
    STORE_MANAGER_PW: SM_PW,
    STORE_OPERATOR_PW: SO_PW,
  })
);
