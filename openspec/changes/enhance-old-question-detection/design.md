# Design for Enhancing Old Question Detection

## Overview
This document outlines the approach for enhancing the old question detection algorithm by incorporating additional criteria based on valid status and edit count. The goal is to improve the accuracy of old question identification by leveraging more signals from the page content.

## Current Algorithm Analysis

### Existing Implementation
The current getPageNewOldStatus function only checks for QA reject status:
- If a QA reject message is detected, the question is marked as old
- Otherwise, it's marked as new

### Limitations
- Only considers QA rejection as the indicator of old questions
- Does not leverage other available signals on the page
- May miss questions that have been edited but not QA rejected

## Enhanced Algorithm Design

### New Criteria
1. Valid Status Detection
   - Look for elements indicating the question has a valid status (默认值是有效)
   - This indicates the question has been processed at least once

2. Edit Count Detection
   - Look for elements showing edit count >= 1 (编辑轮数大于等于1)
   - This indicates the question has been edited at least once

3. QA Reject Detection (existing)
   - Continue to check for QA reject messages as before

### Combined Logic
The enhanced algorithm will use the following logic:
1. If QA reject is detected -> Mark as old
2. Else if valid status is detected AND edit count >= 1 -> Mark as old
3. Else -> Mark as new

### Priority Order
1. QA Reject (highest priority - definitive old question)
2. Valid status + edit count (secondary indicator of old question)
3. Default to new question

## Implementation Strategy

### 1. Element Identification
- Identify CSS selectors for valid status elements
- Identify CSS selectors for edit count elements
- Create robust element selection functions

### 2. Status Detection Functions
- Create function to detect valid status
- Create function to detect edit count
- Handle cases where elements may not be immediately available

### 3. Algorithm Integration
- Modify getPageNewOldStatus to incorporate new criteria
- Maintain backward compatibility with existing QA detection
- Add appropriate logging for debugging

### 4. Error Handling
- Handle cases where elements are not found
- Gracefully fall back to existing logic if new criteria cannot be determined
- Log any issues for debugging purposes

## Technical Details

### Valid Status Detection
- Look for radio button or text indicating "有效" status
- Check for default selection of "有效" option
- Verify the status is explicitly set (not just default)

### Edit Count Detection
- Look for elements showing "编辑轮数" or similar text
- Extract numeric value from associated input or display element
- Verify the value is >= 1

### Integration Points
- getPageNewOldStatus function will be the main integration point
- May need to enhance isCurrentPageRejected function to work with new logic
- Ensure timing considerations for element availability

## Risk Mitigation

### Potential Issues
- Elements may not be immediately available on page load
- Page structure may vary between different task types
- New criteria may conflict with existing QA detection

### Mitigation Strategies
- Use robust element selection with fallback selectors
- Implement proper timing with page load completion
- Thoroughly test with various page scenarios
- Add comprehensive logging for debugging
- Graceful fallback to existing logic when new criteria cannot be determined