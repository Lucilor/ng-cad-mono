import {LurushujuIndexComponent} from "../lurushuju-index/lurushuju-index.component";
import {MenjiaoCadType, 算料数据} from "../xinghao-data";

export interface MenjiaoInput {
  data?: 算料数据;
  componentLrsj?: LurushujuIndexComponent;
  onSubmit?: (result: MenjiaoOutput) => void;
  isKailiao?: boolean;
  suanliaoDataName?: string;
  suanliaoTestName?: string;
  xinghaozhuanyongCadCount?: number;
}

export interface MenjiaoOutput {
  data: 算料数据;
}

export interface MenjiaoCadItemInfo {
  key1: MenjiaoCadType;
  key2: "配合框CAD" | "企料CAD";
  key3: string;
}

export interface MenjiaoShiyituCadItemInfo {
  key1: MenjiaoCadType;
  index: number;
}
