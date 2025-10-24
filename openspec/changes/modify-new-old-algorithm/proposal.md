# OpenSpec Change Proposal: Modify New/Old Question Algorithm

## Title
Modify New/Old Question Algorithm Based on QA Rejection Status

## Status
Proposed

## Summary
This change modifies the algorithm for determining whether a question is "new" or "old" (rework). If the page displays "被 QA1 Rejected 请修订" (Rejected by QA for revision), it will be classified as a rework question. Otherwise, it will be classified as a new question.

## Motivation
The current algorithm for determining new vs. old questions only considers historical rework data. However, when a task explicitly shows a QA rejection message like "被 QA1 Rejected 请修订", it should be immediately classified as a rework question. This change will provide more accurate real-time classification of task status, helping users better understand their current task state.

## Technical Design
The change involves modifying the `getPageNewOldStatus` function in `src/appen-data-collector.js` to check for the presence of QA rejection messages in the current page content.

### Components Affected
- `src/appen-data-collector.js` - The `getPageNewOldStatus` function and related logic

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Modify the `getPageNewOldStatus` function to check for QA rejection messages in the current page
2. Add a new helper function to detect QA rejection messages in page content
3. Simplify the logic to only consider current QA rejection status
4. Test the changes with pages that do and don't show rejection messages

## Testing Strategy
1. Test with pages that show "被 QA1 Rejected 请修订" message - should be classified as "旧" (rework)
2. Test with pages that don't show the rejection message - should be classified as "新" (new)

## Security Considerations
None - this change only affects the display logic and does not introduce any security-sensitive functionality.

## Backward Compatibility
This change is backward compatible as it only modifies the logic for determining question status and does not change any APIs or data structures.

## Alternatives Considered
1. Keep the current algorithm unchanged - This would not provide real-time feedback on QA rejections

## References
- Current implementation in `src/appen-data-collector.js`
- Related to QA rejection detection logic in the same file