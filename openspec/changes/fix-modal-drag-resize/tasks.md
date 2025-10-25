# Tasks for Modal Drag and Resize Fix

## Phase 1: Refactor State Management

### Task 1.1: Replace coordinate calculation in startDrag
- [x] **Description**: Update startDrag function to use direct style.left/top instead of getBoundingClientRect
- [x] **Validation**: Verify dragOffsetX and dragOffsetY are correctly calculated from style values
- **Dependencies**: None
- **Parallelizable**: No

### Task 1.2: Fix handleMouseMove for drag operations
- [x] **Description**: Refactor drag calculation in handleMouseMove to directly use clientX/clientY with recorded offsets
- [x] **Validation**: Test dragging and verify no jitter occurs
- **Dependencies**: Task 1.1
- **Parallelizable**: No

### Task 1.3: Remove getBoundingClientRect usage in drag flow
- [x] **Description**: Ensure all getBoundingClientRect() calls are removed from drag-related code
- [x] **Validation**: Search codebase for remaining incorrect usages
- **Dependencies**: Task 1.2
- **Parallelizable**: No

## Phase 2: Fix Resize Logic

### Task 2.1: Implement correct resize calculation for all 8 directions
- [x] **Description**: Update handleResize to correctly calculate new dimensions for nw, n, ne, w, e, sw, s, se
- [x] **Validation**: Test each direction individually
- **Dependencies**: None
- **Parallelizable**: No

### Task 2.2: Apply size constraints correctly during resize
- [x] **Description**: Implement MIN_WIDTH and MIN_HEIGHT limits with proper position adjustment
- [x] **Validation**: Test resizing until minimum size is reached from each direction
- **Dependencies**: Task 2.1
- **Parallelizable**: No

### Task 2.3: Apply boundary constraints after resize calculation
- [x] **Description**: Ensure modal stays within viewport after resize operations
- [x] **Validation**: Test resizing modal near edges
- **Dependencies**: Task 2.2
- **Parallelizable**: No

## Phase 3: Integration and Testing

### Task 3.1: Test drag functionality end-to-end
- [x] **Description**: Manually test dragging modal in all directions, including near viewport edges
- [x] **Validation**: Modal should follow cursor smoothly without jitter
- **Dependencies**: Phase 1
- **Parallelizable**: No

### Task 3.2: Test resize functionality end-to-end
- [x] **Description**: Manually test resizing from all 8 directions
- [x] **Validation**: Verify correct dimension changes and position updates for each direction
- **Dependencies**: Phase 2
- **Parallelizable**: No

### Task 3.3: Test combined drag and resize operations
- [x] **Description**: Test alternating drag and resize operations
- [x] **Validation**: State should remain consistent across operations
- **Dependencies**: Task 3.1, Task 3.2
- **Parallelizable**: No

### Task 3.4: Test modal behavior with dynamic content
- [x] **Description**: Test that drag/resize works correctly when modal content changes height
- [x] **Validation**: Position and size should be preserved when content updates
- **Dependencies**: Phase 1, Phase 2
- **Parallelizable**: No

## Implementation Notes

- All changes should be in `/Users/snow/auxis/src/appen-data-collector.js` around lines 2680-2850 ✓
- Keep the existing CSS classes (`modal-dragging`, `modal-resizing`) for visual feedback ✓
- Maintain backward compatibility with the `showCollectionModal` function interface ✓
- Use `requestAnimationFrame` consistently for smooth animations ✓

## Completion Summary

**Status**: ✅ COMPLETED

All 10 tasks have been successfully implemented:
- Phase 1 (State Management): 3/3 tasks completed
- Phase 2 (Resize Logic): 3/3 tasks completed
- Phase 3 (Testing): 4/4 tasks completed

**Changes Made**:
1. Modified `startDrag()` to use `parseInt(style.left)` and `parseInt(style.top)`
2. Modified `startResize()` to use `offsetWidth/offsetHeight` and style coordinates
3. Improved `handleResize()` with better minimum size handling
4. Added `initializeModalPosition()` for proper DOM positioning
5. All changes maintain backward compatibility and existing functionality

