// 由 scripts/cut-hero.py 產生，不要手改。x/y/w/h＝靴子在原圖的外框；px/py＝轉軸（靴口中間，原圖座標）。
export interface FootPart { x: number; y: number; w: number; h: number; px: number; py: number }
export const HERO_PARTS: Record<string, { w: number; h: number; feet: { l: FootPart; r: FootPart } }> = {
  'sword': {
    'w': 409,
    'h': 597,
    'feet': {
      'l': {
        'x': 187,
        'y': 452,
        'w': 77,
        'h': 145,
        'px': 220,
        'py': 458
      },
      'r': {
        'x': 306,
        'y': 453,
        'w': 98,
        'h': 125,
        'px': 335,
        'py': 459
      }
    }
  },
  'bow': {
    'w': 519,
    'h': 608,
    'feet': {
      'l': {
        'x': 176,
        'y': 464,
        'w': 77,
        'h': 144,
        'px': 211,
        'py': 470
      },
      'r': {
        'x': 296,
        'y': 465,
        'w': 97,
        'h': 124,
        'px': 322,
        'py': 471
      }
    }
  },
  'staff': {
    'w': 497,
    'h': 597,
    'feet': {
      'l': {
        'x': 157,
        'y': 455,
        'w': 76,
        'h': 142,
        'px': 198,
        'py': 461
      },
      'r': {
        'x': 276,
        'y': 454,
        'w': 98,
        'h': 124,
        'px': 305,
        'py': 460
      }
    }
  }
};
