import {Angle, Point} from "@lucilor/utils";
import {DataType, Properties, Property} from "csstype";
import {cloneDeep} from "lodash";
import {v4} from "uuid";
import {pageComponentInfos, PageComponentType} from "../page-component-infos";

export abstract class PageComponentBase {
  abstract readonly type: string;
  id = v4();
  size = new Point(0, 0);
  position = new Point(0, 0);
  scale = new Point(1, 1);
  anchor = new Point(0, 0);
  rotation = new Angle(0, "deg");
  background: Property.Background = "transparent";
  color: DataType.Color = "black";
  borderStyle: DataType.LineStyle = "none";
  borderColor: DataType.Color = "black";
  borderWidth: number = 0;
  borderShow: [boolean, boolean, boolean, boolean] = [true, true, true, true];

  protected _locked = false;
  protected _hidden = false;
  styleOverrides: Properties = {};

  constructor(public name: string) {}

  protected _getImportData<T>(data: T): T {
    return {...this.export(), ...data};
  }
  import(data: ReturnType<typeof this.export>) {
    if (data.type !== this.type) {
      throw new Error(`Invalid component type: ${data.type}, expected: ${this.type}`);
    }
    this.id = data.id;
    this.name = data.name;
    this.size.copy(data.size);
    this.position.copy(data.position);
    this.scale.copy(data.scale);
    this.anchor.copy(data.anchor);
    this.rotation.deg = data.rotation;
    this.background = data.background;
    this.color = data.color;
    this.borderStyle = data.borderStyle;
    this.borderColor = data.borderColor;
    this.borderWidth = data.borderWidth;
    this.borderShow = cloneDeep(data.borderShow);
    this.styleOverrides = cloneDeep(data.styleOverrides);
    this._locked = data.locked;
    this._hidden = data.hidden;
  }
  export() {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      size: this.size.toArray(),
      position: this.position.toArray(),
      scale: this.scale.toArray(),
      anchor: this.anchor.toArray(),
      rotation: this.rotation.deg,
      background: this.background,
      color: this.color,
      borderStyle: this.borderStyle,
      borderColor: this.borderColor,
      borderWidth: this.borderWidth,
      borderShow: cloneDeep(this.borderShow),
      styleOverrides: cloneDeep(this.styleOverrides),
      locked: this._locked,
      hidden: this._hidden
    };
  }
  clone(resetId?: boolean): this {
    const component = new (this.constructor as any)(this.name);
    const data = this.export();
    if (resetId) {
      data.id = component.id;
    }
    component.import(data);
    return component;
  }

  getStyle(): Properties {
    let rotation = "";
    if (this.rotation.unit === "deg") {
      rotation = `${this.rotation.deg}deg`;
    } else if (this.rotation.unit === "rad") {
      rotation = `${this.rotation.rad}rad`;
    }
    const {x: scaleX, y: scaleY} = this.scale;
    const {x: anchorX, y: anchorY} = this.anchor;
    const {resizable} = pageComponentInfos[this.type as PageComponentType] || {};
    const useWidth = resizable.x || resizable.xLocked;
    const useHeight = resizable.y || resizable.yLocked;
    return {
      width: useWidth ? `${this.size.x}px` : "auto",
      height: useHeight ? `${this.size.y}px` : "auto",
      left: `${this.position.x}px`,
      top: `${this.position.y}px`,
      transform: `translate(-${anchorX * 100}%, -${anchorY * 100}%) scale(${scaleX},${scaleY}) rotate(${rotation})`,
      transformOrigin: "center center",
      background: this.background,
      color: this.color,
      borderTopStyle: this.borderShow[0] ? this.borderStyle : "none",
      borderRightStyle: this.borderShow[1] ? this.borderStyle : "none",
      borderBottomStyle: this.borderShow[2] ? this.borderStyle : "none",
      borderLeftStyle: this.borderShow[3] ? this.borderStyle : "none",
      borderColor: this.borderColor,
      borderWidth: `${Math.max(this.borderWidth, 0)}px`,
      display: this._hidden ? "none" : "block",
      boxSizing: "border-box",
      "--border-style": this.borderStyle,
      "--border-color": this.borderColor,
      "--border-width": `${this.borderWidth}px`,
      "--border": `${this.borderWidth}px ${this.borderStyle} ${this.borderColor}`,
      ...this.styleOverrides
    };
  }

  isLocked() {
    return this._locked;
  }
  lock() {
    this._locked = true;
  }
  unlock() {
    this._locked = false;
  }
  toggleLock() {
    this._locked = !this._locked;
  }

  isHidden() {
    return this._hidden;
  }
  hide() {
    this._hidden = true;
  }
  show() {
    this._hidden = false;
  }
  toggleHidden() {
    this._hidden = !this._hidden;
  }
}
