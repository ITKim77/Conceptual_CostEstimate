---
name: skill-rev04-lookup
description: docs/ REV.04 데이터베이스에서 상부공(27개 형식), 교대/교각, 부대공 단위단가 조회 스킬
---

# skill-rev04-lookup

## 기능
* `docs/고속도로 계획단계 교량 개략공사비 산정.md`의 정규화된 JSON 데이터베이스에서 파라미터(형식명, 지간장, 높이 등)에 일치하는 단위단가를 $O(1)$ 또는 이진 탐색으로 조회합니다.
* 일치하는 규격이 없는 경우 선형보간 필요 플래그(`needsInterpolation: true`)와 상·하한 바운드 데이터를 반환합니다.

