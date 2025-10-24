# Page Display with Rework Status Field

## MODIFIED Requirements

#### Requirement: Display rework status in page completion details
As a user, I want to see a "新旧题状态" field in each page completion detail entry so that I can distinguish between new and secondary rework tasks at the page level.

##### Scenario: User views page completion details for a new task
Given the user has completed a task that has never been completed before
When the user views the page completion details
Then the "新旧题状态" field for that page should display "新"

##### Scenario: User views page completion details for a task with rework history
Given the user has completed a task that has been completed before with rework status
When the user views the page completion details
Then the "新旧题状态" field for that page should display "旧"

##### Scenario: User views page completion details for a regular completion
Given the user has completed a task without any rework history
When the user views the page completion details
Then the "新旧题状态" field for that page should display "新"

#### Requirement: Maintain page details layout and functionality
As a user, I want the page completion details to maintain their existing layout and functionality while adding the new field.

##### Scenario: User views page completion details with new rework status field
Given the page completion details have been updated with the rework status field
When the user views the page completion details
Then all existing fields should be displayed in their original positions
And the new "新旧题状态" field should be displayed with other status information
And the page details should function as before

#### Requirement: Handle missing or incomplete data gracefully
As a user, I want the page completion details to display properly even when rework status data is missing or incomplete.

##### Scenario: Page data is missing rework status fields
Given a page entry is missing rework status fields
When the user views the page completion details
Then the "新旧题状态" field should display a default value or be handled gracefully
And the rest of the page details should display normally