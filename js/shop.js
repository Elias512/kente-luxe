import {
  fetchAllProducts,
  fetchFilterOptions,
  renderShopProducts,
  getPriceRange,
} from './products.js'

import { apiFetch, addToCart } from './cart.js'

let currentFilters = {
  occasions: [],
  fabric_types: [],
  regions: [],
  gender: [],
  priceMin: undefined,
  priceMax: undefined
}

let currentSort = 'newest'
let currentPage = 1
const ITEMS_PER_PAGE = 12
let totalProducts = 0

export async function initShop() {
  await populateFilterOptions()
  await loadProducts()
  setupEventListeners()
  setupProductModal()

  // Handle product ID from query param (e.g. from lookbook card click)
  const params = new URLSearchParams(window.location.search)
  const productId = params.get('id')
  if (productId) {
    // Wait a tick for DOM to settle, then open modal
    setTimeout(() => openProductModal(productId), 300)

    // Remove from URL without reload
    const url = new URL(window.location)
    url.searchParams.delete('id')
    window.history.replaceState({}, '', url)
  }
}

async function populateFilterOptions() {
  try {
    const priceRange = await getPriceRange()
    document.getElementById('price-min').placeholder = `Min (${priceRange.min})`
    document.getElementById('price-max').placeholder = `Max (${priceRange.max})`
  } catch (error) {
    console.error('Error populating filter options:', error)
  }
}

async function loadProducts() {
  try {
    const result = await renderShopProducts(
      currentFilters,
      currentSort,
      currentPage,
      ITEMS_PER_PAGE
    )

    if (result) {
      totalProducts = result.total
      updateResultsCount(result.total)
      generatePagination(result.total)
    }
  } catch (error) {
    console.error('Error loading products:', error)
  }
}

function updateResultsCount(total) {
  const resultsInfo = document.getElementById('results-count')
  const start = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const end = Math.min(currentPage * ITEMS_PER_PAGE, total)

  if (total === 0) {
    resultsInfo.textContent = 'No products found'
  } else {
    resultsInfo.textContent = `Showing ${start}–${end} of ${total} products`
  }
}

function generatePagination(total) {
  const paginationWrapper = document.getElementById('pagination-wrapper')
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  if (totalPages <= 1) {
    paginationWrapper.innerHTML = ''
    return
  }

  let html = '<div class="pagination">'

  if (currentPage > 1) {
    html += `<button class="pagination-btn" data-page="${currentPage - 1}">← Previous</button>`
  } else {
    html += '<button class="pagination-btn" disabled>← Previous</button>'
  }

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      if (i === currentPage) {
        html += `<button class="pagination-btn active">${i}</button>`
      } else {
        html += `<button class="pagination-btn" data-page="${i}">${i}</button>`
      }
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += '<span class="pagination-dots">...</span>'
    }
  }

  if (currentPage < totalPages) {
    html += `<button class="pagination-btn" data-page="${currentPage + 1}">Next →</button>`
  } else {
    html += '<button class="pagination-btn" disabled>Next →</button>'
  }

  html += '</div>'
  paginationWrapper.innerHTML = html

  document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentPage = parseInt(e.target.dataset.page)
      window.scrollTo(0, 0)
      loadProducts()
    })
  })
}

function setupEventListeners() {
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value
    currentPage = 1
    loadProducts()
  })

  document.querySelectorAll('input[name="occasion"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateOccasionFilters()
      currentPage = 1
      loadProducts()
    })
  })

  document.querySelectorAll('input[name="fabric_type"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateFabricTypeFilters()
      currentPage = 1
      loadProducts()
    })
  })

  document.querySelectorAll('input[name="region"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRegionFilters()
      currentPage = 1
      loadProducts()
    })
  })

  document.getElementById('price-filter-btn').addEventListener('click', () => {
    updatePriceFilters()
    currentPage = 1
    loadProducts()
  })

  document.getElementById('clear-filters').addEventListener('click', () => {
    clearAllFilters()
  })
}

// ============================================
// PRODUCT DETAIL MODAL
// ============================================

