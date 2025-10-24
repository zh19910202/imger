# Implementation Tasks for Modify New/Old Question Algorithm

## Task List

### 1. Analyze Current Implementation
- Review the existing `getPageNewOldStatus` function in `src/appen-data-collector.js`
- Understand how the current algorithm works

### 2. Create Helper Function for QA Rejection Detection
- Create a new function `isCurrentPageRejected()` to detect "被 QA1 Rejected 请修订" messages in the current page
- Test the function with pages that do and don't show the rejection message
- Ensure the function works with different QA names (QA1, QA2, etc.)

### 3. Modify getPageNewOldStatus Function
- Update the function to only check for current QA rejection messages
- Remove the dependency on historical rework data
- Ensure the function returns "旧" when rejection is detected and "新" otherwise

### 4. Update Related Functions
- Update `getCurrentPageReworkStatus` if needed
- Update `getPageNewOldStatusColor` if needed
- Ensure all related display functions work correctly with the new logic

### 5. Add Logging for Debugging
- Add debug logging to show when a question is classified as rework due to current QA rejection
- Log the detection of QA rejection messages for troubleshooting

### 6. Testing
- Test with pages showing "被 QA1 Rejected 请修订" - should show as "旧"
- Test with pages not showing the rejection message - should show as "新"
- Test with different QA names (QA2, QA3, etc.) - should show as "旧"

### 7. Documentation Update
- Update any relevant documentation or comments
- Add code comments explaining the new logic

### 8. Validation
- Validate the changes work correctly in different scenarios
- Ensure no regression in existing functionality
- Verify the display updates correctly in the UI