// ============================================
// DIRECT SUPABASE API (bypasses client auth issues)
// ============================================

const SUPABASE_URL = 'https://csajcdvwmmumhpuzpmuk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYWpjZHZ3bW11bWhwdXpwbXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjA3NjIsImV4cCI6MjA5NjMzNjc2Mn0.A1e_7yMdgm9Yfs4LoZvMH6MAGo_dtxTkRisePjOPl5k'

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function apiFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...HEADERS, ...options.headers }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }

  if (res.status === 204) return null
  return res.json()
}

// ============================================
// GUEST ID MANAGEMENT
// ============================================

export function getGuestId() {
  let guestId = localStorage.getItem('kente_guest_id')
  if (!guestId) {
    guestId = self.crypto?.randomUUID?.() || 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
    localStorage.setItem('kente_guest_id', guestId)
  }
  return guestId
}

// ============================================
// CART CRUD OPERATIONS
// ============================================

export async function addToCart(productId, quantity = 1) {
  try {
    const guestId = getGuestId()

    // Check if item already in cart
    const existing = await apiFetch(
      `cart_items?product_id=eq.${productId}&guest_id=eq.${guestId}&select=id,quantity`,
      { method: 'GET' }
    )

    if (existing && existing.length > 0) {
      const item = existing[0]
      const newQty = item.quantity + quantity
      await apiFetch(
        `cart_items?id=eq.${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ quantity: newQty, updated_at: new Date().toISOString() })
        }
      )
    } else {
      await apiFetch(
        `cart_items`,
        {
          method: 'POST',
          body: JSON.stringify({ guest_id: guestId, product_id: productId, quantity })
        }
      )
    }

    dispatchCartUpdate()
    return true
  } catch (error) {
    console.error('Error adding to cart:', error)
    return false
  }
}

export async function getCartItems() {
  try {
    const guestId = getGuestId()

    const data = await apiFetch(
      `cart_items?guest_id=eq.${guestId}&select=id,quantity,created_at,product_id&order=created_at.desc`
    )

    if (!data || data.length === 0) return []

    // Fetch product details separately (avoids join auth issues)
    const productIds = data.map(item => item.product_id).filter(Boolean)
    if (productIds.length === 0) return []

    const products = await apiFetch(
      `products?id=in.(${productIds.join(',')})`
    )

    const productMap = {}
    if (products) {
      products.forEach(p => { productMap[p.id] = p })
    }

    return data.map(item => ({
      ...item,
      products: productMap[item.product_id] || null
    }))
  } catch (error) {
    console.error('Error fetching cart:', error)
    return []
  }
}

export async function removeFromCart(itemId) {
  try {
    const guestId = getGuestId()

    await apiFetch(
      `cart_items?id=eq.${itemId}&guest_id=eq.${guestId}`,
      { method: 'DELETE' }
    )

    dispatchCartUpdate()
    return true
  } catch (error) {
    console.error('Error removing from cart:', error)
    return false
  }
}

export async function updateCartItemQuantity(itemId, quantity) {
  try {
    if (quantity <= 0) {
      return await removeFromCart(itemId)
    }

    await apiFetch(
      `cart_items?id=eq.${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ quantity, updated_at: new Date().toISOString() })
      }
    )

    dispatchCartUpdate()
    return true
  } catch (error) {
    console.error('Error updating cart item:', error)
    return false
  }
}

export async function clearCart() {
  try {
    const guestId = getGuestId()

    await apiFetch(
      `cart_items?guest_id=eq.${guestId}`,
      { method: 'DELETE' }
    )

    dispatchCartUpdate()
    return true
  } catch (error) {
    console.error('Error clearing cart:', error)
    return false
  }
}

export async function getCartCount() {
  try {
    const guestId = getGuestId()

    const data = await apiFetch(
      `cart_items?guest_id=eq.${guestId}&select=quantity`
    )

    return (data || []).reduce((sum, item) => sum + item.quantity, 0)
  } catch (error) {
    console.error('Error getting cart count:', error)
    return 0
  }
}

export async function getCartSubtotal() {
  try {
    const items = await getCartItems()
    return items.reduce((total, item) => {
      const price = item.products?.price || 0
      return total + price * item.quantity
    }, 0)
  } catch (error) {
    console.error('Error calculating subtotal:', error)
    return 0
  }
}

// ============================================
// STOCK VALIDATION
// ============================================

export async function validateCartStock() {
  try {
    const items = await getCartItems()
    const issues = []
    const updates = []

    for (const item of items) {
      const product = item.products
      if (!product) continue

      const stock = product.stock || 0

      if (stock === 0) {
        issues.push({ item, issue: 'out_of_stock' })
        updates.push(removeFromCart(item.id))
      } else if (item.quantity > stock) {
        issues.push({ item, issue: 'quantity_reduced', newQty: stock })
        updates.push(updateCartItemQuantity(item.id, stock))
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates)
    }

    return issues
  } catch (error) {
    console.error('Error validating cart stock:', error)
    return []
  }
}

export async function hasOutOfStockItems() {
  const issues = await validateCartStock()
  return issues.filter(i => i.issue === 'out_of_stock').length > 0
}

// ============================================
// CART RENDERING
// ============================================

