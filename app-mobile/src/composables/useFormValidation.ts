/**
 * 通用表单校验 composable
 * 为 uni-app 提供类似 Element Plus el-form 的三件套能力：ref + :model + :rules
 * 用法：const { errors, validate, formRef } = useFormValidation(formModel, rules)
 */
import { ref, reactive } from 'vue'

export interface Rule {
  /** 是否必填 */
  required?: boolean
  /** 错误提示消息 */
  message?: string
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 正则校验 */
  pattern?: RegExp
  /** 自定义校验函数，返回 true 表示通过 */
  validator?: (value: any, model: Record<string, any>) => boolean
}

export interface Rules {
  [field: string]: Rule[]
}

export function useFormValidation<T extends Record<string, any>>(model: T, rules: Rules) {
  const errors = reactive<Record<string, string>>({})
  const formRef = ref<any>(null)

  /** 校验所有字段，返回是否通过 */
  function validate(): boolean {
    // 清空已有错误
    Object.keys(errors).forEach(key => delete errors[key])

    let valid = true
    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = model[field]
      for (const rule of fieldRules) {
        // 必填校验
        if (rule.required) {
          const isEmpty = value === undefined || value === null || String(value).trim() === ''
          if (isEmpty) {
            errors[field] = rule.message || `${field}不能为空`
            valid = false
            break
          }
        }
        // 跳过非必填且值为空的字段
        if (value === undefined || value === null || value === '') {
          continue
        }
        // 最小长度
        if (rule.minLength !== undefined && String(value).length < rule.minLength) {
          errors[field] = rule.message || `${field}长度不能少于${rule.minLength}位`
          valid = false
          break
        }
        // 最大长度
        if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
          errors[field] = rule.message || `${field}长度不能超过${rule.maxLength}位`
          valid = false
          break
        }
        // 正则校验
        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors[field] = rule.message || `${field}格式不正确`
          valid = false
          break
        }
        // 自定义校验
        if (rule.validator && !rule.validator(value, model)) {
          errors[field] = rule.message || `${field}校验失败`
          valid = false
          break
        }
      }
    }
    return valid
  }

  /** 校验单个字段 */
  function validateField(field: string): boolean {
    delete errors[field]
    const fieldRules = rules[field]
    if (!fieldRules) return true

    const value = model[field]
    for (const rule of fieldRules) {
      if (rule.required) {
        const isEmpty = value === undefined || value === null || String(value).trim() === ''
        if (isEmpty) {
          errors[field] = rule.message || `${field}不能为空`
          return false
        }
      }
      if (value === undefined || value === null || value === '') continue
      if (rule.minLength !== undefined && String(value).length < rule.minLength) {
        errors[field] = rule.message || `${field}长度不能少于${rule.minLength}位`
        return false
      }
      if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
        errors[field] = rule.message || `${field}长度不能超过${rule.maxLength}位`
        return false
      }
      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors[field] = rule.message || `${field}格式不正确`
        return false
      }
      if (rule.validator && !rule.validator(value, model)) {
        errors[field] = rule.message || `${field}校验失败`
        return false
      }
    }
    return true
  }

  /** 清除指定字段错误 */
  function clearError(field: string) {
    delete errors[field]
  }

  /** 清除所有错误 */
  function clearAllErrors() {
    Object.keys(errors).forEach(key => delete errors[key])
  }

  return { errors, validate, validateField, clearError, clearAllErrors, formRef }
}