import {DragAxis} from "@angular/cdk/drag-drop";

export interface ControlPoint {
  position: string;
  axis: DragAxis;
}

export interface Helpers {
  axisX: {show: boolean; threshold: number; snap?: {from: number; to: number; id: string}};
  axisY: {show: boolean; threshold: number; snap?: {from: number; to: number; id: string}};
  rotation: {
    show: boolean;
    threshold: number;
    snap?: {from: number; to: number};
    position: [number, number];
    deg: number;
    size: number;
  };
}
