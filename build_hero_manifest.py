# -*- coding: utf-8 -*-
"""
코스프레 규정 페이지(cosplay.html) 맨 위 슬라이드쇼용 사진 목록 생성.

사용법:
    python build_hero_manifest.py

  - cosplay-hero/탐라, cosplay-hero/탐라코스체험, cosplay-hero/과수 폴더를
    이 순서대로 훑어서(각 폴더 안에서는 파일명 순) cosplay-hero/manifest.js 를 만든다.
  - 폴더에 사진을 새로 넣거나 뺐으면 이 스크립트를 다시 실행 → 커밋 → 푸시.
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "cosplay-hero")
FOLDERS = ["탐라", "탐라코스체험", "과수"]
EXTS = (".jpg", ".jpeg", ".png", ".webp")

photos = []
for folder in FOLDERS:
    d = os.path.join(ROOT, folder)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        if name.lower().endswith(EXTS):
            photos.append(f"cosplay-hero/{folder}/{name}")

out_path = os.path.join(ROOT, "manifest.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// build_hero_manifest.py 로 자동 생성됨. 직접 수정하지 말 것.\n")
    f.write("window.HERO_PHOTOS = " + json.dumps(photos, ensure_ascii=False, indent=2) + ";\n")

print(f"{len(photos)}장 -> {out_path}")
