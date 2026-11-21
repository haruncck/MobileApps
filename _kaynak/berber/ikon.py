"""Berber Randevu ikonlarını üretir: lacivert zemin üstünde berber direği.
Kullanım: python3 _kaynak/berber/ikon.py   (berber/icon-192.png ve icon-512.png yazar)
Direk, maskable güvenli alanın (ortadaki %80) içinde kalır."""
from pathlib import Path
from PIL import Image, ImageDraw

LACIVERT, KIRMIZI, MAVI, AK, CELIK = "#14213D", "#C8102E", "#1D4E9E", "#FFFFFF", "#C9D2E0"
HEDEF = Path(__file__).resolve().parents[2] / "berber"


def ikon(boy: int) -> Image.Image:
    k = 4  # kenar yumuşatma için büyük çizip küçült
    n = boy * k
    resim = Image.new("RGB", (n, n), LACIVERT)
    # direk gövdesi: çapraz şeritler, kapsül biçiminde kırpılır
    gen, yuk = int(n * 0.24), int(n * 0.46)
    x0, y0 = (n - gen) // 2, (n - yuk) // 2
    serit = Image.new("RGB", (gen, yuk), AK)
    c = ImageDraw.Draw(serit)
    adim = gen * 0.42
    renkler = [KIRMIZI, AK, MAVI, AK]
    i = 0
    y = -gen * 2.0
    while y < yuk + gen:
        c.polygon([(0, y + gen), (gen, y), (gen, y + adim), (0, y + gen + adim)], fill=renkler[i % 4])
        y += adim
        i += 1
    maske = Image.new("L", (gen, yuk), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, gen - 1, yuk - 1], radius=int(gen * 0.18), fill=255)
    resim.paste(serit, (x0, y0), maske)
    # üst ve alt başlıklar
    c = ImageDraw.Draw(resim)
    bg, by = int(gen * 1.36), int(n * 0.07)
    bx = (n - bg) // 2
    for ust in (y0 - by + int(n * 0.012), y0 + yuk - int(n * 0.012)):
        c.rounded_rectangle([bx, ust, bx + bg, ust + by], radius=by // 2, fill=CELIK)
    return resim.resize((boy, boy), Image.LANCZOS)


for boy in (192, 512):
    ikon(boy).save(HEDEF / f"icon-{boy}.png", optimize=True)
    print("yazıldı:", HEDEF / f"icon-{boy}.png")
