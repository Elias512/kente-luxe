import { 
  fetchAllProducts, 
  fetchFilterOptions, 
  renderShopProducts, 
  getPriceRange,
  attachCartListeners 
} from './products.js'

// ============================================
// STATE MANAGEMENT
// ============================================

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

// ============================================
// INITIALIZATION
// ============================================

export async function initShop() {
  // Load and populate filter options
  await populateFilterOptions()
  
  // Load initial products
  await loadProducts()
  
  // Setup event listeners
  setupEventListeners()
}

// ============================================
// FILTER POPULATION
// ============================================

async function populateFilterOptions() {
  try {
    // Get price range
    const priceRange = await getPriceRange()
    document.getElementById('price-min').placeholder = `Min (${priceRange.min})`
    document.getElementById('price-max').placeholder = `Max (${priceRange.max})`
  } catch (error) {
    console.error('Error populating filter options:', error)
  }
}

// ============================================
// PRODUCT LOADING
// ============================================

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

// ============================================
// UI UPDATES
// ============================================

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

  // Previous button
  if (currentPage > 1) {
    html += `<button class="pagination-btn" data-page="${currentPage - 1}">← Previous</button>`
  } else {
    html += '<button class="pagination-btn" disabled>← Previous</button>'
  }

  // Page numbers
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

  // Next button
  if (currentPage < totalPages) {
    html += `<button class="pagination-btn" data-page="${currentPage + 1}">Next →</button>`
  } else {
    html += '<button class="pagination-btn" disabled>Next →</button>'
  }

  html += '</div>'
  paginationWrapper.innerHTML = html

  // Add pagination click listeners
  document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentPage = parseInt(e.target.dataset.page)
      window.scrollTo(0, 0)
      loadProducts()
    })
  })
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Sort dropdown
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value
    currentPage = 1
    loadProducts()
  })

  // Occasion filters
  document.querySelectorAll('input[name="occasion"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateOccasionFilters()
      currentPage = 1
      loadProducts()
    })
  })

  // Fabric type filters
  document.querySelectorAll('input[name="fabric_type"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateFabricTypeFilters()
      currentPage = 1
      loadProducts()
    })
  })

  // Region filters
  document.querySelectorAll('input[name="region"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRegionFilters()
      currentPage = 1
      loadProducts()
    })
  })

  // Price filter button
  document.getElementById('price-filter-btn').addEventListener('click', () => {
    updatePriceFilters()
    currentPage = 1
    loadProducts()
  })

  // Clear all filters
  document.getElementById('clear-filters').addEventListener('click', () => {
    clearAllFilters()
  })
}

// ============================================
// FILTER UPDATE FUNCTIONS
// ============================================

function updateOccasionFilters() {
  const selected = Array.from(
    document.querySelectorAll('input[name="occasion"]:checked')
  ).map(cb => cb.value)
  
  currentFilters.occasions = selected
}

function updateFabricTypeFilters() {
  const selected = Array.from(
    document.querySelectorAll('input[name="fabric_type"]:checked')
  ).map(cb => cb.value)
  
  currentFilters.fabric_types = selected
}

function updateRegionFilters() {
  const selected = Array.from(
    document.querySelectorAll('input[name="region"]:checked')
  ).map(cb => cb.value)
  
  currentFilters.regions = selected
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
  // Reset filters object
  currentFilters = {
    occasions: [],
    fabric_types: [],
    regions: [],
    gender: [],
    priceMin: undefined,
    priceMax: undefined
  }

  // Uncheck all checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false
  })

  // Clear price inputs
  document.getElementById('price-min').value = ''
  document.getElementById('price-max').value = ''

  // Reset sort
  document.getElementById('sort-select').value = 'newest'
  currentSort = 'newest'

  // Reload products
  currentPage = 1
  loadProducts()
}

export default {
  initShop
}
