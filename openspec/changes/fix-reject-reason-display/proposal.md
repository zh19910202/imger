# Fix Reject Reason Display in Page Completion Details

## Status
Proposed

## Summary
Fix the bug where all page completion details display the same reject reason (from the current page) instead of each page's own reject reason. This enhancement will store reject reasons per page and display the correct reason for each page.

## Motivation
Currently, all page completion details show the same reject reason because they all reference `collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment`. This is misleading and prevents users from seeing the actual reject reasons for each completed page.

This fix will:
1. Store reject reasons individually for each page in the completion statistics
2. Display the correct reject reason for each page in the completion details
3. Improve the accuracy and usefulness of the completion statistics display

## Technical Design
The fix will modify the completion statistics data structure to include reject reasons per page and update the UI rendering logic to use page-specific reject reasons instead of a global one.

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Add `rejectReason` field to per-page completion data structure
2. Modify completion recording functions to store page-specific reject reasons
3. Update UI rendering to use page-specific reject reasons
4. Ensure proper data migration for existing completion statistics
5. Test the fix with various reject reason scenarios

## Testing Strategy
- Unit tests for new data structure fields
- Manual testing with multiple pages having different reject reasons
- Verification of data persistence and loading
- Backward compatibility testing with existing data

## Security Considerations
- No security implications expected
- Ensure no sensitive data is stored in completion statistics
- Maintain data integrity during refactoring

## Backward Compatibility
- Maintain existing completion statistics format
- Ensure older data can be migrated or handled gracefully
- No breaking changes to existing APIs

## Alternatives Considered
- Keeping the current behavior - Rejected because it provides incorrect information
- Not displaying reject reasons at all - Rejected because it reduces visibility into work quality

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality
- Quality check record handling logic