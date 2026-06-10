import { describe, expect, it } from "vitest";
import { makeBizNo, makeToken } from "../shared/id.js";

describe("业务编号工具", () => {
  it("按指定前缀生成业务编号", () => {
    const no = makeBizNo("DD");
    expect(no).toMatch(/^DD\d{14}[A-F0-9]{6}$/);
  });

  it("生成 48 位随机 token", () => {
    expect(makeToken()).toMatch(/^[a-f0-9]{48}$/);
  });
});
