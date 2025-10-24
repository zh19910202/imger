# Track Invalid Pages - Design

## Overview
This design document outlines the approach for enhancing the completion statistics to track invalid labeled pages and display additional metrics.

## Current State Analysis
The current implementation in `appen-data-collector.js` tracks:
- `totalValidCompletions`: Count of valid page completions
- `totalTopicsCompleted`: Total number of topics/questions completed
- `perPage`: Detailed information per page including validity status

Each page entry in `perPage` already has an `isValid` field, but there's no aggregated statistics for invalid pages.

## Requirements
1. Add tracking for invalid page completions
2. Display invalid page count next to "总有效完成次数"
3. Show invalid page details in "各页面完成详情"
4. Calculate and display total question count across all pages

## Data Structure Changes
We'll enhance the `completionStats` structure:

```javascript
let completionStats = {
    totalValidCompletions: 0,
    totalInvalidCompletions: 0,  // NEW
    totalTopicsCompleted: 0,
    totalQuestions: 0,           // NEW - total questions across all pages
    perPage: {}
};
```

## Function Implementation
We need to:
1. Add `recordInvalidCompletion()` function similar to `recordValidCompletion()`
2. Update existing functions to maintain the new counters
3. Enhance data synchronization logic

## UI Changes
1. Add "无效完成次数" display next to "总有效完成次数"
2. Update "各页面完成详情" to clearly show valid/invalid status
3. Add "题目总数" display showing total questions across all pages

## Migration Strategy
For backward compatibility, we'll need to:
1. Initialize new fields when loading existing data
2. Calculate initial values from existing `perPage` data if possible
3. Ensure no data loss during the transition

## Error Handling
- Handle cases where validity status is unknown
- Gracefully handle missing or malformed data
- Maintain data consistency during concurrent operations

## Performance Considerations
- Minimal impact on existing performance
- Efficient data aggregation for display
- Proper debouncing of UI updates