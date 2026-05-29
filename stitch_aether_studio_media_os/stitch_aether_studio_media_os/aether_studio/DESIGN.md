---
name: Aether Studio
colors:
  surface: '#111415'
  surface-dim: '#111415'
  surface-bright: '#373a3b'
  surface-container-lowest: '#0c0f10'
  surface-container-low: '#191c1d'
  surface-container: '#1d2021'
  surface-container-high: '#282a2b'
  surface-container-highest: '#323536'
  on-surface: '#e1e3e4'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#e1e3e4'
  inverse-on-surface: '#2e3132'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#c0c6db'
  on-secondary: '#293040'
  secondary-container: '#404758'
  on-secondary-container: '#aeb5c9'
  tertiary: '#ffb695'
  on-tertiary: '#571f00'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#111415'
  on-background: '#e1e3e4'
  surface-variant: '#323536'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  code:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered for a high-performance AI media operating system. The brand personality is authoritative, precise, and sophisticated, catering to professional creators and technical operators. 

The aesthetic adheres to **Modern Minimalist SaaS** principles, heavily influenced by the utilitarian elegance of Linear and the structural clarity of Vercel. It prioritizes information density without sacrificing whitespace, ensuring that complex AI workflows feel manageable and focused. The UI avoids "gimmicky" AI tropes like glowing gradients or heavy blurs, opting instead for a "tool-first" philosophy where the interface recedes to let the user's media and data take center stage.

## Colors

This design system utilizes a deep, "ink" dark mode palette to reduce eye strain during long production sessions. 

- **Primary Indigo:** Used sparingly for primary actions, active states, and focus indicators.
- **Grayscale Hierarchy:** The background (#0B0F14) and surface (#111827) colors create a subtle perceived depth. 
- **Functional Colors:** Success, Warning, and Error colors are desaturated to maintain a professional tone while remaining legible against the dark background.
- **Borders:** A consistent #1F2937 hex is used for structural definition, providing enough contrast to separate UI regions without visual noise.

## Typography

The system uses a pairing of **Geist** and **Inter**. Geist is utilized for headlines, labels, and technical data due to its precise, mono-influenced proportions which evoke a sense of engineering excellence. Inter is used for body copy to ensure maximum legibility during extended reading.

Hierarchy is established primarily through weight and color (using high-contrast white for headings and mid-grey for secondary body text) rather than dramatic size shifts. Use `label-sm` for metadata and "eyebrow" text to maintain an organized, enterprise-grade feel.

## Layout & Spacing

This design system employs a **12-column fluid grid** for main content areas with fixed sidebars (standardized at 240px or 280px). 

- **The 4px Rule:** All spacing and sizing must be multiples of 4px.
- **Density:** Use `md` (16px) for standard component spacing and `lg` (24px) for container padding. 
- **Vertical Rhythm:** Maintain consistent vertical spacing between sections using `2xl` (48px) to define distinct task areas.
- **Adaptive Strategy:** On desktop, use generous margins to prevent content from stretching too wide. On mobile, the layout collapses to a single column with 16px side margins.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and **Subtle Outlines** rather than aggressive shadows. 

1.  **Floor (Level 0):** #0B0F14 — The base canvas.
2.  **Surface (Level 1):** #111827 — Main UI containers, sidebars, and cards. Use a 1px solid border (#1F2937) for definition.
3.  **Raised (Level 2):** #1F2937 — Hover states and active dropdowns.
4.  **Overlay (Level 3):** Modals and context menus. These use a tighter 1px border and a soft, diffused shadow (0px 10px 15px -3px rgba(0, 0, 0, 0.5)) to separate them from the interface below.

Avoid any "glass" or blur effects to ensure the interface remains performant and visually stable.

## Shapes

The shape language is consistently **Rounded** to soften the technical nature of the AI platform. 

- **Standard Elements:** Buttons, inputs, and small cards use a 0.5rem (8px) radius.
- **Large Containers:** Main content panels and modals use 1rem (16px) radius for a more contemporary, "app-like" feel.
- **Status Pills:** Use fully rounded (pill-shaped) corners for status indicators and tags to differentiate them from interactive buttons.

## Components

- **Buttons:** Primary buttons use #4F46E5 with white text. Secondary buttons use a transparent background with a 1px border (#1F2937). Use a "Ghost" style for tertiary actions.
- **Input Fields:** Default state is #111827 with a 1px #1F2937 border. On focus, the border shifts to #4F46E5 with a subtle outer glow.
- **Cards:** Use #111827 with a 1px border. Do not use shadows for cards that are part of the grid; use them only for floating elements.
- **Lists:** Use a 1px horizontal separator between items. Hover states should use a subtle background shift to #1F2937.
- **Chips/Tags:** Small, high-contrast labels with `label-sm` typography. 
- **AI Feedback:** For AI-generated content or processing states, use a subtle "shimmer" animation or a primary-colored progress bar. Avoid "magic wand" icons; use technical icons (e.g., terminal, spark, or CPU) to maintain the professional aesthetic.