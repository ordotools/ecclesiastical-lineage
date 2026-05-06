# Search Bar Behavior

## Purpose
Define expected behavior for lineage search input + suggestions so UI stays visually connected and interaction is predictable.

## Usage

### Visual Shell
- Input + suggestions render as one connected control when suggestions open.
- Shared shell owns border/background/shadow, not separate stacked blocks.
- No visible shadow bleed at seam between input and suggestions.
- Input radius stays compact in both closed and open states.

### Open/Close Rules
- Suggestions open only when matching results exist.
- Open state is driven by JS-applied shell class (for example, `is-open`).
- Suggestions close when:
  - query has no matches,
  - user clears input,
  - user selects a suggestion,
  - or focus leaves search interaction flow.

### Selection + Focus Rules
- Mouse click or keyboard selection writes selected value into input.
- After selection:
  - suggestions close immediately,
  - input is explicitly blurred,
  - selected text remains visible in input.

### Keyboard/Pointer Interaction
- Keyboard navigation behavior remains unchanged for moving through suggestions.
- Pointer hover/click behavior remains unchanged except for close + blur on selection.

### Responsive Notes
- Behavior and connected shell styling hold at desktop and mobile breakpoints (`768px`, `640px`).

## Acceptance Checklist
- [ ] No shadow bleed visible between input and dropdown seam.
- [ ] Input + dropdown appear as one connected control when open.
- [ ] Input keeps compact radius in both open and closed states.
- [ ] Selecting suggestion keeps value, closes suggestions, and removes input focus.
- [ ] Open/close shell state is class-driven and consistent with suggestion visibility.
- [ ] Connected control remains correct at `768px` and `640px` breakpoints.
