# Fix Reject Reason Display - Design

## Overview
This design document outlines the approach for fixing the bug where all page completion details display the same reject reason instead of each page's own reject reason.

## Current State Analysis
The current implementation has the following issues:
1. All page completion details use the same reject reason: `collectedData.responseElements?.qualityCheckRecord?.latestRecord?.comment`
2. Per-page data structure does not store individual reject reasons
3. Users see incorrect information about which pages were rejected and why

## Requirements
1. Store reject reasons individually for each page in completion statistics
2. Display the correct reject reason for each page in completion details
3. Maintain backward compatibility with existing data
4. Handle cases where pages have no reject reasons

## Data Structure Changes
Enhance the per-page completion data structure to include reject reasons:

```javascript
// Current per-page structure:
{
    completions: 0,
    topicId: 'unknown_topic',
    topicCount: 0,
    elapsedSeconds: 0,
    isValid: true,
    hasRework: false,
    firstCompletionTime: timestamp,
    lastCompletionTime: timestamp
}

// New per-page structure:
{
    completions: 0,
    topicId: 'unknown_topic',
    topicCount: 0,
    elapsedSeconds: 0,
    isValid: true,
    hasRework: false,
    rejectReason: '具体驳回理由', // NEW - Page-specific reject reason
    firstCompletionTime: timestamp,
    lastCompletionTime: timestamp
}
```

## Implementation Approach
1. **Data Structure Enhancement**: Add `rejectReason` field to per-page data
2. **Recording Logic**: Modify completion recording functions to:
   - Extract reject reason when available
   - Store reject reason in per-page data
3. **UI Enhancement**: Update completion details display to:
   - Use page-specific reject reasons instead of global one
4. **Data Migration**: Ensure existing data handles the new field properly

## Reject Reason Extraction Logic
When recording completion:
1. Check if current page has quality check record with rejection
2. Extract reject reason from `qualityCheckRecord.latestRecord.comment`
3. Store in per-page data structure

## Migration Strategy
For backward compatibility:
1. Initialize `rejectReason` field when loading existing data
2. Set to empty string or null for pages without reject reasons
3. Ensure no data loss during the transition

## Error Handling
- Handle cases where quality check data is missing or malformed
- Gracefully handle pages without reject reasons (show "无驳回")
- Maintain data consistency during concurrent operations

## Performance Considerations
- Minimal impact on existing performance
- Efficient reject reason storage and retrieval
- Proper debouncing of UI updates