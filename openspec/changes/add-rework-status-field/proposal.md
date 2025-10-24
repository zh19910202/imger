# Add Rework Status Field to Appen Data Modal

## Status
Proposed

## Summary
Add a new "新旧题状态" field above the "驳回理由" field in the Appen data collection modal. The "旧" status indicates secondary rework, which helps distinguish返修题目 that may not have captured reject reasons but still need to be reworked.

## Motivation
Currently, there are cases where reject reasons are not captured but the task still needs rework. Users need a way to distinguish between new and old (二次返修) rework tasks to:
1. Better track rework patterns
2. Identify secondary rework tasks that may have failed to capture reject reasons
3. Improve work quality analysis

This enhancement will provide better visibility into rework status by adding a dedicated field.

## Technical Design
The enhancement will modify the Appen data collection modal to include a new "新旧题状态" field above the "驳回理由" field. The status will be determined based on rework history.

### Components Affected
- `src/appen-data-collector.js` - Modal display logic

### New Components
- None

### API Changes
- None

## Implementation Plan
1. Add `isSecondaryRework` field to per-page completion data structure
2. Modify completion recording logic to detect secondary rework
3. Add "新旧题状态" field to modal display above "驳回理由"
4. Implement status detection logic
5. Update data persistence and migration logic
6. Test enhanced functionality

## Testing Strategy
- Unit tests for new data structures
- Manual testing of modal display changes
- Verification of status detection logic
- Backward compatibility testing

## Security Considerations
- No security implications expected
- Maintain data integrity during refactoring

## Backward Compatibility
- Maintain existing data structure format
- Ensure older data can be migrated or handled gracefully
- No breaking changes to existing APIs

## Alternatives Considered
- Keeping the current display without the new field - Rejected because it reduces visibility into rework patterns
- Adding the field in a different location - Rejected because placing it above 驳回理由 provides better context

## References
- Current `appen-data-collector.js` implementation
- Existing completion statistics functionality
- Quality check record handling logic