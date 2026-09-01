# -*- coding: utf-8 -*-
"""
황금 귤을 찾아라 — 미션 QR 인쇄 시트 만들기
(2026-08-29: 보물찾기는 QR→GPS 나침반으로 전면 교체됨. 이 스크립트는
 스태프 명찰용 "미션 완료 QR"만 만든다. 보물찾기 좌표는 gps_picker.html로 찍는다.)

사용법:
    python make_qr.py https://내주소.web.app/

  - data.js 에서 미션 QR 목록을 읽어 인쇄용 카드를 만든다
  - A4 6장씩(2x3) 배치한 인쇄용 PNG 를 out/ 에 저장한다
  - 낱장 PNG 도 out/missions/ 에 따로 저장한다 (부분 재인쇄용)
"""
import io, os, re, json, sys
import qrcode
from PIL import Image, ImageDraw, ImageFont

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://example.web.app/"
# 뒤에 ?q=/ ?m= 을 그대로 붙일 것이므로 슬래시를 강제로 넣지 않는다.
# (아티팩트 URL처럼 도메인 뒤에 고정 경로가 있는 주소는 슬래시가 붙으면 경로가 달라진다)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "out")

# ── data.js 에서 missions 읽기 ────────────────────────────
src = io.open(os.path.join(HERE, "data.js"), encoding="utf-8").read()

def block(name):
    i = src.index(name)
    i = src.index(":", i) + 1
    depth, start, j = 0, None, i
    while j < len(src):
        c = src[j]
        if c in "[{":
            if start is None:
                start = j
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                return src[start:j+1]
        j += 1
    raise ValueError(name)

def jsonify(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', s)
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    return json.loads(s)

missions = jsonify(block("missions"))

# ── 폰트 ────────────────────────────────────────────────────────
def font(sz, bold=False):
    for p in (r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
              r"C:\Windows\Fonts\malgun.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

# ── 카드 공용 치수 ────────────────────────────────────────────────
CARD_W, CARD_H = 1150, 1080
GOLD, INK, GREY = (168, 129, 31), (32, 28, 20), (130, 130, 130)

# ── A4 시트 배치 상수 ─────────────────────────────────────────────
A4 = (2480, 3508)
COLS, ROWS = 2, 3
MX, MY = 60, 110
GX = (A4[0] - MX*2 - CARD_W*COLS) // max(COLS-1, 1)
GY = (A4[1] - MY*2 - CARD_H*ROWS) // max(ROWS-1, 1)
per = COLS * ROWS

# ── 미션 완료 QR (스태프 명찰용) ──────────────────────────────────
OUTM = os.path.join(OUT, "missions")
os.makedirs(OUTM, exist_ok=True)
RED = (168, 60, 50)

def make_mission_card(m):
    img = Image.new("RGB", (CARD_W, CARD_H), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, CARD_W-7, CARD_H-7], outline=(200, 200, 200), width=3)
    d.rectangle([26, 26, CARD_W-27, CARD_H-27], outline=RED, width=5)

    f_t = font(46, True)
    d.text((CARD_W//2, 86), "미션 완료 확인", font=f_t, fill=RED, anchor="mm")
    f_z = font(40, True)
    d.text((CARD_W//2, 150), m["name"], font=f_z, fill=INK, anchor="mm")

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=10, border=2)
    qr.add_data(BASE + "?m=" + m["qr"])
    qr.make(fit=True)
    qim = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qim = qim.resize((620, 620), Image.NEAREST)
    img.paste(qim, ((CARD_W-620)//2, 200))

    f_m = font(40, True)
    d.text((CARD_W//2, 880), "완료를 확인한 뒤에만 보여주세요", font=f_m, fill=INK, anchor="mm")
    f_s = font(30)
    d.text((CARD_W//2, 936), "참가자가 자기 폰 카메라로 찍으면 즉시 완료 처리됩니다", font=f_s, fill=GREY, anchor="mm")

    f_i = font(30, True)
    d.text((CARD_W-52, CARD_H-52), m["qr"], font=f_i, fill=(190, 190, 190), anchor="rs")
    return img

mission_list = [m for m in missions if m.get("qr")]
mcards = [make_mission_card(m) for m in mission_list]
for m, c in zip(mission_list, mcards):
    c.save(os.path.join(OUTM, "%s.png" % m["qr"]))

msheets = []
for s in range(0, len(mcards), per):
    sheet = Image.new("RGB", A4, "white")
    for i, c in enumerate(mcards[s:s+per]):
        r, col = divmod(i, COLS)
        sheet.paste(c, (MX + col*(CARD_W+GX), MY + r*(CARD_H+GY)))
    n = s//per + 1
    p = os.path.join(OUT, "미션QR시트_%02d.png" % n)
    sheet.save(p, dpi=(300, 300))
    msheets.append(p)

print()
print("미션 QR %d장 → %s" % (len(mcards), OUTM))
print("미션 QR 인쇄 시트 %d장 → %s" % (len(msheets), OUT))
for p in msheets:
    print("  ", os.path.basename(p))
