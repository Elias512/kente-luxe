import { apiFetch } from './cart.js'

const FABRIC_STORIES = {
  Kente: {
    subtitle: 'Woven Royalty',
    summary: "Originating from the Ashanti Kingdom of Ghana, Kente is more than cloth — it is a woven language of proverbs, history, and status. Each pattern and colour combination holds specific meaning, passed down through generations of master weavers.",
    traditions: [
      "Handwoven on narrow wooden looms in small villages across the Ashanti Region",
      "Each colour carries meaning — gold for royalty, green for growth, blue for spirituality",
      "Traditionally worn by chiefs and queens during sacred ceremonies and festivals"
    ],
    region: "Ashanti Region, Ghana"
  },
  Ankara: {
    subtitle: 'The Language of Wax',
    summary: "Ankara, also known as African wax print, is a vibrant cotton fabric that tells stories through bold motifs and striking colour combinations. While industrially produced, its cultural significance in West Africa is profound — each design communicates identity, mood, and belonging.",
    traditions: [
      "The wax-resist dyeing technique originated in Indonesia and was embraced across West Africa",
      "Each print design has a name and meaning — often named after proverbs, events, or popular sayings",
      "Women curate their Ankara wardrobes as a form of self-expression and cultural pride"
    ],
    region: "West Africa"
  },
  Smock: {
    subtitle: 'Northern Heritage',
    summary: "The Fugu or Batakari, known internationally as the Ghanaian smock, is a handwoven textile from Ghana's northern regions. Its distinctive striped patterns and flowing silhouette have been worn by chiefs, farmers, and presidents alike — a symbol of resilience and cultural identity.",
    traditions: [
      "Handwoven from cotton and silk by the Dagomba, Gonja, and Mamprusi people",
      "The strip-weaving technique requires years of apprenticeship to master",
      "Worn during important ceremonies and now embraced as high-fashion streetwear"
    ],
    region: "Northern Ghana"
  },
  Adinkra: {
    subtitle: 'Symbols of Wisdom',
    summary: "Adinkra is a sacred stamped cloth from the Bono people of Ghana, adorned with symbols representing proverbs and philosophical concepts. Each stamp is carved from calabash gourd and dipped in traditional dye made from bark. It is cloth that speaks — a textile philosophy.",
    traditions: [
      "Originally reserved for funerals and mourning, now worn for celebrations too",
      "Over 400 Adinkra symbols exist, each with its own meaning and proverb",
      "The traditional dye is made from the bark of the Badie tree, boiled with iron slag"
    ],
    region: "Bono Region, Ghana"
  },
  "Kente Silk": {
    subtitle: 'The Royal Thread',
    summary: "Kente Silk represents the pinnacle of Ghanaian weaving — finer threads, more intricate patterns, and a luminous sheen that distinguishes ceremonial cloth from everyday wear. Woven primarily for royalty and special occasions, each piece is a masterpiece of patience and precision.",
    traditions: [
      "Uses finer silk threads imported and hand-dyed by master weavers",
      "More densely woven than cotton Kente, taking weeks or months to complete",
      "Reserved for the most significant life events — weddings, enstoolments, and state ceremonies"
    ],
    region: "Ashanti Region, Ghana"
  }
}

const FABRIC_ORDER = ["Kente", "Kente Silk", "Ankara", "Smock", "Adinkra"]

let allProducts = []
let allImages = []

export async function initLookbook() {
  await loadProducts()
  await loadGalleryImages()
  if (allProducts.length > 0) {
    renderStories(allProducts)
    renderNav(allProducts)
  }
  setupNavScroll()
  setupLightbox()
}

async function loadProducts() {
  const container = document.getElementById("lookbook-stories")
  if (!container) return

  container.innerHTML = `<div class="cart-loader" style="margin: 3rem auto;"></div>`

  try {
    allProducts = await apiFetch("products?select=id,name,price,region,occasion,fabric_type,stock,description,story,color_palette,care_instructions&order=created_at.desc")

    if (!allProducts || allProducts.length === 0) {
      container.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 2rem;">No products available yet.</p>`
      return
    }
  } catch (error) {
    console.error("Error loading lookbook:", error)
    container.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 2rem;">Failed to load stories.</p>`
  }
}

