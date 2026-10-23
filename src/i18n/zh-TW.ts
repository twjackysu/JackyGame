/** 繁體中文（預設語系）。新增字串時以此檔為準，其他語系可缺漏並回退到這裡。 */
export const zhTW = {
  'game.title': '星燼回響',
  'game.subtitle': 'Echoes of Starfall',
  'title.tapToStart': '點擊開始',
  'title.version': '版本 {version}',
  'boot.loading': '載入中…',
} as const;

export type MessageKey = keyof typeof zhTW;
