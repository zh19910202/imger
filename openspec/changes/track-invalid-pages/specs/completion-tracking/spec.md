# Completion Tracking with Invalid Page Support

## MODIFIED Requirements

#### Requirement: Track invalid page completions separately
As a user, I want the system to track invalid page completions separately from valid ones so that I can understand the quality of my annotations.

##### Scenario: User completes a valid page
Given a user has completed a page marked as valid
When the system records the completion
Then the totalValidCompletions counter should be incremented
And the perPage entry should be updated with isValid = true

##### Scenario: User completes an invalid page
Given a user has completed a page marked as invalid
When the system records the completion
Then the totalInvalidCompletions counter should be incremented
And the perPage entry should be updated with isValid = false

##### Scenario: User views completion statistics
Given completion statistics have been recorded for both valid and invalid pages
When the user views the statistics panel
Then they should see separate counts for valid and invalid completions
And they should see the total question count across all pages

#### Requirement: Maintain backward compatibility
As a developer, I want the system to maintain backward compatibility with existing data so that users don't lose their completion history.

##### Scenario: Loading existing data without invalid tracking
Given existing completion data that doesn't have totalInvalidCompletions field
When the system loads the data
Then it should initialize totalInvalidCompletions to 0
And it should calculate the value from existing perPage data if possible

##### Scenario: Saving data with new structure
Given completion statistics with new fields
When the system saves the data
Then it should persist all fields including totalInvalidCompletions and totalQuestions