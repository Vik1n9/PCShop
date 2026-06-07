@/Users/vikinglu/.codex/RTK.md

## Project Maintenance Rules

- When adding a feature or changing product logic, purchasing flow, compatibility behavior, filtering behavior, data model, UI behavior, or customer-facing quote behavior, update the relevant project concept documents in the same change.
- Update `PRODUCT.md` for product intent, user experience, design principles, maintenance policy, customer-facing behavior, or roadmap-level concept changes.
- Update `規格書.txt` for functional requirements, technical rules, data structures, compatibility logic, UI interaction requirements, admin/backend behavior, or implementation constraints.
- Whenever either `PRODUCT.md` or `規格書.txt` changes because of a feature or logic update, bump that document's version number and date so later project-maintenance work can trace which concept version matches the implementation.
