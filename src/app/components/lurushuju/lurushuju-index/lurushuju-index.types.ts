import {Properties} from "csstype";

export interface ToolbarBtn {
  name: string;
  color?: string;
  class?: string[];
  style?: Properties;
  hidden?: boolean;
  onClick?: () => void;
}
