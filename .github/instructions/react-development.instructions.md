---
applyTo: '**'
---

# React Development Instructions

When generating React code, always follow these best practices:

## General React Best Practices
- Use functional components and React Hooks (e.g., useState, useEffect) instead of class components.
- Ensure all components are modular, reusable, and maintainable.
- Use TypeScript for type safety. Always type props and state.
- Use prop-types or TypeScript interfaces for component props.
- Avoid prop drilling by using context or state management libraries when necessary.
- Keep components focused and small; extract logic into custom hooks if reusable.
- Use meaningful, descriptive names for components, props, and variables.
- Write clear and concise comments where necessary.

## Responsiveness
- Ensure all components are responsive and mobile-friendly.
- Use Bootstrap’s grid system and responsive utility classes to handle layout and spacing.
- Test components at different screen sizes (mobile, tablet, desktop).
- Avoid fixed widths and heights; use relative units (%, rem, em) where possible.

## Bootstrap Usage
- Use Bootstrap 5 (or the version specified in the project) for all styling and layout.
- Prefer Bootstrap classes for layout, spacing, and components (e.g., buttons, forms, cards).
- Avoid custom CSS unless necessary; if used, scope it to the component.
- Import Bootstrap CSS at the top level of the application if not already present.

## Accessibility
- Ensure all interactive elements are accessible (e.g., use semantic HTML, aria-labels).
- Use proper HTML elements for buttons, forms, and navigation.
- Ensure keyboard navigation and screen reader compatibility.

## Testing
- Write code that is easy to test and follows the requirements of the provided Jest test files.
- Ensure all edge cases are handled as described in the test.

## Workflow
- When given a test file, generate only the implementation code needed to pass the test.
- Do not write or modify test files unless explicitly instructed.
- Only write code for one feature or test at a time, as provided.

---
