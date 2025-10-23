# Enhance Modal Completion Statistics with Reject Reason and Elapsed Time

## Change ID
enhance-modal-completion-stats

## Status
Implemented

## Summary
Enhance the showDataModal function to include reject reason and elapsed time in the page completion details statistics. This will provide more comprehensive information about each completed annotation page directly in the modal display.

## Motivation
The current modal display shows basic completion statistics but lacks important details such as:
1. Reject reasons for QA-rejected pages
2. Elapsed time for each page completion
3. Detailed validity status information

Users need this additional information to better understand their annotation performance and identify areas for improvement.

## Technical Design
The enhancement will modify the modal display to include:
- Reject reason for each page (if applicable)
- Elapsed time per page completion
- Enhanced formatting for better readability

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement (showDataModal function)

## Implementation Plan
1. Modify the page completion details display in showDataModal
2. Add reject reason information to each page entry
3. Include elapsed time for each page completion
4. Enhance visual formatting for better readability
5. Ensure proper data access and error handling
6. Test enhanced modal display functionality

## Testing Strategy
- Manual testing of modal display with various completion scenarios
- Verification that reject reasons are properly displayed
- Confirmation that elapsed times are accurate
- Testing with different data states (empty, partial, complete)

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
- Enhanced completion statistics data structure