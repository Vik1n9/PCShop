# Product

## Version

**Version**: 1.4
**Date**: 2026-06-08

## Register

product

## Users

PCShop serves two main groups: first-time and entry-level PC buyers, as well as DIY enthusiasts who know what they want but value speed and local availability. Beginners understand budgets and use cases better than socket names, wattage margins, or case clearances. They typically choose parts on a phone, compare a few options, and want to avoid costly mistakes without becoming hardware experts. DIY enthusiasts appreciate quick filtering, local pricing, and the ability to spot compatibility issues instantly. Both groups expect a tool that feels like a knowledgeable local shop assistant — not a cold database.

## Product Purpose

PCShop is a mobile-first PC build quotation tool designed for local computer shops. It helps users select eight core part categories (CPU, motherboard, RAM, storage, GPU, PSU, case, cooling), blocks hard compatibility conflicts in real time, surfaces soft warnings (e.g., size or power headroom), previews expected 3DMark Time Spy performance after CPU and GPU selection, and generates a clean quote that can be saved, shared, copied, or printed. Success means a novice user moves from budget intent to a complete, purchasable configuration with visible confidence in compatibility and performance level, while a DIY enthusiast finishes a quote in under two minutes and walks into the shop ready to buy.

## Project Concept Maintenance

- When the project adds a feature or changes product logic, purchasing flow, compatibility behavior, filtering behavior, data model, UI behavior, or customer-facing quote behavior, the project concept documents must be updated in the same change.
- `PRODUCT.md` tracks product intent, customer experience, design principles, maintenance policy, and roadmap-level concept decisions.
- `規格書.txt` tracks functional requirements, technical rules, data structures, compatibility logic, UI interaction requirements, admin/backend behavior, and implementation constraints.
- If a change updates either document, bump that document's version number and date so future maintenance can trace the implemented behavior back to the current concept version.

## Local Shop Context

PCShop is built for a single brick-and-mortar computer shop or a small local chain. Inventory, pricing, and part availability reflect what is actually in stock or easily ordered. The tool replaces handwritten quotes, confusing spreadsheet tabs, and endless back‑and‑forth messaging. It also acts as a sales assistant: when a part is out of stock, it suggests the next best alternative within the user’s rough budget tier. Quotes include the shop’s contact information, assembly fee (if applicable), and a unique quote ID for easy lookup in the store.

## Brand Personality

Calm, precise, protective. The interface feels like a knowledgeable shop assistant who quietly prevents mistakes, explains only what matters, and keeps the buying flow moving. No panic messages, no jargon dumps — just clear guidance and a smooth path from selection to quote.

## Anti‑references

Avoid dense spreadsheet‑like parts tables, hover‑dependent desktop configurators, cart‑first shopping flows that hide compatibility until checkout, and raw backend tag labels leaking into customer‑facing UI. The product should not look like a parts database wearing a thin storefront skin. Also avoid forcing account creation before seeing a quote — users can generate and share a quote instantly, then save it later if they choose.

## Design Principles

- **Make progress visible at all times** so users never need to remember what is missing. A clear step indicator shows which part categories are complete, pending, or have warnings.
- **Make performance legible early**: once CPU and GPU are selected, the progress navigation should show a 3DMark Time Spy score and plain-language tier so users understand whether the build matches their gaming or creative-performance expectations.
- **Make selected-part correction immediate**: filled progress blocks must expose both replace and remove actions directly inside the block, so users can undo a mistaken selection without scrolling to the selected-parts list.
- **Block hard conflicts immediately** and explain the exact reason in plain language (e.g., “This CPU requires an LGA1700 motherboard, but you have an AM5 board selected”).
- **Reveal part details progressively**: product lists should follow a PC-builder row pattern: product name as the primary line, price and actions on the right when space allows, a short description below the name, then compact inventory/spec context. Complete specifications remain available through a tap.
- **Let structured fields and backend‑resolved actions drive behavior**, while keeping internal tag keys (e.g., `socket_type: "LGA1700"`) out of the customer interface.
- **Favor thumb‑friendly mobile flows first**, with desktop gaining density (more visible parts per category) rather than different behavior.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls. Support keyboard navigation, visible focus states, screen‑reader labels, reduced‑motion preferences, and clear state text for selected, unavailable, incompatible, and warning states. Copy should assume no hardware background and avoid abbreviations unless the product data already uses them as specs (e.g., “PCIe 4.0” is kept because it’s a spec, but “OoS” would be written as “Out of Stock”).

## Additional Rules for Local Shop Operation

- **Stock awareness**: Out‑of‑stock parts are shown but grayed out, with an estimated restock date or a “check in store” option. They cannot be added to a quote unless the shop overrides (staff mode).
- **Quote persistence**: Quotes are saved locally in the browser for 7 days. Users can also generate a short‑lived shareable link (expires in 48 hours) or a PDF copy.
- **Pricing flexibility**: The shop owner can apply a global markup, category‑specific discounts, or manual quote adjustments. Prices are shown including local tax (configurable).
- **Assembly & services**: A separate line item for “Assembly & testing” can be toggled on/off. Optional services (rush build, cable management, OS installation) can be added as extras.
- **Staff override mode** (password protected): Allows shop staff to force‑select incompatible parts (with a warning logged), adjust prices manually, or mark special orders.

## Product List & Official Link Maintenance

- Product rows should stay within the app width and remain a single vertical list on desktop, matching the PC builder reference pattern without copying its dark theme or oversized side panel.
- The list row only needs the product name as the main product identifier. Detailed explanation belongs in the description line below the name, using `description` or `details` from product data when available.
- Product data may include `official_url` or `url`. If present, the “產品官網” button opens it in a new tab. Demo/static data may fall back to manufacturer search pages, but production data should provide exact official product URLs.
- Key specs are supporting context only, shown compactly after stock information or in expanded details. Do not return to dense spreadsheet-style product tables.

## Admin Product Management Maintenance

- The customer storefront must stay focused on quotation flow and must not display an admin/backend entry link.
- The temporary backend entry is documented in `README.md` for maintainers. This keeps customer-facing navigation clean while still allowing local product database maintenance.
- The MVP admin login keeps the authentication interface and session endpoint, but does not require a username or password yet. Future production work can attach real credentials to the existing login API without changing the maintenance flow.
- Product administrators can search, add, edit, and remove catalog rows through the backend page. Saved changes write directly to `data/products.csv`, which remains the current product database used by the storefront.

## Benchmark Preview Maintenance

- 3DMark Time Spy preview data is maintained separately from product inventory data, keyed by selected `cpu_id` and `gpu_id`.
- The progress navigation must show a pending state until both CPU and GPU are selected, a score state when a matching benchmark exists, and a clear “待補資料” state when the pair has not been scored yet.
- Benchmark scores are guidance for relative performance comparison, not a purchase guarantee; avoid presenting them as exact results for every user’s thermal, driver, or power configuration.
