import { supabase } from './supabase.js'
import { addToCart } from './cart.js'

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch featured products (3 most recent)
 * Used on homepage
 */
export async function fetchFeaturedProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, region, occasion, category, description, stock, featured, fabric_type, image_url')
      .eq('featured', true)
      .order('created_at', { ascending: false })
      .limit(3)

    if (error) {
      console.error('Error fetching featured products:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error fetching featured products:', error)
    return []
  }
}

/**
 * Fetch all products with optional filtering
 * Used on shop page
 */
export async function fetchAllProducts(filters = {}, sortBy = 'newest', page = 1, perPage = 12) {
  try {
    let query = supabase
      .from('products')
      .select('id, name, price, region, occasion, category, description, stock, featured, fabric_type, gender, subcategory, image_url', { count: 'exact' })

    // Apply filters
    if (filters.occasions && filters.occasions.length > 0) {
      query = query.overlaps('occasion', filters.occasions)
    }

    if (filters.fabric_types && filters.fabric_types.length > 0) {
      query = query.in('fabric_type', filters.fabric_types)
    }

    if (filters.regions && filters.regions.length > 0) {
      query = query.in('region', filters.regions)
    }

    if (filters.gender && filters.gender.length > 0) {
      query = query.in('gender', filters.gender)
    }

    if (filters.priceMin !== undefined && filters.priceMax !== undefined) {
      query = query.gte('price', filters.priceMin).lte('price', filters.priceMax)
    }

    // Apply sorting
    switch (sortBy) {
      case 'price_asc':
        query = query.order('price', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false })
        break
      case 'bestsellers':
        query = query.order('bestseller', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    const offset = (page - 1) * perPage
    query = query.range(offset, offset + perPage - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching products:', error)
      return { products: [], total: 0 }
    }

    return { products: data || [], total: count || 0 }
  } catch (error) {
    console.error('Unexpected error fetching products:', error)
    return { products: [], total: 0 }
  }
}

/**
 * Fetch single product by ID
 * Used on product detail page
 */
export async function fetchProductById(productId) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) {
      console.error('Error fetching product:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error fetching product:', error)
    return null
  }
}

/**
 * Get unique values for filter options
 */
export async function fetchFilterOptions() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('occasion, fabric_type, region, gender')

    if (error) {
      console.error('Error fetching filter options:', error)
      return { occasions: [], fabricTypes: [], regions: [], genders: [] }
    }

    // Extract unique values
    const occasions = [...new Set(data.flatMap(p => p.occasion || []))].filter(Boolean)
    const fabricTypes = [...new Set(data.map(p => p.fabric_type).filter(Boolean))]
    const regions = [...new Set(data.map(p => p.region).filter(Boolean))]
    const genders = [...new Set(data.map(p => p.gender).filter(Boolean))]

    return { occasions, fabricTypes, regions, genders }
  } catch (error) {
    console.error('Unexpected error fetching filter options:', error)
    return { occasions: [], fabricTypes: [], regions: [], genders: [] }
  }
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

/**
 * Create HTML for a single product card
 */
export function createProductCard(product) {
  const stockStatus = product.stock === 0 ? 'Out of Stock' : ''
  const isOutOfStock = product.stock === 0

  const occasionText = Array.isArray(product.occasion) 
    ? product.occasion.join(' · ') 
    : product.occasion

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-img">
        ${product.image_url
          ? `<img class="product-img-src" src="${product.image_url}" alt="${product.name}" loading="lazy">`
          : `<div class="kente-pattern-bg"></div>
             <div class="product-img-label">
               <span>KL</span>
               <p>${product.fabric_type || 'Product image'}</p>
             </div>`
        }
        ${product.stock === 0 ? '<div class="product-badge out-of-stock">Out of Stock</div>' : '<div class="product-badge">In Stock</div>'}
      </div>
      <div class="product-info">
        <div class="product-region">${product.region || 'Regional'}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-occasion">${occasionText}</div>
        <div class="product-footer">
          <span class="product-price">GHS ${product.price}</span>
          <button class="add-to-cart" ${isOutOfStock ? 'disabled' : ''} data-product-id="${product.id}">
            ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  `
}

/**
 * Create HTML for skeleton loader (loading state)
 */
export function createSkeletonLoader(count = 1) {
  let skeletons = ''
  for (let i = 0; i < count; i++) {
    skeletons += `
      <div class="product-card skeleton-loader">
        <div class="product-img skeleton-bg"></div>
        <div class="product-info">
          <div class="skeleton-text skeleton-region"></div>
          <div class="skeleton-text skeleton-name"></div>
          <div class="skeleton-text skeleton-occasion"></div>
          <div class="product-footer">
            <div class="skeleton-text skeleton-price"></div>
            <div class="skeleton-text skeleton-button"></div>
          </div>
        </div>
      </div>
    `
  }
  return skeletons
}

/**
 * Render featured products on homepage
 */
export async function renderFeaturedProducts() {
  const container = document.getElementById('products-grid')
  if (!container) return

  // Show skeleton loaders
  container.innerHTML = createSkeletonLoader(3)

  // Fetch and render products
  const products = await fetchFeaturedProducts()

  if (products.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; color: var(--muted); text-align: center; padding: 2rem;">No products available.</p>'
    return
  }

  container.innerHTML = products.map(product => createProductCard(product)).join('')

  // Add event listeners to "Add to Cart" buttons
  attachCartListeners(container)
}

/**
 * Render paginated products on shop page
 */
export async function renderShopProducts(filters = {}, sortBy = 'newest', page = 1, perPage = 12) {
  const container = document.getElementById('products-grid')
  if (!container) return

  // Show skeleton loaders
  container.innerHTML = createSkeletonLoader(perPage)

  // Fetch and render products
  const { products, total } = await fetchAllProducts(filters, sortBy, page, perPage)

  if (products.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; color: var(--muted); text-align: center; padding: 2rem;">No products found. Try adjusting your filters.</p>'
    return
  }

  container.innerHTML = products.map(product => createProductCard(product)).join('')

  // Add event listeners to "Add to Cart" buttons
  attachCartListeners(container)

  // Return pagination info
  return { total, page, perPage }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Attach cart event listeners to add-to-cart buttons
 */
export function attachCartListeners(container) {
  const buttons = container.querySelectorAll('.add-to-cart:not([disabled])')

  buttons.forEach(button => {
    button.addEventListener('click', async function (e) {
      e.preventDefault()
      const productId = this.dataset.productId
      const success = await addToCart(productId, 1)

      // Show feedback
      const originalText = this.textContent
      if (success) {
        this.textContent = 'Added ✓'
        this.style.background = 'var(--gold)'
        this.style.color = 'var(--dark)'
      } else {
        this.textContent = 'Failed'
        this.style.background = '#B71C1C'
        this.style.color = '#ffcdd2'
      }

      setTimeout(() => {
        this.textContent = originalText
        this.style.background = ''
        this.style.color = ''
      }, 1500)
    })
  })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get price range from all products
 */
export async function getPriceRange() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('price')
      .order('price', { ascending: true })

    if (error) {
      console.error('Error fetching price range:', error)
      return { min: 0, max: 1000 }
    }

    const prices = data.map(p => p.price)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  } catch (error) {
    console.error('Unexpected error fetching price range:', error)
    return { min: 0, max: 1000 }
  }
}

export default {
  fetchFeaturedProducts,
  fetchAllProducts,
  fetchProductById,
  fetchFilterOptions,
  createProductCard,
  createSkeletonLoader,
  renderFeaturedProducts,
  renderShopProducts,
  attachCartListeners,
  getPriceRange
}
