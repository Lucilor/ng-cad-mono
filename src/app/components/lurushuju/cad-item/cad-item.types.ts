import {MaybePromise} from "@lucilor/utils";
import {CadFormValidators} from "@modules/cad-editor/components/menu/cad-info/cad-info.utils";
import {CadItemComponent} from "./cad-item.component";

export interface CadItemButton<T> {
  name: string;
  onClick: (component: CadItemComponent<T>) => void;
}

export const typeOptions = ["按开料模板公式展开", "自动展开+模板", "双向自动展开+模板"] as const;

export interface CadItemSelectable<T> {
  selected: boolean | undefined;
  onChange: (component: CadItemComponent<T>) => void;
}

export interface CadItemIsOnlineInfo<T> {
  isFetched?: boolean;
  afterFetch?: (component: CadItemComponent<T>) => void;
}

export interface CadItemValidators extends CadFormValidators {
  zhankai?: boolean;
}

export interface CadItemFormExtraText {
  key: string;
  value?: string;
}
export interface CadItemForm<T> {
  noDefaultTexts?: boolean;
  extraTexts?: CadItemFormExtraText[];
  onEdit?: (component: CadItemComponent<T>) => MaybePromise<void>;
}
