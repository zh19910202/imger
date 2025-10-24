# Add Rework Status to Page Completion Details

## Status
Proposed

## Summary
Add "新旧题状态" field to the page completion details display to show whether each completed page is a new task or secondary rework. This enhancement will provide better visibility into rework patterns in the completion statistics panel.

## Motivation
Currently, the page completion details only show basic information like completion count, topic count, elapsed time, validity status, and reject reason. Users need to see the rework status (new vs. secondary rework) in the page details to:
1. Better understand rework patterns across different pages
2. Identify which pages have been reworked multiple times
3. Improve work quality analysis at the page level

This enhancement will provide better visibility into rework status by adding the field to page completion details.

## Technical Design
The enhancement will modify the page completion details display to include a "新旧题状态" field showing whether each page is new or secondary rework.

### Components Affected
- `src/appen-data-collector.js` - Page completion details display logic

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Update page completion details template to include rework status
2. Implement status display logic using existing `isSecondaryRework` field
3. Ensure proper styling and formatting
4. Test enhanced functionality

## Testing Strategy
- Manual testing of page completion details display
- Verification of status display logic
- Backward compatibility testing

## Security Considerations
- No security implications expected
- Maintain data integrity during display updates

## Backward Compatibility
- Maintain existing display format
- Ensure older data can be handled gracefully
- No breaking changes to existing functionality

## Alternatives Considered
- Keeping the current display without the new field - Rejected because it reduces visibility into rework patterns
- Adding the field in a different location - Rejected because placing it with other page details provides better context

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality
- Previous rework status implementation