# How to Add Product Images to DeepSleep

## Quick Start

Your website now has two placeholder areas for product images. Follow these steps to add your actual product photos.

## Image Requirements

### Hero Image (Main Product Photo)
- **Recommended Size**: 800x600px or larger
- **Aspect Ratio**: 4:3 or 16:9
- **Format**: JPG or PNG
- **File Size**: Under 500KB (optimized)
- **Content**: Clean product shot on white/light background

### Showcase Image (Product Detail/In Use)
- **Recommended Size**: 600x500px or larger
- **Aspect Ratio**: Square or 4:3
- **Format**: JPG or PNG
- **File Size**: Under 400KB (optimized)
- **Content**: Product in use, packaging, or detail shot

## Step 1: Prepare Your Images

1. Take high-quality photos of your DeepSleep product
2. Use good lighting (natural light works best)
3. Clean background (white or light colored)
4. Show product from best angle
5. Optimize images using tools like:
   - TinyPNG (https://tinypng.com)
   - Squoosh (https://squoosh.app)
   - Photoshop "Save for Web"

## Step 2: Add Images to Your Project

Create a folder for images:
```
DeepSleep/
  public/
    images/
      product-hero.jpg        ← Main product image
      product-showcase.jpg    ← Detail/in-use image
      product-package.jpg     ← Optional: packaging
```

## Step 3: Update HTML - Hero Section

Find this code in `index.html` (around line 88-100):

```html
<div class="hero-image">
    <div class="product-image-container">
        <div class="image-placeholder">
            <!-- OLD PLACEHOLDER CODE -->
        </div>
        <div class="image-badge">Material EVA Premium</div>
    </div>
</div>
```

Replace with:

```html
<div class="hero-image">
    <div class="product-image-container">
        <img src="/images/product-hero.jpg" 
             alt="DeepSleep Bucal Anti-Ronquidos" 
             class="product-main-image" />
        <div class="image-badge">Material EVA Premium</div>
    </div>
</div>
```

## Step 4: Update HTML - Showcase Section

Find this code in `index.html` (around line 151-159):

```html
<div class="showcase-image">
    <div class="showcase-placeholder">
        <!-- OLD PLACEHOLDER CODE -->
    </div>
</div>
```

Replace with:

```html
<div class="showcase-image">
    <img src="/images/product-showcase.jpg" 
         alt="DeepSleep en uso" 
         class="product-showcase-image" />
</div>
```

## Step 5: Add CSS for Images

Add this to the end of `src/styles/main.css`:

```css
/* Product Images */
.product-main-image {
    width: 100%;
    height: auto;
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    object-fit: cover;
    max-height: 500px;
}

.product-showcase-image {
    width: 100%;
    height: auto;
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    object-fit: cover;
    max-height: 400px;
}

/* Optional: Add hover effect */
.product-main-image:hover,
.product-showcase-image:hover {
    transform: scale(1.02);
    transition: transform 0.3s ease;
}
```

## Advanced: Multiple Product Images (Gallery)

If you want to show multiple product angles, add this to the hero section:

```html
<div class="product-gallery">
    <img src="/images/product-front.jpg" alt="Vista frontal" class="gallery-main" />
    <div class="gallery-thumbnails">
        <img src="/images/product-side.jpg" alt="Vista lateral" />
        <img src="/images/product-case.jpg" alt="Estuche incluido" />
        <img src="/images/product-detail.jpg" alt="Detalle material" />
    </div>
</div>
```

Add this CSS:

```css
.product-gallery {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.gallery-main {
    width: 100%;
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
}

.gallery-thumbnails {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-xs);
}

.gallery-thumbnails img {
    width: 100%;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: transform 0.2s;
}

.gallery-thumbnails img:hover {
    transform: scale(1.05);
}
```

## Image Optimization Tips

### Before Upload:
1. **Resize**: Don't upload 4000px images for 500px display
2. **Compress**: Use TinyPNG or similar tools
3. **Format**: 
   - JPG for photos
   - PNG for graphics with transparency
   - WebP for best compression (modern browsers)

### Recommended Tools:
- **Online**: TinyPNG, Squoosh, Compressor.io
- **Desktop**: Photoshop, GIMP, XnConvert
- **CLI**: ImageMagick, Sharp (Node.js)

### Example ImageMagick Command:
```bash
magick product.jpg -resize 800x600 -quality 85 product-optimized.jpg
```

## Using WebP Format (Modern & Efficient)

For better performance, use WebP with JPG fallback:

```html
<picture>
    <source srcset="/images/product-hero.webp" type="image/webp">
    <img src="/images/product-hero.jpg" 
         alt="DeepSleep Bucal Anti-Ronquidos" 
         class="product-main-image" />
</picture>
```

Convert to WebP online: https://cloudconvert.com/jpg-to-webp

## Lazy Loading (Performance Boost)

Add `loading="lazy"` to images below the fold:

```html
<img src="/images/product-showcase.jpg" 
     alt="DeepSleep en uso" 
     class="product-showcase-image"
     loading="lazy" />
```

## Testing Your Images

After adding images:

1. ✅ Check all images load correctly
2. ✅ Test on mobile devices
3. ✅ Verify file sizes are optimized
4. ✅ Check alt text for accessibility
5. ✅ Test page load speed (PageSpeed Insights)

## Troubleshooting

### Image Not Showing?
- Check file path is correct
- Verify image is in `public/images/` folder
- Check file name matches exactly (case-sensitive)
- Clear browser cache (Ctrl+Shift+R)

### Image Too Large?
- Compress with TinyPNG
- Resize to recommended dimensions
- Convert to WebP format

### Image Looks Stretched?
- Check aspect ratio matches recommendation
- Use `object-fit: cover` in CSS
- Crop image to proper dimensions

## Example: Complete Hero Section with Image

```html
<div class="hero-image">
    <div class="product-image-container">
        <picture>
            <source srcset="/images/product-hero.webp" type="image/webp">
            <img src="/images/product-hero.jpg" 
                 alt="DeepSleep Bucal Anti-Ronquidos - Material EVA Premium" 
                 class="product-main-image"
                 width="800"
                 height="600"
                 loading="eager" />
        </picture>
        <div class="image-badge">Material EVA Premium</div>
    </div>
</div>
```

## Need Help?

If you need help with images:
1. Check browser console for errors (F12)
2. Verify file paths in DevTools Network tab
3. Test with a simple image first
4. Ensure images are in correct folder

---

**Pro Tip**: Use professional product photography if possible. Good images significantly increase conversion rates!
