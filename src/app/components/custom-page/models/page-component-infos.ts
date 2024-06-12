import {imgEmpty} from "@app/app.common";
import {keysOf} from "@lucilor/utils";
import {PageComponentImage} from "./page-components/page-component-image";
import {PageComponentText} from "./page-components/page-component-text";

export interface PageComponentInfos {
  text: PageComponentInfo<typeof PageComponentText>;
  image: PageComponentInfo<typeof PageComponentImage>;
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
    resizable: {x: true, y: true, preserveRatio: true}
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
  preserveRatio?: boolean;
}
