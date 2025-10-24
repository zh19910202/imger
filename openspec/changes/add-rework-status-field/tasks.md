# Add Rework Status Field - Tasks

## Task List

### 1. Data Structure Enhancement
- [ ] Add `isSecondaryRework` field to per-page completion data structure
- [ ] Update data initialization logic for new field
- [ ] Update data migration logic for backward compatibility

### 2. Core Logic Implementation
- [ ] Modify completion recording functions to detect secondary rework
- [ ] Implement status detection logic based on completion history
- [ ] Update `isSecondaryRework` flag when appropriate

### 3. UI Implementation
- [ ] Add "新旧题状态" field to modal display above "驳回理由"
- [ ] Implement display logic for new/old status
- [ ] Ensure proper styling and formatting

### 4. Data Persistence
- [ ] Ensure rework status is properly saved and loaded
- [ ] Test data migration with existing completion statistics
- [ ] Verify data integrity during save/load operations

### 5. Testing
- [ ] Unit tests for status detection logic
- [ ] Manual testing of modal display with different status values
- [ ] Test with pages that have no rework history
- [ ] Backward compatibility testing
- [ ] Edge case testing (insufficient data, etc.)

### 6. Documentation
- [ ] Update inline documentation if needed

## Dependencies
- Completion statistics implementation
- Quality check record handling

## Parallelizable Work
- Data structure enhancement and UI implementation can be done in parallel
- Core logic implementation can be done independently
- Testing can be done in parallel with implementation