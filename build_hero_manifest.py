# -*- coding: utf-8 -*-
"""
코스프레 규정 페이지(cosplay.html) 맨 위 슬라이드쇼용 사진 목록 생성.

사용법:
    python build_hero_manifest.py

  - cosplay-hero/ 안의 "탐라.*", "탐라코스체험.*", "과수.*" 파일을 이 순서대로 찾아
    cosplay-hero/manifest.js 를 만든다. 같은 이름으로 파일을 교체하면 순서는 그대로 유지된다.
  - 사진을 바꾸거나 추가했으면 이 스크립트를 다시 실행 → 커밋 → 푸시.
"""
import os, json, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "cosplay-hero")
NAMES = ["탐라", "탐라코스체험", "과수"]
EXTS = (".jpg", ".jpeg", ".png", ".webp")

photos = []
for name in NAMES:
    for ext in EXTS:
        p = os.path.join(ROOT, name + ext)
        if os.path.isfile(p):
            photos.append(f"cosplay-hero/{name}{ext}")
            break

out_path = os.path.join(ROOT, "manifest.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// build_hero_manifest.py 로 자동 생성됨. 직접 수정하지 말 것.\n")
    f.write("window.HERO_PHOTOS = " + json.dumps(photos, ensure_ascii=False, indent=2) + ";\n")

print(f"{len(photos)}장 -> {out_path}")
