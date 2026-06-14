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
  setupPaymentMethodToggle()
  setupCardInputFormatting()
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

function setupPaymentMethodToggle() {
  const radios = document.querySelectorAll('input[name="payment_method"]')
  const mobileForm = document.getElementById('payment-form-mobile')
  const visaForm = document.getElementById('payment-form-visa')
  const cards = document.querySelectorAll('.payment-method-card')

  function togglePayment(value) {
    cards.forEach(c => c.classList.remove('active'))
    if (value === 'mobile_money') {
      cards[0]?.classList.add('active')
      if (mobileForm) mobileForm.style.display = 'block'
      if (visaForm) visaForm.style.display = 'none'
    } else if (value === 'visa') {
      cards[1]?.classList.add('active')
      if (mobileForm) mobileForm.style.display = 'none'
      if (visaForm) visaForm.style.display = 'block'
    }
  }

  togglePayment('mobile_money')

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) togglePayment(radio.value)
    })
  })
}

function setupCardInputFormatting() {
  const cardNumber = document.getElementById('card_number')
  const cardExpiry = document.getElementById('card_expiry')

  if (cardNumber) {
    cardNumber.addEventListener('input', () => {
      let val = cardNumber.value.replace(/\D/g, '').slice(0, 16)
      val = val.replace(/(.{4})/g, '$1 ').trim()
      cardNumber.value = val
    })
  }

  if (cardExpiry) {
    cardExpiry.addEventListener('input', () => {
      let val = cardExpiry.value.replace(/\D/g, '').slice(0, 4)
      if (val.length >= 3) {
        val = val.slice(0, 2) + '/' + val.slice(2)
      }
      cardExpiry.value = val
    })
  }
}

function setupFormSubmission() {
  const form = document.getElementById('checkout-form')
  const submitBtn = document.getElementById('place-order-btn')
  const spinner = document.getElementById('order-spinner')
  const btnText = document.getElementById('order-btn-text')
  const processingEl = document.getElementById('checkout-processing')

  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!validateForm()) return

    showProcessing(processingEl)

    isSubmitting = true
    if (submitBtn) submitBtn.disabled = true
    if (spinner) spinner.style.display = 'inline-block'
    if (btnText) btnText.textContent = 'Placing Order...'

    await new Promise(resolve => setTimeout(resolve, 2500))

    try {
      const formData = new FormData(form)
      const items = await fetchCartItems()
      const total = items.reduce((sum, item) => sum + (item.products?.price || 0) * item.quantity, 0)
      const paymentMethod = formData.get('payment_method')

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
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: 'paid'
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
      hideProcessing(processingEl)
      showSuccess(orderId, formData.get('email'))
      updateNavbarCartCount()
    } catch (error) {
      console.error('Order submission failed:', error)
      hideProcessing(processingEl)
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

  const paymentMethod = form.querySelector('input[name="payment_method"]:checked')
  if (!paymentMethod) {
    showFormError('Please select a payment method')
    valid = false
  } else if (paymentMethod.value === 'mobile_money') {
    valid = validateMobilePayment(form) && valid
  } else if (paymentMethod.value === 'visa') {
    valid = validateVisaPayment(form) && valid
  }

  return valid
}

function validateMobilePayment(form) {
  let valid = true
  const network = form.querySelector('[name="mobile_network"]')
  const phone = form.querySelector('[name="mobile_phone"]')
  const netError = network?.parentElement?.querySelector('.form-error')
  const phoneError = phone?.parentElement?.querySelector('.form-error')

  if (network) network.style.borderColor = ''
  if (phone) phone.style.borderColor = ''
  if (netError) netError.style.display = 'none'
  if (phoneError) phoneError.style.display = 'none'

  if (!network?.value) {
    if (network) network.style.borderColor = '#e74c3c'
    if (netError) {
      netError.style.display = 'block'
      netError.textContent = 'Please select a mobile network'
    }
    valid = false
  }

  if (!phone?.value.trim() || !/^(0\d{9}|\+233\d{9}|233\d{9})$/.test(phone.value.trim().replace(/\s/g, ''))) {
    if (phone) phone.style.borderColor = '#e74c3c'
    if (phoneError) {
      phoneError.style.display = 'block'
      phoneError.textContent = 'Enter a valid Ghanaian phone number (e.g. 054 XXX XXXX)'
    }
    valid = false
  }

  return valid
}

function validateVisaPayment(form) {
  let valid = true
  const name = form.querySelector('[name="card_name"]')
  const number = form.querySelector('[name="card_number"]')
  const expiry = form.querySelector('[name="card_expiry"]')
  const cvv = form.querySelector('[name="card_cvv"]')

  const nameError = name?.parentElement?.querySelector('.form-error')
  const numError = number?.parentElement?.querySelector('.form-error')
  const expError = expiry?.parentElement?.querySelector('.form-error')
  const cvvError = cvv?.parentElement?.querySelector('.form-error')

  if (name) name.style.borderColor = ''
  if (number) number.style.borderColor = ''
  if (expiry) expiry.style.borderColor = ''
  if (cvv) cvv.style.borderColor = ''
  if (nameError) nameError.style.display = 'none'
  if (numError) numError.style.display = 'none'
  if (expError) expError.style.display = 'none'
  if (cvvError) cvvError.style.display = 'none'

  if (!name?.value.trim()) {
    if (name) name.style.borderColor = '#e74c3c'
    if (nameError) {
      nameError.style.display = 'block'
      nameError.textContent = 'Cardholder name is required'
    }
    valid = false
  }

  const cardNum = number?.value?.replace(/\s/g, '') || ''
  if (!/^\d{16}$/.test(cardNum)) {
    if (number) number.style.borderColor = '#e74c3c'
    if (numError) {
      numError.style.display = 'block'
      numError.textContent = 'Enter a valid 16-digit card number'
    }
    valid = false
  }

  if (!/^\d{2}\/\d{2}$/.test(expiry?.value?.trim() || '')) {
    if (expiry) expiry.style.borderColor = '#e74c3c'
    if (expError) {
      expError.style.display = 'block'
      expError.textContent = 'Use MM/YY format'
    }
    valid = false
  }

  if (!/^\d{3}$/.test(cvv?.value?.trim() || '')) {
    if (cvv) cvv.style.borderColor = '#e74c3c'
    if (cvvError) {
      cvvError.style.display = 'block'
      cvvError.textContent = 'Enter a valid 3-digit CVV'
    }
    valid = false
  }

  return valid
}

function showProcessing(el) {
  if (!el) return
  el.style.display = 'flex'
}

function hideProcessing(el) {
  if (!el) return
  el.style.display = 'none'
}

function showSuccess(orderId, email) {
  const summaryEl = document.getElementById('checkout-summary')
  const formEl = document.getElementById('checkout-form-section')
  const successEl = document.getElementById('checkout-success')

  if (summaryEl) summaryEl.style.display = 'none'
  if (formEl) formEl.style.display = 'none'
  if (successEl) successEl.style.display = 'flex'

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