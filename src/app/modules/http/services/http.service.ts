import {Injectable, Injector} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatSnackBar} from "@angular/material/snack-bar";
import {publicKey, timer} from "@app/app.common";
import {LoginFormData, openLoginFormDialog} from "@components/dialogs/login-form/login-form.component";
import {environment} from "@env";
import {downloadByBlob, isTypeOf, ObjectOf, RSA} from "@lucilor/utils";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import axios, {AxiosError, AxiosResponse} from "axios";
import {CustomResponse, HttpOptions, HttpServiceResponseError} from "./http.service.types";

@Injectable({
  providedIn: "root"
})
export class HttpService {
  protected dialog: MatDialog;
  protected message: MessageService;
  protected snackBar: MatSnackBar;
  protected spinner: SpinnerService;
  baseURL = "";
  strict = true;
  private _loginPromise: ReturnType<typeof openLoginFormDialog> | null = null;
  lastResponse: CustomResponse<any> | null = null;
  offlineMode = false;
  token = "";

  constructor(injector: Injector) {
    this.dialog = injector.get(MatDialog);
    this.message = injector.get(MessageService);
    this.snackBar = injector.get(MatSnackBar);
    this.spinner = injector.get(SpinnerService);
  }

  protected alert(msg: string, silent: boolean) {
    if (!silent) {
      this.message.alert(msg);
    }
  }

  protected snack(msg: string, silent: boolean) {
    if (!silent) {
      this.message.snack(msg);
    }
  }

  protected error(msg: string, silent: boolean, title = "网络请求错误") {
    if (!silent) {
      this.message.error({content: msg, title: `<span style="color:red">${title}</span>`});
    }
  }

  private async _waitForLogin(project?: LoginFormData["project"]) {
    if (!project) {
      project = {id: "", name: "未知"};
    }
    if (!this._loginPromise) {
      this._loginPromise = openLoginFormDialog(this.dialog, {
        data: {project, baseUrl: this.baseURL},
        autoFocus: true,
        hasBackdrop: true,
        disableClose: true
      });
    }
    await this._loginPromise;
    if (this._loginPromise) {
      this._loginPromise = null;
    }
  }

  getUrl(path: string, params?: ObjectOf<any>) {
    let url: URL;
    try {
      url = new URL(path, this.baseURL || location.origin);
    } catch {
      return path;
    }
    if (params) {
      for (const key in params) {
        url.searchParams.set(key, params[key]);
      }
    }
    return url.href;
  }

