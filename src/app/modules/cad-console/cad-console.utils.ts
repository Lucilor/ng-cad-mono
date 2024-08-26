import {DomSanitizer} from "@angular/platform-browser";
import {getListStr} from "@modules/message/components/message/message.utils";
import hljs from "highlight.js";
import {v4} from "uuid";
import {Desc} from "./cad-command-types";

export const getContent = (domSanitizer: DomSanitizer, desc: Desc): string => {
  if (!desc) {
    return "";
  }
  if (typeof desc === "string") {
    return desc;
  }
  let content = desc.content;
  const sub = desc.sub?.map((v) => getContent(domSanitizer, v));
  if (sub) {
    content += "<br>" + getListStr(domSanitizer, sub);
  }
  return content;
};

export const getEmphasized = (str: string) => `<span style='color:deeppink'>${str}</span>`;

export const getBashStyle = (str: string) => `<code class="bash hljs">${hljs.highlight(str, {language: "bash"}).value}</code>`;

export const spaceReplacer = v4();
