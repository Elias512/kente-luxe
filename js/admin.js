import { supabase } from './supabase.js'
import { apiFetch, SUPABASE_URL } from './cart.js'

let managerUser = null
let managerData = null

export { apiFetch, SUPABASE_URL }

export async function requireManager() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    window.location.href = 'login.html'
    return null
  }

  const managers = await apiFetch(
    `managers?email=eq.${encodeURIComponent(user.email)}&select=*`
  )

  if (!managers || managers.length === 0) {
    await supabase.auth.signOut()
    window.location.href = 'login.html'
    return null
  }

  managerUser = user
  managerData = managers[0]
  return { user, manager: managers[0] }
}

export function getManager() {
  return managerData
}

export function getUser() {
  return managerUser
}

export async function adminSignOut() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}

export function showError(el, message) {
  if (!el) return
  el.textContent = message
  el.style.display = 'block'
  setTimeout(() => { el.style.display = 'none' }, 5000)
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function formatCurrency(amount) {
  return `GHS ${Number(amount).toLocaleString()}`
}

export function statusClass(status) {
  const map = {
    pending: 'order-status--pending',
    confirmed: 'order-status--confirmed',
    shipped: 'order-status--shipped',
    delivered: 'order-status--delivered',
    cancelled: 'order-status--cancelled'
  }
  return map[status] || 'order-status--pending'
}
