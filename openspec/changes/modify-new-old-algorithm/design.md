# Design Document: Modify New/Old Question Algorithm

## Overview
This document describes the design for modifying the new/old question algorithm to consider only current QA rejection status.

## Current Implementation
The current algorithm in `getPageNewOldStatus` only considers historical rework data:
```javascript
function getPageNewOldStatus(pageData) {
    if (!pageData) {
        return '新'; // If no page data, consider it new
    }

    // Check if there was a rework record previously
    if (pageData.hasRework === true) {
        return '旧'; // Previously had rework record
    }

    // No previous rework record
    return '新'; // New question
}
```

## Proposed Design
The new algorithm will check only for current QA rejection status:

```javascript
function getPageNewOldStatus(pageData) {
    // Check for current QA rejection on the page
    if (isCurrentPageRejected()) {
        return '旧'; // Current page shows QA rejection
    }

    // If no current rejection, consider it new
    return '新'; // New question
}
```

## QA Rejection Detection
A new helper function `isCurrentPageRejected()` will be created to detect QA rejection messages:

```javascript
function isCurrentPageRejected() {
    // Check page text for QA rejection messages
    const pageText = document.body.innerText;
    if (pageText.includes("被 QA1 Rejected 请修订")) {
        return true; // Found QA rejection message
    }

    // Check for other possible QA rejection patterns
    if (pageText.includes("被 QA") && pageText.includes("Rejected") && pageText.includes("请修订")) {
        return true; // Found QA rejection with different QA name
    }

    // Check for QA rejection in JavaScript data
    if (window.__INITIAL_DATA__ &&
        window.__INITIAL_DATA__.taskMessage &&
        window.__INITIAL_DATA__.taskMessage.taskType === "REWORK") {
        return true; // Task is marked as rework in initial data
    }

    return false; // No QA rejection detected
}
```

## Priority Logic
The new algorithm only considers one factor:
1. Current QA rejection message on page (only factor)

## Impact Analysis
This change will:
- Provide real-time feedback when a question is rejected by QA
- Improve user experience by showing accurate status immediately
- Simplify the logic by removing historical data consideration
- Not affect any other functionality in the extension

## Edge Cases Considered
1. Pages with "被 QA1 Rejected 请修订" - will show as "旧"
2. Pages without the rejection message - will show as "新"
3. Pages with different QA names (QA2, QA3, etc.) - will also be detected
4. Pages where rejection message is not yet loaded - may temporarily show "新" until DOM is fully loaded

## Performance Considerations
- The QA rejection detection function will be lightweight
- No additional network requests will be made
- DOM queries will be minimized
- The function will be called only when needed for status display