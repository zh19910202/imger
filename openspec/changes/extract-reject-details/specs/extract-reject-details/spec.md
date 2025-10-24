# Extract Reject Details Specification

## MODIFIED Requirements

### Requirement: Detect QA Reject Messages
The appen-data-collector.js file SHALL detect QA reject messages to trigger automatic reject details extraction.

#### Scenario: Identify reject message
Given a task page is loaded
When the page contains the text "你的标注任务被QA1 Rejected，请修订后重新提交"
Then the system SHALL identify this as a rework task and prepare to extract reject details

#### Scenario: Handle non-reject pages
Given a task page is loaded
When the page does not contain the reject text
Then the system SHALL not attempt to extract reject details

### Requirement: Simulate Click on Red Dot Icon
The appen-data-collector.js file SHALL simulate a click on the red dot icon when a reject message is detected.

#### Scenario: Click red dot icon
Given a task is identified as rejected
When the red dot icon (uid=13_197) is present on the page
Then the system SHALL simulate a click event on the icon to fetch reject details

#### Scenario: Handle missing red dot icon
Given a task is identified as rejected
When the red dot icon is not present on the page
Then the system SHALL handle this gracefully without errors

### Requirement: Extract Reject Details from Page
The appen-data-collector.js file SHALL extract reject details from the page after clicking the red dot icon.

#### Scenario: Extract reject details from tooltip
Given the red dot icon has been clicked
When a tooltip with reject details is displayed
Then the system SHALL extract the reject message "你的标注任务被QA1 Rejected，请修订后重新提交" and store it

#### Scenario: Extract reject details from page content
Given a reject message is present on the page
When the tooltip extraction fails
Then the system SHALL extract the reject details directly from page content

## ADDED Requirements

### Requirement: Store Reject Details
The appen-data-collector.js file SHALL store extracted reject details in the response elements.

#### Scenario: Store extracted reject details
Given reject details have been successfully extracted
When the details are available
Then the system SHALL store them in responseElements.qualityCheckRecord with the following structure:
- hasRecord: boolean indicating if a record exists
- dataSource: string indicating the source of data ("TOOLTIP", "PAGE_CONTENT", etc.)
- timestamp: ISO string of when the record was extracted
- latestRecord: object containing type, action, comment, operator, and operateTime

#### Scenario: Store extraction failure
Given an attempt to extract reject details has been made
When the extraction fails
Then the system SHALL store a null value or appropriate error object in responseElements.qualityCheckRecord

### Requirement: Integrate with Existing New/Old Status Detection
The appen-data-collector.js file SHALL integrate the reject details extraction with existing new/old status detection.

#### Scenario: Identify rework tasks
Given a page contains reject details
When the new/old status is being determined
Then the system SHALL mark the task as "旧" (old/rework) and display it with orange color (#FF9800)

#### Scenario: Identify regular tasks
Given a page does not contain reject details
When the new/old status is being determined
Then the system SHALL mark the task as "新" (new/regular) and display it with blue color (#2196F3)