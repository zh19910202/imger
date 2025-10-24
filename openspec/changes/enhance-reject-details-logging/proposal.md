# OpenSpec Change Proposal: Enhance Reject Details Logging

## Title
Enhance Logging for Reject Details Extraction Workflow

## Status
Proposed

## Summary
This change proposes to add comprehensive logging to the reject details extraction workflow to provide better visibility into the plugin's behavior when entering rework annotation pages. The enhanced logging will help developers and users understand the specific workflow status and ensure the process is working as expected.

## Motivation
Currently, when the plugin enters a rework annotation page, there is limited visibility into the internal workflow status and execution steps. This makes it difficult to debug issues or verify that the reject details extraction process is working correctly. By adding detailed logging, we can:
1. Track the exact steps the plugin takes when detecting a rework page
2. Monitor the success or failure of each stage in the reject details extraction process
3. Provide clear indicators of workflow status at each step
4. Enable easier debugging and troubleshooting

## Technical Design
The change involves enhancing the existing logging in the reject details extraction functionality to provide more granular information about:
- Page detection and identification
- Reject message detection
- Red dot icon click simulation
- Reject details extraction process
- Data storage and integration with existing features

### Components Affected
- `src/appen-data-collector.js` - The main content script file

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Add detailed logging at key decision points in the reject details workflow
2. Log the detection of rework pages and the specific reject message found
3. Log the red dot icon click simulation process
4. Log the reject details extraction process and results
5. Log the integration with new/old status detection
6. Log the storage of reject details for UI display
7. Test the enhanced logging to ensure it provides the needed visibility

## Testing Strategy
1. Verify that enhanced logging appears in the console when entering rework pages
2. Confirm that all key workflow steps are properly logged
3. Ensure that the logging provides clear status information
4. Verify that existing functionality continues to work as expected
5. Test that logs are helpful for debugging and troubleshooting

## Security Considerations
None - this change only adds logging statements and does not introduce any security-sensitive functionality.

## Backward Compatibility
This change is backward compatible as it only adds additional logging statements and does not modify existing APIs or data structures.

## Alternatives Considered
1. Keep the current minimal logging - This would maintain the current lack of visibility into the workflow
2. Add external logging or analytics - This would be more complex and potentially raise privacy concerns

## References
- Current implementation in `src/appen-data-collector.js`
- Previous reject details extraction functionality
- Existing new/old status detection implementation