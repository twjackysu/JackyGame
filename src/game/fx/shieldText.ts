/**
 * 護盾架起來時頭上的「護盾 +N」（第 197 輪，D-396）。
 * 全自動之後護盾那一招每八秒左右自己放一次，那行字每次都冒在主角頭上——正好是貼上來的怪和牠們血條的位置。
 * 每次進地圖只說前幾次；之後護盾還是看得到：身上的罩子、往外擴的光環、頂端血條上的淺藍那一段。
 */
export const SHIELD_TEXT_TIMES = 3;

/** 這一次（從 0 算起的第 n 次架盾）要不要冒字 */
export function showShieldText(n: number, times = SHIELD_TEXT_TIMES): boolean {
  return n < times;
}
