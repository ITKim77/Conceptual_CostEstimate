# CLAUDE.md — 프로젝트 거버넌스 및 개발 가이드라인

> **프로젝트 공식 명칭**: BIM 기반 고속도로 교량 공사비 산정 웹 소프트웨어  
> **핵심 주제**: BIM을 기반으로 한 고속도로의 교량 공사비를 대안별로 산정하여 비교할 수 있도록 하는 웹기반 소프트웨어  
> **도메인 유형**: Web Application (React + Vite + TypeScript + Three.js)  
> **기준 성과품**: `docs/고속도로 계획단계 교량 개략공사비 산정.md` (REV.04)  
> **품질 지표**: 산정방법 및 단가 정확도 100% 일치  

---

## 1. 프로젝트 원칙 및 거버넌스 규약 (Governance Rules)

### 1.1 절대적 단일 진실 공급원 (SSOT) 및 데이터 무결성
* 본 시스템의 모든 공사비 산정 로직과 기본 단가는 반드시 `docs/고속도로 계획단계 교량 개략공사비 산정.md` (REV.04)를 절대적 기준으로 삼는다.
* **임의 수치 지어내기(Hallucination) 절대 금지**: 단가나 수식에 대한 자의적 추정이나 임의 상수를 생성하지 않으며, 기준 문서에 없는 조건은 사용자의 명시적 지침을 받는다.
* **선형보간(Linear Interpolation)**: 규격표(교각 높이, 경간장)의 중간값은 공식에 명시된 기울기 증분을 적용하여 수학적으로 보간한다.

### 1.2 UI/UX 데이터 표현 및 컬러 코딩 규칙 (`ui_rules.enabled: true`)
모든 UI 화면 컴포넌트는 다음 3대 색상 원칙을 엄격히 준수한다:
1. **사용자 입력값 (Red / `#EF4444`)**:
   * 교량 연장, 상부 폭원, 경간 구성, 교각 직경/높이, 지반 조건, 제잡비율 등 사용자가 직접 입력/수정하는 변수.
   * **단일 위치 정의 원칙**: 동일 변수를 화면의 여러 위치에 분산하여 중복 입력받는 것을 엄격히 금지한다.
2. **인용 및 연산값 (Blue / `#3B82F6`)**:
   * 실적 DB 단가 조회값, 직접공사비, 제잡비, $m^2$당 단가, 대안 간 증감율($\pm\%$) 등 시스템 연산 결과.
   * **Read-Only**: 사용자가 직접 타이핑하거나 수정할 수 없도록 강제한다.
3. **고정값 또는 기본 가정값 (Black / `#111827`)**:
   * 가시설 기당 단가(5,500만 원), 매스콘크리트 단가(7만 원/$m^3$), 기타공사비율(10%), 강재비 비중(35%) 등 시스템 상수.

### 1.3 세션 부트스트랩 및 작업 상태 추적 프로토콜 (Session Bootstrapping)
* **세션 시작 시 필수 선독**: 모든 에이전트는 새로운 세션을 시작하거나 작업을 인계받을 때 반드시 최우선적으로 `PROGRESS.md`와 `PLAN.md`를 필독한다.
  * `PROGRESS.md`: 현재까지 어디까지 진행되었고 어떤 결정이 내려졌는지 파악.
  * `PLAN.md`: 지금 당장 착수해야 할 작업(Next Action) 및 백로그 우선순위 파악.
* **작업 완료 후 상태 즉시 동기화**: 단계별 작업 완료, 사용자 승인 획득, 의사결정 변경 시 즉시 `PROGRESS.md`에 이력을 남기고 `PLAN.md`를 최신화한다.

### 1.4 Anthropic 장기 실행 앱 하네스 (Harness Design) 원칙
1. **상태 분리 (State Separation)**:
   * 에이전트의 LLM 컨텍스트 윈도우에 모든 교량 제원 및 연산 이력을 담아두지 않는다.
   * 교량 파라미터(Red) 및 대안별 상태는 외부 체크포인트에 영속화하며, 컨텍스트 압축이나 세션 재시작 시 파일에서 상태를 복원한다.
2. **모듈 및 서브에이전트 격리 (Module Isolation)**:
   * 적산 연산, 3D 지오메트리 빌드, 대안 비교, 정합성 검증 등 기능 단위별로 완전히 격리된 서브에이전트(`bridge-cost-engine`, `bim-parametric-modeler` 등)를 운영한다.
   * 에이전트 간 데이터 전달은 엄격한 JSON 스키마를 통해서만 수행하며 컨텍스트 오염을 원천 차단한다.
3. **오류 복원력 및 멱등성 (Fault-Tolerance & Idempotency)**:
   * 모든 계산 엔진 함수는 순수 함수로 작성되어 멱등성을 보장하며, 정합성 검증 실패 시 이전 정상 체크포인트로 안전하게 롤백(Rollback)한다.

---

## 2. 시스템 아키텍처 및 기술 스택

### 2.1 기술 스택 명세
* **런타임 & 번들러**: Node.js (LTS), Vite
* **프레임워크**: React 18/19, TypeScript (Strict Mode)
* **스타일링**: Tailwind CSS, Lucide React, shadcn/ui
* **3D BIM 엔진**: Three.js, `@react-three/fiber`, `@react-three/drei`
* **상태 관리**: Zustand (Input Slice와 Computed Slice의 엄격한 단방향 분리)
* **대안 분석 & 차트**: Recharts
* **단위 테스트**: Vitest (적산 공식 및 선형보간 100% 정합성 검증)
* **데이터 입출력**: SheetJS (`xlsx`), FileSaver, JSON Schema Validator

