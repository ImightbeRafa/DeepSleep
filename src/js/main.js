// Import styles
import '../styles/main.css';

// Constants
const API_BASE_URL = '/api'; // Vercel serverless functions

// Pricing structure - MUST match backend pricing (api/utils/order.js)
const UNIT_PRICE = 9900; // ₡9,900 per unit, no volume discount

// Shipping costs
const SHIPPING_COST = 3000; // ₡3,000 for every order

const DEFAULT_OUT_OF_STOCK_MESSAGE = 'Estamos sin stock por el momento. No estamos recibiendo pedidos nuevos.';
const GENERIC_ORDER_ERROR = 'No pudimos procesar el pedido. Intente de nuevo o escríbanos por WhatsApp al 6201-9914.';
let productInStock = true;
let currentOutOfStockMessage = DEFAULT_OUT_OF_STOCK_MESSAGE;
let sinpeAvailable = false;
let isSubmitting = false;

const orderForm = document.getElementById('order-form');
const quantitySelect = document.getElementById('cantidad');

// ₡12.900 — matches the price format used across the site
function formatCRC(value) {
    return `₡${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function getOrderQuantity() {
    return parseInt(quantitySelect?.value, 10) || 1;
}

function getOrderTotal() {
    return UNIT_PRICE * getOrderQuantity() + SHIPPING_COST;
}

function getSelectedPaymentMethod() {
    const selected = orderForm?.querySelector('input[name="metodoPago"]:checked');
    return selected && selected.value === 'sinpe' && sinpeAvailable ? 'sinpe' : 'card';
}

// Checkout token: stays the same across retries of the same form data so the
// server can de-duplicate double clicks / flaky connections; changes when the
// customer edits the form.
let checkoutToken = null;

function newCheckoutToken() {
    try {
        if (window.crypto?.randomUUID) {
            return `tok_${window.crypto.randomUUID().replace(/-/g, '')}`;
        }
    } catch (e) {
        // fall through
    }
    return `tok_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function getCheckoutToken() {
    if (!checkoutToken) {
        checkoutToken = newCheckoutToken();
    }
    return checkoutToken;
}

function updateSubmitState() {
    const submitButton = orderForm?.querySelector('button[type="submit"]');
    const formNote = document.getElementById('form-note');
    const method = getSelectedPaymentMethod();
    const total = formatCRC(getOrderTotal());

    if (submitButton) {
        submitButton.disabled = !productInStock || isSubmitting;

        if (!productInStock) {
            submitButton.textContent = 'Sin stock por el momento';
        } else if (isSubmitting) {
            submitButton.textContent = 'Procesando...';
        } else {
            submitButton.textContent = method === 'sinpe'
                ? `Confirmar pedido de ${total} y pagar por SINPE`
                : `Pagar ${total} con tarjeta`;
        }
    }

    if (formNote) {
        formNote.textContent = method === 'sinpe'
            ? '📱 En el siguiente paso te mostramos el número SINPE y el monto exacto. También te lo enviamos por correo.'
            : '🔒 Serás redirigido a la pasarela segura de Tilopay para completar el pago.';
    }

    orderForm?.querySelectorAll('.payment-option').forEach((option) => {
        const input = option.querySelector('input[type="radio"]');
        option.classList.toggle('selected', Boolean(input?.checked));
    });
}

function setProductAvailability(inStock, message = DEFAULT_OUT_OF_STOCK_MESSAGE) {
    productInStock = inStock;
    currentOutOfStockMessage = message;
    document.body.classList.toggle('is-out-of-stock', !inStock);

    const stockMessage = document.getElementById('stock-message');
    const ctaButtons = document.querySelectorAll('a[href="#pedido"].btn-primary');

    if (stockMessage) {
        stockMessage.textContent = message;
        stockMessage.hidden = inStock;
    }

    ctaButtons.forEach((button) => {
        if (!button.dataset.inStockText) {
            button.dataset.inStockText = button.textContent;
        }

        button.textContent = inStock ? button.dataset.inStockText : 'Sin stock por el momento';
        button.classList.toggle('btn-disabled', !inStock);
        button.setAttribute('aria-disabled', String(!inStock));
    });

    updateSubmitState();
}

function setSinpeAvailability(available) {
    sinpeAvailable = Boolean(available);
    const sinpeOption = document.getElementById('payment-option-sinpe');

    if (sinpeOption) {
        sinpeOption.hidden = !sinpeAvailable;
    }

    if (sinpeAvailable && new URLSearchParams(window.location.search).get('pago') === 'sinpe') {
        const sinpeRadio = sinpeOption?.querySelector('input');
        if (sinpeRadio) sinpeRadio.checked = true;
    }

    if (!sinpeAvailable) {
        const cardRadio = orderForm?.querySelector('input[name="metodoPago"][value="card"]');
        if (cardRadio) cardRadio.checked = true;
    }

    updateSubmitState();
}

async function refreshStockStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/stock-status`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return;
        }

        const status = await response.json();
        setProductAvailability(status.inStock !== false, status.message || DEFAULT_OUT_OF_STOCK_MESSAGE);
        setSinpeAvailability(status.paymentMethods?.sinpe === true);
    } catch (error) {
        console.warn('Could not load stock status:', error);
    }
}

// --- Meta Pixel tracking helpers ---
function metaTrack(eventName, params, options) {
    try {
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
            if (params && options) {
                window.fbq('track', eventName, params, options);
            } else if (params) {
                window.fbq('track', eventName, params);
            } else {
                window.fbq('track', eventName);
            }
        }
    } catch (e) {
        // no-op — never break the site if Pixel fails
    }
}

// ViewContent — fires once when product section scrolls into view
(function setupViewContentObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    const productSection = document.getElementById('producto');
    if (!productSection) return;
    let hasFired = false;
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting || hasFired) return;
            hasFired = true;
            metaTrack('ViewContent', {
                content_ids: ['deepsleep-bucal'],
                content_name: 'DeepSleep Bucal Anti-Ronquidos',
                content_type: 'product',
                value: UNIT_PRICE,
                currency: 'CRC'
            });
            observer.disconnect();
        });
    }, { threshold: 0.3 });
    observer.observe(productSection);
})();

// AddToCart — fires on first quantity selector interaction
(function setupAddToCartTracking() {
    if (!quantitySelect) return;
    let hasTrackedAddToCart = false;
    quantitySelect.addEventListener('change', function() {
        if (hasTrackedAddToCart) return;
        hasTrackedAddToCart = true;
        metaTrack('AddToCart', {
            content_ids: ['deepsleep-bucal'],
            content_name: 'DeepSleep Bucal Anti-Ronquidos',
            content_type: 'product',
            value: UNIT_PRICE * getOrderQuantity(),
            currency: 'CRC'
        });
    });
})();

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Update summary based on quantity
function updateTotal() {
    const quantity = getOrderQuantity();
    const subtotal = UNIT_PRICE * quantity;

    const qtyElement = document.querySelector('.summary-qty');
    const subtotalElement = document.querySelector('.summary-subtotal');
    const shippingElement = document.querySelector('.summary-shipping-cost');
    const totalElement = document.querySelector('.summary-total-amount');

    if (qtyElement) qtyElement.textContent = `× ${quantity}`;
    if (subtotalElement) subtotalElement.textContent = formatCRC(subtotal);
    if (shippingElement) shippingElement.textContent = formatCRC(SHIPPING_COST);
    if (totalElement) totalElement.textContent = formatCRC(subtotal + SHIPPING_COST);

    updateSubmitState();
}

if (quantitySelect) {
    quantitySelect.addEventListener('change', updateTotal);
}

// --- Validation ---
function setFieldError(field, message) {
    const group = field.closest('.form-group');
    if (!group) return;

    let errorEl = group.querySelector('.field-error');
    if (message) {
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'field-error';
            errorEl.id = `${field.id}-error`;
            group.appendChild(errorEl);
        }
        errorEl.textContent = message;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', errorEl.id);
    } else {
        errorEl?.remove();
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    }
}

function validateField(field) {
    const value = String(field.value || '').trim();
    let message = '';

    if (field.required && !value) {
        message = 'Este campo es requerido.';
    } else if (field.name === 'telefono' && value.replace(/\D/g, '').length < 8) {
        message = 'Ingresá un teléfono de 8 dígitos.';
    } else if (field.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        message = 'Revisá tu correo, parece incompleto.';
    }

    setFieldError(field, message);
    return !message;
}

function validateForm() {
    const fields = Array.from(orderForm.querySelectorAll('input[required], select[required], textarea[required]'));
    let firstInvalid = null;

    fields.forEach((field) => {
        if (!validateField(field) && !firstInvalid) {
            firstInvalid = field;
        }
    });

    if (firstInvalid) {
        firstInvalid.focus({ preventScroll: true });
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    return true;
}

// Form submission handler
if (orderForm) {
    orderForm.addEventListener('change', (e) => {
        if (e.target.name === 'metodoPago') {
            updateSubmitState();
        }
    });

    orderForm.addEventListener('input', (e) => {
        if (e.target.name !== 'metodoPago') {
            // Different data → different order; keep the token only for pure retries.
            checkoutToken = null;
        }
        if (e.target.getAttribute('aria-invalid') === 'true') {
            validateField(e.target);
        }
    });

    orderForm.addEventListener('focusout', (e) => {
        if (e.target.matches('input, select, textarea') && e.target.value) {
            validateField(e.target);
        }
    });

    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return;

        if (!productInStock) {
            showMessage(currentOutOfStockMessage, 'error');
            return;
        }

        hideMessage();

        if (!validateForm()) {
            showMessage('Revisá los campos marcados en rojo.', 'error', { scroll: false });
            return;
        }

        const data = Object.fromEntries(new FormData(orderForm));
        const method = getSelectedPaymentMethod();
        delete data.metodoPago;

        setSubmitting(true, method === 'sinpe' ? 'Registrando su pedido...' : 'Conectando con la pasarela segura...');

        try {
            if (method === 'sinpe') {
                await handleSinpePayment({ ...data, checkoutToken: getCheckoutToken() });
            } else {
                await handleTilopayPayment(data);
            }
        } catch (error) {
            console.error('Payment error:', error);
            showMessage(error.userMessage || GENERIC_ORDER_ERROR, 'error');
            setSubmitting(false);
        }
    });
}

async function readApiError(response) {
    const errorData = await response.json().catch(() => ({}));

    if (errorData.error === 'OUT_OF_STOCK') {
        setProductAvailability(false, errorData.message || DEFAULT_OUT_OF_STOCK_MESSAGE);
    }

    if (errorData.error === 'SINPE_DISABLED') {
        setSinpeAvailability(false);
    }

    const error = new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    // Only surface server messages that were written for customers.
    if (response.status < 500 || errorData.error === 'ORDER_NOT_RECORDED' || errorData.error === 'SINPE_ORDER_FAILED') {
        error.userMessage = errorData.message;
    }
    return error;
}

// Handle SINPE payment
async function handleSinpePayment(data) {
    const response = await fetch(`${API_BASE_URL}/sinpe/create-order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw await readApiError(response);
    }

    const result = await response.json();

    if (!result.success || !result.orderId) {
        throw new Error('Invalid SINPE response');
    }

    const metaParams = {
        content_ids: ['deepsleep-bucal'],
        content_type: 'product',
        num_items: result.cantidad || getOrderQuantity(),
        value: result.total,
        currency: 'CRC'
    };
    metaTrack('InitiateCheckout', metaParams, result.metaEventIds?.initiateCheckout ? { eventID: result.metaEventIds.initiateCheckout } : undefined);
    metaTrack('Lead', { value: result.total, currency: 'CRC' }, result.metaEventIds?.lead ? { eventID: result.metaEventIds.lead } : undefined);

    try {
        sessionStorage.setItem(`deepsleep_sinpe_${result.orderId}`, JSON.stringify({
            orderId: result.orderId,
            total: result.total,
            cantidad: result.cantidad,
            sinpe: result.sinpe,
            whatsappUrl: result.whatsappUrl,
            email: data.email
        }));
    } catch (e) {
        // sinpe.html can still render from the query string + /api/stock-status
    }

    checkoutToken = null;

    const params = new URLSearchParams({
        orderId: result.orderId,
        total: String(result.total)
    });
    // Give the Pixel a moment to flush before navigating.
    setTimeout(() => {
        window.location.href = `/sinpe.html?${params.toString()}`;
    }, 250);
}

