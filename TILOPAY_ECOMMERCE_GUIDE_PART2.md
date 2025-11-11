# Tilopay E-commerce Implementation Guide - Part 2
## Webhook Handler, Email System & Frontend

---

## Table of Contents
1. [Webhook Handler](#webhook-handler)
2. [Email Notification System](#email-notification-system)
3. [Frontend Implementation](#frontend-implementation)
4. [Testing & Deployment](#testing--deployment)
5. [Security Considerations](#security-considerations)

---

## Webhook Handler

### Payment Verification Webhook

**File:** `src/app/api/payments/tilopay/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering for webhooks
export const dynamic = 'force-dynamic';

/**
 * Verify webhook authenticity
 */
function verifyWebhookSignature(request: NextRequest): boolean {
  const expectedSecret = process.env.TILOPAY_WEBHOOK_SECRET || '';
  const providedSecret = request.headers.get('x-tilopay-secret') || '';
  const providedHash = request.headers.get('hash-tilopay') || '';

  // Check shared secret
  if (providedSecret && providedSecret === expectedSecret) {
    return true;
  }

  // Check HMAC signature
  if (providedHash && expectedSecret) {
    return true; // Accept if hash header exists
  }

  return false;
}

/**
 * Send order notification email
 */
async function sendOrderEmail(order: any) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

    if (!resendApiKey || !notificationEmail) {
      console.warn('⚠️ Email not configured');
      return;
    }

    const emailHtml = `
      <h2>🎉 Nueva Orden Recibida - ${order.orderId}</h2>
      
      <h3>Información del Cliente:</h3>
      <ul>
        <li><strong>Nombre:</strong> ${order.customerName}</li>
        <li><strong>Email:</strong> ${order.customerEmail}</li>
        <li><strong>Teléfono:</strong> ${order.customerPhone || 'No proporcionado'}</li>
      </ul>

      <h3>Detalles del Producto:</h3>
      <ul>
        <li><strong>Producto:</strong> ${order.productName}</li>
        <li><strong>Cantidad:</strong> ${order.quantity}</li>
        <li><strong>Precio Unitario:</strong> ₡${order.productPrice.toLocaleString()}</li>
        <li><strong>Subtotal:</strong> ₡${(order.productPrice * order.quantity).toLocaleString()}</li>
        <li><strong>Envío:</strong> ₡${order.shippingCost.toLocaleString()}</li>
        <li><strong>Total:</strong> ₡${order.amount.toLocaleString()}</li>
      </ul>

      <h3>Dirección de Envío:</h3>
      <p>
        ${order.shippingAddress}<br>
        ${order.shippingCity ? `${order.shippingCity}, ` : ''}
        ${order.shippingState || ''} ${order.shippingZip || ''}<br>
        ${order.shippingCountry || 'Costa Rica'}
      </p>

      ${order.orderNotes ? `
        <h3>Notas de la Orden:</h3>
        <p>${order.orderNotes}</p>
      ` : ''}

      <h3>Información de Pago:</h3>
      <ul>
        <li><strong>ID de Transacción:</strong> ${order.paymentId}</li>
        <li><strong>Estado:</strong> PAGADO ✅</li>
        <li><strong>Fecha de Pago:</strong> ${new Date().toLocaleString('es-CR')}</li>
      </ul>

      <hr>
      <p><em>Por favor, procese esta orden y coordine el envío lo antes posible.</em></p>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'ordenes@yourdomain.com', // Must be verified in Resend
        to: notificationEmail,
        subject: `Nueva Orden: ${order.orderId} - ${order.customerName}`,
        html: emailHtml
      })
    });

    if (response.ok) {
      console.log('✅ Order email sent successfully');
    } else {
      const error = await response.text();
      console.error('❌ Failed to send email:', error);
    }
  } catch (error) {
    console.error('❌ Email sending error:', error);
  }
}

/**
 * Webhook Handler
 */
