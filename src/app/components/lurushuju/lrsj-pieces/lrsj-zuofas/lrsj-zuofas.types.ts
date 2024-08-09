import {Point} from "@angular/cdk/drag-drop";
import {WritableSignal} from "@angular/core";
import {工艺做法} from "../../xinghao-data";

export interface ZuofaInfo {
  fenleiName: string;
  zuofa: 工艺做法;
  position: WritableSignal<Readonly<Point>>;
}
