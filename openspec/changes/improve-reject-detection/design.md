# Design for Improving QA Reject Detection

## Overview
This document outlines the approach for improving the QA reject detection algorithm by incorporating precise HTML element targeting. The goal is to improve the reliability and accuracy of QA reject identification by leveraging specific HTML structures instead of text-based searching.

## Current Algorithm Analysis

### Existing Implementation
The current `isCurrentPageRejected` function uses multiple approaches to detect QA rejects:
1. Text-based searching in document.body.innerText
2. Line-by-line text scanning for specific patterns
3. JavaScript variable inspection
4. Element class-based searching

### Limitations
- Text-based searching can be unreliable due to formatting variations
- Timing issues with dynamic content loading
- False positives from similar text in other page elements
- Performance overhead from extensive text scanning

## Improved Algorithm Design

### New Approach
1. HTML Element Targeting
   - Target specific div elements with known class structures
   - Look for elements containing "被 QA1 Rejected 请修订" text in specific HTML contexts
   - Use precise CSS selectors to target the reject notification area

2. Fallback Strategy
   - Maintain existing text-based detection as fallback
   - Only use fallback when HTML targeting doesn't find results
   - Preserve all existing detection patterns for backward compatibility

### Priority Order
1. HTML Element Targeting (highest priority - most accurate)
2. Existing text-based detection (fallback for compatibility)

## Implementation Strategy

### 1. Element Identification
- Identify CSS selectors for QA reject notification elements
- Target the specific div structure: `div.flex.flex-row.justify-between.items-center.h-10.px-4`
- Verify the element contains the expected text content

### 2. Detection Functions
- Enhance `isCurrentPageRejected` function with HTML targeting
- Add precise element selection with error handling
- Maintain existing detection logic as fallback

### 3. Algorithm Integration
- Modify `isCurrentPageRejected` to prioritize HTML targeting
- Preserve status locking mechanism
- Maintain detailed logging for debugging

### 4. Error Handling
- Handle cases where elements are not found
- Gracefully fall back to existing logic
- Log any issues for debugging purposes

## Technical Details

### HTML Element Targeting
- Target selector: `div.flex.flex-row.justify-between.items-center.h-10.px-4`
- Verify element has expected background-color and color styles
- Check that element text contains "被 QA1 Rejected 请修订"

### Integration Points
- `isCurrentPageRejected` function will be the main integration point
- Preserve existing status locking mechanism
- Maintain compatibility with `getPageNewOldStatus` function

## Risk Mitigation

### Potential Issues
- HTML structure may change between different task types
- Elements may not be immediately available on page load
- New targeting method may conflict with existing detection

### Mitigation Strategies
- Use robust element selection with fallback selectors
- Implement proper timing with page load completion
- Thoroughly test with various page scenarios
- Add comprehensive logging for debugging
- Graceful fallback to existing logic when new method cannot be determined

## Implementation Details

### Enhanced isCurrentPageRejected Function
The improved `isCurrentPageRejected` function will:
1. First attempt HTML element targeting with precise selectors
2. If HTML targeting finds reject status, return true immediately
3. If HTML targeting doesn't find reject status, fall back to existing detection
4. Include detailed logging for both approaches
5. Maintain status locking mechanism to prevent state changes within the same page

## Testing Strategy
The implementation will be tested with various scenarios:
1. Pages with QA rejects using the new HTML structure
2. Pages without QA rejects
3. Pages where HTML elements are not immediately available
4. Pages where HTML targeting fails but text-based detection works
5. Pages with both HTML and text-based indicators

All tests will confirm the correct behavior of the improved algorithm while maintaining backward compatibility.