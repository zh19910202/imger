# Question Classification Specification

## MODIFIED Requirements

#### Scenario: Question with current QA rejection message
Given a question page that displays "被 QA1 Rejected 请修订"
When the system determines the question status
Then the question should be classified as "旧" (rework)
And the status should be displayed in orange color

#### Scenario: Question without QA rejection message
Given a question page that does not display "被 QA1 Rejected 请修订" or any similar QA rejection message
When the system determines the question status
Then the question should be classified as "新" (new)
And the status should be displayed in blue color

## ADDED Requirements

#### Scenario: Question with rejection from different QA names
Given a question page that displays "被 QA2 Rejected 请修订" (different QA name)
When the system determines the question status
Then the question should be classified as "旧" (rework)
And the status should be displayed in orange color