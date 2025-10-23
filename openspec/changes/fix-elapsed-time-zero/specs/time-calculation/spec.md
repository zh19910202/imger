# Time Calculation Specification

## MODIFIED Requirements

### Requirement: Consistent elapsed time calculation
Both recordValidCompletion and recordCompletionOnConfirm functions MUST calculate and store elapsed time using the same method.

#### Scenario: Recording page completion with elapsed time calculation
Given a page completion event
When either recordValidCompletion or recordCompletionOnConfirm is called
Then the function MUST calculate elapsed time as: Math.floor((currentTime - collectedData.startTime) / 1000)
And the calculated elapsed time MUST be stored in completionStats.perPage[pageKey].elapsedSeconds

#### Scenario: Creating new page entry with elapsed time
Given a new page that has not been recorded before
When either function creates a new page entry
Then the new entry MUST include elapsedSeconds field with calculated value
And the entry MUST include all other required fields

### Requirement: Consistent data structure initialization
Both functions MUST initialize page entries with the same data structure.

#### Scenario: Initializing new page entry
Given a new page entry needs to be created
When either function initializes the entry
Then both functions MUST create entries with the same fields:
- completions: 0
- topicId: collectedData.topicId || 'unknown_topic'
- topicCount: topicCount
- elapsedSeconds: calculated elapsed time
- isValid: true
- firstCompletionTime: currentTime
- lastCompletionTime: currentTime

## ADDED Requirements

### Requirement: Elapsed time accuracy
The elapsed time calculation MUST accurately reflect the time between page start and completion.

#### Scenario: Accurate elapsed time calculation
Given a page that was started at timestamp T1 and completed at timestamp T2
When the elapsed time is calculated
Then the result MUST be Math.floor((T2 - T1) / 1000) seconds
And the result MUST match the actual time difference

### Requirement: Backward compatibility for existing entries
The fix MUST maintain backward compatibility with existing page entries that may not have elapsedSeconds.

#### Scenario: Existing entry without elapsedSeconds
Given an existing page entry without elapsedSeconds field
When the entry is accessed for display
Then the system MUST handle the missing field gracefully
And the display MUST show appropriate fallback value (0)