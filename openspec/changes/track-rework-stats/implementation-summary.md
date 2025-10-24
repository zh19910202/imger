# Track Rework Statistics Separately - Implementation Summary

This proposal has been created to track rework pages (pages with rejection information) separately from regular completions.

## Files Created
1. `proposal.md` - Main proposal document
2. `design.md` - Technical design document
3. `tasks.md` - Implementation tasks
4. `specs/completion-tracking/spec.md` - Specification for completion tracking with rework separation

## Key Features
- Separate tracking for rework pages (pages with rejection information)
- Exclusion of rework pages from regular completion and topic counts
- New UI display for rework statistics below "总有效完成次数"
- Backward compatibility with existing data

## Implementation Approach
1. Enhance completionStats data structure with rework-specific counters
2. Modify completion recording logic to detect and handle rework pages
3. Update statistics calculation to exclude rework from totals
4. Add UI display for rework statistics
5. Ensure data persistence and synchronization

## Next Steps
1. Review the proposal with stakeholders
2. Get approval for implementation
3. Begin implementation according to the task list