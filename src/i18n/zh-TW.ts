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
  'auto.tip': '攻擊技能和大招會自己放了！你只管走位和閃避（MENU→技能樹可以改回手動）',
  'bless.title': '燼火祝福',
  'bless.sub': '選一個——這趟冒險都有效（回營火休息或倒下就消散）',
  'bless.have': '身上：',
  'bless.reroll': '換一批（剩 {n} 次）',
  'bless.noReroll': '這趟不能再換了',
  'bless.got': '祝福：{name}',
  'bless.gone': '燼火祝福消散了',
  'bless.restAsk': '休息會讓 {n} 個燼火祝福消散\n確定的話再點一次營火',
  'bless.tip': '燼火祝福：打怪累積右上角的火，滿了就能選一個；回營火休息或倒下會消散',
} as const;

export type MessageKey = keyof typeof zhTW;