async function loadGalleryImages() {
  try {
    const data = await apiFetch("lookbook_images?select=*&order=display_order.asc")
    if (data && data.length > 0) {
      allImages = data
    } else {
      await seedGalleryImages()
      const seeded = await apiFetch("lookbook_images?select=*&order=display_order.asc")
      if (seeded) allImages = seeded
    }
  } catch (error) {
    console.warn("Could not load gallery images:", error)
    allImages = []
  }

  // Append lifestyle/wear images as static data (already in Storage, bypass DB insert)
  const base = "https://csajcdvwmmumhpuzpmuk.supabase.co/storage/v1/object/public/lookbook/"
  const lifestyleData = [
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-gallery-woman.png", caption: "A stylish Ghanaian woman in a modern Kente midi dress at an art gallery opening", alt_text: "Woman in modern Kente dress at art gallery", section: "lifestyle", display_order: 1 },
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-street-man.png", caption: "A young Ghanaian man in a deconstructed Kente-panel streetwear jacket in Accra", alt_text: "Man in Kente streetwear jacket", section: "lifestyle", display_order: 2 },
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-bridal-bride.png", caption: "A Ghanaian bride in a structured Kente ball gown with gold beadwork at a garden ceremony", alt_text: "Bride in Kente ball gown", section: "lifestyle", display_order: 3 },
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-power-businesswoman.png", caption: "A senior Ghanaian businesswoman in a tailored Kente power suit at a glass boardroom table", alt_text: "Businesswoman in Kente power suit", section: "lifestyle", display_order: 4 },
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-youth-friends.png", caption: "Two teenage friends in coordinating Kente crop tops and high-waist skirts at a weekend market", alt_text: "Teenagers in Kente outfits at market", section: "lifestyle", display_order: 5 },
    { fabric_type: "Kente", image_url: base + "lifestyle-kente-gala-toga-man.png", caption: "A man in a full hand-woven Kente toga draped over a white dress shirt at a black-tie gala", alt_text: "Man in Kente toga at gala", section: "lifestyle", display_order: 6 },
    { fabric_type: "Kente Silk", image_url: base + "lifestyle-kente-silk-rooftop-couple.png", caption: "A couple in luxurious Kente Silk attire at a rooftop event in Accra during golden hour", alt_text: "Couple in Kente Silk at rooftop event", section: "lifestyle", display_order: 1 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-botanical-woman.png", caption: "A young woman in a tailored Ankara blazer and wide-leg trousers walking through a sunlit botanical garden", alt_text: "Woman in Ankara blazer in botanical garden", section: "lifestyle", display_order: 1 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-co-ord-woman.jpeg", caption: "A woman in a matching Ankara corset top and flared maxi skirt walking along a palm-lined coastal road", alt_text: "Woman in Ankara co-ord on coastal road", section: "lifestyle", display_order: 2 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-office-woman.png", caption: "A professional woman in a sleek Ankara wrap blouse tucked into black trousers in a modern office", alt_text: "Woman in Ankara blouse in office", section: "lifestyle", display_order: 3 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-men-cafe.png", caption: "A stylish man in an Ankara-print short-sleeve button-up shirt at an outdoor cafe terrace", alt_text: "Man in Ankara shirt at cafe", section: "lifestyle", display_order: 4 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-kids-play.png", caption: "Two young girls in vibrant matching Ankara dresses playing in a sunlit courtyard", alt_text: "Girls in matching Ankara dresses", section: "lifestyle", display_order: 5 },
    { fabric_type: "Ankara", image_url: base + "lifestyle-ankara-night-gown.png", caption: "A woman in a backless Ankara-print evening gown at a rooftop dinner party with city lights", alt_text: "Woman in Ankara evening gown", section: "lifestyle", display_order: 6 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-creative-man.png", caption: "A man in a contemporary handwoven smock at a creative studio in Accra", alt_text: "Man in handwoven smock at studio", section: "lifestyle", display_order: 1 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-graduate-man.png", caption: "A young Ghanaian man in a crisp white handwoven smock at his university graduation", alt_text: "Graduate in white smock at graduation", section: "lifestyle", display_order: 2 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-elder-man.png", caption: "A village elder in a rich indigo and white smock seated under a large neem tree", alt_text: "Elder in indigo smock under neem tree", section: "lifestyle", display_order: 3 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-street-creative.png", caption: "A young creative in a deconstructed oversized smock layered over a turtleneck in a Tamale alley", alt_text: "Creative in deconstructed smock in Tamale", section: "lifestyle", display_order: 4 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-wedding-groom.png", caption: "A groom in an embroidered ceremonial smock at a traditional northern Ghana wedding", alt_text: "Groom in embroidered smock at wedding", section: "lifestyle", display_order: 5 },
    { fabric_type: "Smock", image_url: base + "lifestyle-smock-workspace-architect.png", caption: "A male architect in a light blue smock reviewing blueprints at a drafting table", alt_text: "Architect in light blue smock at work", section: "lifestyle", display_order: 6 },
    { fabric_type: "Adinkra", image_url: base + "lifestyle-adinkra-wrap-woman.png", caption: "A woman in an Adinkra-print modern wrap dress at a cultural event", alt_text: "Woman in Adinkra wrap dress", section: "lifestyle", display_order: 1 },
    { fabric_type: "Adinkra", image_url: base + "lifestyle-adinkra-scholar-man.png", caption: "A young male academic in an Adinkra-stamped linen jacket in a sunlit university library", alt_text: "Academic in Adinkra linen jacket in library", section: "lifestyle", display_order: 2 },
    { fabric_type: "Adinkra", image_url: base + "lifestyle-adinkra-fusion-designer.png", caption: "A young designer in a cropped Adinkra-print jacket with wide-leg denim in her textile studio", alt_text: "Designer in cropped Adinkra jacket in studio", section: "lifestyle", display_order: 3 },
    { fabric_type: "Adinkra", image_url: base + "lifestyle-adinkra-runway-model.png", caption: "A model on a minimalist white runway wearing a structured Adinkra-pattern coat dress", alt_text: "Model in Adinkra coat dress on runway", section: "lifestyle", display_order: 4 },
  ]
  allImages = [...allImages, ...lifestyleData]
}

async function seedGalleryImages() {
  const base = "https://csajcdvwmmumhpuzpmuk.supabase.co/storage/v1/object/public/lookbook/"
  const seeds = [
    { fabric_type: "Kente", image_url: base + "lookbook-kente-hero.png", caption: "Master weaver at work on a narrow loom in Bonwire", alt_text: "Kente weaver working on traditional loom", section: "hero", display_order: 1 },
    { fabric_type: "Kente", image_url: base + "lookbook-kente-craftsmanship-1.png", caption: "Close-up of intricate gold and green Kente pattern", alt_text: "Detail of Kente weaving pattern", section: "craftsmanship", display_order: 2 },
    { fabric_type: "Kente", image_url: base + "lookbook-kente-cultural.png", caption: "Chief wearing Kente cloth at a ceremonial durbar", alt_text: "Chief in full Kente regalia", section: "cultural", display_order: 3 },
    { fabric_type: "Kente", image_url: base + "lookbook-kente-craftsmanship-2.png", caption: "Skeins of dyed silk thread drying in the sun", alt_text: "Silk threads being prepared for Kente weaving", section: "craftsmanship", display_order: 4 },
    { fabric_type: "Kente", image_url: base + "lookbook-kente-detail.png", caption: "A completed Kente strip showing the traditional rainbow pattern", alt_text: "Completed Kente cloth strip", section: "detail", display_order: 5 },
    { fabric_type: "Kente Silk", image_url: base + "lookbook-kente-silk-hero.png", caption: "Master weaver handling fine silk threads", alt_text: "Kente Silk weaver at work", section: "hero", display_order: 1 },
    { fabric_type: "Kente Silk", image_url: base + "lookbook-kente-silk-craftsmanship.png", caption: "Silk Kente with intricate geometric patterns", alt_text: "Detail of silk Kente pattern", section: "craftsmanship", display_order: 2 },
    { fabric_type: "Kente Silk", image_url: base + "lookbook-kente-silk-cultural.png", caption: "Royal silk Kente on display at a festival", alt_text: "Royal silk Kente exhibition", section: "cultural", display_order: 3 },
    { fabric_type: "Kente Silk", image_url: base + "lookbook-kente-silk-detail.png", caption: "Close-up of the sheen on handwoven silk Kente", alt_text: "Silk sheen detail on Kente cloth", section: "detail", display_order: 4 },
    { fabric_type: "Ankara", image_url: base + "lookbook-ankara-hero.png", caption: "Vibrant Ankara wax print bolts at a market", alt_text: "Ankara fabric bolts at market", section: "hero", display_order: 1 },
    { fabric_type: "Ankara", image_url: base + "lookbook-ankara-detail.png", caption: "Close-up of a bold Ankara pattern with symbolic motifs", alt_text: "Ankara wax print pattern detail", section: "detail", display_order: 2 },
    { fabric_type: "Ankara", image_url: base + "lookbook-ankara-cultural-1.png", caption: "Woman in Ankara dress at a community gathering", alt_text: "Woman wearing Ankara print dress", section: "cultural", display_order: 3 },
    { fabric_type: "Ankara", image_url: base + "lookbook-ankara-craftsmanship.png", caption: "Colourful Ankara designs stacked in a textile shop", alt_text: "Ankara fabric display", section: "craftsmanship", display_order: 4 },
    { fabric_type: "Smock", image_url: base + "lookbook-smock-hero.png", caption: "Artisan weaving smock fabric on a traditional loom", alt_text: "Smock weaver in Northern Ghana", section: "hero", display_order: 1 },
    { fabric_type: "Smock", image_url: base + "lookbook-smock-detail-1.png", caption: "Striped smock pattern ready for tailoring", alt_text: "Smock fabric stripe pattern", section: "detail", display_order: 2 },
    { fabric_type: "Smock", image_url: base + "lookbook-smock-cultural.png", caption: "Elder wearing a handwoven smock at a festival", alt_text: "Elder in traditional smock", section: "cultural", display_order: 3 },
    { fabric_type: "Smock", image_url: base + "lookbook-smock-craftsmanship.png", caption: "Cotton threads being spun for smock weaving", alt_text: "Cotton thread preparation for smock", section: "craftsmanship", display_order: 4 },
    { fabric_type: "Smock", image_url: base + "lookbook-smock-detail-2.png", caption: "Completed smock displayed against northern architecture", alt_text: "Finished handwoven smock", section: "detail", display_order: 5 },
    { fabric_type: "Adinkra", image_url: base + "lookbook-adinkra-hero.png", caption: "Master stamper applying Adinkra symbols to cloth", alt_text: "Adinkra stamping process", section: "hero", display_order: 1 },
    { fabric_type: "Adinkra", image_url: base + "lookbook-adinkra-craftsmanship-1.png", caption: "Calabash stamps carved with traditional Adinkra symbols", alt_text: "Adinkra calabash stamps", section: "craftsmanship", display_order: 2 },
    { fabric_type: "Adinkra", image_url: base + "lookbook-adinkra-detail.png", caption: "Sankofa and Gye Nyame symbols on finished Adinkra cloth", alt_text: "Adinkra symbol detail", section: "detail", display_order: 3 },
    { fabric_type: "Adinkra", image_url: base + "lookbook-adinkra-craftsmanship-2.jpeg", caption: "Traditional dye preparation from Badie tree bark", alt_text: "Adinkra traditional dye making", section: "craftsmanship", display_order: 4 },
    { fabric_type: "Adinkra", image_url: base + "lookbook-adinkra-cultural.jpeg", caption: "Elder displaying Adinkra cloth worn for a ceremony", alt_text: "Elder in Adinkra cloth", section: "cultural", display_order: 5 }
  ]

  for (const img of seeds) {
    try {
      await apiFetch("lookbook_images", {
        method: "POST",
        body: JSON.stringify(img)
      })
    } catch (e) {
      console.warn("Failed to seed image:", img.fabric_type, img.display_order)
    }
  }
}

function getFabricProducts(products, fabricType) {
  return products.filter(p => p.fabric_type === fabricType)
}

function renderNav(products) {
  const nav = document.getElementById("lookbook-nav")
  if (!nav) return

  const availableFabrics = FABRIC_ORDER.filter(f => getFabricProducts(products, f).length > 0)
  const allFabrics = FABRIC_ORDER.filter(f => {
    const p = getFabricProducts(products, f)
    return p.length > 0
  })

  if (allFabrics.length === 0) {
    nav.style.display = "none"
    return
  }

  nav.innerHTML = allFabrics.map(f => {
    const story = FABRIC_STORIES[f]
    return `<a href="#story-${f.toLowerCase().replace(/\s+/g, "-")}" class="lookbook-nav-link">
      <span class="lookbook-nav-icon">◆</span>
      <span class="lookbook-nav-text">
        <span class="lookbook-nav-label">${f}</span>
        <span class="lookbook-nav-sub">${story.subtitle}</span>
      </span>
    </a>`
  }).join("")
}

function renderStories(products) {
  const container = document.getElementById("lookbook-stories")
  if (!container) return

  const storyFabrics = FABRIC_ORDER.filter(f => {
    const p = getFabricProducts(products, f)
    return p.length > 0
  })

  if (storyFabrics.length === 0) {
    container.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 2rem;">No products available yet.</p>`
    return
  }

  container.innerHTML = storyFabrics.map((fabric, idx) => {
    const story = FABRIC_STORIES[fabric]
    const fabricProducts = getFabricProducts(products, fabric)
    const isEven = idx % 2 === 0
    const fabricImages = allImages.filter(img => img.fabric_type === fabric && img.section !== "lifestyle")
    const lifestyleImages = allImages.filter(img => img.fabric_type === fabric && img.section === "lifestyle")

    const base = "https://csajcdvwmmumhpuzpmuk.supabase.co/storage/v1/object/public/lookbook/"
    const heroImages = {
      Kente:  base + "lookbook-kente-hero-v2.png",
      Ankara: base + "lookbook-ankara-hero-v2.png",
      Smock:  base + "lookbook-smock-hero-v2.png",
    }
    const heroUrl = heroImages[fabric]

    return `
      <article class="story-section ${isEven ? "story-section-alt" : ""}" id="story-${fabric.toLowerCase().replace(/\s+/g, "-")}">

        <div class="story-header">
          <span class="story-region">${story.region}</span>
          <h2 class="story-title">${fabric} <em>${story.subtitle}</em></h2>
          <div class="story-divider">◆  ◆  ◆</div>
        </div>

        <div class="story-body">
          <div class="story-text">
            <p class="story-summary">${story.summary}</p>
            <ul class="story-traditions">
              ${story.traditions.map(t => `<li>${t}</li>`).join("")}
            </ul>
          </div>
          <div class="story-visual">
            <div class="story-visual-frame"${heroUrl ? ` style="background-image: url('${heroUrl}'); background-size: cover; background-position: center;"` : ""}>
              ${heroUrl ? "" : '<div class="kente-pattern-bg"></div>'}
              <div class="story-visual-content">
                ${heroUrl ? "" : '<span class="story-visual-icon">KL</span>'}
                <p>${fabric}</p>
              </div>
            </div>
          </div>
        </div>

        ${fabricImages.length > 0 ? `
        <div class="story-photo-gallery">
          <h3 class="story-gallery-heading">The <em>Craft</em></h3>
          <div class="story-photo-grid">
            ${fabricImages.map((img, imgIdx) => `
              <div class="story-photo-item" data-src="${img.image_url}" data-caption="${img.caption || ""}" data-fabric="${fabric}" data-index="${imgIdx}" data-section="${img.section || ""}">
                <div class="story-photo-frame">
                  <img class="story-photo-img" src="${img.image_url}" alt="${img.alt_text || img.caption || ""}" loading="lazy">
                </div>
                ${img.caption ? `<p class="story-photo-caption">${img.caption}</p>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

        ${lifestyleImages.length > 0 ? `
        <div class="story-gallery">
          <h3 class="story-gallery-heading">Wear the <em>Heritage</em></h3>
          <div class="lifestyle-art-grid">
            ${lifestyleImages.map((img, liIdx) => `
              <div class="lifestyle-art-item" data-src="${img.image_url}" data-caption="${img.caption || ""}" data-fabric="${fabric}" data-index="${liIdx}">
                <div class="lifestyle-art-frame">
                  <img class="lifestyle-art-img" src="${img.image_url}" alt="${img.alt_text || img.caption || ""}" loading="lazy">
                </div>
                ${img.caption ? `<p class="lifestyle-art-caption">${img.caption}</p>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

      </article>
    `
  }).join("")
}

function setupNavScroll() {
  const nav = document.getElementById("lookbook-nav")
  if (!nav) return

  const links = nav.querySelectorAll(".lookbook-nav-link")
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      const href = link.getAttribute("href")
      if (!href) return
      const target = document.querySelector(href)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" })
        // Update active state
        links.forEach(l => l.classList.remove("active"))
        link.classList.add("active")
      }
    })
  })

  // Intersection Observer for active nav state
  const sections = document.querySelectorAll(".story-section")
  if (sections.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id")
          links.forEach(l => {
            l.classList.toggle("active", l.getAttribute("href") === `#${id}`)
          })
        }
      })
    }, { rootMargin: "-30% 0px -60% 0px" })

    sections.forEach(s => observer.observe(s))
  }
}

