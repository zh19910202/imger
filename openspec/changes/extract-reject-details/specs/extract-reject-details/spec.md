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
When the red dot icon (uid=11_197) is present on the page
Then the system SHALL simulate a click event on the icon to fetch reject details

#### Scenario: Handle missing red dot icon
Given a task is identified as rejected
When the red dot icon is not present on the page
Then the system SHALL handle this gracefully without errors

## ADDED Requirements

### Requirement: Extract Latest Reject Record
The appen-data-collector.js file SHALL extract the latest reject record information after clicking the red dot icon.

#### Scenario: Extract reject details
Given the red dot icon has been clicked
When reject details are displayed on the page
Then the system SHALL extract the latest reject record including:
- Reject reason
- QA name
- Timestamp
- Status

#### Scenario: Parse reject record information
Given reject details are displayed
When the content contains multiple reject records
Then the system SHALL identify and extract information from the most recent record

### Requirement: Store Reject Details
The appen-data-collector.js file SHALL store extracted reject details for UI display.

#### Scenario: Store extracted information
Given reject details have been extracted
When the information is available
Then the system SHALL store it in a format accessible to the extension UI

#### Scenario: Handle extraction failures
Given an attempt to extract reject details has been made
When the extraction fails or returns no data
Then the system SHALL store appropriate fallback information