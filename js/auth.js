import { supabase } from './supabase.js'
import { apiFetch } from './cart.js'

async function ensureUserRow(user) {
  try {
    const existing = await apiFetch(
      `users?id=eq.${user.id}&select=id`
    )
    if (existing && existing.length > 0) return

    await apiFetch('users', {
      method: 'POST',
      body: JSON.stringify({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        role: user.user_metadata?.role || 'customer'
      })
    })
  } catch (error) {
    console.error('Error ensuring user row:', error)
  }
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: 'customer' }
    }
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  if (data.user) {
    await ensureUserRow(data.user)
  }
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  localStorage.removeItem('kente_guest_id')
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

export async function requireAuth(redirectTo) {
  const user = await getCurrentUser()
  if (!user) {
    window.location.href = redirectTo || '/login.html'
    return null
  }
  return user
}

export function updateNavForAuth(user) {
  const loginLinks = document.querySelectorAll('.nav-login-link')
  loginLinks.forEach(link => {
    if (user) {
      link.textContent = 'My Account'
      link.href = 'account.html'
    } else {
      link.textContent = 'Login'
      link.href = 'login.html'
    }
  })
}

export async function initAuth() {
  // Fast local check — no network
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.user) {
      updateNavForAuth(data.session.user)
    }
  } catch {}

  // Verify with API (network call validates token isn't expired)
  const user = await getCurrentUser()
  updateNavForAuth(user)
  if (user) await ensureUserRow(user)

  onAuthChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      getCurrentUser().then(u => updateNavForAuth(u))
    }
  })

  return user
}
