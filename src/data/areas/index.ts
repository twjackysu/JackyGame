// 所有可走區域（ExploreScene 依 id 載入）。
import type { AreaDef } from '../../core/explore/area';
import { GREYLAMP } from './greylamp';
import { MISTWOOD } from './mistwood';
import { WOLFPATH } from './wolfpath';
import { MINECAMP } from './minecamp';
import { MINE } from './mine';
import { CAPITAL } from './capital';

export const AREAS: Record<string, AreaDef> = { greylamp: GREYLAMP, mistwood: MISTWOOD, wolfpath: WOLFPATH, minecamp: MINECAMP, mine: MINE, capital: CAPITAL };