### 2.2 디렉터리 아키텍처 구조 (셋업 시 표준 규격)
```
src/
├── domain/                    # 순수 도메인 비즈니스 로직 (UI 비의존)
│   ├── constants/             # REV.04 표준단가 DB, 재료비 비중 등 불변 상수
│   ├── models/                # 교량, 경간, 교각, 교대, 기초 TypeScript 타입 정의
│   ├── engine/                # 상부/하부/기초/부대/토공 적산 순수 함수
│   └── validators/            # 경간 한계, 사각, 폭원 유효성 검증기
├── store/                     # Zustand SSOT 상태 관리
│   ├── useBridgeStore.ts      # 사용자 입력값(Red) 및 계산 결과(Blue) 슬라이스
│   └── useAlternativeStore.ts # 대안(Alt 1~N) 관리 및 비교 슬라이스
├── components/                # UI 컴포넌트
│   ├── common/                # SSOT 컬러 적용된 InputField(Red), OutputDisplay(Blue)
│   ├── input/                 # 파라메트릭 입력 패널 (단일 위치 입력 폼)
│   ├── viewer3d/              # Three.js 기반 교량 3D BIM 파라메트릭 뷰어
│   ├── analytics/             # 대안별 공사비 비교 차트 및 매트릭스
│   └── report/                # 산출서 테이블 및 엑셀/PDF 내보내기
└── lib/                       # 수학 계산, 보간, 포맷터 유틸리티
```

---

## 3. 개발 명령어 표준 (Standard Commands)

```bash
# 개발 서버 구동 (Vite Dev Server)
npm run dev

# TypeScript 타입 검증 및 프로덕션 빌드
npm run build

# 적산 엔진 및 정합성 단위 테스트 실행 (Vitest)
npm run test

# 테스트 커버리지 및 리포트 출력
npm run test:coverage

# 코드 린트 및 포맷팅 검사
npm run lint
```

---

## 4. 코딩 및 품질 표준 (Coding Standards)

1. **TypeScript 엄격 모드**:
   * `any` 타입 사용 금지. 모든 파라미터(`SpanItem`, `PierItem`, `CostBreakdown` 등)는 명시적 인터페이스로 선언.
2. **도메인 계산 엔진의 순수성**:
   * `domain/engine/`의 적산 함수는 부수 효과(Side-effect)가 없는 순수 함수(Pure function)로 작성하여 단위 테스트에서 100% 재현성을 보장한다.
3. **3D 렌더링 최적화**:
   * 말뚝 기초 등 다량 반복 구조물은 `InstancedMesh`를 필히 사용하며, 지오메트리 변경 시 메모리 누수가 발생하지 않도록 `dispose()` 사이클을 철저히 관리한다.
4. **테스트 주도 정합성 검증 (TDD)**:
   * `docs/` 6장의 실제 벤치마크(연축교 원안 및 비교 1~5안, 안동JCT 비교안)를 단위 테스트 케이스로 구현하여 계산 오차 0%를 유지한다.

---

## 5. 다중 에이전트 협업 및 확장 컴포넌트 프로토콜 (.claude/)

### 5.1 등록된 전문 서브에이전트 (`.claude/agents/`)
| 서브에이전트 | 전담 역할 | 데이터 핸드오프 규칙 |
| :--- | :--- | :--- |
| **`bridge-cost-engine`** | REV.04 기반 수치 적산, 선형보간, 강재가 변동 보정 | 파라메터 JSON 입력 수신 $\rightarrow$ 적산 세부내역 JSON 반환 |
| **`bim-parametric-modeler`** | Three.js 파라메트릭 3D 지오메트리 빌드 | 제원 JSON 수신 $\rightarrow$ Scene Graph 및 InstancedMesh 렌더링 |
| **`alternative-analyst`** | 대안 간 공사비 증감률($\pm\%$), 경제성 지수 분석 | 복수 대안 세트 수신 $\rightarrow$ 비교 매트릭스 및 차트 데이터셋 반환 |
| **`quality-verifier`** | 연축교/안동JCT 벤치마크 1:1 정합성 감사 | 적산 결과 수신 $\rightarrow$ 오차율 0% 검증 보고서 반환 (실패 시 롤백) |
| **`report-generator`** | SheetJS 표준 적산 내역서(XLSX) 및 PDF 생성 | 적산 집계 JSON 수신 $\rightarrow$ 포맷팅된 파일 버퍼 출력 |

### 5.2 등록된 슬래시 단축 명령어 (`.claude/commands/`)
* `/estimate`: 현재 파라메터로 개략공사비 적산 전체 파이프라인 즉시 실행
* `/compare-alts`: 대안별 공사비 비교 매트릭스 및 경제성 비교표 도출
* `/verify-benchmarks`: `docs/` 실적 벤치마크(연축교, 안동JCT) 자동 정합성 테스트 실행
* `/sync-bim`: 3D BIM 뷰어 지오메트리 렌더링 동기화
* `/export-cost-sheet`: 표준 적산 내역서(Excel/JSON) 출력
* `/status`: `PROGRESS.md` 및 `PLAN.md` 기반 진척도 요약 보고

### 5.3 컨텍스트 오염 방지 및 데이터 격리 규칙
1. **메인 오케스트레이터의 역할 최소화**: 총괄 에이전트는 작업 지시 및 결과 취합만 수행하며, 개별 계산이나 대용량 지오메트리 배열을 메인 프롬프트 컨텍스트에 직접 적재하지 않는다.
2. **에이전트 간 전달 데이터 최소화**: 에이전트 간 핸드오프 시 불필요한 로그는 배제하고 스키마에 정의된 핵심 JSON 페이로드만 주고받는다.
3. **체크포인트 기반 롤백**: 오류 발생 시 대화 히스토리로 문제를 복구하려 하지 않고, 하네스 체크포인트(`.claude/harness/`)를 통해 직전 정상 상태로 복원한다.


