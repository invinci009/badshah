# Biryani Badshah Architecture & Scale Design

## 1. High-Concurrency & Low Server Read Architecture (400+ Users)

The platform is designed to effortlessly handle 400+ simultaneous dining guests and kitchen staff without exceeding Firestore free or standard read quotas.

### Multi-Tier Caching Stack
1. **Tier 1: Global In-Memory Store (`__rp_memoryStore`)**
   - Attached to `globalThis` to survive Next.js module re-evaluations and Server Action executions.
   - 30-minute TTL on semi-static catalogs (categories, menu items, restaurant settings, loyalty config).
   - Instant 0-read memory lookups for repeated catalog views.

2. **Tier 2: Request Coalescing (`__rp_inFlightRequests`)**
   - When 100 guests open the menu simultaneously during peak hours, only **1 database query** executes.
   - All 99 other concurrent promises hook onto the active in-flight query, preventing thundering herds.

3. **Tier 3: Active Orders Memory Cache (`__rp_activeOrdersCache`)**
   - Staff dashboards poll `/api/business/orders` every 3 seconds across kitchen tablets.
   - An in-memory cache with a 4-second coalesced window serves these polls directly with `304 Not Modified` headers.
   - Automatic immediate invalidation on order placement or status update guarantees zero lag.

4. **Tier 4: Conditional HTTP Caching (ETags & 304 Not Modified)**
   - All public endpoints (`/api/public/order-menu`, `/api/public/orders/[id]`, `/api/public/loyalty/summary`, `/api/public/loyalty/rewards`) emit deterministic ETags.
   - When data has not changed, the server returns an empty `304 Not Modified`, saving bandwidth, CPU, and Firestore quota.

---

## 2. Component & Modularization Structure

The presentation layer is strictly decoupled from business logic and state orchestration:

```
src/
├── app/
│   ├── (auth)/             # Login, register, auth flows
│   ├── (dashboard)/        # Kitchen and admin dashboard workspaces
│   ├── api/
│   │   ├── business/       # Admin endpoints (protected by session token)
│   │   └── public/         # Guest endpoints (rate-limited, sanitized)
│   └── order/[slug]/       # Diner portal: menu, cart, checkout, confirmation
├── components/
│   ├── dashboard/          # OrdersTab, KitchenTab, TablesTab, LoyaltyTab, MenuTab
│   ├── ordering/           # Modular ordering components
│   │   ├── ItemDetailModal.tsx   # Customization & dietary selections
│   │   ├── TableSelectModal.tsx  # Dynamic table availability & states
│   │   ├── ServiceCallModal.tsx  # Waiter call assistance
│   │   ├── VipOrdersHubModal.tsx # VIP Gold card, order history & perks
│   │   ├── ItemCard.tsx          # Menu dish card with veg badges & quick quantity
│   │   └── MainPortalSelector.tsx# Portal selector for QR routing
│   └── quiz/               # Feedback and Google Review workflows
├── config/
│   ├── env.ts              # Strongly-typed environment schema (Zod)
│   ├── loader.ts           # White-label restaurant brand loader
│   └── schema.ts           # Restaurant config schema
└── lib/
    ├── cache.ts            # Coalesced multi-tier cache
    ├── firebase/           # Admin & client Firestore implementations
    └── ordering/           # Pure business logic, validation & cart
```

---

## 3. Server Security & Edge Filtering

1. **Proxy Layer (`src/proxy.ts`)**
   - Runs before any route handler.
   - Uses `bot-filter` to block web crawlers and scrapers from hitting dynamic endpoints.
   - Uses multi-tier rate limiting (Upstash Redis + in-memory sliding window).
   - Validates Firebase auth cookies on `/dashboard/*` before passing to server components.

2. **HTTP Security Headers (`next.config.ts`)**
   - `X-Frame-Options: SAMEORIGIN` prevents clickjacking.
   - `X-Content-Type-Options: nosniff` stops MIME-sniffing vulnerabilities.
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
   - `X-XSS-Protection: 1; mode=block`.

3. **Table & Occupancy Protection**
   - Tables track live state: `available`, `occupied`, `cleaning`.
   - Anti-collision logic rejects orders to occupied or cleaning tables unless placed by the same active dining party.
