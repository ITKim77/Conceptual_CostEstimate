---
description: 현재 입력 파라메터와 3D BIM 지오메트리 뷰어의 렌더링 메시 즉시 동기화
usage: /sync-bim [--view="elevation|cross|iso"]
---

# /sync-bim 커맨드 실행 프로토콜

1. `bim-parametric-modeler` 에이전트를 호출합니다.
2. 현재 활성화된 대안의 파라메터(경간, 교각 높이, 폭원 등)를 읽어와 3D 메시를 재생성합니다.
3. 카메라 시점을 파라미터(`--view`)에 맞춰 전환합니다.

