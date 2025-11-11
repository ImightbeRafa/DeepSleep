// Import styles
import '../styles/main.css';

// Constants
const basePrice = 9900;
const API_BASE_URL = '/api'; // Vercel serverless functions

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

function updateTotal() {
    if (!quantitySelect || !totalElement) return;
    
    const quantity = parseInt(quantitySelect.value) || 1;
    const total = basePrice * quantity;
    
    // Format number with Costa Rican colones format
    totalElement.textContent = `₡${total.toLocaleString('es-CR')}`;
}

if (quantitySelect) {
    quantitySelect.addEventListener('change', updateTotal);
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
                    <p><strong>Importante:</strong> Use el nombre de su orden en el concepto del SINPE para verificar el pago.</p>
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
        
        // Show success modal with SINPE instructions
        showSinpeModal(result.orderId);
        
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
            throw new Error('Failed to create payment link');
        }
        
        const result = await response.json();
        
        if (result.paymentUrl) {
            // Redirect to Tilopay payment page
            window.location.href = result.paymentUrl;
        } else {
            throw new Error('No payment URL received');
        }
        
    } catch (error) {
        console.error('Tilopay payment error:', error);
        throw error;
    }
}

// Show SINPE modal with instructions
function showSinpeModal(orderId) {
    const modal = document.getElementById('payment-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2>📱 Instrucciones de Pago SINPE</h2>
        <div class="modal-order-info">
            <p><strong>Número de Orden:</strong></p>
            <p class="order-id-display">${orderId}</p>
        </div>
        <div class="sinpe-instructions">
            <h3>Siga estos pasos:</h3>
            <ol>
                <li>Abra la aplicación SINPE Móvil de su banco</li>
                <li>Realice una transferencia por <strong>₡${(basePrice * parseInt(document.getElementById('cantidad').value)).toLocaleString('es-CR')}</strong></li>
                <li><strong>Importante:</strong> En el concepto o descripción, escriba: <code>${orderId}</code></li>
                <li>Complete la transferencia</li>
            </ol>
            <div class="warning-box">
                <p>⚠️ <strong>Recuerde usar el número de orden (${orderId}) en el concepto del SINPE para que podamos verificar su pago.</strong></p>
            </div>
            <p>Recibirá un correo electrónico con esta información y los detalles de su pedido.</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.href='/'">Entendido</button>
    `;
    
    modal.style.display = 'flex';
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
    
    // Insert before form
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.parentNode.insertBefore(message, orderForm);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            message.remove();
        }, 5000);
    }
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Modal close handler
const modal = document.getElementById('payment-modal');
const closeBtn = document.querySelector('.modal-close');

if (closeBtn) {
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Initialize total on page load
document.addEventListener('DOMContentLoaded', function() {
    updateTotal();
});

