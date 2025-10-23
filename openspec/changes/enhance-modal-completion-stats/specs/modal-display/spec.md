# Modal Display Specification

## MODIFIED Requirements

### Requirement: Enhanced page completion details display
The modal display MUST show enhanced page completion details including reject reasons and elapsed times for each page.

#### Scenario: Displaying page completion with reject reason
Given a page with QA rejection
When the modal is displayed
Then the page completion details MUST include:
- Page identifier
- Completion count
- Topic count
- Elapsed time
- Reject reason (if applicable)
- Last completion timestamp

#### Scenario: Displaying page completion without reject reason
Given a page without QA rejection
When the modal is displayed
Then the page completion details MUST include:
- Page identifier
- Completion count
- Topic count
- Elapsed time
- "无驳回" or similar indicator for reject reason
- Last completion timestamp

### Requirement: Enhanced visual formatting
The modal display MUST use enhanced visual formatting for better readability of page completion details.

#### Scenario: Displaying multiple page completions
Given multiple page completions with varying data
When the modal is displayed
Then each page completion MUST be displayed in a clear, hierarchical format
And different information types MUST be color-coded appropriately
And long text fields MUST be properly truncated

## ADDED Requirements

### Requirement: Reject reason display
The modal display MUST show reject reasons for pages that have been QA-rejected.

#### Scenario: Page with recent QA rejection
Given a page with a recent QA rejection recorded
When the modal is displayed
Then the reject reason MUST be displayed alongside the page completion details
And the reject reason MUST be properly escaped to prevent XSS
And the display MUST handle long reject reason texts appropriately

#### Scenario: Page without QA rejection
Given a page without any QA rejection
When the modal is displayed
Then the reject reason field MUST show "无驳回" or similar appropriate text
And the display MUST not show error or missing data indicators

### Requirement: Elapsed time display
The modal display MUST show elapsed time for each page completion.

#### Scenario: Page with completion time tracking
Given a page with elapsed time data
When the modal is displayed
Then the elapsed time MUST be displayed in seconds format
And the display MUST handle maximum time limits appropriately
And the time display MUST be clearly labeled

### Requirement: Error handling for missing data
The modal display MUST handle missing or undefined data gracefully.

#### Scenario: Missing reject reason data
Given a page completion record without reject reason data
When the modal is displayed
Then the display MUST show a default value instead of error
And the rest of the page completion information MUST still be displayed correctly

#### Scenario: Missing elapsed time data
Given a page completion record without elapsed time data
When the modal is displayed
Then the display MUST show "N/A" or "0" for elapsed time
And the rest of the page completion information MUST still be displayed correctly