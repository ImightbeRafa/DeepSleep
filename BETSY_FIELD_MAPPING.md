# Betsy CRM Field Mapping - DeepSleep Website Orders

## Field Comparison: Manual vs API Orders

### ✅ Fields Now Matching

| Betsy Field | Manual Order | DeepSleep API | Status |
|-------------|--------------|---------------|--------|
| **Cliente** | Sigmund | ✅ `customer.name` | ✅ Mapped |
| **Teléfono** | 12121212 | ✅ `customer.phone` | ✅ Mapped |
| **Email** | peterfreud9@gmail.com | ✅ `customer.email` | ✅ Mapped |
| **Producto** | DeepSleep Bucal Anti-Ronquidos | ✅ `product.name` | ✅ Mapped |
| **Cantidad** | 1 | ✅ `product.quantity` | ✅ Mapped |
| **Provincia** | San José | ✅ `shipping.address.province` | ✅ Mapped |
| **Cantón** | asdasda | ✅ `shipping.address.canton` | ✅ Mapped |
| **Distrito** | asdsad | ✅ `shipping.address.district` | ✅ Mapped |
| **Dirección** | asdsadsad | ✅ `shipping.address.fullAddress` | ✅ Mapped |
| **Costo de Producto** | 9.9 | ✅ `product.unitPrice` | ✅ Mapped |
| **Costo de Envío** | 0 | ✅ `shipping.cost` (GRATIS) | ✅ Mapped |
| **Total** | 9,900 | ✅ `total` | ✅ Mapped |
| **Comentario** | Payment + Customer comments | ✅ `metadata.comments` | ✅ Mapped |
| **Timestamp** | 2025-11-12T23:59:37.109Z | ✅ `metadata.createdAt` | ✅ Mapped |
| **Estado** | Pendiente | ✅ `payment.status` (PENDIENTE) | ✅ Mapped |
| **Fecha de Venta** | 2025-11-12 | ✅ `payment.date` | ✅ Mapped |

### 🆕 Logistics Fields Added

| Betsy Field | Value | DeepSleep API Field | Notes |
|-------------|-------|---------------------|-------|
| **Vendedor** | Website | ✅ `seller: 'Website'` | Fixed value for all web orders |
| **Canal de Ventas** | Website | ✅ `salesChannel: 'Website'` | Fixed value for all web orders |
| **Mensajería/Delivery** | Correos de Costa Rica | ✅ `shipping.courier: 'Correos de Costa Rica'` | Fixed value for all orders |

### ⚪ Optional/Not Applicable Fields

| Betsy Field | Manual Order | DeepSleep API | Notes |
|-------------|--------------|---------------|-------|
| **Usuario** | - | Not set | Internal Betsy user field |
| **Negocio** | - | Not set | B2B field, not applicable |
| **Tamaño** | - | Not set | Product has no size variants |
| **Color** | - | Not set | Product has no color variants |
| **Empaque** | - | Not set | Standard packaging |
| **Personalización** | - | Not set | No customization offered |
| **Fecha Esperada** | - | Not set | Delivery date not tracked |
| **IVA** | 0 | Not set | Tax not applicable |
| **Canal** | - | Uses `salesChannel` | Duplicate field |

## Updated Payload Structure

```javascript
{
  orderId: "310220EA",
  customer: {
    name: "Sigmund",
    phone: "12121212",
    email: "peterfreud9@gmail.com"
  },
  product: {
    name: "DeepSleep Bucal Anti-Ronquidos",
    quantity: 1,
    unitPrice: "₡9.900"
  },
  shipping: {
    cost: "GRATIS",
    courier: "Correos de Costa Rica",  // 🆕 Added
    address: {
      province: "San José",
      canton: "asdasda",
      district: "asdsad",
      fullAddress: "asdsadsad"
    }
  },
  total: "₡9,900",
  payment: {
    method: "SINPE",
    transactionId: "PENDING",
    status: "PENDIENTE",
    date: "12/11/2025, 05:59:37 p. m."
  },
  source: "DeepSleep Website",
  salesChannel: "Website",  // 🆕 Added
  seller: "Website",         // 🆕 Added
  metadata: {
    campaign: "organic",
    referrer: "direct",
    comments: "Pago: SINPE Móvil - Estado: Pendiente de confirmación\n\nComentarios del cliente: feed the man",
    createdAt: "2025-11-12T23:59:37.109Z"
  }
}
```

## Changes Made to DeepSleep Code

### File: `api/utils/betsy.js`

**Added 3 new fields:**

1. **`shipping.courier`** - Line 69
   ```javascript
   courier: 'Correos de Costa Rica'
   ```

2. **`salesChannel`** - Line 93
   ```javascript
   salesChannel: 'Website'
   ```

3. **`seller`** - Line 94
   ```javascript
   seller: 'Website'
   ```

## Betsy API Endpoint Requirements

### If Betsy API Needs Updates:

The Betsy CRM API endpoint (`/api/integration/orders/create`) should accept these additional fields:

```javascript
// Add to Zod schema or validation
{
  // ... existing fields ...
  salesChannel: z.string().optional(),
  seller: z.string().optional(),
  shipping: {
    cost: z.string(),
    courier: z.string().optional(),  // 🆕 Add this
    address: {
      province: z.string(),
      canton: z.string(),
      district: z.string(),
      fullAddress: z.string()
    }
  }
}
```

### Database Schema Updates (if needed):

If Betsy stores these in separate database columns:

```sql
-- Add columns if they don't exist
ALTER TABLE orders ADD COLUMN sales_channel VARCHAR(255);
ALTER TABLE orders ADD COLUMN seller VARCHAR(255);
ALTER TABLE orders ADD COLUMN courier VARCHAR(255);
```

### Mapping in Betsy Backend:

```javascript
// In your Betsy order creation handler
const order = {
  // ... existing mappings ...
  salesChannel: req.body.salesChannel || null,
  seller: req.body.seller || null,
  courier: req.body.shipping?.courier || null,
  // ... rest of fields ...
}
```

## Testing Checklist

- [ ] Deploy updated DeepSleep code
- [ ] Place SINPE test order
- [ ] Verify in Betsy CRM:
  - [ ] Vendedor shows "Website"
  - [ ] Canal de Ventas shows "Website"
  - [ ] Mensajería shows "Correos de Costa Rica"
- [ ] Place Tilopay test order
- [ ] Verify same fields appear correctly

## Notes

- All web orders will have consistent logistics info
- Manual orders in Betsy can still use different values
- These fields help distinguish web orders from other sales channels
- Courier field ensures proper shipping routing