// Handle Tilopay payment
async function handleTilopayPayment(data) {
    const response = await fetch(`${API_BASE_URL}/tilopay/create-payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await readApiError(response);
        console.error('Tilopay API error:', error.message);
        throw error;
    }

    const result = await response.json();

    if (result.orderId && result.returnData) {
        try {
            sessionStorage.setItem(`deepsleep_returnData_${result.orderId}`, result.returnData);
            sessionStorage.setItem('deepsleep_latestOrderId', result.orderId);
        } catch (e) {
            console.warn('Could not persist order return data for success-page fallback:', e);
        }
    }

    if (!result.paymentUrl) {
        throw new Error('No payment URL received');
    }

    // InitiateCheckout for Tarjeta — with server dedup eventID
    if (result.metaEventId) {
        metaTrack('InitiateCheckout', {
            content_ids: ['deepsleep-bucal'],
            content_type: 'product',
            num_items: getOrderQuantity(),
            value: getOrderTotal(),
            currency: 'CRC'
        }, { eventID: result.metaEventId });
    }
    window.location.href = result.paymentUrl;
}

// --- Messages / loading ---
function showMessage(text, type = 'success', { scroll = true } = {}) {
    const message = document.getElementById('form-message');
    if (!message) return;

    message.textContent = text;
    message.className = `form-message message ${type}`;
    message.hidden = false;

    if (scroll) {
        message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function hideMessage() {
    const message = document.getElementById('form-message');
    if (message) message.hidden = true;
}

function setSubmitting(submitting, loadingText) {
    isSubmitting = submitting;
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');

    if (text && loadingText) text.textContent = loadingText;
    if (overlay) overlay.style.display = submitting ? 'flex' : 'none';

    updateSubmitState();
}

// Returning with the browser back button from Tilopay restores the page from
// bfcache with the overlay still showing — reset it.
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        setSubmitting(false);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());

    updateTotal();
    refreshStockStatus();
});

// --- Sticky CTA bar show/hide ---
(function setupStickyCta() {
    const stickyBar = document.getElementById('sticky-cta');
    if (!stickyBar) return;

    let heroPast = false;
    let orderVisible = false;

    function updateBar() {
        if (heroPast && !orderVisible) {
            stickyBar.classList.add('visible');
            document.body.classList.add('has-sticky-cta');
        } else {
            stickyBar.classList.remove('visible');
            document.body.classList.remove('has-sticky-cta');
        }
    }

    // Observer A — hero CTA buttons: show bar once they scroll out of view
    const heroButtons = document.querySelector('.cta-buttons');
    if (heroButtons) {
        new IntersectionObserver(function(entries) {
            heroPast = !entries[0].isIntersecting;
            updateBar();
        }, { threshold: 0 }).observe(heroButtons);
    }

    // Observer B — order form section: hide bar when form is on screen
    const orderSection = document.getElementById('pedido');
    if (orderSection) {
        new IntersectionObserver(function(entries) {
            orderVisible = entries[0].isIntersecting;
            updateBar();
        }, { threshold: 0.1 }).observe(orderSection);
    }
})();

