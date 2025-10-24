# Completion Display with Correct Reject Reasons

## MODIFIED Requirements

#### Requirement: Display page-specific reject reasons
As a user, I want each page completion detail to display its own specific reject reason so that I can accurately see which pages were rejected and why.

##### Scenario: User completes multiple pages with different reject reasons
Given the user has completed multiple pages with different reject reasons
When the user views the completion details
Then each page should display its own specific reject reason
And pages without reject reasons should show "无驳回"

##### Scenario: User completes a page with a reject reason
Given the user has completed a page that was rejected with reason "图片不清晰"
When the user views the completion details for that page
Then the page should display "图片不清晰" as the reject reason

##### Scenario: User completes a page without a reject reason
Given the user has completed a page that was not rejected
When the user views the completion details for that page
Then the page should display "无驳回" as the reject reason

#### Requirement: Maintain backward compatibility
As a developer, I want the system to maintain backward compatibility with existing data so that users don't lose their completion history.

##### Scenario: Loading existing data without reject reasons
Given existing completion data that doesn't have reject reasons stored per page
When the system loads the data
Then it should initialize reject reasons to empty string or null
And it should handle displaying these pages correctly

##### Scenario: Saving data with reject reasons
Given completion statistics with page-specific reject reasons
When the system saves the data
Then it should persist all reject reasons along with other page data