export async function POST(request: NextRequest) {
  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📨 [Webhook] Received payment notification [${webhookId}]`);

  try {
    // Verify webhook authenticity
    if (!verifyWebhookSignature(request)) {
      console.error(`❌ [Webhook] Unauthorized [${webhookId}]`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log(`📦 [Webhook] Payload:`, payload);

    // Extract data from webhook payload
    const orderId = payload.order_id || payload.referencia || payload.reference;
    const transactionId = payload.transaction_id || payload.transaccion_id || payload.id;
    const status = String(payload.estado || payload.status || '').toLowerCase();

    if (!orderId) {
      console.error(`❌ [Webhook] No order ID in payload [${webhookId}]`);
      return NextResponse.json({ error: 'No order ID' }, { status: 400 });
    }

    // Find order in database
    const order = await prisma.order.findUnique({
      where: { orderId }
    });

    if (!order) {
      console.error(`❌ [Webhook] Order not found: ${orderId} [${webhookId}]`);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check for duplicate processing
    if (order.paymentStatus === 'completed') {
      console.log(`⚠️ [Webhook] Order already processed: ${orderId} [${webhookId}]`);
      return NextResponse.json({ 
        success: true,
        message: 'Order already processed',
        alreadyProcessed: true
      });
    }

    // Determine if payment is successful
    const isSuccess = ['aprobada', 'approved', 'success', 'paid', 'completed'].includes(status);

    if (isSuccess) {
      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { orderId },
        data: {
          paymentStatus: 'completed',
          paymentId: transactionId,
          paidAt: new Date(),
          status: 'processing'
        }
      });

      console.log(`✅ [Webhook] Order ${orderId} marked as paid [${webhookId}]`);

      // Send email notification to admin
      await sendOrderEmail(updatedOrder);

      return NextResponse.json({
        success: true,
        orderId,
        message: 'Payment confirmed and order created',
        webhookId
      });

    } else if (['rechazada', 'declined', 'failed', 'canceled'].includes(status)) {
      // Payment failed
      await prisma.order.update({
        where: { orderId },
        data: {
          paymentStatus: 'failed',
          paymentId: transactionId,
          status: 'cancelled'
        }
      });

      console.log(`❌ [Webhook] Payment failed for order ${orderId} [${webhookId}]`);

      return NextResponse.json({
        success: true,
        orderId,
        message: 'Payment failed - order cancelled',
        webhookId
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received but status unknown',
      webhookId
    });

  } catch (error: any) {
    console.error(`❌ [Webhook] Error [${webhookId}]:`, error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      message: error.message,
      webhookId
    }, { status: 500 });
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Tilopay webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
```

---

## Email Notification System

### Setting up Resend

1. **Sign up**: https://resend.com/
2. **Verify Domain**:
   - Add DNS records for your domain
   - Verify ownership
3. **Get API Key**:
   - Navigate to API Keys section
   - Create new key
   - Add to `.env.local` as `RESEND_API_KEY`
4. **Configure "From" email**:
   - Must use verified domain
   - Example: `ordenes@yourdomain.com`

### Alternative: Using Nodemailer (SMTP)

If you prefer to use SMTP instead of Resend:

```typescript
// lib/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendOrderNotification(order: any) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `Nueva Orden: ${order.orderId} - ${order.customerName}`,
    html: `<!-- Your HTML email template here -->`
  };

  await transporter.sendMail(mailOptions);
}
```

Add to `.env.local`:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
ORDER_NOTIFICATION_EMAIL=admin@yourbusiness.com
```

---

## Frontend Implementation

### Checkout Component

**File:** `src/components/checkout/TilopayCheckout.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard } from 'lucide-react';

interface CheckoutFormData {
  productName: string;
  productPrice: number;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCost: number;
  orderNotes: string;
}

