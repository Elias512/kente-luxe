import { getGuestId, apiFetch } from './cart.js'

let isSubmitting = false

export function initCustomOrder() {
  const form = document.getElementById('custom-order-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!validateForm()) return

    isSubmitting = true
    const submitBtn = document.getElementById('custom-order-submit')
    const spinner = document.getElementById('custom-order-spinner')
    const btnText = document.getElementById('custom-order-btn-text')

    if (submitBtn) submitBtn.disabled = true
    if (spinner) spinner.style.display = 'inline-block'
    if (btnText) btnText.textContent = 'Submitting...'

    const formData = new FormData(form)

    const payload = {
      guest_id: getGuestId(),
      user_id: null,
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      fabric: formData.get('fabric_preference'),
      style: formData.get('garment_type'),
      measurements: formData.get('measurement_notes') || '',
      occasion: formData.get('occasion'),
      notes: formData.get('description'),
      status: 'received'
    }

    try {
      await apiFetch('custom_orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      showSuccess()
    } catch (error) {
      console.error('Custom order submission failed:', error)
      const errorEl = document.getElementById('custom-order-error')
      if (errorEl) {
        errorEl.textContent = 'Something went wrong. Please try again.'
        errorEl.style.display = 'block'
        setTimeout(() => { errorEl.style.display = 'none' }, 5000)
      }
      isSubmitting = false
      if (submitBtn) submitBtn.disabled = false
      if (spinner) spinner.style.display = 'none'
      if (btnText) btnText.textContent = 'Submit Request'
    }
  })
}

function validateForm() {
  const form = document.getElementById('custom-order-form')
  if (!form) return false

  const required = ['full_name', 'email', 'phone', 'garment_type', 'fabric_preference', 'occasion', 'budget_range', 'description']
  let valid = true

  required.forEach(id => {
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

function showSuccess() {
  const formEl = document.getElementById('custom-order-form')
  const successEl = document.getElementById('custom-order-success')

  if (formEl) formEl.style.display = 'none'
  if (successEl) successEl.style.display = 'block'
}

export default { initCustomOrder }