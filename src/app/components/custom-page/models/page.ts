import {isTypeOf, Point} from "@lucilor/utils";
import Color from "color";
import {Properties, Property} from "csstype";
import {cloneDeep} from "lodash";
import {PageOrientation} from "pdfmake/interfaces";
import {v4} from "uuid";
import {pageComponentInfos, PageComponentType, PageComponentTypeAny} from "./page-component-infos";
import {PageSizeName, PageSizeNameCustom, pageSizes} from "./page-size";
import {Trbl} from "./page.utils";

export class Page {
  id = v4();
  size = new Point(pageSizes.A4.slice());
  sizeName: PageSizeNameCustom = "A4";
  orientation: PageOrientation = "portrait";
  backgroundInner: Property.Background = "white";
  backgroundOuter: Property.Background = "white";
  scale = new Point(1, 1);
  padding: Trbl = [0, 0, 0, 0];

  styleOverrides: Properties = {};
  workSpaceStyle: Properties = {};
  components: PageComponentTypeAny[] = [];

  constructor() {}

  import(data: ReturnType<typeof this.export>) {
    data = {...this.export(), ...data};
    this.id = data.id;
    if (data.sizeName === "自定义") {
      this.setSize({width: data.size[0], height: data.size[1]});
    } else {
      this.setSize({name: data.sizeName, orientation: data.orientation});
    }
    this.backgroundInner = data.backgroundInner;
    this.backgroundOuter = data.backgroundOuter;
    this.scale.copy(data.scale);
    this.padding = data.padding;
    this.styleOverrides = data.styleOverrides;
    this.workSpaceStyle = data.workSpaceStyle;
    this.components = [];
    for (const component of data.components) {
      const type = component.type as PageComponentType;
      if (!(type in pageComponentInfos)) {
        console.warn(`Unknown component type: ${type}`);
        continue;
      }
      const componentInstance = new pageComponentInfos[type].class(component.name);
      componentInstance.import(component as any);
      this.components.push(componentInstance);
    }
  }
  export() {
    return {
      id: this.id,
      size: this.size.toArray(),
      sizeName: this.sizeName,
      orientation: this.orientation,
      backgroundInner: this.backgroundInner,
      backgroundOuter: this.backgroundOuter,
      scale: this.scale.toArray(),
      padding: this.padding,
      styleOverrides: this.styleOverrides,
      workSpaceStyle: this.workSpaceStyle,
      components: this.components.map((v) => v.export())
    };
  }
  clone(resetId?: boolean) {
    const page = new Page();
    const data = this.export();
    if (resetId) {
      data.id = page.id;
    }
    page.import(data);
    return page;
  }

  getConfig(): PageConfig {
    return {
      sizeName: this.sizeName,
      orientation: this.orientation,
      width: this.size.x,
      height: this.size.y,
      backgroundInnerColor: Color(this.backgroundInner),
      backgroundOuterColor: Color(this.backgroundOuter),
      workSpaceBgColor: Color(this.workSpaceStyle.backgroundColor),
      padding: this.padding
    };
  }
  setConfig(config: PageConfig) {
    if (config.sizeName === "自定义") {
      this.setSize({width: config.width, height: config.height});
    } else {
      this.setSize({name: config.sizeName, orientation: config.orientation});
    }
    this.backgroundInner = config.backgroundInnerColor.toString();
    this.backgroundOuter = config.backgroundOuterColor.toString();
    this.workSpaceStyle.backgroundColor = config.workSpaceBgColor.toString();
    this.padding = cloneDeep(config.padding);
  }

  setSize(params: {name: PageSizeName; orientation?: PageOrientation} | {width: number; height: number}) {
    if ("name" in params) {
      const {name, orientation} = params;
      if (!(name in pageSizes)) {
        throw new Error(`Unknown page size: ${name}`);
      }
      this.sizeName = name;
      this.orientation = orientation || "portrait";
      if (this.orientation === "portrait") {
        this.size.set(...(pageSizes[name].slice() as [number, number]));
      } else {
        this.size.set(...(pageSizes[name].slice().reverse() as [number, number]));
      }
    } else {
      const {width, height} = params;
      if (!isTypeOf(width, "number")) {
        throw new Error(`Invalid width: ${width}`);
      }
      if (!isTypeOf(height, "number")) {
        throw new Error(`Invalid height: ${height}`);
      }
      this.sizeName = "自定义";
      this.size.set(width, height);
    }
  }

  getStyle(): Properties {
    const {x: width, y: height} = this.size.multiply(this.scale);
    return {
      width: `${width}mm`,
      height: `${height}mm`,
      background: this.backgroundOuter,
      "--background-inner": this.backgroundInner,
      padding: this.padding.map((v) => `${v}mm`).join(" "),
      boxSizing: "border-box",
      ...this.styleOverrides
    };
  }

  fitToSize(width: number, height: number) {
    const {x: w, y: h} = this.size;
    const scale = Math.min(width / w, height / h);
    this.scale.set(scale, scale);
  }
}

export interface PageConfig {
  sizeName: Page["sizeName"];
  orientation: Page["orientation"];
  width: number;
  height: number;
  backgroundInnerColor: Color;
  backgroundOuterColor: Color;
  workSpaceBgColor: Color;
  padding: Page["padding"];
}
