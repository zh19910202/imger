# Fix Reject Reason Display - Tasks

## Task List

### 1. Data Structure Enhancement
- [ ] Add `rejectReason` field to per-page completion data structure
- [ ] Update data initialization logic for new field
- [ ] Update data migration logic for backward compatibility

### 2. Core Logic Implementation
- [ ] Modify `recordValidCompletion()` to store page-specific reject reasons
- [ ] Modify `recordInvalidCompletion()` to store page-specific reject reasons
- [ ] Modify `recordCompletionOnConfirm()` to store page-specific reject reasons
- [ ] Ensure reject reason extraction logic works correctly

### 3. UI Implementation
- [ ] Update page completion details display to use page-specific reject reasons
- [ ] Ensure proper handling of empty or missing reject reasons
- [ ] Maintain existing display formatting and styling

### 4. Data Persistence
- [ ] Ensure reject reasons are properly saved and loaded
- [ ] Test data migration with existing completion statistics
- [ ] Verify data integrity during save/load operations

### 5. Testing
- [ ] Unit tests for reject reason storage and retrieval
- [ ] Manual testing with multiple pages having different reject reasons
- [ ] Test with pages that have no reject reasons
- [ ] Backward compatibility testing
- [ ] Edge case testing (malformed reject reasons, etc.)

### 6. Documentation
- [ ] Update inline documentation if needed

## Dependencies
- Completion statistics implementation
- Quality check record handling

## Parallelizable Work
- Data structure enhancement and UI implementation can be done in parallel
- Core logic implementation can be done independently
- Testing can be done in parallel with implementation