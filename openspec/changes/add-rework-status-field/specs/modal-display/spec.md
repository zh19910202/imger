# Modal Display with Rework Status Field

## MODIFIED Requirements

#### Requirement: Display rework status in Appen data modal
As a user, I want to see a "新旧题状态" field above the "驳回理由" field in the Appen data collection modal so that I can distinguish between new and secondary rework tasks.

##### Scenario: User opens modal for a new task
Given the user has opened the modal for a task that has never been completed before
When the user views the modal
Then the "新旧题状态" field should display "新"

##### Scenario: User opens modal for a task with rework history
Given the user has opened the modal for a task that has been completed before with rework status
When the user views the modal
Then the "新旧题状态" field should display "旧"

##### Scenario: User opens modal for a task without sufficient history
Given the user has opened the modal for a task with incomplete history data
When the user views the modal
Then the "新旧题状态" field should display "未知" or be omitted

#### Requirement: Maintain modal layout and functionality
As a user, I want the modal to maintain its existing layout and functionality while adding the new field.

##### Scenario: User views modal with new rework status field
Given the modal has been updated with the rework status field
When the user views the modal
Then all existing fields should be displayed in their original positions
And the new "新旧题状态" field should be displayed above the "驳回理由" field
And the modal should function as before

#### Requirement: Maintain backward compatibility
As a developer, I want the system to maintain backward compatibility with existing data so that users don't lose their completion history.

##### Scenario: Loading existing data without rework status
Given existing completion data that doesn't have rework status information
When the system loads the data
Then it should initialize rework status fields appropriately
And it should handle displaying these pages correctly