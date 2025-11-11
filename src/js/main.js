// Import styles
import '../styles/main.css';

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
const priceElement = document.querySelector('.price');
const totalElement = document.querySelector('.summary-total span:last-child');

const basePrice = 9900;

function updateTotal() {
    const quantity = parseInt(quantitySelect.value) || 1;
    const total = basePrice * quantity;
    
    // Format number with Costa Rican colones format
    totalElement.textContent = `₡${total.toLocaleString('es-CR')}`;
}

if (quantitySelect) {
    quantitySelect.addEventListener('change', updateTotal);
}

// Form submission handler
const orderForm = document.getElementById('order-form');

if (orderForm) {
    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(orderForm);
        const data = Object.fromEntries(formData);
        
        // Calculate total
        const quantity = parseInt(data.cantidad) || 1;
        const total = basePrice * quantity;
        
        // Prepare email content
        const emailSubject = `Nuevo Pedido DeepSleep - ${data.nombre}`;
        const emailBody = `
NUEVO PEDIDO DEEPSLEEP
========================

INFORMACIÓN DE CONTACTO:
------------------------
Nombre: ${data.nombre}
Teléfono: ${data.telefono}
Email: ${data.email || 'No proporcionado'}

DIRECCIÓN DE ENVÍO:
-------------------
Provincia: ${data.provincia}
Cantón: ${data.canton}
Distrito: ${data.distrito}
Dirección exacta: ${data.direccion}

DETALLES DEL PEDIDO:
--------------------
Cantidad: ${data.cantidad} unidad(es)
Precio unitario: ₡9.900
Total: ₡${total.toLocaleString('es-CR')}

MÉTODO DE PAGO:
---------------
${data['metodo-pago']}

${data.comentarios ? `COMENTARIOS:\n${data.comentarios}` : ''}

---
Fecha: ${new Date().toLocaleString('es-CR')}
        `.trim();
        
        // Create mailto link
        const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        
        // For now, we'll use mailto. Later this can be replaced with:
        // 1. A backend API endpoint
        // 2. Email service like EmailJS, Formspree, etc.
        // 3. Integration with Tilopay webhook
        
        // Show success message
        showMessage('¡Pedido enviado! Por favor, revisa tu cliente de correo para enviar el email. Si prefieres, también puedes contactarnos por WhatsApp.', 'success');
        
        // Open mailto (user can choose to send or copy)
        window.location.href = mailtoLink;
        
        // Alternative: You can also copy to clipboard
        // Uncomment the following if you want to copy email body to clipboard instead:
        /*
        try {
            await navigator.clipboard.writeText(emailBody);
            showMessage('¡Información del pedido copiada al portapapeles! Por favor, envíala por email o WhatsApp.', 'success');
        } catch (err) {
            // Fallback to mailto
            window.location.href = mailtoLink;
        }
        */
        
        // Reset form after a delay
        setTimeout(() => {
            orderForm.reset();
            updateTotal();
        }, 2000);
    });
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

// Initialize total on page load
document.addEventListener('DOMContentLoaded', function() {
    updateTotal();
});

