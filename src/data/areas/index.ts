// 所有可走區域（ExploreScene 依 id 載入）。
import type { AreaDef } from '../../core/explore/area';
import { GREYLAMP } from './greylamp';

export const AREAS: Record<string, AreaDef> = { greylamp: GREYLAMP };
