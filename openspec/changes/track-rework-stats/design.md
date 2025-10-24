# Track Rework Statistics Separately - Design

## Overview
This design document outlines the approach for tracking rework (pages with rejection information) separately from regular completions.

## Current State Analysis
The current implementation tracks:
- Total valid completions (`totalValidCompletions`)
- Total invalid completions (`totalInvalidCompletions`)
- Total topics completed (`totalTopicsCompleted`)
- Per-page completion details (`perPage`)

Pages with rejection information are currently counted in the regular statistics without distinction.

## Requirements
1. Detect pages with rejection information (quality check records with rejections)
2. Track rework pages separately from regular completions
3. Exclude rework pages from total completion and topic counts
4. Display rework statistics below "总有效完成次数"
5. Maintain backward compatibility

## Data Structure Changes
Enhance the `completionStats` structure:

```javascript
let completionStats = {
    totalValidCompletions: 0,     // Regular valid completions only
    totalInvalidCompletions: 0,   // Regular invalid completions only
    totalReworkCompletions: 0,    // NEW - Rework completions
    totalTopicsCompleted: 0,      // Regular topics only
    totalReworkTopics: 0,         // NEW - Topics in rework pages
    totalQuestions: 0,            // Regular questions only
    reworkQuestions: 0,           // NEW - Questions in rework pages
    perPage: {}                   // Enhanced per-page tracking
};
```

## Rework Detection Logic
A page is considered rework if:
- `collectedData.responseElements.qualityCheckRecord.hasRecord` is true
- `collectedData.responseElements.qualityCheckRecord.latestRecord.type` is 'REJECTED'

## Implementation Approach
1. **Data Structure Enhancement**: Add rework-specific counters
2. **Recording Logic**: Modify completion recording functions to:
   - Check for rejection information
   - Route rework pages to separate counters
   - Exclude rework from regular totals
3. **UI Enhancement**: Add rework statistics display below "总有效完成次数"
4. **Data Synchronization**: Update sync logic for new fields

## Page Completion Logic
When recording a completion:
1. Check if the page has rejection information
2. If yes:
   - Increment `totalReworkCompletions`
   - Add topics to `totalReworkTopics`
   - Do NOT increment `totalValidCompletions` or `totalTopicsCompleted`
3. If no:
   - Use existing logic for regular completions

## Migration Strategy
For backward compatibility:
1. Initialize new fields when loading existing data
2. Recalculate rework statistics from existing `perPage` data if possible
3. Ensure no data loss during the transition

## Error Handling
- Handle cases where quality check data is missing or malformed
- Gracefully handle mixed data (some pages with rework info, some without)
- Maintain data consistency during concurrent operations

## Performance Considerations
- Minimal impact on existing performance
- Efficient rejection detection
- Proper debouncing of UI updates