  async request<T>(url: string, method: "GET" | "POST", data?: ObjectOf<any>, options?: HttpOptions): Promise<CustomResponse<T> | null> {
    let offlineMode = this.offlineMode;
    if (typeof options?.offlineMode === "boolean") {
      offlineMode = options.offlineMode;
    }
    if ((offlineMode && !environment.production) || environment.unitTest) {
      return null;
    }
    const rawData = {...data};
    const encrypt = options?.encrypt ?? "no";
    const silent = !!options?.silent;
    const timerName = `http.request.${url}.${timer.now}`;
    timer.start(timerName);
    const rawUrl = url;
    const token = this.token;
    url = this.getUrl(url);
    let axiosResponse: AxiosResponse<CustomResponse<T>> | null = null;
    let response: CustomResponse<T> | null = null;
    let loaderId = options?.spinner;
    if (silent) {
      loaderId = false;
    } else {
      if (loaderId === true || loaderId === undefined) {
        loaderId = this.spinner.defaultLoaderId;
      }
    }
    if (loaderId) {
      if (typeof loaderId === "object") {
        this.spinner.show(loaderId.id || this.spinner.defaultLoaderId, loaderId.config);
      } else {
        this.spinner.show(loaderId);
      }
    } else {
      this.spinner.show(this.spinner.defaultLoaderId, {background: true});
    }
    try {
      if (method === "GET") {
        if (data) {
          if (encrypt !== "no") {
            url += `?data=${RSA.encrypt(data, publicKey)}`;
          } else {
            const queryArr: string[] = [];
            for (const key in data) {
              if (data[key] !== undefined) {
                queryArr.push(`${key}=${data[key]}`);
              }
            }
            if (token) {
              queryArr.push(token);
            }
            if (queryArr.length) {
              url += `?${queryArr.join("&")}`;
            }
          }
        }
        axiosResponse = await axios.get<CustomResponse<T>>(url, options);
      }
      if (method === "POST") {
        let files: {file: File; key: string}[] = [];
        for (const key in data) {
          const value = data[key];
          if (value instanceof FileList) {
            files = Array.from(value).map((file, i) => ({file, key: `${key}${i}`}));
            delete data[key];
          }
          if (value instanceof File) {
            files = [{file: value, key}];
            delete data[key];
          }
        }
        const formData = new FormData();
        if (encrypt === "yes") {
          formData.append("data", RSA.encrypt(data, publicKey));
        } else if (encrypt === "no") {
          if (typeof data === "string") {
            formData.append("data", data);
          } else if (data && typeof data === "object") {
            formData.append("data", JSON.stringify(data));
          }
        } else {
          for (const key in data) {
            formData.append(key, data[key]);
          }
        }
        files.forEach((v) => formData.append(v.key, v.file));
        if (token) {
          formData.append("token", token);
        }
        axiosResponse = await axios.post<CustomResponse<T>>(url, formData, options);
      }
      if (!axiosResponse) {
        throw new Error("请求错误");
      }
      response = axiosResponse.data;
      if (axiosResponse.status === 200 && axiosResponse.config.responseType === "blob") {
        const match = axiosResponse.headers["content-disposition"]?.match(/filename=([^;]*);?/);
        let filename = "";
        if (match) {
          filename = decodeURIComponent(match[1]);
          filename = filename.replace(/"/g, "");
        }
        downloadByBlob(response as any as Blob, {filename});
        return null;
      }
      if (!isTypeOf(response, "object")) {
        const msg = typeof response === "string" ? response : JSON.stringify(response);
        this.message.alert(msg, {width: "85%"});
        response = null;
        return null;
      }
      if (this.strict) {
        const code = response.code;
        const bypassCodes = options?.bypassCodes ?? [];
        if (code === 0 || bypassCodes.includes(code)) {
          if (typeof response.msg === "string" && response.msg) {
            if (response.msg.match(/\n|<br>/)) {
              this.alert(response.msg, silent);
            } else {
              this.snack(response.msg, silent);
            }
          }
          return response;
        } else if (code === 2) {
          if (typeof response.msg === "string" && response.msg) {
            const data2 = response.data as any;
            let msg = response.msg;
            if (typeof data2?.name === "string") {
              msg += "<br>" + data2.name;
            }
            this.alert(msg, silent);
          }
          return null;
        } else if (code === -2) {
          await this._waitForLogin((response.data as any)?.project);
          return this.request(url, method, rawData, options);
        } else if (code === -20) {
          try {
            (parent.window as any).vueFuns.logout();
          } catch (error) {
            console.warn(error);
          }
          return null;
        } else {
          throw new HttpServiceResponseError(response);
        }
      } else {
        return response;
      }
    } catch (error) {
      let content = "";
      let errorData: any;
      if (error instanceof AxiosError && error.response) {
        const {data: errData, status, statusText} = error.response;
        if (typeof errData === "string") {
          content = errData;
        } else if (errData instanceof Blob) {
          content = await errData.text();
        } else {
          content = "未知网络错误";
        }
        if (content.includes("没有权限")) {
          await this._waitForLogin();
          return this.request(url, method, rawData, options);
        }
        content = `<span>${status} (${statusText})</span><br>${content}`;
      } else if (error instanceof HttpServiceResponseError) {
        errorData = error.response.data;
        content = error.details || error.message;
      } else if (error instanceof Error) {
        content = error.message;
      }
      console.error(error);
      if (errorData) {
        console.error(errorData);
      }
      this.error(content, silent, response?.title);
      return response;
    } finally {
      if (loaderId) {
        if (typeof loaderId === "object") {
          this.spinner.hide(loaderId.id || this.spinner.defaultLoaderId);
        } else {
          this.spinner.hide(loaderId);
        }
      } else {
        this.spinner.hide(this.spinner.defaultLoaderId);
      }
      this.lastResponse = response;
      if (response) {
        response.duration = timer.getDuration(timerName);
      }
      timer.end(timerName, `${method} ${rawUrl}`);
    }
  }

  async get<T>(url: string, data?: ObjectOf<any>, options?: HttpOptions) {
    return await this.request<T>(url, "GET", data, options);
  }

  async post<T>(url: string, data?: ObjectOf<any>, options?: HttpOptions) {
    return await this.request<T>(url, "POST", data, options);
  }

  isSuccessfulResponse(response: CustomResponse<any> | null, options?: HttpOptions): response is CustomResponse<any> {
    if (!response) {
      return false;
    }
    const bypassCodes = options?.bypassCodes ?? [];
    return response.code === 0 || bypassCodes.includes(response.code);
  }

  async getData<T>(url: string, data?: ObjectOf<any>, options?: HttpOptions) {
    const response = await this.post<T>(url, data, options);
    if (!this.isSuccessfulResponse(response, options)) {
      return null;
    }
    let data2: T | undefined | null = response.data;
    if (data2 === undefined) {
      data2 = null;
    }
    return data2;
  }

  async getDataAndCount<T>(url: string, data?: ObjectOf<any>, options?: HttpOptions) {
    const response = await this.post<T>(url, data, options);
    if (!this.isSuccessfulResponse(response, options)) {
      return null;
    }
    let data2: T | undefined | null = response.data;
    if (data2 === undefined) {
      data2 = null;
    }
    return {data: data2, count: response.count || 0};
  }
}
