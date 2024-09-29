import {模块大小配置} from "@components/msbj-rects/msbj-rects.types";
import {XhmrmsbjInfoMokuaiNode} from "@views/xhmrmsbj/xhmrmsbj.types";

export interface MkdxpzEditorData {
  dxpz?: 模块大小配置;
  nodes?: XhmrmsbjInfoMokuaiNode[];
}

export interface MkdxpzEditorCloseEvent {
  data: MkdxpzEditorData | null;
}
