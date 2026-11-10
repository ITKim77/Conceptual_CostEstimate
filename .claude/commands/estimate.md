---
description: 현재 설정된 교량 파라메터로 개략공사비 적산 전체 파이프라인 즉시 실행
usage: /estimate [--spans="..."] [--width=...] [--markup=...]
---

# /estimate 커맨드 실행 프로토콜

1. `bridge-cost-engine` 에이전트를 호출하여 현재 입력 상태(Red)를 검증합니다.
2. 상부공 $\rightarrow$ 교대공 $\rightarrow$ 교각공 $\rightarrow$ 기초공 $\rightarrow$ 부대공 $\rightarrow$ 토공 직접비를 순차 산출합니다.
3. 기타공사비(10%) 및 제잡비(40.0~43.9%)를 집계하여 총공사비 및 $m^2$당 단가를 출력합니다.
4. 산출 결과(Blue)를 상태 스토어 및 화면에 즉각 반영합니다.

