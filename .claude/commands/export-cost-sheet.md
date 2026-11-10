---
description: 현재 산출 내역을 관공서 표준 토목 적산 엑셀 파일(XLSX) 또는 JSON으로 내보내기
usage: /export-cost-sheet [--format="xlsx|json"]
---

# /export-cost-sheet 커맨드 실행 프로토콜

1. `report-generator` 에이전트를 호출합니다.
2. 현재 대안(또는 전 대안)의 공종별 적산 집계 데이터를 표준 토목 공사비 내역서 템플릿에 매핑합니다.
3. 지정된 형식(XLSX 또는 JSON)의 파일을 생성하여 다운로드 가능한 버퍼 또는 파일 경로를 반환합니다.

