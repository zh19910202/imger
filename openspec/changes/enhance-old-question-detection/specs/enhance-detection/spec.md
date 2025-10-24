# Enhance Old Question Detection Specification

## MODIFIED Requirements

### Requirement: Enhance Old Question Detection Algorithm
The appen-data-collector.js file SHALL enhance the old question detection algorithm to include valid status and edit count criteria.

#### Scenario: Detect old question with valid status and edit count
Given a task page is loaded
When the page has a valid status and edit count >= 1
Then the system SHALL identify the question as old

#### Scenario: Detect new question without valid status or edit count
Given a task page is loaded
When the page does not have a valid status or edit count < 1
Then the system SHALL identify the question as new

### Requirement: Maintain Existing QA Reject Detection
The appen-data-collector.js file SHALL continue to detect QA rejects as old questions.

#### Scenario: Detect old question with QA reject
Given a task page is loaded
When the page contains a QA reject message
Then the system SHALL identify the question as old (highest priority)

#### Scenario: Combine detection methods
Given a task page is loaded
When multiple old question indicators are present
Then the system SHALL prioritize QA rejects over valid status/edit count

## ADDED Requirements

### Requirement: Detect Valid Status
The appen-data-collector.js file SHALL detect the valid status of a question.

#### Scenario: Identify valid status
Given a task page is loaded
When the page shows "有效" as the selected status
Then the system SHALL recognize this as a valid status indicator

#### Scenario: Handle missing valid status
Given a task page is loaded
When no valid status is found or determined
Then the system SHALL continue with other detection methods

### Requirement: Detect Edit Count
The appen-data-collector.js file SHALL detect the edit count of a question.

#### Scenario: Identify edit count >= 1
Given a task page is loaded
When the page shows an edit count >= 1
Then the system SHALL recognize this as an edited question indicator

#### Scenario: Handle edit count < 1
Given a task page is loaded
When the page shows an edit count < 1
Then the system SHALL not use this as an old question indicator

### Requirement: Handle Multiple Edit Round Values
The appen-data-collector.js file SHALL correctly handle different edit round values.

#### Scenario: Handle 1 edit round
Given a task page is loaded
When the page shows "1轮" as the selected edit count
Then the system SHALL recognize this as an edited question indicator

#### Scenario: Handle 2 or 3 edit rounds
Given a task page is loaded
When the page shows "2轮" or "3轮" as the selected edit count
Then the system SHALL recognize this as an edited question indicator

### Requirement: Combine Detection Criteria
The appen-data-collector.js file SHALL combine multiple detection criteria for old question identification.

#### Scenario: Old question with multiple indicators
Given a task page is loaded
When the page has QA reject OR (valid status AND edit count >= 1)
Then the system SHALL mark the question as old

#### Scenario: New question with no indicators
Given a task page is loaded
When the page has no QA reject AND NOT (valid status AND edit count >= 1)
Then the system SHALL mark the question as new

## IMPLEMENTATION Details

### Valid Status Detection Implementation
The `hasValidStatus` function SHALL:
1. Search for labels containing "是否有效"
2. Look for checked radio buttons with value "有效"
3. Use multiple search strategies for robustness:
   - Direct search for checked radio buttons
   - Search near the "是否有效" label
   - Global search across all radio buttons
4. Include comprehensive error handling that returns false on errors

### Edit Count Detection Implementation
The `getEditRoundCount` function SHALL:
1. Search for labels containing "判断编辑轮数"
2. Look for checked radio buttons with text indicating round count
3. Extract numeric values using regex patterns matching (\d+)轮
4. Support multiple edit round values (1轮, 2轮, 3轮)
5. Return default value of 1 when no explicit selection is found
6. Include comprehensive error handling that returns 0 on errors

### Combined Algorithm Implementation
The `getPageNewOldStatus` function SHALL:
1. First check for QA rejects with highest priority
2. If no QA reject, check for valid status AND edit count >= 1
3. Return "旧" if either condition is met
4. Return "新" if neither condition is met
5. Include detailed logging for debugging purposes