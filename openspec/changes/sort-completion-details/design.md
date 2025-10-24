# Sort Completion Details by Time - Design

## Overview
This design document outlines the approach for sorting the page completion details by time order, with the most recent completion displayed first.

## Current State Analysis
The current implementation in `appen-data-collector.js` displays page completion details using:
```javascript
Object.entries(completionStats.perPage)
    .slice(0, 5) // 只显示前5条记录
    .map(([pageKey, data]) => {
        // Render each entry
    })
```

This approach relies on the natural enumeration order of object keys, which is not meaningful from a temporal perspective.

## Requirements
1. Sort page completion entries by `lastCompletionTime` in descending order (newest first)
2. Handle entries without valid timestamps gracefully
3. Maintain the existing display limit of 5 entries
4. Preserve all existing display information

## Technical Approach
Convert the object entries to an array and sort by `lastCompletionTime`:
1. Extract entries from `completionStats.perPage`
2. Sort by `data.lastCompletionTime` in descending order
3. Handle missing or invalid timestamps by placing those entries at the end
4. Apply the existing slice limit (5 entries)

## Implementation Details
The key change will be in the template string where page completion details are rendered:
```javascript
// Current:
Object.entries(completionStats.perPage)
    .slice(0, 5)
    .map(([pageKey, data]) => { /* render */ })

// New:
Object.entries(completionStats.perPage)
    .sort((a, b) => {
        const timeA = a[1].lastCompletionTime || 0;
        const timeB = b[1].lastCompletionTime || 0;
        return timeB - timeA; // Descending order
    })
    .slice(0, 5)
    .map(([pageKey, data]) => { /* render */ })
```

## Error Handling
- Entries with missing `lastCompletionTime` will be sorted to the end
- Invalid timestamp values will be treated as 0
- Empty or null data entries will be filtered out before sorting

## Performance Considerations
- Sorting operation on small datasets (typically < 100 entries) should have minimal performance impact
- No additional data fetching or processing required
- Client-side sorting only affects display, not data storage

## Testing Considerations
- Verify sorting with various timestamp combinations
- Test with missing/invalid timestamps
- Confirm display limit is maintained
- Ensure backward compatibility with existing data