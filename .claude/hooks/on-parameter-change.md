# Hook: on-parameter-change

## 트리거 시점
* 사용자가 Red(단일 입력 필드)에서 임의의 파라메터 값을 수정했을 때.

## 실행 동작
1. SSOT 원칙에 따라 Zustand 글로벌 스토어의 `inputs` 슬라이스를 단방향 갱신.
2. 디바운스(Debounce, 200ms) 후 파생 연산(Blue) 및 Three.js 3D 파라메트릭 렌더러에 변경 이벤트를 브로드캐스트.

