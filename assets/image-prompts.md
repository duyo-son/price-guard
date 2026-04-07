# Price Guard — 이미지 제작 가이드

## 필요한 이미지 목록

| 파일명 | 크기 | 배치 경로 | 용도 |
|--------|------|-----------|------|
| `icon-16.png` | 16×16 px | `public/icons/icon-16.png` | 브라우저 툴바 파비콘 |
| `icon-32.png` | 32×32 px | `public/icons/icon-32.png` | 고DPI 툴바 / Windows 트레이 |
| `icon-48.png` | 48×48 px | `public/icons/icon-48.png` | chrome://extensions 목록 |
| `icon-128.png` | 128×128 px | `public/icons/icon-128.png` | Chrome 웹스토어 + 알림 아이콘 |

> **빌드 시 자동 복사:** `npm run build` 실행 시 `public/icons/` → `dist/icons/` 로 복사됩니다.
> 4개 파일 모두 있어야 Chrome 확장프로그램이 정상 동작합니다.

---

## 아이콘 디자인 컨셉

**Price Guard** — 가격을 지키는 방패 + 가격표/태그 조합.
보라/인디고 그라디언트 계열의 미니멀 플랫 아이콘.

---

## 이미지 생성 프롬프트

### 기본 프롬프트 (Midjourney / DALL·E 3 / Stable Diffusion 공통)

```
A minimalist flat icon for a Chrome browser extension called "Price Guard".
The design features a shield shape with a price tag or small numeric label inside,
symbolizing price protection and tracking.
Color palette: deep purple to indigo gradient (#667eea to #764ba2), white foreground elements.
Style: clean, modern, flat design, no shadows, no gradients on the icon elements,
solid crisp edges, suitable for small sizes (16px to 128px).
Background: transparent or solid white circle/rounded square.
No text, no letters. Simple geometric shapes only.
```

### Midjourney 전용 (세부 파라미터 포함)

```
minimalist flat app icon, shield with price tag symbol inside, purple indigo gradient background #667eea #764ba2, white icon, clean flat design, chrome extension icon, no text, simple geometric, crisp edges --style raw --stylize 50 --ar 1:1 --v 6
```

### DALL·E 3 전용

```
Design a simple, clean Chrome extension icon for "Price Guard".
It should be a flat icon on a rounded square background with a purple-to-indigo gradient
(from #667eea to #764ba2). In the center, draw a white shield with a small white price tag
or currency symbol (₩ or ¥) inside the shield. The style must be minimalist,
no shadows, no bevels, no text, no letters. The icon should look professional
and recognizable even at 16x16 pixels.
```

### Stable Diffusion (negative prompt 포함)

```
Positive:
flat icon design, shield with price tag, purple gradient background, white foreground,
minimalist, app icon, chrome extension, clean edges, 128x128, vector style, centered

Negative:
text, letters, words, 3d, shadow, blur, complex, realistic, photo, gradient on icon,
multiple colors, noise, dark background, low quality
```

---

## 제작 후 처리 방법

1. **128×128** 기본 사이즈로 먼저 생성
2. Photoshop / Figma / [favicon.io](https://favicon.io) 등으로 각 사이즈로 리사이즈:
   - 128px → `icon-128.png`
   - 48px → `icon-48.png`
   - 32px → `icon-32.png`
   - 16px → `icon-16.png`
3. 반드시 **PNG 포맷**, 투명 배경 권장 (또는 둥근 사각형 배경)
4. 파일을 `public/icons/` 폴더에 저장
5. `npm run build` 실행하여 `dist/icons/` 로 복사 확인

---

## 빠른 대안 — 무료 툴

| 툴 | 특징 | URL |
|----|------|-----|
| **favicon.io** | 텍스트/이모지로 즉시 생성 | https://favicon.io |
| **Icon Kitchen** | Material 스타일 앱 아이콘 생성기 | https://icon.kitchen |
| **Canva** | 템플릿 기반 아이콘 디자인 | https://canva.com |
| **Figma** (무료) | 직접 벡터 디자인 후 PNG 내보내기 | https://figma.com |

> **최빠른 대안:** favicon.io에서 이모지 `🛡️` 또는 `💰` 선택 → 배경색 `#667eea` → PNG 다운로드 → 각 사이즈로 리사이즈
