# 2. State Management and Data Loading

*Status: Proposed*

**Context:**
The application has various state requirements, from local UI state to server-side user sessions. A clear strategy is needed to avoid unnecessary complexity and performance bottlenecks.

**Decision:**
We will adopt a tiered approach to state management, prioritizing local state and avoiding a global client-side state manager until absolutely necessary.

1.  **Local/Component State**: For all UI state that is not shared between components (e.g., toggle states, form inputs), we will use React hooks (`useState`, `useReducer`).
2.  **Shared Server State**: For user authentication and session management, we will use **`iron-session`**. This provides a secure, cookie-based session that is managed on the server.
3.  **Shared Client State**: There is currently no identified need for a global client-side state manager (like Redux, Zustand, or Jotai). The combination of server-side session state and local component state is sufficient for the learning-first feature set.
4.  **Data Loading**: Data will be fetched on the server within Server Components wherever possible. Client components will receive data as props. For client-side data fetching, we will use standard `fetch` or a lightweight library like SWR if caching and revalidation become necessary.

**Consequences:**
- **Pros:**
  - Minimizes client-side JavaScript, improving performance.
  - Avoids the complexity and boilerplate of a global state management library.
  - Aligns with the React Server Components paradigm.
- **Cons:**
  - If complex client-side state becomes a requirement later, this decision may need to be revisited.
  - Requires careful prop-drilling or composition for deeply nested components.