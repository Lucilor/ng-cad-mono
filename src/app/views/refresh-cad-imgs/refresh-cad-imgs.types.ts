import {WritableSignal} from "@angular/core";
import {CadCollection} from "@app/cad/collections";

export interface RefreshCadImgsQueryConfig {
  collections: WritableSignal<CadCollection[]>;
  queryLrsj: WritableSignal<boolean>;
}
export interface RefreshCadImgsRefreshConfig {
  step: WritableSignal<number>;
}

export interface CollecionQuery {
  collection: CadCollection;
  name: string;
  ids: string[];
}

export interface LrsjQuery {
  [key: string]: string;
}
