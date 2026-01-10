# Dependency Patterns

## Core Principle

**Minimize dependencies, maximize parallelism.**

Every `blockedBy` relationship = serial execution = slower completion.

## Dependency Types

### 1. Data Dependency
Task B needs output from Task A.

```
Task A: Create user table
Task B: Implement user queries (blockedBy: A)
```

### 2. File Conflict Prevention
Tasks modify same file.

```
Task A: Add auth middleware
Task B: Add logging middleware (same file)
→ One blocks other to prevent merge conflicts
```

### 3. Logical Ordering
Makes sense to do A before B.

```
Task A: Implement core feature
Task B: Add error handling (blockedBy: A)
```

## Parallel Patterns

### Fan-Out (Maximum Parallelism)
```
       ┌── Task B
Task A ├── Task C
       └── Task D

# All of B, C, D can run parallel after A
```

### Pipeline (Sequential)
```
Task A → Task B → Task C

# Only when each truly depends on previous
```

### Diamond (Converge)
```
       ┌── Task B ──┐
Task A ┤            ├── Task D
       └── Task C ──┘

# D waits for both B and C
```

### Parallel Tracks
```
Track 1: A1 → A2 → A3
Track 2: B1 → B2 → B3
Final:   Both tracks → Integration

# Completely independent tracks
```

## Dependency Rules

### MUST Add Dependency When:
- Task reads data that another task creates
- Tasks modify the same file
- Task tests code that another task implements
- Integration task combines outputs

### MUST NOT Add Dependency When:
- Tasks work on completely different files
- Tasks are conceptually related but not technically dependent
- "It makes sense to do A first" (not enough reason)

## Setting Dependencies

```python
# After creating tasks
TaskUpdate(taskId="3", addBlockedBy=["1", "2"])

# This means Task 3 waits for both 1 and 2
```

## Critical Path

The longest chain of dependencies = total minimum time.

```
A(1) → B(2) → D(1) = 4 units
A(1) → C(3) → D(1) = 5 units  ← Critical path

Optimizing C has more impact than B.
```

## Anti-Patterns

### Over-Serialization
```
❌ A → B → C → D → E (when B, C, D could parallel)
```

### Missing Dependencies
```
❌ A and B both create migrations (conflict!)
✅ A → B or B → A
```

### Circular Dependencies
```
❌ A blockedBy B, B blockedBy A
(TaskUpdate will reject this)
```
