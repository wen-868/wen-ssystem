import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Taro from '@tarojs/taro'

export interface CartItem {
  id: number
  productId: number
  productName: string
  productImage: string
  skuId?: number
  skuName?: string
  price: number
  originalPrice?: number
  quantity: number
  selected: boolean
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const selectedCount = computed(() => {
    return items.value.reduce((sum, item) => item.selected ? sum + item.quantity : sum, 0)
  })

  const selectedTotal = computed(() => {
    return items.value.reduce((sum, item) => item.selected ? sum + item.price * item.quantity : sum, 0)
  })

  const addItem = (item: Omit<CartItem, 'id' | 'selected'>) => {
    const existingItem = items.value.find(
      i => i.productId === item.productId && i.skuId === item.skuId
    )

    if (existingItem) {
      existingItem.quantity += item.quantity
    } else {
      items.value.push({
        ...item,
        id: Date.now(),
        selected: true
      })
    }
    saveToStorage()
  }

  const removeItem = (id: number) => {
    const index = items.value.findIndex(i => i.id === id)
    if (index > -1) {
      items.value.splice(index, 1)
    }
    saveToStorage()
  }

  const updateQuantity = (id: number, quantity: number) => {
    const item = items.value.find(i => i.id === id)
    if (item) {
      item.quantity = Math.max(1, quantity)
    }
    saveToStorage()
  }

  const toggleSelect = (id: number) => {
    const item = items.value.find(i => i.id === id)
    if (item) {
      item.selected = !item.selected
    }
    saveToStorage()
  }

  const toggleSelectAll = () => {
    const allSelected = items.value.every(item => item.selected)
    items.value.forEach(item => {
      item.selected = !allSelected
    })
    saveToStorage()
  }

  const clearSelected = () => {
    items.value = items.value.filter(item => !item.selected)
    saveToStorage()
  }

  const clearCart = () => {
    items.value = []
    saveToStorage()
  }

  const saveToStorage = () => {
    try {
      Taro.setStorageSync('cartItems', JSON.stringify(items.value))
    } catch (error) {
      console.error('Failed to save cart to storage:', error)
    }
  }

  const loadFromStorage = () => {
    try {
      const savedItems = Taro.getStorageSync('cartItems')
      if (savedItems) {
        items.value = JSON.parse(savedItems)
      }
    } catch (error) {
      console.error('Failed to load cart from storage:', error)
      items.value = []
    }
  }

  return {
    items,
    totalCount,
    selectedCount,
    selectedTotal,
    addItem,
    removeItem,
    updateQuantity,
    toggleSelect,
    toggleSelectAll,
    clearSelected,
    clearCart,
    loadFromStorage
  }
})
