# Design for Optimizing Rework Page Handling

## Overview
This document outlines the approach for optimizing the rework page handling process by implementing a prioritized information collection workflow. The goal is to improve efficiency and ensure critical information is collected first for rework pages.

## Current Implementation Analysis

### Existing Page Handling Flow
The current implementation follows this flow:
1. URL change detection triggers `onUrlChange()`
2. Task information is collected via `collectTaskInfo()`
3. Response elements are extracted via `extractResponseElements()`
4. Quality check records are collected as part of response extraction

### Limitations
- No prioritization based on page type (rework vs. regular)
- Quality check information collection is part of general response extraction
- Complex multi-attempt mechanisms for quality check data collection
- No clear separation between rework-specific and general processing

## Optimized Design

### New Workflow Priority
1. **Rework Status Detection** (Highest priority)
   - Quickly determine if current page is a rework page
   - Use existing `isCurrentPageRejected()` function

2. **Reject Reason Collection** (Rework pages only)
   - For rework pages, prioritize collecting reject reasons
   - Simplified collection process focused on essential data

3. **Basic Information Collection** (All pages)
   - Collect user ID, task ID, topic ID, etc.
   - Gather validity status and edit round information

4. **Additional Processing** (Lowest priority)
   - Other page element extraction
   - Statistical information collection

### New Function Structure
```
onUrlChange()
├── isTargetPage()
├── collectTaskInfo()
├── handleAnnotationPage()  # New main handler
│   ├── isCurrentPageRejected()
│   ├── collectRejectReason()    # New: Rework-specific
│   └── collectBasicInfo()       # New: General info
└── extractResponseElements()
```

## Implementation Strategy

### 1. Main Page Handler
- Create `handleAnnotationPage()` as the central coordination function
- Implement clear decision logic based on rework status
- Manage state to prevent duplicate processing

### 2. Rework-Specific Processing
- Create `collectRejectReason()` for focused reject reason collection
- Simplify quality check data extraction
- Prioritize DOM-based extraction over complex fallback mechanisms

### 3. General Information Collection
- Create `collectBasicInfo()` for standard information gathering
- Maintain compatibility with existing data structures
- Optimize common data collection operations

### 4. Integration Points
- Modify `onUrlChange()` to call new handler functions
- Maintain existing `isCurrentPageRejected()` logic
- Preserve all existing data collection capabilities

## Technical Details

### handleAnnotationPage Function
The new `handleAnnotationPage` function will:
1. Determine if current page is a rework page using `isCurrentPageRejected()`
2. If rework page: Call `collectRejectReason()` first
3. For all pages: Call `collectBasicInfo()`
4. Manage processing state to prevent duplicate work

### collectRejectReason Function
The new `collectRejectReason` function will:
1. Focus specifically on extracting reject reasons
2. Use simplified DOM extraction logic
3. Prioritize the most reliable data sources
4. Store results in a clear, accessible format

### collectBasicInfo Function
The new `collectBasicInfo` function will:
1. Collect standard page information (user ID, task ID, etc.)
2. Gather validity status and edit round data
3. Maintain compatibility with existing data structures

### State Management
New state tracking to ensure:
- Each page is processed only once per load
- Reject reasons are collected only for rework pages
- Processing order is maintained

## Risk Mitigation

### Potential Issues
- Changes to page handling flow might affect timing
- Simplified extraction logic might miss some edge cases
- New function structure might introduce integration issues

### Mitigation Strategies
- Thorough testing with various page types
- Maintain fallback mechanisms where critical
- Preserve existing logging for debugging
- Gradual integration with comprehensive testing

## Implementation Details

### Page State Management
```javascript
const pageState = {
    isRejected: null,        // Rework page status
    rejectReasonCollected: false, // Reject reason collection status
    basicInfoCollected: false,    // Basic info collection status
    lastProcessedUrl: null        // Last processed URL
};
```

### Processing Flow
1. Check if page already processed (URL comparison)
2. Determine rework status
3. If rework page: Collect reject reasons
4. Collect basic information
5. Update processing state

### Error Handling
- Centralized error handling in main handler function
- Graceful degradation for individual collection failures
- Detailed logging for debugging purposes

## Testing Strategy
The implementation will be tested with various scenarios:
1. Rework pages with various reject reason formats
2. Regular pages without reject information
3. Pages with complex DOM structures
4. Edge cases with timing issues
5. Integration with existing functionality

All tests will confirm the correct prioritized behavior while maintaining backward compatibility.