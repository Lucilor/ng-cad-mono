import {Property} from "csstype";
import {cloneDeep} from "lodash";
import {Trbl} from "../page.utils";
import {PageComponentBase} from "./page-component-base";

export class PageComponentForm extends PageComponentBase {
  readonly type = "form";
  private _rows = 0;
  get rows() {
    return this._rows;
  }
  set rows(value) {
    this._rows = value;
    this._updateValues();
  }
  private _cols = 0;
  get cols() {
    return this._cols;
  }
  set cols(value) {
    this._cols = value;
    this._updateValues();
  }
  rowHeight = 0;
  labelWidth = 0;
  valueWidth = 0;
  values: string[][][] = [];
  labelSeparator = true;
  labelWrap = false;
  valueWrap = false;
  labelPadding: Trbl = [0, 0, 0, 0];
  valuePadding: Trbl = [0, 0, 0, 0];
  fontSize: number = 16;
  fontFamily: Property.FontFamily = "";

  import(data: ReturnType<typeof this.export>) {
    data = this._getImportData(data);
    super.import(data);
    this.rows = data.rows;
    this.cols = data.cols;
    this.rowHeight = data.rowHeight;
    this.labelWidth = data.labelWidth;
    this.valueWidth = data.valueWidth;
    this.values = cloneDeep(data.values);
    this.labelSeparator = data.labelSeparator;
    this.labelWrap = data.labelWrap;
    this.valueWrap = data.valueWrap;
    this.labelPadding = cloneDeep(data.labelPadding);
    this.valuePadding = cloneDeep(data.valuePadding);
    this.fontSize = data.fontSize;
    this.fontFamily = data.fontFamily;
  }
  export() {
    return {
      ...super.export(),
      rows: this.rows,
      cols: this.cols,
      rowHeight: this.rowHeight,
      labelWidth: this.labelWidth,
      valueWidth: this.valueWidth,
      values: cloneDeep(this.values),
      labelSeparator: this.labelSeparator,
      labelWrap: this.labelWrap,
      valueWrap: this.valueWrap,
      labelPadding: cloneDeep(this.labelPadding),
      valuePadding: cloneDeep(this.valuePadding),
      fontSize: this.fontSize,
      fontFamily: this.fontFamily
    };
  }

  getStyle() {
    const style = super.getStyle();
    style["--row-height"] = `${this.rowHeight}px`;
    style["--label-width"] = `${this.labelWidth}px`;
    style["--value-width"] = `${this.valueWidth}px`;
    style["--label-padding"] = this.labelPadding.join("px ") + "px";
    style["--value-padding"] = this.valuePadding.join("px ") + "px";
    style.fontSize = `${this.fontSize}px`;
    style.fontFamily = this.fontFamily;
    return style;
  }

  private _updateValues() {
    const {rows, cols, values} = this;
    if (values.length !== rows) {
      values.length = rows;
    }
    for (let i = 0; i < rows; i++) {
      if (!values[i]) {
        values[i] = [];
      }
      if (values[i].length !== cols) {
        values[i].length = cols;
      }
      for (let j = 0; j < cols; j++) {
        if (!values[i][j]) {
          values[i][j] = ["", ""];
        }
      }
    }
  }
}
