# Track Rework Statistics Separately - Tasks

## Task List

### 1. Data Structure Enhancement
- [ ] Add `totalReworkCompletions` field to completionStats
- [ ] Add `totalReworkTopics` field to completionStats
- [ ] Add `reworkQuestions` field to completionStats
- [ ] Update data initialization logic
- [ ] Update data loading/migration logic
- [ ] Update data saving logic

### 2. Core Logic Implementation
- [ ] Implement rework detection logic
- [ ] Modify `recordValidCompletion()` to handle rework pages
- [ ] Modify `recordInvalidCompletion()` to handle rework pages
- [ ] Modify `recordCompletionOnConfirm()` to handle rework pages
- [ ] Update `updateTotalQuestions()` to exclude rework pages from total
- [ ] Implement `updateReworkQuestions()` for rework question tracking

### 3. UI Implementation
- [ ] Add rework statistics display below "总有效完成次数"
- [ ] Update "题目总数" calculation to exclude rework pages
- [ ] Add styling for rework indicators
- [ ] Ensure proper layout integration

### 4. Data Persistence
- [ ] Update storage schema
- [ ] Implement backward compatibility for existing data
- [ ] Test data loading and saving
- [ ] Verify data integrity during migration

### 5. Testing
- [ ] Unit tests for new data structures
- [ ] Unit tests for rework detection logic
- [ ] Integration tests for completion recording with rework
- [ ] Manual testing of UI display changes
- [ ] Backward compatibility testing
- [ ] Edge case testing (mixed rework/regular pages)

### 6. Documentation
- [ ] Update inline documentation
- [ ] Update any relevant user guides

## Dependencies
- Completion statistics implementation
- Quality check record handling

## Parallelizable Work
- Data structure enhancement and UI implementation can be done in parallel
- Core logic implementation can be done independently
- Testing can be done in parallel with implementation