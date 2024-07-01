import {Property} from "csstype";
import {PageComponentBase} from "./page-component-base";

export class PageComponentText extends PageComponentBase {
  readonly type = "text";
  text = "";
  fontSize: number = 16;
  fontFamily: Property.FontFamily = "";

  import(data: ReturnType<typeof this.export>) {
    data = this._getImportData(data);
    super.import(data);
    this.text = data.text;
    this.fontSize = data.fontSize;
    this.fontFamily = data.fontFamily;
  }
  export() {
    return {
      ...super.export(),
      text: this.text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily
    };
  }

  getStyle() {
    const style = super.getStyle();
    style.fontSize = `${this.fontSize}px`;
    style.fontFamily = this.fontFamily;
    return style;
  }
}
