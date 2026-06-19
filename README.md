# Kente Luxe

Premium African heritage fashion e-commerce platform — connecting the global diaspora to authentic, handcrafted textiles and garments rooted in tradition.

**Live site:** [kente-luxe.pages.dev](https://kente-luxe.pages.dev)

---

## Overview

Kente Luxe is a full-featured e-commerce platform built for a luxury African fashion brand. It offers a seamless shopping experience with product discovery, guest and authenticated cart management, checkout with mobile money and card payment, user account management, and a comprehensive admin panel for store operations.

---

## Features

### Customer-facing
- **Product catalog** — browse and filter by occasion, fabric type, region, gender, and price range
- **Product detail modal** — inline product view with story, care instructions, color palette, and stock status
- **Shopping cart** — persists for both guest users (local ID) and authenticated customers (server-side)
- **Checkout** — delivery form, payment method selection (Mobile Money / Visa), order summary with tax and delivery fees
- **User accounts** — profile management, name and password updates, order history with expandable detail, account deletion
- **Product reviews** — verified-purchase only, star rating (1–5), admin-moderated, displayed on product modal
- **Custom orders** — bespoke garment request form
- **Heritage lookbook** — editorial gallery with fabric stories and lifestyle imagery
- **Newsletter** — email subscriptions stored via Supabase REST API

### Admin panel (`/admin/`)
- **Dashboard** — stat cards (orders, revenue, products, customers, low stock) and quick action links
- **Orders** — view, filter, and update order status
- **Products** — CRUD operations with image, pricing, stock, metadata, and categorization
- **Customers** — searchable customer list with order count and total spend
- **Reviews** — approve or reject pending customer reviews
- **Analytics** — revenue line chart, order status doughnut, top products bar chart (Chart.js)
- **Profile** — name update, password change, admin account deletion

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES modules) |
| **Backend** | Supabase (Auth, PostgreSQL, REST API) |
| **Hosting** | Cloudflare Pages |
| **Charts** | Chart.js (admin analytics) |
| **Payment** | Mobile Money (MTN, Telecel, AirtelTigo), Visa Card |

---

## Architecture

The platform uses a **static-first architecture** with Supabase as the backend:

- **Authentication** — Supabase Auth handles sign-up, sign-in, session management, and password resets. Auth state is synchronized across tabs via `onAuthStateChange`.
- **Data access** — All CRUD operations go through Supabase REST API via a custom `apiFetch` helper that injects the current session token. Database functions (RPCs) handle operations requiring server-side logic (e.g., verified-purchase review checks, admin key validation, revenue aggregation).
- **Guest support** — Unauthenticated users are tracked via a UUID stored in `localStorage`, allowing cart persistence before login.
- **Row-Level Security** — Tables use RLS with SECURITY DEFINER RPCs for privileged operations.

---

## Project Structure

```
kente-luxe/
├── index.html              # Homepage
├── shop.html               # Product catalog + detail modal
├── cart.html               # Shopping cart
├── checkout.html           # Checkout flow
├── account.html            # User profile + order history
├── login.html              # Customer sign-in / sign-up
├── custom-order.html       # Bespoke order form
├── lookbook.html           # Heritage gallery
├── our-story.html          # Brand story
├── contact.html            # Contact information
├── shipping.html           # Shipping & returns policy
├── product.html            # Legacy redirect → shop.html
├── admin/
│   ├── dashboard.html      # Admin home
│   ├── orders.html         # Order management
│   ├── products.html       # Product CRUD
│   ├── customers.html      # Customer list
│   ├── reviews.html        # Review moderation
│   ├── analytics.html      # Charts & insights
│   ├── profile.html        # Admin profile
│   └── login.html          # Admin sign-in / registration
├── js/
│   ├── supabase.js         # Supabase client init
│   ├── auth.js             # Auth functions
│   ├── cart.js             # Cart CRUD + apiFetch helper
│   ├── checkout.js         # Checkout logic
│   ├── shop.js             # Shop page + product modal + reviews
│   ├── products.js         # Product rendering + filters
│   ├── admin.js            # Admin auth helpers
│   ├── custom-order.js     # Custom order form
│   ├── lookbook.js         # Lookbook gallery
│   └── product.js          # Legacy product logic
└── css/
    └── style.css           # All styles
```

---

## Getting Started

### Prerequisites
- A Supabase project (free tier works)
- Your Supabase project URL and anon key

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/Elias512/kente-luxe.git
cd kente-luxe
```

2. **Configure Supabase connection**

Open `js/supabase.js` and verify the `SUPABASE_URL` and `SUPABASE_ANON_KEY` match your Supabase project settings.

3. **Database setup**

Run `sql/setup.sql` in your Supabase SQL Editor to create all tables, RLS policies, and RPC functions. After running, update the default admin secret key:

```sql
UPDATE admin_settings SET admin_key = 'your-secret-key' WHERE id = (SELECT id FROM admin_settings LIMIT 1);
```

4. **Open locally**

Serve the project with any static file server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Deploy

The site is fully static and can be deployed to any static hosting provider:

```bash
# Cloudflare Pages — connect Git repo via dashboard
# Netlify — drag-and-drop folder or connect Git
# GitHub Pages — push to gh-pages branch
```

No build step is required — simply publish the root directory.

---

## Admin Access

1. Navigate to `/admin/login.html`
2. Sign in with an existing admin account or register using the **Register** tab with the admin secret key
3. The admin secret key is verified via the `verify_admin_key` RPC against the `admin_settings` table

---

## Key Design Decisions

- **No framework** — The frontend uses vanilla JavaScript ES modules to keep dependencies minimal and load times fast.
- **RPC-first data access** — Sensitive operations (review submission, admin management, analytics aggregation) are handled through PostgreSQL functions with `SECURITY DEFINER` to bypass RLS cleanly.
- **Guest cart** — Cart data is tied to a `guest_id` UUID in `localStorage` until the user signs in, at which point it merges with the authenticated user's cart.
- **Verified reviews** — Reviews require a matching `order_items` record linked to the reviewer's auth ID or email, preventing fake reviews.
- **Admin moderation** — All customer reviews start as `pending` and must be approved in the admin panel before appearing publicly.

---

## License

All rights reserved. Kente Luxe — premium African heritage fashion.

## Team

Built by **Group 25** — COMP 454, University of Energy and Natural Resources, 2026.
