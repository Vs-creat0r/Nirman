# Rule: Number Inputs & Numeric Fields

## Constraints & Requirements
1. **No Stepper Arrows (Spin Buttons)**:
   - All numeric inputs must have their browser spin buttons / up-down stepper arrows hidden via CSS (`appearance: none` / `-moz-appearance: textfield`).
2. **No Mouse Wheel Value Changes**:
   - Scrolling the mouse wheel while hovering over or focusing a number field must NEVER increment or decrement the number. (Handled via `onWheel` blur and CSS).
3. **No Negative Numbers**:
   - Number inputs across the system (quantities, amounts, rates, etc.) must NEVER accept negative values.
   - Negative keydown (`-`) is blocked, and inputs clamp values to `Math.max(0, val)`.
