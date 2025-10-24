# Design for Enhancing Reject Details Logging

## Overview
This document outlines the approach for adding comprehensive logging to the reject details extraction workflow. The goal is to provide better visibility into the plugin's behavior when entering rework annotation pages, making it easier to understand the workflow status and debug any issues.

## Logging Strategy

### 1. Log Granularity
We will implement detailed logging at each significant step of the reject details extraction workflow:
- Page detection and identification
- Reject message detection
- Red dot icon click simulation
- Reject details extraction
- Data storage and UI integration

### 2. Log Content
Each log entry will include:
- Clear identification of the workflow step
- Relevant data and context information
- Status indicators (success/failure/progress)
- Timestamps for timing analysis
- Descriptive messages that explain what is happening

### 3. Log Levels
We will use appropriate log levels:
- DEBUG: Detailed information for diagnosing problems
- INFO: General information about workflow progress
- WARN: Warning conditions that might indicate issues
- ERROR: Error conditions that prevent normal operation

## Key Workflow Steps to Log

### 1. Page Detection and Identification
- When a page is loaded and identified as a potential annotation page
- When the page is confirmed as a rework page
- What specific indicators identify it as a rework page

### 2. Reject Message Detection
- When the reject message "你的标注任务被QA1 Rejected，请修订后重新提交" is detected
- Where the message was found (tooltip, page content, etc.)
- The exact content of the detected message

### 3. Red Dot Icon Click Simulation
- When the red dot icon (uid=13_197) is identified
- When the click simulation is initiated
- When the click simulation completes
- Any issues encountered during click simulation

### 4. Reject Details Extraction
- When the extraction process begins
- What source is being used for extraction (tooltip, page content, etc.)
- When reject details are successfully extracted
- The content of the extracted details
- Any failures in the extraction process

### 5. Integration with New/Old Status Detection
- How reject details affect the new/old status determination
- When a page is marked as "旧" (rework)
- When a page is marked as "新" (regular)
- The color assigned based on status

### 6. Data Storage and UI Display
- When reject details are stored
- The structure of the stored data
- How the data will be used for UI display
- Any issues with data storage

## Log Format

### 1. Consistent Prefixing
All logs will use a consistent prefix to identify them as part of the Appen Data Collector:
```
[Appen Data Collector] <log message>
```

### 2. Structured Information
Logs will include structured information in a consistent format:
```
[Appen Data Collector] <workflow step> - <status> - <details>
```

### 3. Key Data Points
Logs will include key data points relevant to each step:
- Page identification information
- Timestamps
- Data source information
- Status indicators
- Error details when applicable

## Implementation Approach

### 1. Non-Intrusive Logging
- Logging will not affect the normal operation of the plugin
- Log statements will be placed at appropriate points without changing workflow logic
- Logging will not introduce performance overhead

### 2. Contextual Information
- Each log will include sufficient context to understand what is happening
- Related logs will be clearly connected
- Logs will include identifiers to track related events

### 3. Error Handling
- Logging will include error information when issues occur
- Error logs will provide enough detail for debugging
- Error conditions will be clearly identified

## Integration with Existing Logging

### 1. Consistency
- New logs will follow the same format as existing logs
- Log levels will be consistent with existing usage
- Prefixes and identifiers will match existing patterns

### 2. Enhancement
- Existing log points will be reviewed to ensure they provide adequate information
- Additional context may be added to existing logs where beneficial
- Log levels may be adjusted for better visibility

## Testing and Validation

### 1. Log Visibility
- Verify that logs appear in the console when expected
- Confirm that logs provide the needed visibility into workflow status
- Check that logs are clear and understandable

### 2. Performance Impact
- Ensure that logging does not significantly impact plugin performance
- Verify that logs do not cause memory issues
- Confirm that logging does not interfere with normal operation

### 3. Completeness
- Verify that all key workflow steps are properly logged
- Confirm that logs include sufficient detail for debugging
- Check that error conditions are properly logged