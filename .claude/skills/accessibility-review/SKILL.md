---
name: accessibility-review
description: Run a WCAG 2.1 AA accessibility audit. Trigger with "audit accessibility", "check a11y", "is this accessible?".
---

# WCAG 2.1 AA Quick Reference

## Perceivable
- 1.4.3 Contrast ratio >= 4.5:1 (normal text), >= 3:1 (large text)
- 1.1.1 Non-text content has alt text

## Operable
- 2.1.1 All functionality available via keyboard
- 2.5.5 Touch target >= 44x44 CSS pixels
- 2.4.7 Visible focus indicator

## Understandable
- 3.3.2 Labels or instructions for inputs
- 3.3.1 Error identification

## Robust
- 4.1.2 Name, role, value for all UI components

## Output format

Table per category: issue, WCAG criterion, severity, recommendation.
Include a color contrast table and a keyboard navigation table.
Close with priority fixes ordered by impact.
