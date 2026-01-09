---
name: overview-exploration
description: "Quick project overview exploration - direct execution without agent spawn. Use at the start of ultrawork sessions."
---

# Overview Exploration Skill

프로젝트 개요를 빠르게 파악하는 직접 탐색 스킬입니다. Agent spawn 없이 직접 실행합니다.

---

## When to Use

- ultrawork 세션 시작 시 (GATE 1)
- 프로젝트 구조 파악이 필요할 때
- Targeted exploration 전 컨텍스트 수집

---

## Execution Steps

### Step 1: 프로젝트 설정 파일 확인

```python
# 언어/프레임워크 감지
Glob(pattern="package.json")      # Node.js/JS
Glob(pattern="go.mod")            # Go
Glob(pattern="requirements.txt")  # Python
Glob(pattern="Cargo.toml")        # Rust
Glob(pattern="pom.xml")           # Java/Maven
Glob(pattern="*.csproj")          # .NET
```

발견된 파일 읽기:
```python
Read(file_path="package.json")  # 또는 해당 설정 파일
```

### Step 2: 디렉토리 구조 파악

```python
# 최상위 구조
Glob(pattern="*", path=".")

# 주요 소스 디렉토리
Glob(pattern="src/*")
Glob(pattern="app/*")
Glob(pattern="lib/*")
Glob(pattern="internal/*")
Glob(pattern="cmd/*")
```

### Step 3: 핵심 패턴 탐색

```python
# 설정 파일들
Glob(pattern="**/*.config.*")
Glob(pattern="**/.*rc")
Glob(pattern="**/*.json", path=".")

# 테스트 구조
Glob(pattern="**/*_test.*")
Glob(pattern="**/*.test.*")
Glob(pattern="**/test/**/*")
```

### Step 4: 기존 문서 확인 (있다면)

```python
# README, CLAUDE.md 등
Read(file_path="README.md")
Read(file_path="CLAUDE.md")
Read(file_path=".claude/CLAUDE.md")
```

---

## Output Format

탐색 완료 후 다음 형식으로 요약:

```markdown
## Overview 탐색 결과

**프로젝트 유형**: {Next.js / Express / Go CLI / Python Library / etc.}

**기술 스택**:
- Language: {TypeScript / Go / Python / etc.}
- Framework: {Next.js / Express / Gin / etc.}
- Database: {PostgreSQL / MongoDB / etc.} (있다면)
- Test: {Jest / pytest / go test / etc.}

**디렉토리 구조**:
```
project/
├── src/           # {설명}
├── app/           # {설명}
├── lib/           # {설명}
└── tests/         # {설명}
```

**핵심 진입점**:
- {main entry file}
- {api routes if any}

**기존 패턴**:
- {auth: implemented/not found}
- {database: prisma/typeorm/raw sql/not found}
- {api: rest/graphql/trpc/not found}

**관련 파일** (Goal 기준):
- {file1}: {이유}
- {file2}: {이유}
```

---

## Session Integration

ultrawork 세션에서 사용 시:

### 1. exploration_stage 업데이트

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" \
  --session {session_dir}/session.json \
  --exploration-stage overview
```

### 2. overview.md 저장

```python
Write(
  file_path="{session_dir}/exploration/overview.md",
  content="{위 형식의 탐색 결과}"
)
```

### 3. context.json 초기화

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/context-init.sh" \
  --session {session_dir} \
  --overview-complete
```

---

## Time Budget

- 목표: **30초 이내** 완료
- 최대 Read: 5-7개 파일
- 최대 Glob: 10개 패턴

**과도한 탐색 금지** - Overview는 빠른 파악이 목적입니다.
Targeted exploration이 상세 탐색을 담당합니다.

---

## Next Steps

Overview 완료 후:

1. Goal + Overview 분석 → Targeted exploration hints 생성
2. `Task(subagent_type="ultrawork:explorer")` 로 상세 탐색
3. 모든 탐색 완료 → Planning phase 진행
