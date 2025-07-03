# GitHub Copilot Instructions for Shift-Scheduler

## General Development Guidelines

### Frontend Development Practices

#### 1. Shared Components First
- **Always check the `frontend/src/app/shared/` folder first** when making frontend changes
- Look for existing shared components such as buttons, forms, modals, etc. before creating new ones
- Reuse existing shared components to maintain consistency across the application
- If a similar component exists, consider extending or modifying it rather than creating a duplicate

#### 2. Component Creation Guidelines
- When creating new components, analyze the functionality to determine the best location:
  - **Shared components**: Place in `frontend/src/app/shared/components/` if the component will be used across multiple modules
  - **Module-specific components**: Place in the appropriate module folder (e.g., `employee/`, `manager/`, `admin/`)
  - **Feature-specific components**: Place in the relevant feature folder within the module

#### 3. Component Structure
- **Always create a dedicated folder** for each new component
- Each component folder should contain:
  - `component-name.component.ts` - TypeScript component file
  - `component-name.component.html` - Template file
  - `component-name.component.scss` - Styles file
  - `component-name.component.spec.ts` - Unit test file
- Follow Angular naming conventions (kebab-case for folders and files)

#### 4. Folder Placement Logic
Unless explicitly specified in the prompt, determine component placement based on:
- **Reusability**: If used across multiple modules → `shared/components/`
- **Module specificity**: If only used within one module → `{module}/components/`
- **Feature specificity**: If tied to a specific feature → `{module}/{feature}/components/`

#### 5. Before Creating Components
1. Search existing components in `shared/components/`
2. Check module-specific component folders
3. Verify the component doesn't already exist in a different form
4. Consider if an existing component can be extended or modified

#### 6. Code Organization
- Import shared components from `shared/` module
- Maintain consistent styling using existing SCSS variables and mixins
- Follow the established project structure and naming conventions
- Ensure proper module imports and declarations

## Project Structure Context
- **Frontend**: Angular application with modular architecture
- **Backend**: AWS Lambda functions with Node.js
- **Shared folder**: Contains reusable components, services, and utilities
- **Module folders**: `admin/`, `employee/`, `manager/`, `auth/`, `authenticated/`

## Example Component Creation
```
frontend/src/app/shared/components/
├── button/
│   ├── button.component.ts
│   ├── button.component.html
│   ├── button.component.scss
│   └── button.component.spec.ts
```

Remember: **Always prioritize reusability and consistency by checking shared components first!**
