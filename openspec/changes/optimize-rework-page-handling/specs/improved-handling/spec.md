# Optimize Rework Page Handling Specification

## MODIFIED Requirements

### Requirement: Optimize Page Handling Workflow
The appen-data-collector.js file SHALL implement a prioritized page handling workflow.

#### Scenario: Handle annotation page with prioritized workflow
Given an annotation page is loaded
When the page handling process begins
Then the system SHALL first determine rework status, then collect appropriate information based on that status

#### Scenario: Maintain existing page detection
Given an annotation page is loaded
When the page handling process runs
Then the system SHALL continue to correctly identify target pages using existing URL patterns

### Requirement: Prioritize Rework Information Collection
The appen-data-collector.js file SHALL prioritize reject reason collection for rework pages.

#### Scenario: Process rework page with priority handling
Given an annotation page is identified as a rework page
When the page handling process runs
Then the system SHALL collect reject reasons before other information

#### Scenario: Process regular page with standard handling
Given an annotation page is identified as a regular page
When the page handling process runs
Then the system SHALL follow standard information collection without prioritizing reject reasons

## ADDED Requirements

### Requirement: Implement Main Page Handler Function
The appen-data-collector.js file SHALL implement a main page handler function to coordinate processing.

#### Scenario: Coordinate page processing through main handler
Given an annotation page is loaded
When the page handling process begins
Then the system SHALL use handleAnnotationPage() to coordinate all processing steps

#### Scenario: Prevent duplicate page processing
Given an annotation page has already been processed
When the page handling process is triggered again for the same page
Then the system SHALL skip processing to prevent duplicate work

### Requirement: Implement Rework-Specific Collection Function
The appen-data-collector.js file SHALL implement a dedicated function for reject reason collection.

#### Scenario: Collect reject reasons for rework pages
Given an annotation page is identified as a rework page
When reject reason collection is needed
Then the system SHALL use collectRejectReason() to efficiently extract reject information

#### Scenario: Handle missing reject reasons gracefully
Given an annotation page is identified as a rework page
When reject reason collection fails or finds no reasons
Then the system SHALL continue processing and log the issue appropriately

### Requirement: Implement Basic Information Collection Function
The appen-data-collector.js file SHALL implement a dedicated function for basic information collection.

#### Scenario: Collect basic information for all pages
Given an annotation page is loaded
When basic information collection is needed
Then the system SHALL use collectBasicInfo() to gather standard page information

#### Scenario: Maintain compatibility with existing data structures
Given an annotation page is loaded
When basic information is collected
Then the system SHALL store data in formats compatible with existing usage

### Requirement: Implement State Management
The appen-data-collector.js file SHALL implement state management to track processing status.

#### Scenario: Track page processing state
Given an annotation page is loaded
When processing begins
Then the system SHALL maintain state information about what has been processed

#### Scenario: Prevent redundant processing
Given an annotation page has been processed
When processing is requested again
Then the system SHALL check state and skip redundant operations

## IMPLEMENTATION Details

### Main Page Handler Implementation
The handleAnnotationPage() function SHALL:
1. Determine if current page is a rework page using isCurrentPageRejected()
2. If rework page: Call collectRejectReason() first
3. For all pages: Call collectBasicInfo()
4. Manage processing state to prevent duplicate work
5. Include comprehensive error handling and logging

### Reject Reason Collection Implementation
The collectRejectReason() function SHALL:
1. Focus specifically on extracting reject reasons from available sources
2. Use simplified DOM extraction logic prioritizing reliability
3. Store results in a clear, accessible format
4. Include error handling that allows continuation of other processing
5. Provide detailed logging for debugging purposes

### Basic Information Collection Implementation
The collectBasicInfo() function SHALL:
1. Collect standard page information (user ID, task ID, topic ID, etc.)
2. Gather validity status and edit round data
3. Maintain compatibility with existing data structures
4. Optimize common data collection operations
5. Include error handling and logging

### State Management Implementation
The page state management SHALL:
1. Track whether current page is a rework page
2. Track whether reject reasons have been collected (for rework pages)
3. Track whether basic information has been collected
4. Track the last processed URL to prevent duplicate processing
5. Provide functions to check and update state appropriately

## IMPLEMENTATION Workflow

