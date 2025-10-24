# Design for Extracting Reject Details

## Overview
This document outlines the approach for automatically extracting and displaying the latest QA reject details when a task is identified as a rework item. The goal is to improve user efficiency by automatically providing the most relevant feedback without requiring manual interaction.

## Identification Strategy

### 1. QA Reject Detection Enhancement
We will enhance the existing QA reject detection to specifically identify the message "你的标注任务被QA1 Rejected，请修订后重新提交" and trigger the automatic extraction process.

### 2. Red Dot Icon Identification
The red dot icon has been identified as having uid=11_197 in the page structure. We will use this identifier to simulate a click event.

### 3. Reject Record Extraction
After clicking the red dot icon, we will extract the latest reject record from the displayed content, focusing on:
- The most recent reject reason
- The QA who rejected the task
- The timestamp of the rejection
- Any additional comments or feedback

## Implementation Strategy

### 1. Click Simulation
We will implement a safe click simulation mechanism that:
- Only triggers when a reject message is detected
- Uses the existing page element identification system
- Does not interfere with normal user interactions
- Handles cases where the element might not be immediately available

### 2. Content Extraction
We will implement a robust content extraction mechanism that:
- Parses the displayed reject records
- Identifies the most recent record
- Extracts relevant information in a structured format
- Handles variations in the displayed content format

### 3. Data Storage
The extracted reject details will be stored in a way that:
- Integrates with the existing data structures
- Can be easily accessed by the UI components
- Persists for the duration of the task session
- Does not interfere with other extension functionality

## Timing and Safety

### 1. Execution Timing
- The click simulation will only occur after the page has fully loaded
- We will add appropriate delays to ensure elements are available
- The extraction will occur after the click simulation is complete

### 2. Error Handling
- If the red dot icon is not found, we will gracefully handle the situation
- If the content extraction fails, we will not break existing functionality
- All operations will be wrapped in try-catch blocks to prevent crashes

### 3. User Experience
- The automatic click will not interfere with user interactions
- The process will be fast and unobtrusive
- Users will still be able to manually interact with the reject details if needed

## Integration with Existing Functionality

### 1. Compatibility
- The new functionality will work alongside existing QA reject detection
- No existing APIs or data structures will be modified
- Backward compatibility will be maintained

### 2. Data Flow
- Reject details will be stored in a way that complements existing data
- The UI will be able to display both old and new information
- No existing display logic will be disrupted

## Risk Mitigation

### 1. Potential Issues
- The red dot icon UID might change in future page updates
- The content structure of reject records might change
- Click simulation might interfere with page functionality

### 2. Mitigation Strategies
- Use robust element identification that can handle minor changes
- Implement flexible content parsing that can adapt to structure changes
- Thoroughly test the click simulation to ensure it doesn't break the page
- Add comprehensive error handling to gracefully handle failures