# Task Decomposition Examples

## Example 1: OAuth Authentication Feature

**Goal**: "Add OAuth authentication with Google"

### Task Breakdown

```
Wave 1 (Parallel - no dependencies):
|- Task 1: Setup NextAuth.js [standard]
|  |- Install nextauth, create config, add env vars
|  |- Files:
|  |  - Create: src/auth.ts
|  |  - Modify: package.json
|  |  - Modify: .env.local
|  |- Criteria:
|     - V1: cat package.json | grep next-auth -> "next-auth", exit 0
|     - V2: test -f src/auth.ts && echo "exists" -> exists
|     - V3: grep GOOGLE_CLIENT_ID .env.local -> GOOGLE_CLIENT_ID=, exit 0
|
|- Task 2: Create user database schema [standard]
   |- Add User model with OAuth fields
   |- Files:
   |  - Modify: prisma/schema.prisma
   |  - Create: prisma/migrations/*/migration.sql
   |- Criteria:
      - V1: grep "model User" prisma/schema.prisma -> model User, exit 0
      - V2: test -f prisma/migrations/*/migration.sql && echo "exists" -> exists

Wave 2 (After Wave 1):
|- Task 3: Implement auth API routes [standard]
|  |- Depends on: [1]
|  |- /api/auth/[...nextauth]/route.ts
|  |- Files:
|  |  - Create: app/api/auth/[...nextauth]/route.ts
|  |  - Test: tests/auth/route.test.ts
|  |- Criteria:
|     - V1: test -f app/api/auth/[...nextauth]/route.ts && echo "exists" -> exists
|     - V2: curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/auth/providers -> 200, exit 0
|
|- Task 4: Add session provider [standard]
|  |- Depends on: [1]
|  |- Wrap app with SessionProvider in layout.tsx
|  |- Files:
|  |  - Modify: app/layout.tsx:5-10
|  |- Criteria:
|     - V1: grep "SessionProvider" app/layout.tsx -> SessionProvider, exit 0
|
|- Task 5: Create login UI [standard]
   |- Depends on: [1, 4]
   |- Login button, callback page
   |- Files:
   |  - Create: components/LoginButton.tsx
   |  - Create: app/auth/callback/page.tsx
   |  - Test: tests/auth/LoginButton.test.tsx
   |- Criteria:
      - V1: test -f components/LoginButton.tsx && echo "exists" -> exists
      - V2: test -f app/auth/callback/page.tsx && echo "exists" -> exists

Wave 3 (Verification):
|- Task 6: [VERIFY] Auth integration [complex]
   |- Depends on: [1, 2, 3, 4, 5]
   |- Criteria:
      - V1: curl -X POST localhost:3000/auth/login -d '{"provider":"google"}' -> HTTP 302, exit 0
      - V2: curl -s localhost:3000/api/auth/session | jq '.user' -> non-null JSON, exit 0
      - V3: bun test tests/auth/ -> PASS, exit 0
```

### Full Criterion Example (Task 3)

```
Criterion: Auth API endpoints respond correctly
  Command: curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/auth/providers
  Expected Output: 200
  Exit code: 0
```

### Script Commands

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

# Wave 1 - Independent
bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "1" \
  --subject "Setup NextAuth.js configuration" \
  --description "Install next-auth@5, create auth config with Google provider, add environment variables" \
  --complexity standard \
  --criteria "cat package.json | grep next-auth -> next-auth, exit 0|test -f src/auth.ts && echo exists -> exists|grep GOOGLE_CLIENT_ID .env.local -> GOOGLE_CLIENT_ID=, exit 0"

bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "2" \
  --subject "Create user database schema" \
  --description "Add User model to Prisma schema with OAuth fields (id, email, name, image, provider)" \
  --complexity standard \
  --criteria "grep 'model User' prisma/schema.prisma -> model User, exit 0|test -f prisma/migrations/*/migration.sql && echo exists -> exists"

# Wave 2 - Sequential
bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "3" \
  --subject "Implement auth API routes" \
  --description "Create /api/auth/[...nextauth]/route.ts with NextAuth handler" \
  --blocked-by "1" \
  --complexity standard \
  --criteria "test -f app/api/auth/[...nextauth]/route.ts && echo exists -> exists|curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/auth/providers -> 200, exit 0"

bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "4" \
  --subject "Add session provider to app" \
  --description "Wrap root layout with SessionProvider from next-auth/react" \
  --blocked-by "1" \
  --complexity standard \
  --criteria "grep SessionProvider app/layout.tsx -> SessionProvider, exit 0"

bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "5" \
  --subject "Create login UI components" \
  --description "Add login button, callback page, user menu with signOut" \
  --blocked-by "1,4" \
  --complexity standard \
  --criteria "test -f components/LoginButton.tsx && echo exists -> exists|test -f app/auth/callback/page.tsx && echo exists -> exists"

# Wave 3 - Verification
bun $SCRIPTS/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "verify" \
  --subject "[VERIFY] OAuth authentication integration" \
  --description "Verify complete OAuth flow: login, session persistence, user data storage, logout" \
  --blocked-by "1,2,3,4,5" \
  --complexity complex \
  --criteria "curl -X POST localhost:3000/auth/login -d '{\"provider\":\"google\"}' -> HTTP 302, exit 0|curl -s localhost:3000/api/auth/session | jq '.user' -> non-null JSON, exit 0|bun test tests/auth/ -> PASS, exit 0"
```

---

## Example 2: Database Migration (Prisma)

**Goal**: "Migrate from direct SQL to Prisma ORM"

### Task Breakdown

```
Wave 1 (Foundation):
|- Task 1: Setup Prisma and define schema [standard]
   |- Install prisma, create schema from existing tables
   |- Files:
   |  - Create: prisma/schema.prisma
   |  - Modify: package.json
   |- Criteria:
      - V1: test -f prisma/schema.prisma && echo "exists" -> exists
      - V2: npx prisma validate -> exit 0

Wave 2 (Migration):
|- Task 2: Migrate user queries [standard]
|  |- Depends on: [1]
|  |- Replace SQL in user.service.ts
|  |- Files:
|  |  - Modify: src/services/user.service.ts
|  |  - Test: tests/services/user.service.test.ts
|  |- Criteria:
|     - V1: grep -c "prisma\." src/services/user.service.ts -> >= 1, exit 0
|     - V2: grep -c "SELECT\|INSERT\|UPDATE\|DELETE" src/services/user.service.ts -> 0
|
|- Task 3: Migrate post queries [standard]
|  |- Depends on: [1]
|  |- Replace SQL in post.service.ts
|  |- Files:
|  |  - Modify: src/services/post.service.ts
|  |  - Test: tests/services/post.service.test.ts
|  |- Criteria:
|     - V1: grep -c "prisma\." src/services/post.service.ts -> >= 1, exit 0
|     - V2: grep -c "SELECT\|INSERT\|UPDATE\|DELETE" src/services/post.service.ts -> 0
|
|- Task 4: Migrate auth queries [standard]
   |- Depends on: [1]
   |- Replace SQL in auth.service.ts
   |- Files:
   |  - Modify: src/services/auth.service.ts
   |  - Test: tests/services/auth.service.test.ts
   |- Criteria:
      - V1: grep -c "prisma\." src/services/auth.service.ts -> >= 1, exit 0
      - V2: grep -c "SELECT\|INSERT\|UPDATE\|DELETE" src/services/auth.service.ts -> 0

