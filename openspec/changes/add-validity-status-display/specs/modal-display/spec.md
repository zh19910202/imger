# Modal Display Specification

## MODIFIED Requirements

### Requirement: Enhanced page completion details with validity status
The modal display MUST show validity status for each page completion in addition to existing information.

#### Scenario: Displaying page completion with valid status
Given a page marked as valid (isValid: true)
When the modal is displayed
Then the page completion details MUST include:
- Page identifier
- Completion count
- Topic count
- Elapsed time
- Validity status: "✓ 有效" in green color
- Reject reason (if applicable)
- Last completion timestamp

#### Scenario: Displaying page completion with invalid status
Given a page marked as invalid (isValid: false)
When the modal is displayed
Then the page completion details MUST include:
- Page identifier
- Completion count
- Topic count
- Elapsed time
- Validity status: "✗ 无效" in red color
- Reject reason (if applicable)
- Last completion timestamp

### Requirement: Visual formatting for validity status
The modal display MUST use appropriate visual formatting for validity status information.

#### Scenario: Displaying multiple pages with different validity states
Given multiple page completions with different validity states
When the modal is displayed
Then valid pages MUST show "✓ 有效" in green color
And invalid pages MUST show "✗ 无效" in red color
And pages with unknown validity MUST show "未知状态" in gray color

## ADDED Requirements

### Requirement: Validity status display
The modal display MUST show validity status for each page completion.

#### Scenario: Page with explicit validity status
Given a page completion record with explicit validity status
When the modal is displayed
Then the validity status MUST be displayed alongside other page completion details
And the display MUST use appropriate color coding based on status

#### Scenario: Page without validity status data
Given a page completion record without validity status data
When the modal is displayed
Then the validity status field MUST show "未知状态" in gray color
And the display MUST not show error or missing data indicators

### Requirement: Error handling for missing validity data
The modal display MUST handle missing or undefined validity data gracefully.

#### Scenario: Missing validity status data
Given a page completion record without validity status data
When the modal is displayed
Then the display MUST show a default value instead of error
And the rest of the page completion information MUST still be displayed correctly

#### Scenario: Invalid validity status data
Given a page completion record with invalid validity status data
When the modal is displayed
Then the display MUST handle the invalid data gracefully
And show an appropriate default status