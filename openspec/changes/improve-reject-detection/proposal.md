# OpenSpec Change Proposal: Improve QA Reject Detection

## Title
Improve QA Reject Detection with Precise HTML Element Targeting

## Status
Implemented

## Summary
This change proposes to improve the QA reject detection algorithm by using precise HTML element targeting instead of text-based searching. The new approach will target specific HTML structures to more accurately identify QA reject status.

## Motivation
The current QA reject detection relies on text-based searching which can be unreliable due to:
1. Variations in text formatting and spacing
2. Dynamic content loading that may not be immediately available
3. False positives from similar text in other parts of the page
4. Timing issues with page content availability

By targeting specific HTML elements with known class names and structures, we can achieve more reliable and accurate detection.

## Technical Design
The change involves enhancing the existing `isCurrentPageRejected` function to use HTML element targeting:

### Components Affected
- `src/appen-data-collector.js` - The main content script file

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Analyze current HTML structure for QA reject elements
2. Identify specific CSS selectors for QA reject elements
3. Enhance `isCurrentPageRejected` function with HTML element targeting
4. Maintain backward compatibility with existing text-based detection as fallback
5. Test the improved algorithm
6. Update documentation

## Testing Strategy
1. Verify that pages with QA reject elements are correctly identified using HTML targeting
2. Ensure that pages without QA reject elements are correctly identified as not rejected
3. Confirm that fallback to text-based detection still works correctly
4. Test edge cases and timing scenarios

## Security Considerations
None - this change only adds logic to identify page elements and does not introduce any security-sensitive functionality.

## Backward Compatibility
This change is backward compatible as it only enhances the detection method while maintaining the existing text-based approach as a fallback.

## Alternatives Considered
1. Keep the current text-based detection - This would not address the reliability issues
2. Replace text-based detection completely - This would lose the fallback mechanism

## References
- Current implementation in `src/appen-data-collector.js`
- Previous QA reject detection functionality