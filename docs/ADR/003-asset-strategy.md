# 3. Asset Strategy (Images, Fonts, Icons)

*Status: Proposed*

**Context:**
Static assets like images, fonts, and icons are major contributors to page weight and Core Web Vitals (LCP, CLS). A consistent and optimized strategy is required.

**Decision:**

1.  **Images**: All images must be optimized.
    - **Component**: Use the **`next/image`** component for all static and content images. This provides automatic resizing, format conversion (WebP/AVIF), and lazy loading.
    - **LCP**: The Largest Contentful Paint (LCP) image on any given page must have the `priority` prop set.
    - **Source**: Store images in the `/public` directory.

2.  **Fonts**:
    - **Loading**: Use the **`next/font`** package to load and self-host web fonts. This eliminates a round-trip to a font provider and improves performance.
    - **Display**: Ensure `font-display: swap` is used to prevent text from being invisible while the font loads.
    - **Subsetting**: When using custom fonts, create subsets that only include the characters used on the site.

3.  **Icons**:
    - **Format**: Use **SVG** for all icons for scalability and small file size.
    - **Implementation**: Use the **`@svgr/webpack`** loader (already configured) to import SVGs as React components. This allows for easy styling and manipulation.
    - **Library**: `lucide-react` is the preferred icon library for consistency.

**Consequences:**
- **Pros:**
  - Maximizes performance by leveraging Next.js built-in optimizations.
  - Improves Core Web Vitals scores.
  - Provides a consistent and maintainable way to handle all assets.
- **Cons:**
  - Requires developer discipline to always use the correct components (`<Image>`, `next/font`, SVGR imports) instead of standard HTML tags.