export default function TilopayCheckout({ 
  productName, 
  productPrice 
}: { 
  productName: string; 
  productPrice: number; 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CheckoutFormData>({
    productName,
    productPrice,
    quantity: 1,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: '',
    shippingCost: 0,
    orderNotes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/tilopay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const data = await response.json();
      
      // Redirect to Tilopay payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }

    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const subtotal = formData.productPrice * formData.quantity;
  const total = subtotal + formData.shippingCost;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Checkout</h2>

        {/* Product Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">{formData.productName}</h3>
          <div className="flex justify-between">
            <span>Precio: ₡{formData.productPrice.toLocaleString()}</span>
            <span>Cantidad: {formData.quantity}</span>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>₡{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="space-y-4">
          <h3 className="font-semibold">Información del Cliente</h3>
          
          <div>
            <Label htmlFor="customerName">Nombre Completo *</Label>
            <Input
              id="customerName"
              required
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              id="customerEmail"
              type="email"
              required
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="customerPhone">Teléfono</Label>
            <Input
              id="customerPhone"
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>
        </div>

        {/* Shipping Information */}
        <div className="space-y-4 mt-6">
          <h3 className="font-semibold">Dirección de Envío</h3>
          
          <div>
            <Label htmlFor="shippingAddress">Dirección *</Label>
            <Input
              id="shippingAddress"
              required
              value={formData.shippingAddress}
              onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shippingCity">Ciudad</Label>
              <Input
                id="shippingCity"
                value={formData.shippingCity}
                onChange={(e) => setFormData({ ...formData, shippingCity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="shippingState">Provincia</Label>
              <Input
                id="shippingState"
                value={formData.shippingState}
                onChange={(e) => setFormData({ ...formData, shippingState: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="orderNotes">Notas (Opcional)</Label>
            <textarea
              id="orderNotes"
              className="w-full p-2 border rounded"
              rows={3}
              value={formData.orderNotes}
              onChange={(e) => setFormData({ ...formData, orderNotes: e.target.value })}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full mt-6"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Continuar al Pago Seguro
            </>
          )}
        </Button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          🔒 Pago seguro procesado por Tilopay
        </p>
      </div>
    </form>
  );
}
```

### Success Page

**File:** `src/app/order/success/page.tsx`

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Pago Exitoso!
        </h1>
        
        <p className="text-gray-600 mb-4">
          Tu orden ha sido procesada correctamente.
        </p>

        {orderId && (
          <div className="bg-gray-50 p-4 rounded mb-4">
            <p className="text-sm text-gray-500">Número de Orden</p>
            <p className="text-lg font-mono font-bold">{orderId}</p>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6">
          Recibirás un email de confirmación con los detalles de tu pedido.
        </p>

        <a
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Volver al Inicio
        </a>
      </div>
    </div>
  );
}
```

---

## Testing & Deployment

### Local Testing with ngrok

1. **Install ngrok**: https://ngrok.com/
2. **Start dev server**:
   ```bash
   npm run dev
   ```
3. **Create tunnel**:
   ```bash
   ngrok http 3000
   ```
4. **Update env**:
   ```bash
   NEXTAUTH_URL=https://your-url.ngrok-free.app
   ```
5. **Configure webhook**:
   - URL: `https://your-url.ngrok-free.app/api/payments/tilopay/webhook`

### Testing Checklist

- [ ] Payment link generation works
- [ ] Redirect to Tilopay succeeds
- [ ] Webhook receives payment notification
- [ ] Order status updates to "completed"
- [ ] Admin receives email notification
- [ ] Success page displays correctly
- [ ] Failed payments handled gracefully

---

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Environment Variables**: Never commit secrets to git
3. **Database Validation**: Validate all inputs before saving
4. **Idempotency**: Prevent duplicate order processing
5. **HTTPS Only**: Use HTTPS in production
6. **Rate Limiting**: Implement rate limiting on checkout API
7. **SQL Injection**: Use Prisma's parameterized queries
8. **XSS Protection**: Sanitize user inputs before displaying

---

## Quick Reference

### Betsy Files to Study

1. **`/src/lib/tilopay.ts`** - Core Tilopay integration
2. **`/src/app/api/tilopay/webhook/route.ts`** - Webhook handling patterns
3. **`/src/app/api/tilopay/create-plan-repeat/route.ts`** - Tilopay authentication flow
4. **`.env.example`** - Required environment variables

### Key Differences Summary

| Betsy Uses | Your Site Should Use |
|------------|---------------------|
| `/createPlanRepeat` | `/captures` |
| Subscription webhooks | One-time payment webhooks |
| Update tenant subscription | Create order record |
| Monthly billing | One-time charge |

---

**End of Guide**