function setupProductModal() {
  const grid = document.getElementById('products-grid')
  const modal = document.getElementById('product-modal')
  const backdrop = document.getElementById('modal-backdrop')
  const closeBtn = document.getElementById('modal-close')

  if (!grid || !modal) return

  // Click on product card or add-to-cart button
  grid.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('.add-to-cart')
    if (addBtn) {
      const productId = addBtn.dataset.productId
      if (!productId) return
      addBtn.disabled = true
      const originalText = addBtn.textContent
      const ok = await addToCart(productId, 1)
      if (ok) {
        addBtn.textContent = 'Added ✓'
      } else {
        addBtn.textContent = 'Failed'
      }
      setTimeout(() => {
        addBtn.textContent = originalText
        addBtn.disabled = false
      }, 1500)
      return
    }

    const card = e.target.closest('.product-card')
    if (!card) return
    const productId = card.dataset.productId
    if (!productId) return

    await openProductModal(productId)
  })

  // Close modal
  const closeModal = () => {
    modal.classList.remove('open')
    document.body.style.overflow = ''
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal)
  if (backdrop) backdrop.addEventListener('click', closeModal)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal()
    }
  })

  // Modal quantity controls
  const qtyMinus = document.getElementById('modal-qty-minus')
  const qtyPlus = document.getElementById('modal-qty-plus')
  const qtyInput = document.getElementById('modal-qty')

  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value) || 1
      if (val > 1) qtyInput.value = val - 1
    })
    qtyPlus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value) || 1
      let max = parseInt(qtyInput.max) || 99
      if (val < max) qtyInput.value = val + 1
    })
  }

  // Add to cart from modal
  const modalAddBtn = document.getElementById('modal-add-btn')
  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', async () => {
      const productId = modalAddBtn.dataset.productId
      if (!productId) return

      const qty = parseInt(qtyInput?.value) || 1
      const spinner = document.getElementById('modal-add-spinner')
      const text = document.getElementById('modal-add-text')

      modalAddBtn.disabled = true
      if (spinner) spinner.style.display = 'inline-block'
      if (text) text.textContent = 'Adding...'

      const ok = await addToCart(productId, qty)
      if (ok) {
        if (text) text.textContent = 'Added ✓'
      } else {
        console.error('Add to cart failed')
        if (text) text.textContent = 'Failed'
      }
      setTimeout(() => {
        if (text) text.textContent = 'Add to Cart'
        modalAddBtn.disabled = false
        if (spinner) spinner.style.display = 'none'
      }, 1500)
    })
  }
}

async function openProductModal(productId) {
  const modal = document.getElementById('product-modal')
  if (!modal) return

  modal.classList.add('loading')

  try {
    const data = await apiFetch(`products?id=eq.${productId}&select=id,name,price,region,occasion,fabric_type,stock,description,story,color_palette,care_instructions,category,gender,subcategory,image_url,bestseller,featured`)
    const product = data?.[0]
    if (!product) {
      modal.classList.remove('loading')
      return
    }

    renderModal(product)
    modal.classList.remove('loading')
    modal.classList.add('open')
    document.body.style.overflow = 'hidden'
  } catch (error) {
    console.error('Error loading product details:', error)
    modal.classList.remove('loading')
  }
}

