# Track Rework Statistics Separately

## Status
Proposed

## Summary
Enhance the completion statistics to separately track rework (pages with rejection information) from regular completions. Rework pages should not be counted in total completion numbers and topic totals, but should be tracked in a separate statistic displayed below "总有效完成次数".

## Motivation
Currently, all completed pages are counted in the total completion statistics regardless of whether they have rejection information. Users need to distinguish between regular completions and rework (返修 work) to:
1. Accurately track actual completion rates
2. Identify pages that required corrections
3. Better understand work quality patterns

This enhancement will provide clearer metrics by separating rework from regular completions.

## Technical Design
The enhancement will modify the completion statistics data structure and UI to include:
- Detection of pages with rejection information
- Separate counters for rework pages
- Exclusion of rework pages from total completion and topic counts
- New UI display for rework statistics

### Components Affected
- `src/appen-data-collector.js` - Primary file for enhancement

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Add data structure for tracking rework statistics
2. Modify completion recording logic to detect and handle rework pages
3. Update statistics calculation to exclude rework from totals
4. Add UI display for rework statistics below "总有效完成次数"
5. Update data persistence and synchronization logic
6. Test enhanced functionality

## Testing Strategy
- Unit tests for new data structures
- Integration tests for rework detection and recording
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
- Keeping rework in the same counters - Rejected because it reduces accuracy of completion metrics
- Not tracking rework at all - Rejected because it reduces visibility into work quality

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality
- Quality check record handling logic