### Processing Sequence
1. URL Change Detection:
   - Triggered by onUrlChange()
   - Verifies target page using isTargetPage()
   - Calls handleAnnotationPage() for processing

2. Rework Status Determination:
   - Uses isCurrentPageRejected() to check rework status
   - Updates page state with rework status
   - Makes processing decisions based on status

3. Rework-Specific Processing:
   - For rework pages: Call collectRejectReason()
   - Focus on efficient reject reason extraction
   - Store results for later use

4. General Information Collection:
   - For all pages: Call collectBasicInfo()
   - Collect standard page information
   - Maintain compatibility with existing systems

5. State Management:
   - Update processing state to prevent rework
   - Log completion of processing steps
   - Prepare for next page load

### Error Handling
- Centralized error handling in handleAnnotationPage()
- Graceful degradation for individual collection failures
- Detailed logging for debugging and monitoring
- Continuation of processing where possible after errors

## IMPLEMENTATION Results

### New Functions Implemented
1. `handleAnnotationPage()` - Main coordination function:
   - Determines page type using isCurrentPageRejected()
   - Coordinates specialized processing functions
   - Manages state to prevent duplicate processing
   - Includes comprehensive error handling

2. `collectRejectReason()` - Rework-specific collection:
   - Uses extractLatestQARejectFromDOM() for reliable extraction
   - Stores results in collectedData.qualityCheckInfo
   - Provides detailed logging for debugging
   - Handles errors gracefully without stopping processing

3. `collectBasicInfo()` - General information collection:
   - Calls detectUserSelectionStatus() for user state
   - Calls collectTopicInfo() for topic information
   - Maintains compatibility with existing data structures
   - Includes error handling and logging

4. `pageState` - State management object:
   - Tracks isRejected status
   - Tracks rejectReasonCollected status
   - Tracks basicInfoCollected status
   - Tracks lastProcessedUrl to prevent duplicates

### Integration Implementation
1. Modified `onUrlChange()` integration:
   - Calls handleAnnotationPage() after response element extraction
   - Maintains existing timing with setTimeout delays
   - Handles both cases (with and without existing response elements)

2. Data Structure Extensions:
   - Extended collectedData with qualityCheckInfo field
   - Maintained all existing data structure compatibility
   - Added new fields for reject reason information

### Priority Implementation
1. **Rework Status First**:
   - isCurrentPageRejected() called at start of processing
   - Results immediately influence processing path
   - State tracking prevents redundant status checks

2. **Reject Reason Priority**:
   - Only collected for confirmed rework pages
   - Collected before general information for rework pages
   - Uses most reliable extraction method (DOM-based)

3. **General Information Always**:
   - Collected for all pages after rework-specific processing
   - Maintains existing collection logic where appropriate
   - Integrates with existing user selection detection

### Performance Improvements
1. **Reduced Redundancy**:
   - Page state tracking prevents duplicate processing
   - URL comparison avoids rework when not needed
   - State flags prevent redundant collection

2. **Optimized Extraction**:
   - Direct DOM extraction faster than complex fallbacks
   - Focused functions reduce unnecessary processing
   - Early returns when conditions are met

3. **Improved Maintainability**:
   - Clear separation of concerns in function design
   - Centralized coordination in handleAnnotationPage()
   - Consistent error handling patterns

### Backward Compatibility
1. **Preserved Existing Functionality**:
   - All existing data collection continues to work
   - isCurrentPageRejected() logic unchanged
   - Response element extraction unchanged

2. **Extended Data Structures**:
   - New fields added without breaking existing usage
   - Existing functions continue to populate existing fields
   - New information available without affecting existing code

3. **Maintained Timing**:
   - Existing setTimeout delays preserved
   - Integration timing maintained with existing workflows
   - No breaking changes to processing order

### Implementation Verification
1. **Syntax Validation**:
   - All new code passes JavaScript syntax checking
   - No parsing errors in implemented functions
   - Compatible with existing codebase structure

2. **Functionality Testing**:
   - Unit testing confirms new functions work correctly
   - Integration testing shows proper coordination
   - State management prevents duplicate processing

3. **Error Handling**:
   - Try-catch blocks protect against runtime errors
   - Graceful degradation allows continued processing
   - Detailed logging enables debugging when needed