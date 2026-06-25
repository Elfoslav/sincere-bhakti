<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:code-organization -->
# Code Organization

- **No repeating code.** Any pattern used in more than one place must be extracted to a shared function in `src/lib/` or a shared constant.
- **Utility functions** go in `src/lib/` (e.g. `video.ts`, `auth.ts`).
- **Reusable UI** goes in `src/components/` or `src/components/ui/` (shadcn).
- **Types/interfaces** shared across files go in `src/types/`.
- Inline the same logic in multiple files only if there's a strong reason — otherwise refactor.
<!-- END:code-organization -->
