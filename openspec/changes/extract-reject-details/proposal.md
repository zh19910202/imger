# OpenSpec Change Proposal: Extract Reject Details

## Title
Extract and Display Latest QA Reject Details

## Status
Proposed

## Summary
This change proposes to automatically extract and display the latest QA reject details when a task is identified as a rework item. When the system detects the message "你的标注任务被QA1 Rejected，请修订后重新提交", it will simulate clicking the red dot icon to fetch and display the most recent reject record.

## Motivation
Currently, when a task is marked as rejected, users need to manually click the red dot icon to view the reject details. This change will automate this process, providing immediate access to the most relevant feedback for rework tasks, improving efficiency and reducing friction in the revision process.

## Technical Design
The change involves enhancing the existing QA reject detection functionality to automatically trigger the click event on the red dot icon (uid=11_197) and then extract the latest reject record information from the displayed content.

### Components Affected
- `src/appen-data-collector.js` - The main content script file

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Identify when a task is marked as rejected with "你的标注任务被QA1 Rejected，请修订后重新提交"
2. Simulate clicking the red dot icon (uid=11_197) to fetch reject details
3. Extract the latest reject record information from the displayed content
4. Store the reject details for display in the extension UI
5. Test the functionality to ensure it works correctly without breaking existing features

## Testing Strategy
1. Verify that reject details are automatically extracted when a rework task is detected
2. Test that the click simulation works correctly without interfering with user interactions
3. Ensure that the extracted information is accurate and up-to-date
4. Verify that existing functionality continues to work as expected

## Security Considerations
None - this change only interacts with the DOM elements of the current page and does not introduce any security-sensitive functionality.

## Backward Compatibility
This change is backward compatible as it only adds new functionality for extracting reject details and does not modify existing APIs or data structures.

## Alternatives Considered
1. Keep the manual process - Users would continue to manually click the icon to view reject details
2. Automatically expand the reject details section - This would modify the page layout more significantly

## References
- Current implementation in `src/appen-data-collector.js`
- Previous QA reject detection functionality