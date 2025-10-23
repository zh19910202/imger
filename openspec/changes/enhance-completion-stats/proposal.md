# Enhance Completion Statistics with Detailed Page Tracking

## Change ID
enhance-completion-stats

## Status
Proposed

## Summary
Enhance the Appen data collector to record detailed information for each annotation page in the completion statistics, including topic ID, topic count, elapsed time (seconds), and validity status. This will provide more granular tracking and reporting capabilities for annotation work.

## Motivation
The current completion statistics only track basic counts without detailed information about individual annotation pages. Users need more detailed tracking to:
1. Monitor performance on specific topics
2. Analyze time spent per page
3. Track validity of annotations
4. Generate detailed reports for quality assurance

## Technical Design
The enhancement will modify the completion statistics data structure to include detailed page-level information:
- Topic ID for each page
- Topic count per page
- Elapsed time in seconds
- Validity status

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement

## Implementation Plan
1. Modify completion statistics data structure to include detailed page information
2. Enhance `recordValidCompletion` function to capture additional metrics
3. Add elapsed time tracking per page
4. Ensure data is properly persisted and retrieved from storage
5. Update data synchronization with collectedData
6. Test enhanced functionality

## Testing Strategy
- Unit tests for new data structure
- Integration tests for completion recording
- Manual testing of data persistence
- Verification of backward compatibility

## Security Considerations
- No security implications expected
- Ensure no sensitive data is stored in completion statistics
- Maintain data integrity during refactoring

## Backward Compatibility
- Maintain existing completion statistics format
- Ensure older data can be migrated or handled gracefully
- No breaking changes to existing APIs

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality