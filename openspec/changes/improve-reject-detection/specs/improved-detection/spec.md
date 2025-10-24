# Improve QA Reject Detection Specification

## MODIFIED Requirements

### Requirement: Improve QA Reject Detection Algorithm
The appen-data-collector.js file SHALL enhance the QA reject detection algorithm to include precise HTML element targeting.

#### Scenario: Detect QA reject with HTML element targeting
Given a task page is loaded
When the page contains a QA reject notification div with specific class structure
Then the system SHALL identify the page as rejected using HTML targeting

#### Scenario: Fallback to text-based detection
Given a task page is loaded
When HTML element targeting does not find reject status
Then the system SHALL fall back to existing text-based detection

### Requirement: Maintain Existing Detection as Fallback
The appen-data-collector.js file SHALL continue to support existing text-based detection as fallback.

#### Scenario: Use fallback when HTML targeting fails
Given a task page is loaded
When HTML element targeting does not find elements but text-based detection finds reject patterns
Then the system SHALL identify the page as rejected using fallback detection

#### Scenario: Combine detection methods
Given a task page is loaded
When both HTML targeting and text-based detection are available
Then the system SHALL prioritize HTML targeting over text-based detection

## ADDED Requirements

### Requirement: Target Specific HTML Elements
The appen-data-collector.js file SHALL target specific HTML elements for QA reject detection.

#### Scenario: Identify QA reject div element
Given a task page is loaded
When the page contains a div with classes "flex flex-row justify-between items-center h-10 px-4" and text "被 QA1 Rejected 请修订"
Then the system SHALL recognize this as a QA reject indicator

#### Scenario: Handle missing HTML elements
Given a task page is loaded
When no specific QA reject div elements are found
Then the system SHALL continue with fallback detection methods

### Requirement: Verify Element Styling
The appen-data-collector.js file SHALL verify element styling for accurate detection.

#### Scenario: Verify element styling
Given a task page is loaded
When a div element with required classes also has expected styling (background-color:#fff, color:#0F121A)
Then the system SHALL confirm this as a valid QA reject indicator

#### Scenario: Handle styling variations
Given a task page is loaded
When a div element with required classes does not have expected styling
Then the system SHALL continue with other detection methods

### Requirement: Combine Detection Approaches
The appen-data-collector.js file SHALL combine HTML targeting with existing detection for improved reliability.

#### Scenario: QA reject detected via HTML targeting
Given a task page is loaded
When HTML targeting finds a QA reject element
Then the system SHALL mark the page as rejected without using fallback methods

#### Scenario: No QA reject detected
Given a task page is loaded
When neither HTML targeting nor fallback detection finds reject indicators
Then the system SHALL mark the page as not rejected

## IMPLEMENTATION Details

### HTML Element Targeting Implementation
The enhanced `isCurrentPageRejected` function SHALL:
1. Target selector: `div.flex.flex-row.justify-between.items-center.h-10.px-4`
2. Verify element styling: background-color:#fff and color:#0F121A
3. Check element text content for "被 QA1 Rejected 请修订"
4. Use multiple targeting strategies for robustness:
   - Direct querySelector for the specific element
   - Query with additional attribute filters
   - Fallback to partial class matching
5. Include comprehensive error handling that falls back to existing detection

### Fallback Detection Implementation
The `isCurrentPageRejected` function SHALL maintain all existing detection methods:
1. Text-based searching in document.body.innerText
2. Line-by-line text scanning for specific patterns
3. JavaScript variable inspection
4. Element class-based searching
5. Include comprehensive error handling that returns appropriate status

### Combined Algorithm Implementation
The `isCurrentPageRejected` function SHALL:
1. First attempt HTML element targeting with highest priority
2. If HTML targeting finds reject status, return true immediately
3. If HTML targeting doesn't find reject status, use existing detection methods
4. Return false if no reject indicators are found
5. Include detailed logging for debugging purposes
6. Maintain status locking mechanism to prevent state changes within the same page

## IMPLEMENTATION Results

### New Functions Added
1. `detectRejectByHtmlElement()` function:
   - Uses CSS selector `div.flex.flex-row.justify-between.items-center.h-10.px-4`
   - Verifies element styling (background-color:#fff, color:#0F121A)
   - Checks for text "被 QA1 Rejected 请修订"
   - Includes fallback matching and error handling

2. Enhanced `isCurrentPageRejected()` function:
   - Prioritizes HTML element targeting as first detection method
   - Maintains all existing detection methods as fallback
   - Preserves status locking mechanism
   - Adds comprehensive logging

### Priority Order Implementation
1. HTML Element Targeting (highest priority)
   - Direct element selection with styling verification
   - Immediate return if match found
2. Existing Text-Based Detection (fallback)
   - All previous detection methods preserved
   - Used only if HTML targeting doesn't find results

### Backward Compatibility
- All existing functionality preserved as fallback mechanisms
- No breaking changes to existing API
- Status locking mechanism maintained
- Existing logging patterns preserved

### Error Handling
- Comprehensive try/catch blocks in new functions
- Graceful fallback to existing methods on error
- Detailed error logging for debugging
- No interruption of existing functionality on failure

### Performance Improvements
- Direct element selection faster than full text scanning
- Reduced false positives from precise targeting
- Early return optimization when match found
- Minimal performance impact on pages without QA rejects