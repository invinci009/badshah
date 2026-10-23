# Biryani Badshah API Reference

## Public Endpoints (Guest & Diner Facing)

All public endpoints are rate-limited and protected by the Edge proxy.

### 1. `GET /api/public/order-menu`
- **Query Params**: `slug` (required), `token` (optional), `table` (optional)
- **Headers**: Supports `If-None-Match` for HTTP 304 Not Modified
- **Response**: `{ items, categories, table, orderingConfig, contact, tables }`
- **Caching**: `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` with ETag

### 2. `POST /api/public/orders`
- **Payload**:
  ```json
  {
    "slug": "biryani-badshah-patna",
    "customerName": "Amanullah",
    "customerPhone": "9876543210",
    "tableLabel": "4",
    "items": [{ "itemId": "dish_1", "quantity": 2, "selections": [] }],
    "idempotencyKey": "uuid-v4",
    "clientTotalPaise": 59800
  }
  ```
- **Error Codes**:
  - `401 LOGIN_REQUIRED`: Guest must enter mobile number
  - `409 TABLE_OCCUPIED`: Table already booked by another guest
  - `409 TABLE_CLEANING`: Table is being sanitized
  - `409 PRICE_CHANGED`: Menu prices updated, returns authoritative quote
  - `409 ITEM_UNAVAILABLE`: Item sold out

### 3. `GET /api/public/orders/:id`
- **Query Params**: `token` (unguessable customer access token)
- **Headers**: Supports `If-None-Match`
- **Response**: Masked customer info, order status, item breakdown, payment status

### 4. `POST /api/public/loyalty/auth`
- **Payload**: `{ "action": "phone-login", "phone": "9876543210", "name": "Guest" }`
- **Response**: Customer profile, points balance, active VIP status
- **Cookies**: Sets secure `badshah_customer_session` cookie

### 5. `GET /api/public/loyalty/summary`
- **Headers**: Supports `If-None-Match`
- **Response**: Available points, previous order history, redemption ledger

### 6. `GET /api/public/loyalty/rewards`
- **Headers**: Supports `If-None-Match`
- **Response**: Active rewards with customer-specific eligibility flags (`OK`, `INSUFFICIENT_POINTS`, `MIN_ORDER_NOT_MET`)

### 7. `POST /api/public/service-requests`
- **Payload**: `{ "tableLabel": "4", "type": "water" | "bill" | "cleaning" | "assistance", "note": "optional" }`
- **Response**: `{ "id": "req_1", "status": "OPEN" }`

---

## Business Endpoints (Staff & Admin Facing)

Requires admin session cookie (`firebase_token`) or Bearer token.

### 1. `GET /api/business/orders`
- **Query Params**: `status` (optional filter), `limit`
- **Headers**: Fast 4-second coalesced in-memory cache with ETag

### 2. `POST /api/business/orders/:id/status`
- **Payload**: `{ "fulfilment": "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED" }`
- **Side Effects**: Automatically updates table to `cleaning` when all table orders are `SERVED`

### 3. `GET /api/business/tables`
- **Response**: List of all dining tables with live state (`available`, `occupied`, `cleaning`)

### 4. `PATCH /api/business/tables`
- **Payload**: `{ "id": "table_1", "state": "cleaning" | "available" | "occupied" }`

### 5. `GET /api/business/service-requests`
- **Response**: Real-time staff assistance queue with 304 conditional support
