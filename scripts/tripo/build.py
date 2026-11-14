"""把 Jacky 的 Tripo 3D 模型（另一個 repo：twjackysu/curses-too-useful 的 art-inbox/tripo/，原 yuming-city）做成 JackyGame 的 2D 圖。

前置：pip install --break-system-packages bpy pillow numpy（Blender 當 Python 模組，雲端／無 GPU 也能跑，用 Cycles CPU）
用法：python3 -I scripts/tripo/build.py <tripo 資料夾>   例：python3 -I scripts/tripo/build.py ../curses-too-useful/art-inbox/tripo
輸出：public/art/gear_weapon_{sword,bow,staff}.webp（192×192 圖示）、public/art/anim/enemy_miasma_wolf_walk.webp（5×2 走路影格表）
新增的影格表要在 src/data/animArt.ts 登記（影格尺寸、格數）；新增的單張圖要加進 src/data/handArt.ts（或跑一次 import-art.mjs）。
"""
import glob, os, subprocess, sys, tempfile
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from stickerize import stickerize, outline  # noqa: E402

src = sys.argv[1]
root = os.path.abspath(os.path.join(HERE, "..", ".."))
art = os.path.join(root, "public", "art")
tmp = tempfile.mkdtemp()


def render(out, glb, *args):
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "render_view.py"), out, os.path.join(src, glb), *args],
                   check=True, stdout=subprocess.DEVNULL)


# ---- 武器圖示：深色描邊＋外圈奶油色亮邊（在橘／藍底光上也看得清楚）----
def icon(png, out, bright=1.0, **k):
    im = stickerize(png, None, line_frac=0.03, **k)
    if bright != 1.0:
        rgb = ImageEnhance.Brightness(im.convert("RGB")).enhance(bright); rgb.putalpha(im.split()[3]); im = rgb
    big = Image.new("RGBA", (im.width + 24, im.height + 24), (0, 0, 0, 0)); big.paste(im, (12, 12), im)
    outline(big, 6, color=(250, 240, 220)).resize((192, 192), Image.LANCZOS).save(out, "WEBP", quality=90, method=6)


render(f"{tmp}/sword", "weapon_longsword/weapon_longsword_model.glb", "--view", "thin")
render(f"{tmp}/bow", "weapon_bow/weapon_bow_model.glb", "--view", "yaw:90", "--elev", "0")
render(f"{tmp}/staff", "weapon_staff/weapon_staff_model.glb", "--view", "thin")
icon(f"{tmp}/sword.png", f"{art}/gear_weapon_sword.webp", diag=-45)
icon(f"{tmp}/bow.png", f"{art}/gear_weapon_bow.webp", 1.3)
icon(f"{tmp}/staff.png", f"{art}/gear_weapon_staff.webp", 1.25, diag=-45, flip_x=True, flip_y=True)

# ---- 瘴氣狼走路：一循環約 21 格（24fps），取第 1～19 格每 2 格 → 10 格；朝右、略俯視 ----
render(f"{tmp}/wolf", "enemy_miasma_wolf/enemy_miasma_wolf_anim.glb", "--view", "yaw:-20", "--elev", "0.28",
       "--frames", "1-19:2", "--res", "1100", "--samples", "32")
ims = [Image.open(f).convert("RGBA") for f in sorted(glob.glob(f"{tmp}/wolf_*.png"))]
bb = [im.getbbox() for im in ims]
U = (min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb))  # 全部影格同一個框，腳底才不會跳
frames = []
for im in ims:
    c = im.crop(U)
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(c.convert("RGB")).enhance(1.1)).enhance(1.06); rgb.putalpha(c.split()[3])
    cv = Image.new("RGBA", (c.width + 28, c.height + 28), (0, 0, 0, 0)); cv.paste(rgb, (14, 14), rgb)
    frames.append(outline(cv, 6))
H = 380; s = H / frames[0].height
frames = [f.resize((round(f.width * s), H), Image.LANCZOS) for f in frames]
fw, cols = frames[0].width, 5  # 5×2：手機 WebGL 單張材質上限 4096，一排 10 格會超過
sheet = Image.new("RGBA", (fw * cols, H * 2), (0, 0, 0, 0))
for i, f in enumerate(frames): sheet.paste(f, ((i % cols) * fw, (i // cols) * H))
os.makedirs(f"{art}/anim", exist_ok=True)
sheet.save(f"{art}/anim/enemy_miasma_wolf_walk.webp", "WEBP", quality=88, method=6)
print("frame", fw, "x", H, "— 跟 src/data/animArt.ts 的 frameWidth／frameHeight 對一下")
