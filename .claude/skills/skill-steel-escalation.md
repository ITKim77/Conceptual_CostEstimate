---
name: skill-steel-escalation
description: 강재 시세 변동에 따른 강상부 형식(ST BOX, 플레이트교 등) 단위공사비 실시간 보정 스킬
---

# skill-steel-escalation

## 연산 공식
$$
U_{\text{adjusted}} = U_{\text{base}} + (P_{\text{current}} - P_{\text{base}}) \times \gamma_{\text{steel}}
$$

* $U_{\text{base}}$: REV.04 기본 상부단가 (원/$m^2$)
* $P_{\text{base}}$: 기준 강판단가 (715,000 원/톤, 66~77만 원의 중위값)
* $P_{\text{current}}$: 현재 시점 강판단가 (원/톤)
* $\gamma_{\text{steel}}$: 단위면적당 강재 투입비중 (상부 직접공사비의 35%, 0.35 반영)

