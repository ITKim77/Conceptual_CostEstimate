---
name: skill-bim-mesh-builder
description: Three.js 지오메트리 프리미티브를 결합하여 교량 상부 슬래브, 교각 코핑/기둥, 교대, 말뚝을 3D 메시로 빌드하는 스킬
---

# skill-bim-mesh-builder

## 기능
1. **슬래브 (Superstructure)**: `THREE.BoxGeometry(width, depth, spanLength)`로 경간별 연속 배치.
2. **교각 (Piers)**: 코핑(`BoxGeometry`) + 기둥(`CylinderGeometry` 또는 사각 기둥).
3. **교대 (Abutments)**: 역T형 흉벽 및 기초 슬래브 복합 지오메트리 빌드.
4. **강관말뚝 (Piles)**: `THREE.InstancedMesh`를 통해 수백 본의 말뚝을 단일 드로우 콜로 고속 렌더링.

