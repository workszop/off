# Offquarium review improvements

## Scope

Implement review items 1, 2, 5, and 6 without changing the visual direction,
dialogue, or simulation premise.

## Requirements

### Edit-mode isolation

- Furniture delete, flip, drag, and resize controls cannot receive pointer or
  keyboard interaction outside edit mode.
- JavaScript handlers reject out-of-mode mutations even if called directly.
- Entering edit mode preserves the existing selection and manipulation flow.

### Asset delivery

- Initial artwork transfer is substantially smaller than the current 55.9 MiB.
- Rendered artwork remains transparent and visually equivalent at supported
  desktop and mobile sizes.
- The app remains build-free at runtime and works over a static file server.
- Unneeded sprite frames and unopened palette artwork are not eagerly retained.

### Regression coverage

- A dependency-free automated suite checks source syntax, asset references,
  edit-mode isolation, reset/scene invariants, and the DOM state contract.
- Runtime components publish stable `data-*` state rather than requiring tests
  to infer state from appearance.

### Polish

- Runtime font loading is local, with licenses included.
- Conversation spacing prevents visible character stacking.
- Furniture keeps its authored scale relative to responsive character height.
- Duplicate state assignments are removed.

## Acceptance

- JavaScript syntax and automated tests pass.
- A real-browser smoke test passes at desktop and mobile viewports.
- All runtime resources return successfully with no external font request.
- Core controls, scenes, reset, furniture editing, and the original animation
  behavior continue to work.
