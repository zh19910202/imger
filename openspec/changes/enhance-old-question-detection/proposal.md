# OpenSpec Change Proposal: Enhance Old Question Detection

## Title
Enhance Old Question Detection Algorithm with Valid Status and Edit Count

## Status
Proposed

## Summary
This change proposes to enhance the old question detection algorithm by adding additional criteria for identifying old questions. The new algorithm will consider a question as old if it has a valid status and edit count greater than or equal to 1 after page loading.

## Motivation
The current old question detection algorithm only relies on QA reject status. This change will improve the accuracy of old question identification by incorporating additional signals from the page content, specifically:
1. Valid status (默认值是有效)
2. Edit count (编辑轮数大于等于1)

This will provide a more comprehensive approach to identifying old questions that have been previously worked on.

## Technical Design
The change involves enhancing the existing getPageNewOldStatus function to incorporate additional criteria:
- Check for valid status after page loading
- Check for edit count >= 1 (indicating previous edits)
- Combine these with existing QA reject detection

### Components Affected
- `src/appen-data-collector.js` - The main content script file

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Analyze current page structure to identify valid status elements
2. Identify edit count elements on the page
3. Enhance getPageNewOldStatus function with new criteria
4. Implement logic to check valid status and edit count
5. Combine with existing QA reject detection
6. Test the enhanced algorithm
7. Update documentation

## Testing Strategy
1. Verify that questions with valid status and edit count >= 1 are correctly identified as old
2. Ensure that questions without these criteria are correctly identified as new
3. Confirm that existing QA reject detection still works correctly
4. Test edge cases and combinations of criteria

## Security Considerations
None - this change only adds logic to identify page elements and does not introduce any security-sensitive functionality.

## Backward Compatibility
This change is backward compatible as it only adds additional criteria for old question detection and does not modify existing APIs or data structures.

## Alternatives Considered
1. Keep the current QA-only detection - This would not leverage additional signals available on the page
2. Replace QA detection with new criteria - This would lose the existing reliable detection method

## References
- Current implementation in `src/appen-data-collector.js`
- Previous new/old question detection functionality