export async function renderCart() {
  const container = document.getElementById('cart-items')
  const emptyEl = document.getElementById('cart-empty')
  const summaryEl = document.getElementById('cart-summary')

  if (!container) return

  // Show loading state
  container.innerHTML = `
    <div class="cart-loading">
      <div class="cart-loader"></div>
      <p>Loading your cart...</p>
    </div>
  `
  if (emptyEl) emptyEl.style.display = 'none'
  if (summaryEl) summaryEl.style.display = 'none'

  // Validate stock first
  await validateCartStock()

  // Fetch cart items
  const items = await getCartItems()

  if (items.length === 0) {
    container.innerHTML = ''
    if (emptyEl) emptyEl.style.display = 'flex'
    if (summaryEl) summaryEl.style.display = 'none'
    return
  }

  // Render items
  container.innerHTML = items.map(item => createCartItemCard(item)).join('')

  // Update summary
  const subtotal = await getCartSubtotal()
  updateCartSummary(subtotal, items.length)

  if (summaryEl) summaryEl.style.display = 'block'

  // Attach event listeners
  attachCartItemListeners()

  // Update navbar count
  updateNavbarCartCount()
}

function createCartItemCard(item) {
  const product = item.products
  if (!product) return ''

  const lineTotal = (product.price || 0) * item.quantity
  const stock = product.stock || 0
  const isStockLow = item.quantity >= stock && stock > 0

  return `
    <div class="cart-item-card" data-item-id="${item.id}" data-product-id="${product.id}">
      <div class="cart-item-img">
        <div class="kente-pattern-bg"></div>
        <div class="cart-item-img-label">
          <span>KL</span>
          <p>${product.fabric_type || 'Product'}</p>
        </div>
      </div>
      <div class="cart-item-details">
        <div class="cart-item-header">
          <div>
            <div class="cart-item-name">${product.name}</div>
            <div class="cart-item-meta">
              <span>${product.region || 'African'}</span>
              ${Array.isArray(product.occasion) ? `<span class="cart-item-occasions">${product.occasion.slice(0, 2).join(' · ')}</span>` : ''}
            </div>
          </div>
          <button class="cart-item-remove" data-item-id="${item.id}" aria-label="Remove item">✕</button>
        </div>
        <div class="cart-item-price">GHS ${(product.price || 0).toLocaleString()}</div>
        <div class="cart-item-controls">
          <div class="quantity-control">
            <button class="qty-btn qty-minus" data-item-id="${item.id}">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn qty-plus" data-item-id="${item.id}" ${isStockLow ? 'disabled' : ''}>+</button>
          </div>
          <div class="cart-item-total">GHS ${lineTotal.toLocaleString()}</div>
        </div>
        ${isStockLow && stock > 0 ? `<div class="cart-item-stock-warning">Only ${stock} in stock</div>` : ''}
        ${stock === 0 ? '<div class="cart-item-stock-warning out">Out of stock — removed</div>' : ''}
      </div>
    </div>
  `
}

function updateCartSummary(subtotal, itemCount) {
  const subtotalEl = document.getElementById('cart-subtotal')
  const countEl = document.getElementById('cart-item-count')
  const checkoutBtn = document.getElementById('checkout-btn')

  if (subtotalEl) subtotalEl.textContent = `GHS ${subtotal.toLocaleString()}`
  if (countEl) countEl.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
}

function attachCartItemListeners() {
  // Remove buttons
  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.target.dataset.itemId
      const card = e.target.closest('.cart-item-card')
      card.style.opacity = '0.3'
      await removeFromCart(itemId)
      await renderCart()
    })
  })

  // Quantity minus
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.target.dataset.itemId
      const valueEl = e.target.parentElement.querySelector('.qty-value')
      let qty = parseInt(valueEl.textContent)
      if (qty > 1) {
        qty--
        valueEl.textContent = qty
        await updateCartItemQuantity(itemId, qty)
        await renderCart()
      } else {
        const card = e.target.closest('.cart-item-card')
        card.style.opacity = '0.3'
        await removeFromCart(itemId)
        await renderCart()
      }
    })
  })

  // Quantity plus
  document.querySelectorAll('.qty-plus:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.target.dataset.itemId
      const valueEl = e.target.parentElement.querySelector('.qty-value')
      let qty = parseInt(valueEl.textContent)
      qty++
      valueEl.textContent = qty
      await updateCartItemQuantity(itemId, qty)
      await renderCart()
    })
  })
}

// ============================================
// NAVBAR CART COUNT
// ============================================

export async function updateNavbarCartCount() {
  try {
    const count = await getCartCount()
    const cartBtns = document.querySelectorAll('.cart-btn')
    cartBtns.forEach(btn => {
      btn.textContent = `Cart (${count})`
    })
  } catch (error) {
    console.error('Error updating cart count:', error)
  }
}

export function initNavbarCart() {
  updateNavbarCartCount()
  window.addEventListener('cartUpdated', () => updateNavbarCartCount())
}

// ============================================
// EVENT DISPATCH
// ============================================

function dispatchCartUpdate() {
  window.dispatchEvent(new CustomEvent('cartUpdated'))
}

export default {
  getGuestId,
  addToCart,
  getCartItems,
  removeFromCart,
  updateCartItemQuantity,
  clearCart,
  getCartCount,
  getCartSubtotal,
  validateCartStock,
  hasOutOfStockItems,
  renderCart,
  updateNavbarCartCount,
  initNavbarCart
}
