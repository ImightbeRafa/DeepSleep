# DeepSleep - E-commerce Website

A professional, conversion-optimized e-commerce website for DeepSleep, an anti-snoring mouthguard product made of EVA material, serving customers in Costa Rica.

**✨ Recently Redesigned** - Now featuring modern e-commerce best practices, trust signals, testimonials, and professional UI/UX design.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The site will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

This will create an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
DeepSleep/
├── src/
│   ├── index.html          # Main HTML entry point
│   ├── js/
│   │   └── main.js         # JavaScript logic and form handling
│   └── styles/
│       └── main.css        # All styles with soft peace colors
├── public/                 # Static assets (images, etc.)
├── dist/                   # Production build output (generated)
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
└── README.md               # This file
```

## 🎨 Features

### Design & UX
- **Modern E-Commerce Design**: Professional, conversion-optimized layout
- **Hero Section**: Two-column layout with product image placement and clear value proposition
- **Trust Signals**: Security badges, guarantees, and credibility indicators
- **Social Proof**: Customer testimonials with 5-star ratings
- **Trust Bar**: Metrics showing 500+ customers, 4.8/5 rating, delivery time
- **Product Showcase**: Detailed benefits with icons and descriptions
- **30-Day Guarantee**: Money-back guarantee section with shield icon
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices

### Functionality
- **Single Product Focus**: Dedicated to DeepSleep bucal anti-ronquidos
- **Contact Integration**: Direct links to WhatsApp and Instagram
- **Order Form**: Simple, user-friendly form with order summary
- **Smooth Scrolling**: Navigation with smooth scroll behavior
- **Dynamic Pricing**: Automatic total calculation based on quantity
- **Payment Integration Ready**: Prepared for Tilopay, SINPE, and bank transfer

### Technical
- **Fast Loading**: Optimized CSS and minimal JavaScript
- **Hot Module Replacement**: Fast development with Vite's HMR
- **SEO Ready**: Semantic HTML and proper meta tags
- **Accessibility**: WCAG compliant design elements

## 📦 Product Information

- **Price**: ₡9.900 (Costa Rican Colones)
- **Shipping**: Free shipping (3-5 business days throughout Costa Rica)
- **Material**: EVA (hypoallergenic, comfortable, moldable at home)

## 📞 Contact Information

- **WhatsApp**: [wa.me/50662019914](https://wa.me/50662019914)
- **Instagram**: [@deepsleep.cr](https://www.instagram.com/deepsleep.cr/)

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

### Tech Stack

- **Vite** - Fast build tool and dev server
- **Vanilla JavaScript** - No framework dependencies
- **CSS** - Custom styles with CSS variables

## 📧 Email Implementation

The order form currently uses a `mailto:` link to open the user's default email client with pre-filled order information. This is a simple solution that doesn't require backend infrastructure.

### Future Email Options

When ready to implement a more robust solution, consider:

1. **EmailJS**: Client-side email service (free tier available)
2. **Formspree**: Simple form backend service
3. **Backend API**: Custom backend endpoint to handle email sending
4. **Tilopay Webhook**: Integration with Tilopay payment system

## 💳 Tilopay Integration

The website is prepared for Tilopay payment processing. Implementation guide to be provided later.

## 🎨 Customization

### Colors

Colors are defined in CSS variables at the top of `src/styles/main.css`:

```css
:root {
    --color-primary: #4a90e2;        /* Professional blue */
    --color-primary-dark: #357abd;   /* Hover states */
    --color-success: #27ae60;        /* Trust, free shipping */
    --color-warning: #f39c12;        /* Urgency */
    --color-text: #2c3e50;           /* Dark, readable */
    --color-light-grey: #f8f9fa;     /* Light sections */
    /* ... */
}
```

### Configuration

Edit `vite.config.js` to customize:
- Development server port
- Build output directory
- Build optimizations

## 📚 Documentation

The redesign includes comprehensive documentation:

- **REDESIGN_NOTES.md** - Complete overview of improvements and best practices implemented
- **ECOMMERCE_BEST_PRACTICES.md** - Detailed checklist of 15 e-commerce best practices
- **HOW_TO_ADD_IMAGES.md** - Step-by-step guide for adding product images
- **IMAGE_PLACEMENT_GUIDE.md** - Visual guide showing where to place images

## 🖼️ Adding Product Images

The website has placeholder areas for your product images. To add real images:

1. Create `public/images/` folder
2. Add your product photos (see HOW_TO_ADD_IMAGES.md)
3. Replace placeholder divs in `index.html` with `<img>` tags
4. Recommended sizes:
   - Hero image: 800x600px
   - Showcase image: 600x500px

See **HOW_TO_ADD_IMAGES.md** for detailed instructions.

## ✅ E-Commerce Best Practices

This website implements 15 major e-commerce best practices:

1. ✅ Above-the-fold optimization
2. ✅ Trust signals & credibility
3. ✅ Clear value proposition
4. ✅ Social proof (testimonials)
5. ✅ Urgency & scarcity
6. ✅ Risk reversal (30-day guarantee)
7. ✅ Clear CTAs
8. ✅ Product information hierarchy
9. ✅ Professional visual design
10. ✅ Mobile optimization
11. ✅ Transparent pricing
12. ✅ Shipping information
13. ✅ Form optimization
14. ✅ Benefit-driven content
15. ✅ Excellent user experience

See **ECOMMERCE_BEST_PRACTICES.md** for complete details.

## 🌐 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License

© 2024 DeepSleep. All rights reserved.
