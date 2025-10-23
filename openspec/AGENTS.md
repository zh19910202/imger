# OpenSpec Workflow Documentation

## Overview
This document describes the OpenSpec workflow for the Auxis project. OpenSpec is a lightweight specification system for planning and tracking changes to the project.

## When to Use OpenSpec
AI assistants should always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

## File Structure
```
openspec/
├── AGENTS.md     # This file - workflow and agent instructions
├── project.md    # Project overview, tech stack, and conventions
├── TEMPLATE.md   # Template for change proposals
└── [feature].md  # Individual change proposals
```

## Change Proposal Lifecycle

### 1. Proposal Creation
- Create a new file in `openspec/` with a descriptive name
- Use the template from `TEMPLATE.md`
- Set status to "Proposed"

### 2. Review and Approval
- Team reviews the proposal
- Address feedback and iterate
- Set status to "Approved" when ready

### 3. Implementation
- Implement the change according to the proposal
- Update status to "Implemented" when complete

### 4. Archiving
- Once fully integrated and stable, update status to "Archived"

## Proposal Format
Each proposal should include:
1. Title
2. Status
3. Summary
4. Motivation
5. Technical Design
6. Implementation Plan
7. Testing Strategy
8. Security Considerations
9. Backward Compatibility
10. Alternatives Considered
11. References

## Working with AI Assistants
When working with AI assistants on this project:
1. For any significant changes, first create a proposal in the openspec directory
2. Reference existing proposals when implementing features
3. Keep proposals updated as implementation progresses
4. Follow project conventions documented in project.md

## Integration with Development Process
- All proposals should be reviewed before implementation begins
- Proposals should be linked in pull requests
- Significant changes without proposals should be flagged