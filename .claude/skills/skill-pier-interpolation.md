---
name: skill-pier-interpolation
description: 교각 규격표(D2.0~D3.2m, 중공구형)의 높이 구간 증분 기울기를 계산하여 임의 높이에 대한 정밀 선형보간을 수행하는 스킬
---

# skill-pier-interpolation

## 연산 공식
$$
\text{Cost}(H) = \text{Cost}(H_1) + \frac{\text{Cost}(H_2) - \text{Cost}(H_1)}{H_2 - H_1} \times (H - H_1)
$$

* $H_1, H_2$: 대상 높이 $H$를 포함하는 인접 규격 구간 경계값 (예: 15m, 20m)
* 초과 높이($H > 60\text{m}$)의 경우 최상위 5m 구간의 증분 기울기를 외삽(Extrapolation)하여 산출합니다.

