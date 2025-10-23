# Completion Tracking Specification

## MODIFIED Requirements

### Requirement: Enhanced completion statistics data structure
The completion statistics data structure MUST include detailed information for each annotation page including topic ID, topic count, elapsed time, and validity status.

#### Scenario: Recording a valid completion with detailed information
Given an annotation page with topic ID "topic_123" and 5 topics
When a valid completion is recorded
Then the completion statistics MUST include:
- topicId: "topic_123"
- topicCount: 5
- elapsedSeconds: <calculated_time>
- isValid: true
- firstCompletionTime: <timestamp>
- lastCompletionTime: <timestamp>

#### Scenario: Backward compatibility with existing data
Given existing completion statistics without detailed fields
When the enhanced system loads the data
Then it MUST handle the older format gracefully
And default values MUST be used for missing fields

### Requirement: Per-page elapsed time tracking
The system MUST track elapsed time per annotation page from start to completion.

#### Scenario: Tracking time for a completed page
Given an annotation page that was started at timestamp 1000
And completed at timestamp 1500
When the completion is recorded
Then elapsedSeconds MUST be 500

#### Scenario: Multiple completions on the same page
Given an annotation page with multiple completions
When each completion is recorded
Then elapsedSeconds MUST reflect the time of each individual completion
And lastCompletionTime MUST be updated for each completion

### Requirement: Topic ID and validity tracking
The system MUST capture and store the topic ID and validity status for each completion.

#### Scenario: Recording completion with topic ID
Given an annotation page with topic ID "topic_456"
When a valid completion is recorded
Then the completion statistics MUST include topicId: "topic_456"
And isValid: true

#### Scenario: Handling unknown topic IDs
Given an annotation page with no detectable topic ID
When a valid completion is recorded
Then the completion statistics MUST handle the missing topic ID gracefully
And use an appropriate default value

## ADDED Requirements

### Requirement: First and last completion timestamps
The system MUST track first and last completion timestamps for each page.

#### Scenario: First completion on a page
Given a new annotation page
When the first completion is recorded
Then firstCompletionTime and lastCompletionTime MUST be set to the same value

#### Scenario: Subsequent completions on a page
Given an annotation page with existing completions
When a new completion is recorded
Then firstCompletionTime MUST remain unchanged
And lastCompletionTime MUST be updated to the current timestamp

### Requirement: Data migration for existing statistics
The system MUST handle migration of existing completion statistics to the enhanced format.

#### Scenario: Loading older completion statistics
Given completion statistics stored in the old format
When the system loads the data
Then it MUST convert the data to the enhanced format
And populate default values for new fields