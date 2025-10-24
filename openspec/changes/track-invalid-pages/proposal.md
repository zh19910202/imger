# Track Invalid Pages in Completion Statistics

## Status
Proposed

## Summary
Enhance the completion statistics tracking to include statistics for invalid labeled pages, add a count of invalid pages next to the "总有效完成次数" (total valid completion count), and display the total number of questions across all labeled pages.

## Motivation
The current completion statistics only track valid completions but don't provide visibility into invalid labeled pages. Users need to understand:
1. How many pages have been marked as invalid
2. The ratio of valid to invalid pages
3. Total question count across all pages for better workload assessment

This enhancement will provide better insights into annotation quality and workload distribution.

## Technical Design
The enhancement will modify the completion statistics data structure and UI to include:
- Tracking of invalid page completions
- Separate counters for valid and invalid pages
- Total question count across all pages
- Enhanced display in the statistics panel

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Add data structure for tracking invalid page completions
2. Implement function to record invalid page completions
3. Modify UI to display invalid page statistics
4. Add total question count display
5. Update data persistence and synchronization logic
6. Test enhanced functionality

## Testing Strategy
- Unit tests for new data structures
- Integration tests for invalid page recording
- Manual testing of UI display changes
- Verification of data persistence
- Backward compatibility testing

## Security Considerations
- No security implications expected
- Ensure no sensitive data is stored in completion statistics
- Maintain data integrity during refactoring

## Backward Compatibility
- Maintain existing completion statistics format
- Ensure older data can be migrated or handled gracefully
- No breaking changes to existing APIs

## Alternatives Considered
- Keeping invalid pages in the same counter with a status flag - Rejected because separate counters provide clearer metrics
- Not tracking invalid pages at all - Rejected because it reduces visibility into annotation quality

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality