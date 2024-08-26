import {SpinnerConfig} from "@modules/spinner/services/spinner.service";
import {AxiosRequestConfig} from "axios";
import hljs from "highlight.js";

export interface CustomResponse<T> {
  code: number;
  msg?: string;
  data?: T;
  count?: number;
  importance?: number;
  duration?: number;
  title?: string;
}

export type DataEncrpty = "yes" | "no" | "both";

export interface HttpOptions extends AxiosRequestConfig {
  bypassCodes?: number[];
  silent?: boolean;
  encrypt?: DataEncrpty;
  offlineMode?: boolean;
  spinner?: string | boolean | {id?: string; config: SpinnerConfig};
}

export class HttpServiceResponseError extends Error {
  details: string;

  constructor(public response: CustomResponse<any>) {
    const {msg, data: responseData} = response;
    let message = "";
    let details = "";
    if (msg) {
      message = msg;
    } else if (responseData !== null && responseData !== undefined) {
      const dataJson = JSON.stringify(responseData, null, 2);
      message = dataJson;
      details = hljs.highlight(dataJson, {language: "json"}).value.replace(/\n/g, "<br>");
      details = `<pre class="hljs">${details}</pre>`;
    } else {
      message = "未知错误";
    }
    super(message);
    this.details = details;
  }
}
