import { apiFetch, getGuestId } from './cart.js'

function getProductId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id')
}

function getGuestIdLocal() {
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

async function addToCart(productId, quantity = 1) {
  const guestId = getGuestIdLocal()

  const existing = await apiFetch(
    `cart_items?product_id=eq.${productId}&guest_id=eq.${guestId}&select=id,quantity`,
    { method: 'GET' }
  )

  if (existing && existing.length > 0) {
    await apiFetch(`cart_items?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: existing[0].quantity + quantity, updated_at: new Date().toISOString() })
    })
  } else {
    await apiFetch('cart_items', {
      method: 'POST',
      body: JSON.stringify({ guest_id: guestId, product_id: productId, quantity })
    })
  }

  window.dispatchEvent(new CustomEvent('cartUpdated'))
  return true
}

export async function loadProduct() {
  const container = document.getElementById('product-detail')
  const loadingEl = document.getElementById('product-loading')
  const errorEl = document.getElementById('product-not-found')
  const productId = getProductId()

  if (!productId) {
    if (loadingEl) loadingEl.style.display = 'none'
    if (errorEl) errorEl.style.display = 'flex'
    return
  }

  if (loadingEl) loadingEl.style.display = 'flex'

  try {
    const product = await apiFetch(`products?id=eq.${productId}&select=*`)

    if (!product || product.length === 0) {
      if (loadingEl) loadingEl.style.display = 'none'
      if (errorEl) errorEl.style.display = 'flex'
      return
    }

    const p = product[0]
    if (loadingEl) loadingEl.style.display = 'none'
    if (container) container.style.display = 'grid'

    renderProduct(p)
    setupAddToCart(p)
    await loadRelatedProducts(p)
  } catch (error) {
    console.error('Error loading product:', error)
    if (loadingEl) loadingEl.style.display = 'none'
    if (errorEl) errorEl.style.display = 'flex'
  }
}

function renderProduct(p) {
  const imgLabel = document.getElementById('product-image-label')
  const fabricLabel = document.getElementById('product-fabric-label')
  const nameEl = document.getElementById('product-name')
  const regionEl = document.getElementById('product-region')
  const occasionEl = document.getElementById('product-occasion')
  const priceEl = document.getElementById('product-price')
  const descEl = document.getElementById('product-description')
  const stockEl = document.getElementById('product-stock')
  const addBtn = document.getElementById('product-add-btn')
  const qtyEl = document.getElementById('product-qty')
  const storyEl = document.getElementById('product-story')
  const careEl = document.getElementById('product-care')
  const colorEl = document.getElementById('product-colors')
  const metaEl = document.getElementById('product-meta')
  const badgeEl = document.getElementById('product-badge')

  if (fabricLabel) fabricLabel.textContent = p.fabric_type || 'Product'
  if (imgLabel) imgLabel.textContent = p.fabric_type || 'Product'
  if (nameEl) nameEl.textContent = p.name
  if (regionEl) regionEl.textContent = p.region || 'African Heritage'
  if (priceEl) priceEl.textContent = `GHS ${(p.price || 0).toLocaleString()}`
  if (descEl) descEl.textContent = p.description || ''

  if (occasionEl) {
    const occasions = Array.isArray(p.occasion) ? p.occasion : [p.occasion]
    occasionEl.innerHTML = occasions.filter(Boolean).map(o => `<span class="product-detail-tag">${o}</span>`).join('')
  }

  const stock = p.stock || 0
  if (stock === 0) {
    if (stockEl) { stockEl.textContent = 'Out of Stock'; stockEl.className = 'product-detail-stock out' }
    if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Out of Stock' }
  } else if (stock <= 5) {
    if (stockEl) { stockEl.textContent = `Only ${stock} left`; stockEl.className = 'product-detail-stock low' }
    if (addBtn) addBtn.disabled = false
  } else {
    if (stockEl) { stockEl.textContent = 'In Stock'; stockEl.className = 'product-detail-stock in' }
    if (addBtn) addBtn.disabled = false
  }

  if (qtyEl && stock > 0) {
    qtyEl.max = stock
    qtyEl.value = 1
  }

  if (storyEl) storyEl.textContent = p.story || ''
  if (storyEl && !p.story) storyEl.closest('.product-detail-story')?.style && (storyEl.closest('.product-detail-story').style.display = 'none')

  if (careEl) careEl.textContent = p.care_instructions || ''
  if (careEl && !p.care_instructions) careEl.closest('.product-detail-care')?.style && (careEl.closest('.product-detail-care').style.display = 'none')

  if (colorEl) {
    const colors = Array.isArray(p.color_palette) ? p.color_palette : []
    if (colors.length > 0) {
      colorEl.innerHTML = colors.map(c => `<span class="product-detail-color">${c}</span>`).join('')
    } else {
      const section = colorEl.closest('.product-detail-colors')
      if (section) section.style.display = 'none'
    }
  }

  if (metaEl) {
    const meta = [
      p.fabric_type && `<span><strong>Fabric:</strong> ${p.fabric_type}</span>`,
      p.category && `<span><strong>Category:</strong> ${p.category}</span>`,
      p.subcategory && `<span><strong>Style:</strong> ${p.subcategory}</span>`,
      p.gender && `<span><strong>For:</strong> ${p.gender}</span>`
    ].filter(Boolean)
    metaEl.innerHTML = meta.join('')
  }

  if (badgeEl) {
    if (p.bestseller) badgeEl.textContent = 'Bestseller'
    else if (p.featured) badgeEl.textContent = 'Featured'
    else badgeEl.style.display = 'none'
  }
}

function setupAddToCart(product) {
  const addBtn = document.getElementById('product-add-btn')
  if (!addBtn) return

  addBtn.addEventListener('click', async () => {
    const qtyEl = document.getElementById('product-qty')
    const qty = qtyEl ? parseInt(qtyEl.value) || 1 : 1
    const btnText = document.getElementById('product-add-btn-text')
    const spinner = document.getElementById('product-add-spinner')

    addBtn.disabled = true
    if (spinner) spinner.style.display = 'inline-block'
    if (btnText) btnText.textContent = 'Adding...'

    try {
      await addToCart(product.id, qty)
      if (btnText) btnText.textContent = 'Added ✓'
      setTimeout(() => {
        if (btnText) btnText.textContent = 'Add to Cart'
        addBtn.disabled = false
      }, 1500)
    } catch (error) {
      console.error('Add to cart failed:', error)
      if (btnText) btnText.textContent = 'Failed'
      setTimeout(() => {
        if (btnText) btnText.textContent = 'Add to Cart'
        addBtn.disabled = false
      }, 1500)
    }
  })
}

async function loadRelatedProducts(product) {
  const container = document.getElementById('related-products')
  if (!container) return

  try {
    const data = await apiFetch(
      `products?fabric_type=eq.${product.fabric_type}&id=neq.${product.id}&select=id,name,price,region,occasion,fabric_type,stock&order=created_at.desc&limit=4`
    )

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 2rem;">No related products found.</p>'
      return
    }

    container.innerHTML = data.map(p => {
      const occasionText = Array.isArray(p.occasion) ? p.occasion.slice(0, 2).join(' · ') : p.occasion || ''
      return `
        <a href="product.html?id=${p.id}" class="product-card related-card">
          <div class="product-img">
            <div class="kente-pattern-bg"></div>
            <div class="product-img-label">
              <span>KL</span>
              <p>${p.fabric_type || 'Product'}</p>
            </div>
            ${p.stock === 0 ? '<div class="product-badge out-of-stock">Out of Stock</div>' : '<div class="product-badge">In Stock</div>'}
          </div>
          <div class="product-info">
            <div class="product-region">${p.region || 'Regional'}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-occasion">${occasionText}</div>
            <div class="product-footer">
              <span class="product-price">GHS ${p.price}</span>
            </div>
          </div>
        </a>
      `
    }).join('')
  } catch (error) {
    console.error('Error loading related products:', error)
  }
}

export default { loadProduct }
