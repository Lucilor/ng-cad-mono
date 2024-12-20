import {VarNameItem} from "@components/var-names/var-names.types";
import {Properties} from "csstype";
import {算料公式, 算料数据2} from "../../../../components/lurushuju/xinghao-data";

export interface SuanliaogongshiInfo {
  data: Partial<Pick<算料数据2, "算料公式" | "输入数据">>;
  varNameItem?: VarNameItem;
  isFromSelf?: boolean;
  justifyGongshi?: (item: 算料公式) => void;
  slgs?: {
    title?: string;
    titleStyle?: Properties;
  };
}

export interface SuanliaogongshiCloseEvent {
  submit: boolean;
}
