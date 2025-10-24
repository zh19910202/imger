# Add Rework Status to Page Completion Details - Design

## Overview
This design document outlines the approach for adding a "新旧题状态" field to the page completion details display to show whether each completed page is a new task or secondary rework.

## Current State Analysis
The current page completion details display shows:
- Page identifier
- Completion count
- Topic count
- Elapsed time
- Validity status
- Reject reason

There's no indication of whether a page is a new task or has been reworked multiple times.

## Requirements
1. Add "新旧题状态" field to each page completion detail entry
2. Display "新" for new tasks or first rework
3. Display "旧" for secondary rework tasks
4. Maintain existing display information and layout
5. Handle cases where status cannot be determined

## Implementation Approach
1. **UI Enhancement**: Add "新旧题状态" field to page completion details template
2. **Display Logic**: Use existing `isSecondaryRework` field from page data
3. **Formatting**: Ensure consistent styling with other fields

## Display Logic
For each page entry:
- If `data.isSecondaryRework` is true: Display "旧"
- If `data.hasRework` is true: Display "新"
- Otherwise: Display "新" (regular completion)

## Layout Considerations
The new field should be added to the existing page details without disrupting the current layout. It can be placed in the same line as other status information.

## Error Handling
- Handle cases where rework status fields are missing
- Gracefully handle pages without sufficient data to determine status
- Maintain display consistency for all page entries

## Performance Considerations
- Minimal impact on existing performance
- No additional data processing required
- Simple display logic