/** 繁體中文（預設語系）。新增字串時以此檔為準，其他語系可缺漏並回退到這裡。 */
export const zhTW = {
  'game.title': '命運之境',
  'game.subtitle': '轉生後的異世界冒險',
  'title.tapToStart': '點擊開始',
  'title.version': '版本 {version}',
  'boot.loading': '載入中…',
} as const;

export type MessageKey = keyof typeof zhTW;