function renderModal(product) {
  const stock = product.stock || 0

  document.getElementById('modal-fabric-label').textContent = product.fabric_type || 'Product'

  const modalImgContainer = document.querySelector('.product-modal-image')
  const modalPlaceholder = document.getElementById('modal-img-placeholder')
  if (modalImgContainer && modalPlaceholder) {
    if (product.image_url) {
      modalImgContainer.style.backgroundImage = `url(${product.image_url})`
      modalImgContainer.style.backgroundSize = 'cover'
      modalImgContainer.style.backgroundPosition = 'center'
      modalPlaceholder.style.display = 'none'
    } else {
      modalImgContainer.style.backgroundImage = ''
      modalPlaceholder.style.display = ''
    }
  }
  document.getElementById('modal-region').textContent = product.region || 'African Heritage'
  document.getElementById('modal-name').textContent = product.name
  document.getElementById('modal-price').textContent = `GHS ${(product.price || 0).toLocaleString()}`

  const occasions = Array.isArray(product.occasion) ? product.occasion : [product.occasion]
  document.getElementById('modal-occasion').innerHTML = occasions.filter(Boolean).map(o =>
    `<span class="product-detail-tag">${o}</span>`
  ).join('')

  document.getElementById('modal-description').textContent = product.description || ''

  const stockEl = document.getElementById('modal-stock')
  if (stock === 0) {
    stockEl.textContent = 'Out of Stock'
    stockEl.className = 'product-modal-stock out'
  } else if (stock <= 5) {
    stockEl.textContent = `Only ${stock} left`
    stockEl.className = 'product-modal-stock low'
  } else {
    stockEl.textContent = 'In Stock'
    stockEl.className = 'product-modal-stock in'
  }

  const addBtn = document.getElementById('modal-add-btn')
  const qtyInput = document.getElementById('modal-qty')
  addBtn.dataset.productId = product.id
  addBtn.disabled = stock === 0
  addBtn.querySelector('#modal-add-text').textContent = stock === 0 ? 'Out of Stock' : 'Add to Cart'
  if (qtyInput) qtyInput.value = 1

  const meta = [
    product.fabric_type && `<span><strong>Fabric:</strong> ${product.fabric_type}</span>`,
    product.category && `<span><strong>Category:</strong> ${product.category}</span>`,
    product.gender && `<span><strong>For:</strong> ${product.gender}</span>`
  ].filter(Boolean)
  document.getElementById('modal-meta').innerHTML = meta.join('')

  const storyEl = document.getElementById('modal-story')
  const storySection = document.getElementById('modal-story-section')
  if (product.story) {
    storyEl.textContent = product.story
    storySection.style.display = ''
  } else {
    storySection.style.display = 'none'
  }

  const careEl = document.getElementById('modal-care')
  const careSection = document.getElementById('modal-care-section')
  if (product.care_instructions) {
    careEl.textContent = product.care_instructions
    careSection.style.display = ''
  } else {
    careSection.style.display = 'none'
  }

  const colorsEl = document.getElementById('modal-colors')
  const colorsSection = document.getElementById('modal-colors-section')
  const colors = Array.isArray(product.color_palette) ? product.color_palette : []
  if (colors.length > 0) {
    colorsEl.innerHTML = colors.map(c => `<span class="product-detail-color">${c}</span>`).join('')
    colorsSection.style.display = ''
  } else {
    colorsSection.style.display = 'none'
  }

  const badge = document.getElementById('modal-badge')
  badge.style.display = ''
  if (product.bestseller) badge.textContent = 'Bestseller'
  else if (product.featured) badge.textContent = 'Featured'
  else badge.style.display = 'none'
}

// ============================================
// FILTER UPDATE FUNCTIONS
// ============================================

function updateOccasionFilters() {
  currentFilters.occasions = Array.from(
    document.querySelectorAll('input[name="occasion"]:checked')
  ).map(cb => cb.value)
}

function updateFabricTypeFilters() {
  currentFilters.fabric_types = Array.from(
    document.querySelectorAll('input[name="fabric_type"]:checked')
  ).map(cb => cb.value)
}

function updateRegionFilters() {
  currentFilters.regions = Array.from(
    document.querySelectorAll('input[name="region"]:checked')
  ).map(cb => cb.value)
}

function updatePriceFilters() {
  const minInput = document.getElementById('price-min')
  const maxInput = document.getElementById('price-max')
  const min = minInput.value ? parseInt(minInput.value) : undefined
  const max = maxInput.value ? parseInt(maxInput.value) : undefined
  if (min !== undefined || max !== undefined) {
    currentFilters.priceMin = min
    currentFilters.priceMax = max
  }
}

function clearAllFilters() {
  currentFilters = {
    occasions: [],
    fabric_types: [],
    regions: [],
    gender: [],
    priceMin: undefined,
    priceMax: undefined
  }

  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false)
  document.getElementById('price-min').value = ''
  document.getElementById('price-max').value = ''
  document.getElementById('sort-select').value = 'newest'
  currentSort = 'newest'
  currentPage = 1
  loadProducts()
}

export default { initShop }
