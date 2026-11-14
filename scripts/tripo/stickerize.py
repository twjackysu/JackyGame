"""Post-process a transparent render into JackyGame's sticker look.

- optional PCA rotation so the long axis lies on a diagonal (icons)
- trim, pad, uniform outer outline (dark), slight saturation/contrast boost
Usage (as module): from stickerize import stickerize
"""
import math
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def _pca_angle(alpha):
    ys, xs = np.nonzero(alpha > 32)
    xs = xs - xs.mean(); ys = ys - ys.mean()
    cov = np.cov(np.vstack([xs, ys]))
    vals, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, np.argmax(vals)]
    return math.degrees(math.atan2(vy, vx))  # image coords (y down)


def outline(im, px, color=(42, 32, 38)):
    a = im.split()[3]
    # round dilation via repeated max-filter on a blurred mask
    m = a.point(lambda v: 255 if v > 40 else 0)
    k = 2 * px + 1
    big = m.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))
    big = big.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 255 if v > 100 else 0)
    base = Image.new("RGBA", im.size, color + (0,))
    base.putalpha(big)
    return Image.alpha_composite(base, im)


def stickerize(src, dst_size, line_frac=0.022, diag=None, flip_x=False, flip_y=False, pad_frac=0.06,
               sat=1.18, contrast=1.08, square=True, line_px=None):
    im = Image.open(src).convert("RGBA") if isinstance(src, str) else src.convert("RGBA")
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(im.convert("RGB")).enhance(sat)).enhance(contrast)
    rgb.putalpha(im.split()[3]); im = rgb
    if diag is not None:
        ang = _pca_angle(np.asarray(im.split()[3]))
        # rotate so long axis points to `diag` degrees (image coords, -45 = up-right)
        im = im.rotate(ang - diag, resample=Image.BICUBIC, expand=True)
    if flip_x:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if flip_y:
        im = im.transpose(Image.FLIP_TOP_BOTTOM)
    im = im.crop(im.getbbox())
    w, h = im.size
    side = max(w, h) if square else None
    pad = int((side or max(w, h)) * pad_frac)
    lp = line_px if line_px is not None else max(2, int((side or max(w, h)) * line_frac))
    if square:
        canvas = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
        canvas.paste(im, ((side - w) // 2 + pad, (side - h) // 2 + pad), im)
    else:
        canvas = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
        canvas.paste(im, (pad, pad), im)
    canvas = outline(canvas, lp)
    if dst_size:
        if square:
            canvas = canvas.resize((dst_size, dst_size), Image.LANCZOS)
        else:
            s = dst_size / max(canvas.size)
            canvas = canvas.resize((round(canvas.width * s), round(canvas.height * s)), Image.LANCZOS)
    return canvas
