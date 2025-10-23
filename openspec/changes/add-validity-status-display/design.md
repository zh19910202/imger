# Validity Status Display Design

## Overview
This document outlines the design for adding validity status display to the page completion details in the modal statistics.

## Current State Analysis
The current modal display shows enhanced page completion information including:
- Page identifier
- Completion counts
- Topic counts
- Elapsed times
- Reject reasons
- Last completion timestamps

However, it lacks explicit validity status information that is available in the data structure:
```javascript
completionStats.perPage[pageKey] = {
    completions: 0,
    topicId: "topic_123",
    topicCount: 5,
    elapsedSeconds: 120,
    isValid: true,  // This field is available but not displayed
    firstCompletionTime: 1234567890,
    lastCompletionTime: 1234567890
}
```

## Enhanced Display Format

### Current Display Format
```
页面: task_123::topic_456
  完成次数: 3 | 题数: 5 | 耗时: 120秒
  驳回理由: Quality issue found (QA审核)
  最后完成: 2023-01-01 10:00:00
```

### Enhanced Display Format with Validity Status
```
页面: task_123::topic_456
  完成次数: 3 | 题数: 5 | 耗时: 120秒 | 状态: ✓ 有效
  驳回理由: Quality issue found (QA审核)
  最后完成: 2023-01-01 10:00:00
```

## Implementation Approach

### 1. Data Access
- Access validity status from `completionStats.perPage[pageKey].isValid`
- Handle cases where the field might be missing or undefined
- Provide appropriate default values

### 2. Display Formatting
- Add validity status to the existing information line
- Use visual indicators:
  - ✓ 有效 (Green color) for valid pages
  - ✗ 无效 (Red color) for invalid pages
  - 未知状态 (Gray color) for undefined status
- Maintain consistency with existing color scheme

### 3. Error Handling
- Graceful handling of missing validity data
- Default to "未知状态" when data is unavailable
- Proper error messages for data access issues

## Visual Design

### Color Scheme for Validity Status
- Valid (true): Green (#4CAF50)
- Invalid (false): Red (#f44336)
- Unknown (undefined/null): Gray (#9E9E9E)

### Text Indicators
- Valid: "✓ 有效"
- Invalid: "✗ 无效"
- Unknown: "未知状态"

## Backward Compatibility Strategy
To maintain backward compatibility:
1. Default values for missing validity fields
2. Graceful degradation when data is unavailable
3. Preservation of existing display functionality
4. Non-breaking changes to data structures

## Performance Considerations
- Minimal impact on modal rendering performance
- Efficient data access patterns
- Proper DOM manipulation techniques

## Testing Strategy
- Unit tests for display formatting functions
- Integration tests for data access
- Manual testing of various validity states
- Cross-browser compatibility testing