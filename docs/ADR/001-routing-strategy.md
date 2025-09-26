# 1. Routing Strategy

*Status: Proposed*

**Context:**
The project requires a routing solution that supports a mix of static content pages, dynamic content from a CMS/filesystem (curriculum), and complex interactive pages. The solution must support server-side rendering (SSR) for SEO and performance, as well as client-side navigation.

**Decision:**
We will use the **Next.js App Router** as the sole routing strategy. This is the current standard for Next.js applications.

- **Structure**: Routes will be defined by the folder structure within `src/app`.
- **Dynamic Content**: The curriculum will use a dynamic catch-all route (`/curriculum/[...slug]/page.tsx`) to render content based on the URL slug.
- **Linking**: All internal navigation must use the `next/link` component to enable client-side transitions.
- **API Routes**: API endpoints will be created as `route.ts` files within the `src/app/api` directory.

**Consequences:**
- **Pros:**
  - Aligns with modern Next.js best practices.
  - Supports layouts, server components, and other App Router features out-of-the-box.
  - File-system based routing is intuitive and self-documenting.
- **Cons:**
  - The App Router is a newer paradigm, and some libraries may have limited support compared to the Pages Router.
  - Requires adherence to the `<Link>` component for all client-side navigation to function correctly.