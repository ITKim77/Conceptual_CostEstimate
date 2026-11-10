# Hook: pre-calculate-validate

## 트리거 시점
* 사용자가 적산 실행 버튼을 누르거나 `/estimate` 커맨드가 호출되기 직전.

## 실행 동작
1. 각 경간의 형식(`type`)과 경간장(`span_length`)이 표준 허용 범위 이내인지 검증 (예: PSC BEAM $\le 35\text{m}$, ST BOX $\le 80\text{m}$).
2. 교량 폭원 $B > 0$, 총연장 $L = \sum \text{span\_length}$ 일치 여부 검증.
3. 교각 높이 $H > 0$ 검증.
4. 규칙 위반 시 경고 알림을 발생시키고 연산 엔진에 플래그를 전달합니다.

