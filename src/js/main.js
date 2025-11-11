// Import styles
import '../styles/main.css';

// Constants
const API_BASE_URL = '/api'; // Vercel serverless functions

// Pricing structure
const pricing = {
    1: 9900,   // 1 unit: ₡9.900
    2: 16900,  // 2 units: ₡16.900 (₡8.450 each)
    3: 23900,  // 3 units: ₡23.900 (₡7.967 each)
    4: 30900,  // 4 units: ₡30.900 (₡7.725 each)
    5: 37900   // 5 units: ₡37.900 (₡7.580 each)
};

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Update total price based on quantity
const quantitySelect = document.getElementById('cantidad');
const totalElement = document.querySelector('.summary-total span:last-child');
const summaryItemElement = document.querySelector('.summary-item span:last-child');

function updateTotal() {
    if (!quantitySelect || !totalElement) return;
    
    const quantity = parseInt(quantitySelect.value) || 1;
    const total = pricing[quantity] || pricing[1];
    
    // Update price per unit display
    const pricePerUnit = Math.round(total / quantity);
    if (summaryItemElement) {
        summaryItemElement.textContent = `₡${pricePerUnit.toLocaleString('es-CR')} c/u`;
    }
    
    // Format number with Costa Rican colones format
    totalElement.textContent = `₡${total.toLocaleString('es-CR')}`;
}

if (quantitySelect) {
    quantitySelect.addEventListener('change', updateTotal);
    // Initialize pricing on page load
    updateTotal();
}

// Payment method change handler
const paymentMethodSelect = document.getElementById('metodo-pago');
const paymentInfoBox = document.getElementById('payment-info');

if (paymentMethodSelect && paymentInfoBox) {
    paymentMethodSelect.addEventListener('change', function() {
        const selectedMethod = this.value;
        
        if (selectedMethod === 'SINPE') {
            paymentInfoBox.style.display = 'block';
            paymentInfoBox.innerHTML = `
                <div class="payment-instructions sinpe">
                    <h4>📱 Instrucciones SINPE Móvil</h4>
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
                        <p style="margin: 5px 0;"><strong>📱 Número:</strong> <span style="font-size: 1.2em; color: #0369a1;">7033-9763</span></p>
                        <p style="margin: 5px 0;"><strong>👤 Nombre:</strong> Rafael Garcia</p>
                    </div>
                    <p><strong>⚠️ Importante:</strong></p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Use el número de su orden en el concepto del SINPE</li>
                        <li>Guarde el comprobante de pago</li>
                        <li>Envíe el comprobante por WhatsApp al <strong>6201-9914</strong></li>
                    </ul>
                </div>
            `;
        } else if (selectedMethod === 'Tarjeta') {
            paymentInfoBox.style.display = 'block';
            paymentInfoBox.innerHTML = `
                <div class="payment-instructions tilopay">
                    <h4>💳 Pago con Tarjeta</h4>
                    <p>Será redirigido a la pasarela de pago segura de Tilopay para completar su compra.</p>
                    <p>Aceptamos todas las tarjetas de crédito y débito.</p>
                </div>
            `;
        } else {
            paymentInfoBox.style.display = 'none';
        }
    });
}

// Form submission handler
const orderForm = document.getElementById('order-form');

if (orderForm) {
    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(orderForm);
        const data = Object.fromEntries(formData);
        
        const paymentMethod = data['metodo-pago'];
        
        if (!paymentMethod) {
            showMessage('Por favor, seleccione un método de pago', 'error');
            return;
        }
        
        // Show loading overlay
        showLoading(true);
        
        try {
            if (paymentMethod === 'SINPE') {
                await handleSinpePayment(data);
            } else if (paymentMethod === 'Tarjeta') {
                await handleTilopayPayment(data);
            }
        } catch (error) {
            console.error('Payment error:', error);
            showMessage('Error al procesar el pedido. Por favor, intente de nuevo.', 'error');
            showLoading(false);
        }
    });
}

// Handle SINPE payment
async function handleSinpePayment(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/email/send-sinpe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to process SINPE order');
        }
        
        const result = await response.json();
        
        showLoading(false);
        
        // Hide payment info box
        const paymentInfoBox = document.getElementById('payment-info');
        if (paymentInfoBox) {
            paymentInfoBox.style.display = 'none';
        }
        
        // Show success message
        showMessage(`¡Pedido recibido! Número de orden: ${result.orderId}. Revise su correo para las instrucciones de pago SINPE.`, 'success');
        
        // Reset form
        orderForm.reset();
        updateTotal();
        
    } catch (error) {
        console.error('SINPE payment error:', error);
        throw error;
    }
}

// Handle Tilopay payment
async function handleTilopayPayment(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/tilopay/create-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Tilopay API error:', errorData);
            throw new Error(errorData.message || 'Failed to create payment link');
        }
        
        const result = await response.json();
        
        showLoading(false);
        
        // Redirect to Tilopay payment page
        if (result.paymentUrl) {
            window.location.href = result.paymentUrl;
        } else {
            throw new Error('No payment URL received');
        }
        
    } catch (error) {
        console.error('Tilopay payment error:', error);
        throw error;
    }
}

// Show message function
function showMessage(text, type = 'success') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    message.style.maxWidth = '100%';
    message.style.width = '100%';
    
    // Insert before form
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.parentNode.insertBefore(message, orderForm);
        
        // Scroll to message
        message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Auto remove after 8 seconds
        setTimeout(() => {
            message.remove();
        }, 8000);
    }
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Initialize total on page load
document.addEventListener('DOMContentLoaded', function() {
    updateTotal();
});

