# Add Rework Status Field - Design

## Overview
This design document outlines the approach for adding a "新旧题状态" field to the Appen data collection modal to distinguish between new and secondary rework tasks.

## Current State Analysis
The current implementation displays:
- User ID, Task ID, Topic ID
- Topic count, elapsed time, validity status
- Cookie status
- Reject reason (if available)
- Completion statistics

There's no way to distinguish between new rework tasks and secondary rework tasks that may have failed to capture reject reasons.

## Requirements
1. Add "新旧题状态" field above "驳回理由" in the modal
2. Display "新" for new tasks or first rework
3. Display "旧" for secondary rework tasks
4. Maintain backward compatibility
5. Handle cases where status cannot be determined

## Data Structure Changes
Enhance the per-page completion data structure:

```javascript
// Current per-page structure:
{
    completions: 0,
    topicId: 'unknown_topic',
    topicCount: 0,
    elapsedSeconds: 0,
    isValid: true,
    hasRework: false,
    rejectReason: '',
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
    isSecondaryRework: false, // NEW - Indicates secondary rework
    rejectReason: '',
    firstCompletionTime: timestamp,
    lastCompletionTime: timestamp
}
```

## Status Detection Logic
A task is considered secondary rework if:
1. The same page/topic has been completed before with rework status
2. The page has been completed multiple times and at least one was a rework

## Implementation Approach
1. **Data Structure Enhancement**: Add `isSecondaryRework` field to per-page data
2. **Recording Logic**: Modify completion recording functions to:
   - Check completion history for the same page
   - Set `isSecondaryRework` flag when appropriate
3. **UI Enhancement**: Add "新旧题状态" field to modal display
4. **Data Migration**: Ensure existing data handles the new field properly

## Migration Strategy
For backward compatibility:
1. Initialize `isSecondaryRework` field when loading existing data
2. Set to false for pages without rework history
3. Ensure no data loss during the transition

## Error Handling
- Handle cases where completion history is incomplete
- Gracefully handle pages without sufficient data to determine status
- Maintain data consistency during concurrent operations

## Performance Considerations
- Minimal impact on existing performance
- Efficient status detection logic
- Proper debouncing of UI updates