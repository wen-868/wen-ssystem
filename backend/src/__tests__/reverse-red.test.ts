import { describe, it, expect } from "vitest";

describe("S3-50 reverse red test", () => {
  it("forces failure to prove the Backend unit tests gate can go red", () => {
    expect(1).toBe(2);
  });
});
