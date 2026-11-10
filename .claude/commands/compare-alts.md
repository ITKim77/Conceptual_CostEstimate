---
description: 복수 교량 대안(원안 vs 비교1~5안) 간 공사비 비교 매트릭스 및 경제성 분석 출력
usage: /compare-alts [--base="Alt1"] [--targets="Alt2,Alt3"]
---

# /compare-alts 커맨드 실행 프로토콜

1. `alternative-analyst` 에이전트를 호출하여 등록된 대안들의 적산 내역을 로드합니다.
2. 기준안 대비 각 대안의 총공사비 증감액($\Delta \text{Cost}$), 증감률($\pm\%$), $m^2$당 단가 편차를 계산합니다.
3. 공종별 비용 구성 비중(스택 바 차트 데이터)과 경제성·시공성 비교표를 생성하여 출력합니다.

