/** 繁體中文（預設語系）。新增字串時以此檔為準，其他語系可缺漏並回退到這裡。 */
export const zhTW = {
  'game.title': '命運之境',
  'game.subtitle': '轉生後的異世界冒險',
  'title.tapToStart': '點擊開始',
  'title.version': '版本 {version}',
  'boot.loading': '載入中…',
  'auto.on': '自動',
  'auto.off': '手動',
  'auto.locked': '手動',
  'auto.badge': '自動',
  'auto.descOn': '自動施放：開（冷卻好、打得到就自己放）',
  'auto.descOff': '自動施放：關（要自己按）',
  'auto.descLocked': '這一招永遠手動：看準紅圈再按，才擋得到',
  'auto.tip': '攻擊技能會自己放了！你只管走位和閃避（MENU→技能樹可以改回手動）',
} as const;

export type MessageKey = keyof typeof zhTW;