Wave 3 (Testing):
|- Task 5: Update unit tests [standard]
|  |- Depends on: [2, 3, 4]
|  |- Mock Prisma client in tests
|  |- Files:
|  |  - Modify: tests/services/user.service.test.ts
|  |  - Modify: tests/services/post.service.test.ts
|  |  - Modify: tests/services/auth.service.test.ts
|  |- Criteria:
|     - V1: bun test tests/services/ -> PASS, exit 0
|
|- Task 6: Update integration tests [standard]
   |- Depends on: [2, 3, 4]
   |- Use test database with Prisma
   |- Files:
   |  - Modify: tests/integration/*.test.ts
   |  - Create: tests/integration/setup.ts
   |- Criteria:
      - V1: bun test tests/integration/ -> PASS, exit 0

Wave 4 (Verification):
|- Task 7: [VERIFY] Migration complete [complex]
   |- Depends on: [all]
   |- Criteria:
      - V1: bun test -> PASS, exit 0
      - V2: grep -r "SELECT\|INSERT\|UPDATE\|DELETE" src/services/ | wc -l -> 0
```

**Key Considerations**:
- Task 1 must complete first (foundation)
- Tasks 2-4 can run in parallel (independent services)
- Tasks 5-6 can run in parallel (different test types)
- Task 7 verifies everything together

---

## Example 3: REST API Endpoints

**Goal**: "Add CRUD endpoints for products"

### Task Breakdown

```
Wave 1 (Model):
|- Task 1: Create product model [standard]
   |- Schema, types, validation
   |- Files:
   |  - Create: src/models/product.ts
   |  - Create: src/validators/product.ts
   |  - Modify: prisma/schema.prisma
   |- Criteria:
      - V1: test -f src/models/product.ts && echo "exists" -> exists
      - V2: npx tsc --noEmit src/models/product.ts -> exit 0

Wave 2 (API Routes - Parallel):
|- Task 2: Create GET endpoints [standard]
|  |- GET /products, GET /products/:id
|  |- Files:
|  |  - Create: app/api/products/route.ts
|  |  - Create: app/api/products/[id]/route.ts
|  |  - Test: tests/api/products-get.test.ts
|  |- Criteria:
|     - V1: curl -s localhost:3000/api/products -> HTTP 200, body contains "products" array
|     - V2: curl -s localhost:3000/api/products/1 -> HTTP 200, body contains "id"
|
|- Task 3: Create POST endpoint [standard]
|  |- POST /products with validation
|  |- Files:
|  |  - Modify: app/api/products/route.ts:15-30
|  |  - Test: tests/api/products-post.test.ts
|  |- Criteria:
|     - V1: curl -X POST localhost:3000/api/products -H 'Content-Type: application/json' -d '{"name":"test"}' -> HTTP 201, exit 0
|     - V2: curl -X POST localhost:3000/api/products -d '{}' -> HTTP 400
|
|- Task 4: Create PUT endpoint [standard]
|  |- PUT /products/:id
|  |- Files:
|  |  - Modify: app/api/products/[id]/route.ts:10-25
|  |  - Test: tests/api/products-put.test.ts
|  |- Criteria:
|     - V1: curl -X PUT localhost:3000/api/products/1 -H 'Content-Type: application/json' -d '{"name":"updated"}' -> HTTP 200, exit 0
|
|- Task 5: Create DELETE endpoint [standard]
   |- DELETE /products/:id
   |- Files:
   |  - Modify: app/api/products/[id]/route.ts:27-35
   |  - Test: tests/api/products-delete.test.ts
   |- Criteria:
      - V1: curl -X DELETE localhost:3000/api/products/1 -> HTTP 204, exit 0

Wave 3 (Tests - Parallel):
|- Task 6: Unit tests [standard]
|  |- Test service functions
|  |- Files:
|  |  - Create: tests/services/product.service.test.ts
|  |- Criteria:
|     - V1: bun test tests/services/product.service.test.ts -> PASS, exit 0
|
|- Task 7: Integration tests [standard]
   |- Test API endpoints
   |- Files:
   |  - Create: tests/integration/products.test.ts
   |- Criteria:
      - V1: bun test tests/integration/products.test.ts -> PASS, exit 0

Wave 4 (Verification):
|- Task 8: [VERIFY] API complete [complex]
   |- Criteria:
      - V1: bun test tests/ -> PASS, exit 0
      - V2: curl -s localhost:3000/api/products -> HTTP 200, body contains "products" array
```

---

## Task Granularity Rules

| Rule                       | Guideline                     |
| -------------------------- | ----------------------------- |
| One task = one deliverable | Single focused outcome        |
| Max time                   | ~30 minutes of work           |
| Single worker              | Can be completed by one agent |
| Testable                   | Has clear success criteria    |

---

## Complexity Guidelines

| Complexity | Model  | When to Use                                           |
| ---------- | ------ | ----------------------------------------------------- |
| `standard` | sonnet | CRUD, simple features, tests, straightforward changes |
| `complex`  | opus   | Architecture, security, algorithms, 5+ files          |

---

## Criteria Format

Each criterion follows the **Command -> Expected Output** pattern:

```
Criterion: <description>
  Command: <shell command to run>
  Expected Output: <what the output should contain>
  Exit code: 0
```

**Examples:**

| Criterion | Command | Expected Output |
|-----------|---------|-----------------|
| Auth endpoint responds | `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/auth/providers` | `200`, exit 0 |
| Migration file exists | `test -f prisma/migrations/*/migration.sql && echo "exists"` | `exists` |
| No raw SQL remaining | `grep -r "SELECT\|INSERT" src/services/ \| wc -l` | `0` |
| Tests pass | `bun test tests/auth/` | `PASS`, exit 0 |

---

## File Classification

Each task lists files with their operation type:

```
Files:
- Create: src/auth/provider.ts        (new file)
- Modify: src/app.ts:12-15            (change specific lines)
- Test: tests/auth/provider.test.ts    (test file)
```

| Type     | Meaning                                   |
| -------- | ----------------------------------------- |
| Create   | New file that does not exist yet          |
| Modify   | Existing file with specific line ranges   |
| Test     | Test file for the feature                 |

---

## Dependency Patterns

```
Independent tasks      -> blockedBy: []     (parallel)
Sequential dependency  -> blockedBy: ["1"]  (after task 1)
Multi-dependency      -> blockedBy: ["1","2"] (after both)
Verify task           -> blockedBy: [all]   (after everything)
```
