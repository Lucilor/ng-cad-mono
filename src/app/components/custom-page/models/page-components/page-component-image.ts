import {Point} from "@lucilor/utils";
import {Property} from "csstype";
import {PageComponentBase} from "./page-component-base";

export class PageComponentImage extends PageComponentBase {
  readonly type = "image";
  src: string = "";
  objectFit: Property.ObjectFit = "contain";
  keepRatio = true;
  naturalSize = new Point(0, 0);
  get naturalRatio() {
    const {x, y} = this.naturalSize;
    if (!(x > 0 && y > 0)) {
      return 0;
    }
    return x / y;
  }

  import(data: ReturnType<typeof this.export>) {
    data = this._getImportData(data);
    super.import(data);
    this.src = data.src;
    this.objectFit = data.objectFit;
    this.keepRatio = data.keepRatio;
    this.naturalSize.copy(data.naturalSize);
  }
  export() {
    return {
      ...super.export(),
      src: this.src,
      objectFit: this.objectFit,
      keepRatio: this.keepRatio,
      naturalSize: this.naturalSize.toArray()
    };
  }

  fitToImageElement(img: HTMLImageElement, force = false) {
    const {naturalWidth, naturalHeight} = img;
    this.naturalSize.set(naturalWidth, naturalHeight);
    return this.fitSize(force);
  }
  fitSize(force = false) {
    const keepRatio = this.keepRatio || force;
    const result = {isChanged: false};
    if (!keepRatio) {
      return result;
    }
    if (!(this.size.x > 0)) {
      this.size.x = this.naturalSize.x;
    }
    if (!(this.size.y > 0)) {
      this.size.y = this.naturalSize.y;
    }
    const ratio = this.naturalRatio;
    const ratio2 = this.size.x / this.size.y;
    if (keepRatio && ratio !== ratio2) {
      if (ratio2 > ratio) {
        this.size.y = this.size.x / ratio;
      } else {
        this.size.x = this.size.y * ratio;
      }
      result.isChanged = true;
    }
    return result;
  }
}
