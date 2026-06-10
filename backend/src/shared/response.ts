export function ok<T>(data?: T) {
  return { code: "0", message: "成功", data };
}

export function fail(message: string, code = "400") {
  return { code, message };
}
