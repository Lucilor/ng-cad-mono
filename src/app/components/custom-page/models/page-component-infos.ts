import {imgEmpty} from "@app/app.common";
import {keysOf} from "@lucilor/utils";
import {PageComponentForm} from "./page-components/page-component-form";
import {PageComponentGroup} from "./page-components/page-component-group";
import {PageComponentImage} from "./page-components/page-component-image";
import {PageComponentText} from "./page-components/page-component-text";

export interface PageComponentInfos {
  text: PageComponentInfo<typeof PageComponentText>;
  image: PageComponentInfo<typeof PageComponentImage>;
  form: PageComponentInfo<typeof PageComponentForm>;
  group: PageComponentInfo<typeof PageComponentGroup>;
}
export const pageComponentInfos: PageComponentInfos = {
  text: {
    name: "文字",
    description: "这是文字组件",
    previewImg: imgEmpty,
    class: PageComponentText,
    resizable: {x: true}
  },
  image: {
    name: "图片",
    description: "这是图片组件",
    previewImg: imgEmpty,
    class: PageComponentImage,
    resizable: {x: true, y: true}
  },
  form: {
    name: "表格",
    description: "这是表格组件",
    previewImg: imgEmpty,
    class: PageComponentForm,
    resizable: {}
  },
  group: {
    name: "分组",
    description: "这是分组组件",
    previewImg: imgEmpty,
    class: PageComponentGroup,
    resizable: {xLocked: true, yLocked: true}
  }
};
export const pageComponentTypes = keysOf(pageComponentInfos);
export type PageComponentType = keyof PageComponentInfos;
export type PageComponentTypeAny = InstanceType<PageComponentInfos[PageComponentType]["class"]>;

export interface PageComponentInfo<T> {
  name: string;
  description: string;
  previewImg: string;
  class: T;
  resizable: PageComponentResizable;
  conditions?: string[];
}

export interface PageComponentResizable {
  x?: boolean;
  y?: boolean;
  xLocked?: boolean;
  yLocked?: boolean;
}