function setupLightbox() {
  const lightbox = document.getElementById("lookbook-lightbox")
  const backdrop = document.getElementById("lightbox-backdrop")
  const closeBtn = document.getElementById("lightbox-close")
  const imgEl = document.getElementById("lightbox-img")
  const captionEl = document.getElementById("lightbox-caption")
  const prevBtn = document.getElementById("lightbox-prev")
  const nextBtn = document.getElementById("lightbox-next")

  if (!lightbox) return

  let currentFabric = null
  let currentIndex = 0
  let currentSection = null

  function getFabricImages(fabric, section) {
    return allImages.filter(img => img.fabric_type === fabric && (!section || img.section === section))
  }

  function showImage(fabric, index, section) {
    const images = getFabricImages(fabric, section)
    if (!images.length) return
    if (index < 0) index = images.length - 1
    if (index >= images.length) index = 0
    const img = images[index]
    imgEl.src = img.image_url
    imgEl.alt = img.alt_text || img.caption || ""
    captionEl.textContent = img.caption || ""
    currentFabric = fabric
    currentIndex = index
    currentSection = section
    if (prevBtn) prevBtn.style.display = images.length > 1 ? "" : "none"
    if (nextBtn) nextBtn.style.display = images.length > 1 ? "" : "none"
  }

  // Delegate click on story container
  const container = document.getElementById("lookbook-stories")
  if (!container) return

  container.addEventListener("click", (e) => {
    // Lifestyle art gallery click → lightbox
    const artItem = e.target.closest(".lifestyle-art-item")
    if (artItem) {
      const src = artItem.dataset.src
      const fabric = artItem.dataset.fabric
      const index = parseInt(artItem.dataset.index)
      if (src) {
        showImage(fabric, index, "lifestyle")
        lightbox.style.display = "flex"
        document.body.style.overflow = "hidden"
      }
      return
    }

    // Craft photo gallery click → lightbox
    const photoItem = e.target.closest(".story-photo-item")
    if (photoItem) {
      const src = photoItem.dataset.src
      const fabric = photoItem.dataset.fabric
      const index = parseInt(photoItem.dataset.index)
      const section = photoItem.dataset.section || undefined
      if (src) {
        showImage(fabric, index, section)
        lightbox.style.display = "flex"
        document.body.style.overflow = "hidden"
      }
      return
    }
  })

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentFabric) showImage(currentFabric, currentIndex - 1, currentSection)
    })
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentFabric) showImage(currentFabric, currentIndex + 1, currentSection)
    })
  }

  const closeLightbox = () => {
    lightbox.style.display = "none"
    document.body.style.overflow = ""
  }

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox)
  if (backdrop) backdrop.addEventListener("click", closeLightbox)

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return
    if (e.key === "Escape") closeLightbox()
    if (e.key === "ArrowLeft" && currentFabric) showImage(currentFabric, currentIndex - 1)
    if (e.key === "ArrowRight" && currentFabric) showImage(currentFabric, currentIndex + 1)
  })
}
