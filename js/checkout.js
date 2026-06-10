import { apiFetch } from './cart.js'

const TAX_RATE = 0.125
const DELIVERY_FEE = 50
let isSubmitting = false

function getGuestId() {
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

async function fetchCartItems() {
  const guestId = getGuestId()
  const data = await apiFetch(
    `cart_items?guest_id=eq.${guestId}&select=id,quantity,created_at,product_id&order=created_at.desc`
  )
  if (!data || data.length === 0) return []

  const productIds = data.map(item => item.product_id).filter(Boolean)
  if (productIds.length === 0) return []

  const products = await apiFetch(`products?id=in.(${productIds.join(',')})`)
  const productMap = {}
  if (products) products.forEach(p => { productMap[p.id] = p })

  return data.map(item => ({
    ...item,
    products: productMap[item.product_id] || null
  }))
}

async function calcSubtotal() {
  const items = await fetchCartItems()
  return items.reduce((sum, item) => sum + (item.products?.price || 0) * item.quantity, 0)
}

async function clearCart() {
  const guestId = getGuestId()
  await apiFetch(`cart_items?guest_id=eq.${guestId}`, { method: 'DELETE' })
}

async function validateCartStock() {
  const items = await fetchCartItems()
  const updates = []
  for (const item of items) {
    const stock = item.products?.stock || 0
    if (stock === 0) {
      updates.push(apiFetch(`cart_items?id=eq.${item.id}&guest_id=eq.${getGuestId()}`, { method: 'DELETE' }))
    } else if (item.quantity > stock) {
      updates.push(apiFetch(`cart_items?id=eq.${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: stock, updated_at: new Date().toISOString() })
      }))
    }
  }
  if (updates.length > 0) await Promise.all(updates)
}

async function updateNavbarCartCount() {
  const guestId = getGuestId()
  try {
    const data = await apiFetch(`cart_items?guest_id=eq.${guestId}&select=quantity`)
    const count = (data || []).reduce((sum, item) => sum + item.quantity, 0)
    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.textContent = `Cart (${count})`
    })
  } catch (e) {
    console.error('Error updating cart count:', e)
  }
}

export async function loadCheckout() {
  const loadingEl = document.getElementById('checkout-loading')
  const summaryEl = document.getElementById('checkout-summary')
  const formEl = document.getElementById('checkout-form-section')
  const emptyEl = document.getElementById('checkout-empty')

  if (loadingEl) loadingEl.style.display = 'flex'
  if (summaryEl) summaryEl.style.display = 'none'
  if (formEl) formEl.style.display = 'none'
  if (emptyEl) emptyEl.style.display = 'none'

  await validateCartStock()
  const items = await fetchCartItems()

  if (loadingEl) loadingEl.style.display = 'none'

  if (items.length === 0) {
    if (summaryEl) summaryEl.style.display = 'none'
    if (formEl) formEl.style.display = 'none'
    if (emptyEl) emptyEl.style.display = 'flex'
    return
  }

  if (summaryEl) summaryEl.style.display = 'block'
  if (formEl) formEl.style.display = 'block'

  const subtotal = await calcSubtotal()
  renderOrderSummary(items, subtotal)
  setupFormSubmission()
}

function renderOrderSummary(items, subtotal) {
  const container = document.getElementById('checkout-items')
  if (!container) return

  container.innerHTML = items.map(item => {
    const product = item.products
    if (!product) return ''
    const lineTotal = (product.price || 0) * item.quantity
    return `
      <div class="checkout-summary-item">
        <div class="checkout-summary-item-info">
          <span class="checkout-summary-item-name">${product.name}</span>
          <span class="checkout-summary-item-qty">Qty: ${item.quantity}</span>
        </div>
        <span class="checkout-summary-item-total">GHS ${lineTotal.toLocaleString()}</span>
      </div>
    `
  }).join('')

  const tax = Math.round(subtotal * TAX_RATE)
  const total = subtotal + tax + DELIVERY_FEE

  document.getElementById('checkout-subtotal').textContent = `GHS ${subtotal.toLocaleString()}`
  document.getElementById('checkout-tax').textContent = `GHS ${tax.toLocaleString()}`
  document.getElementById('checkout-delivery').textContent = `GHS ${DELIVERY_FEE}`
  document.getElementById('checkout-total').textContent = `GHS ${total.toLocaleString()}`
}

function setupFormSubmission() {
  const form = document.getElementById('checkout-form')
  const submitBtn = document.getElementById('place-order-btn')
  const spinner = document.getElementById('order-spinner')
  const btnText = document.getElementById('order-btn-text')

  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!validateForm()) return

    isSubmitting = true
    if (submitBtn) submitBtn.disabled = true
    if (spinner) spinner.style.display = 'inline-block'
    if (btnText) btnText.textContent = 'Placing Order...'

    try {
      const formData = new FormData(form)
      const items = await fetchCartItems()
      const total = items.reduce((sum, item) => sum + (item.products?.price || 0) * item.quantity, 0)

      const orderResult = await apiFetch('orders', {
        method: 'POST',
        body: JSON.stringify({
          guest_id: getGuestId(),
          user_id: null,
          customer_name: formData.get('full_name'),
          customer_email: formData.get('email'),
          customer_phone: formData.get('phone'),
          delivery_address: formData.get('address'),
          delivery_city: formData.get('city'),
          delivery_region: formData.get('region'),
          notes: formData.get('notes') || '',
          total,
          status: 'pending'
        })
      })

      const orderId = orderResult?.[0]?.id || orderResult?.id

      await Promise.all(
        items.map(item =>
          apiFetch('order_items', {
            method: 'POST',
            body: JSON.stringify({
              order_id: orderId,
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.products?.price || 0
            })
          })
        )
      )

      await clearCart()
      showSuccess(orderId, formData.get('email'))
      updateNavbarCartCount()
    } catch (error) {
      console.error('Order submission failed:', error)
      showFormError('Something went wrong placing your order. Please try again.')
      isSubmitting = false
      if (submitBtn) submitBtn.disabled = false
      if (spinner) spinner.style.display = 'none'
      if (btnText) btnText.textContent = 'Place Order'
    }
  })
}

function validateForm() {
  const form = document.getElementById('checkout-form')
  if (!form) return false

  const fields = ['full_name', 'email', 'phone', 'address', 'city', 'region']
  let valid = true

  fields.forEach(id => {
    const input = form.querySelector(`[name="${id}"]`)
    const errorEl = input?.parentElement?.querySelector('.form-error')
    if (!input) return

    input.style.borderColor = ''
    if (errorEl) errorEl.style.display = 'none'

    if (!input.value.trim()) {
      input.style.borderColor = '#e74c3c'
      if (errorEl) {
        errorEl.style.display = 'block'
        errorEl.textContent = 'This field is required'
      }
      valid = false
    }
  })

  const email = form.querySelector('[name="email"]')
  const emailError = email?.parentElement?.querySelector('.form-error')
  if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    email.style.borderColor = '#e74c3c'
    if (emailError) {
      emailError.style.display = 'block'
      emailError.textContent = 'Please enter a valid email'
    }
    valid = false
  }

  return valid
}

function showSuccess(orderId, email) {
  const summaryEl = document.getElementById('checkout-summary')
  const formEl = document.getElementById('checkout-form-section')
  const successEl = document.getElementById('checkout-success')

  if (summaryEl) summaryEl.style.display = 'none'
  if (formEl) formEl.style.display = 'none'
  if (successEl) {
    successEl.style.display = 'flex'
    console.log('Showing success screen')
  }

  const idEl = document.getElementById('order-confirmation-id')
  const emailEl = document.getElementById('order-confirmation-email')
  if (idEl) idEl.textContent = orderId || 'Confirmed'
  if (emailEl) emailEl.textContent = email || 'your email'
}

function showFormError(message) {
  const errorEl = document.getElementById('checkout-form-error')
  if (errorEl) {
    errorEl.textContent = message
    errorEl.style.display = 'block'
    setTimeout(() => { errorEl.style.display = 'none' }, 5000)
  }
}

export default { loadCheckout }