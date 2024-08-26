import {Property} from "csstype";
import {PageComponentBase} from "./page-component-base";

export abstract class PageComponentTextBase extends PageComponentBase {
  text = "";
  fontSize: number = 16;
  fontFamily: Property.FontFamily = "";
  textAlign: Property.TextAlign = "left";

  import(data: ReturnType<typeof this.export>) {
    data = this._getImportData(data);
    super.import(data);
    this.text = data.text;
    this.fontSize = data.fontSize;
    this.fontFamily = data.fontFamily;
    this.textAlign = data.textAlign;
  }
  export() {
    return {
      ...super.export(),
      text: this.text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      textAlign: this.textAlign
    };
  }

  getStyle() {
    const style = super.getStyle();
    style.fontSize = `${this.fontSize}px`;
    style.fontFamily = this.fontFamily;
    style.textAlign = this.textAlign;
    return style;
  }
}
