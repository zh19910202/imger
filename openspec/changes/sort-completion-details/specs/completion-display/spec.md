# Completion Display Sorting

## MODIFIED Requirements

#### Requirement: Sort page completion details by time
As a user, I want the page completion details to be sorted by completion time with the most recent completion displayed first so that I can quickly see my latest work.

##### Scenario: User views completion details with multiple entries
Given the user has completed multiple pages at different times
When the user views the completion details
Then the entries should be displayed in descending time order (newest first)

##### Scenario: User views completion details with some missing timestamps
Given the user has completion entries where some have valid timestamps and others don't
When the user views the completion details
Then entries with valid timestamps should be sorted by time (newest first)
And entries without valid timestamps should be displayed after the timestamped entries

##### Scenario: User views completion details with no timestamps
Given the user has completion entries with no timestamp data
When the user views the completion details
Then the entries should be displayed in a consistent order (preferably alphabetical by page key)

#### Requirement: Maintain display limits
As a user, I want to see only the most recent completion details so that the display is not cluttered.

##### Scenario: User has many completion entries
Given the user has more than 5 completion entries
When the user views the completion details
Then only the 5 most recent entries should be displayed