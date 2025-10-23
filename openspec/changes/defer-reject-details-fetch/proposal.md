# OpenSpec Change Proposal: Defer Rejection Details Fetch Until Manual Hide

## Status
Proposed

## Summary
Modify the quality check rejection details extraction logic to only fetch rejection details after the user manually clicks to hide the rejection detail window. This change will reduce unnecessary automatic extraction attempts and improve performance by waiting for explicit user interaction.

## Motivation
Currently, the system automatically triggers quality check details loading on page load and in various other scenarios. This can lead to:
1. Unnecessary performance overhead from frequent automatic extractions
2. Potential conflicts with user interactions
3. Unreliable data extraction when the UI is not in the expected state

By deferring the extraction until the user explicitly interacts with the rejection detail window (specifically when they hide it), we ensure:
1. More accurate and reliable data extraction
2. Better performance by avoiding unnecessary operations
3. Alignment with user intent and workflow

## Technical Design

### Components Affected
- `src/appen-data-collector.js` - Main data collection logic
- Quality check extraction functions
- Event listeners for quality check UI elements

### New Components
- New event listener for panel hide actions
- State tracking for user interaction with quality check panels

### Implementation Changes

1. **Remove automatic extraction triggers**:
   - Remove `autoTriggerQualityCheckDetails()` call on page load
   - Remove automatic extraction in `showDataModal()`
   - Remove periodic automatic extraction attempts

2. **Add user interaction detection**:
   - Add event listeners specifically for when users manually hide the rejection detail window
   - Track user-initiated hide actions to trigger extraction

3. **Modify extraction flow**:
   - Only call `extractQualityCheckRecords()` when the user hides the panel
   - Ensure extraction happens at the optimal time when DOM is stable

## Implementation Plan
1. Identify all current automatic extraction trigger points
2. Remove or disable automatic triggers
3. Add new event listeners for panel hide actions
4. Implement deferred extraction logic
5. Test with various user interaction scenarios
6. Verify data accuracy and performance improvements

## Testing Strategy
1. Manual testing of quality check panel interactions
2. Verify extraction only occurs after panel hide
3. Performance testing to confirm reduced overhead
4. Edge case testing with different panel states
5. Regression testing to ensure other functionality unaffected

## Security Considerations
No security implications. This change only affects the timing of data extraction and does not modify what data is collected or how it's handled.

## Backward Compatibility
This change modifies the timing of when rejection details are fetched but does not change the data format or APIs. Existing functionality that depends on having this data should continue to work, though it may be available at a different time in the user workflow.

## Alternatives Considered
1. **Keep current automatic extraction**: Continue with existing approach but optimize extraction logic
2. **User-initiated extraction only**: Require explicit user action (like pressing a key) to trigger extraction
3. **Hybrid approach**: Keep some automatic triggers but add user interaction detection

The chosen approach balances performance improvements with user experience by leveraging natural user interactions rather than adding new required actions.

## References
- Current implementation in `src/appen-data-collector.js`
- Quality check UI elements and their behavior
- User workflow patterns in the annotation platform