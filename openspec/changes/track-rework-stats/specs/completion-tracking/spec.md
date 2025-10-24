# Completion Tracking with Rework Separation

## MODIFIED Requirements

#### Requirement: Separate rework completions from regular completions
As a user, I want rework pages (pages with rejection information) to be tracked separately from regular completions so that I can accurately measure my completion rates and identify pages requiring corrections.

##### Scenario: User completes a page without rejection information
Given a user has completed a page without rejection information
When the system records the completion
Then the completion should be counted in regular statistics (totalValidCompletions, totalTopicsCompleted)
And the completion should NOT be counted in rework statistics

##### Scenario: User completes a page with rejection information
Given a user has completed a page with rejection information (qualityCheckRecord.hasRecord = true and type = 'REJECTED')
When the system records the completion
Then the completion should be counted in rework statistics (totalReworkCompletions, totalReworkTopics)
And the completion should NOT be counted in regular statistics
And the topics from this page should NOT be included in totalQuestions

##### Scenario: User views completion statistics
Given completion statistics have been recorded for both regular and rework pages
When the user views the statistics panel
Then they should see separate counts for regular and rework completions
And they should see rework statistics displayed below "总有效完成次数"
And they should see that totalQuestions excludes rework pages

#### Requirement: Maintain backward compatibility
As a developer, I want the system to maintain backward compatibility with existing data so that users don't lose their completion history.

##### Scenario: Loading existing data without rework tracking
Given existing completion data that doesn't have rework tracking fields
When the system loads the data
Then it should initialize rework fields to 0
And it should calculate initial values from existing perPage data if possible

##### Scenario: Saving data with new structure
Given completion statistics with new rework fields
When the system saves the data
Then it should persist all fields including rework tracking fields