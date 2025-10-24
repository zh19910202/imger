# Add Rework Status Field - Implementation Summary

This proposal has been created to add a "新旧题状态" field to the Appen data collection modal to distinguish between new and secondary rework tasks.

## Files Created
1. `proposal.md` - Main proposal document
2. `design.md` - Technical design document
3. `tasks.md` - Implementation tasks
4. `specs/modal-display/spec.md` - Specification for modal display with rework status field

## Key Features
- Add "新旧题状态" field above "驳回理由" in the modal
- Display "新" for new tasks or first rework
- Display "旧" for secondary rework tasks
- Backward compatibility with existing data
- Proper handling of cases where status cannot be determined

## Implementation Approach
1. Enhance per-page data structure with `isSecondaryRework` field
2. Modify completion recording functions to detect secondary rework
3. Add "新旧题状态" field to modal display
4. Ensure data persistence and migration

## Next Steps
1. Review the proposal with stakeholders
2. Get approval for implementation
3. Begin implementation according to the task list