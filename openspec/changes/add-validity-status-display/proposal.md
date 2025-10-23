# Add Validity Status to Page Completion Details

## Change ID
add-validity-status-display

## Status
Proposed

## Summary
Add validity status display to the page completion details in the modal statistics. This enhancement will show whether each completed page was marked as valid or invalid, providing users with immediate feedback on their annotation quality.

## Motivation
The current modal display shows completion counts, topic counts, elapsed times, and reject reasons, but lacks explicit validity status information. Users need to quickly identify which pages were marked as valid or invalid to:
1. Monitor their annotation quality in real-time
2. Identify patterns in invalid annotations
3. Improve their annotation performance

## Technical Design
The enhancement will modify the modal display to include validity status information for each page completion, leveraging the existing `isValid` field in the completion statistics data structure.

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement (showDataModal function)

## Implementation Plan
1. Modify the page completion details display in showDataModal
2. Add validity status information to each page entry
3. Use appropriate visual indicators for valid/invalid status
4. Ensure proper data access and error handling
5. Test enhanced modal display functionality

## Testing Strategy
- Manual testing of modal display with various validity states
- Verification that validity status is properly displayed
- Testing with different data states (empty, partial, complete)
- Cross-browser compatibility testing

## Security Considerations
- No security implications expected
- Ensure no sensitive data is displayed in modal
- Maintain data integrity during display rendering

## Backward Compatibility
- No breaking changes to existing functionality
- Enhanced display maintains existing data structure compatibility
- Modal functionality remains unchanged

## References
- Current `appen-data-collector.js` implementation
- Existing showDataModal function
- Enhanced completion statistics data structure with isValid field