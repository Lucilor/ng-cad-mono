import {Injectable} from "@angular/core";
import {MatDialog, MatDialogConfig, MatDialogRef} from "@angular/material/dialog";
import {MatSnackBar, MatSnackBarConfig} from "@angular/material/snack-bar";
import {DomSanitizer} from "@angular/platform-browser";
import {ObjectOf, timeout} from "@lucilor/utils";
import {InputInfo} from "@modules/input/components/input.types";
import {BehaviorSubject, lastValueFrom} from "rxjs";
import {MessageComponent} from "../components/message/message.component";
import {
  AlertMessageData,
  BookMessageData,
  ButtonMessageData,
  ConfirmMessageData,
  EditorMessageData,
  FormMessageData,
  IFrameMessageData,
  JsonMessageData,
  MessageData,
  MessageDataMap,
  MessageOutput
} from "../components/message/message.types";
import {getListEl} from "../components/message/message.utils";

export type MessageDataParams<T> = Omit<T, "type">;
export type MessageDataParams2<T> = Omit<MatDialogConfig<T>, "data">;

@Injectable({
  providedIn: "root"
})
export class MessageService {
  openedDialogs: MatDialogRef<MessageComponent, MessageOutput>[] = [];
  open$ = new BehaviorSubject<MatDialogConfig<MessageData>>({});
  close$ = new BehaviorSubject<MessageOutput>(null);
  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private domSanitizer: DomSanitizer
  ) {}

  async open(config: MatDialogConfig<MessageData>) {
    config = {width: "50%", ...config};
    const data = config.data;
    if (data?.disableCancel || config.disableClose === undefined) {
      config.disableClose = true;
    }
    const ref = this.dialog.open<MessageComponent, MessageData, MessageOutput>(MessageComponent, config);
    this.openedDialogs.push(ref);
    this.open$.next(config);
    const result = await lastValueFrom(ref.afterClosed());
    this.openedDialogs = this.openedDialogs.filter((dialog) => dialog.id !== ref.id);
    this.close$.next(result);
    return result;
  }

  private _getData<T extends MessageData, K extends MessageData["type"]>(data: string | MessageDataParams<T>, type: K): MessageDataMap[K] {
    if (typeof data === "string") {
      data = {content: data} as MessageDataParams<T>;
    }
    if (type === "alert") {
      const {details} = data as MessageDataParams<AlertMessageData>;
      if (Array.isArray(details) && details.length > 0) {
        const el = getListEl(this.domSanitizer, details, data.content);
        data.content = el;
      } else if (details) {
        data.content = `${data.content}<br>${details}`;
      }
    }
    return {...data, type} as MessageData as MessageDataMap[K];
  }

  async alert(data: string | MessageDataParams<AlertMessageData>, others: MessageDataParams2<AlertMessageData> = {}) {
    return await this.open({data: this._getData(data, "alert"), ...others});
  }

  async error(message: string | MessageDataParams<AlertMessageData>, others: MessageDataParams2<AlertMessageData> = {}) {
    const data = this._getData(message, "alert");
    if (!data.title) {
      data.title = `<span style="color:red">错误</span>`;
    }
    return await this.open({data, width: "80vw", ...others});
  }

  async confirm(data: string | MessageDataParams<ConfirmMessageData>, others: MessageDataParams2<ConfirmMessageData> = {}) {
    return !!(await this.open({data: this._getData(data, "confirm"), ...others}));
  }

  async newTabConfirm(data?: string | MessageDataParams<ConfirmMessageData>, others: MessageDataParams2<ConfirmMessageData> = {}) {
    await timeout(100);
    if (!data) {
      data = "是否修改了数据？";
    }
    if (typeof data === "string") {
      data = {content: data} as MessageDataParams<ConfirmMessageData>;
    }
    data.btnTexts = {submit: "修改了", cancel: "没有修改"};
    return await this.confirm(data, others);
  }

  async form<T = any, K = ObjectOf<any>>(
    form: InputInfo<T>[],
    data?: Omit<MessageDataParams<FormMessageData>, "form">,
    others: MessageDataParams2<FormMessageData> = {}
  ) {
    const data2: MessageDataParams<FormMessageData> = {...data, form};
    const result = await this.open({data: this._getData(data2, "form"), ...others});
    if (result && typeof result === "object") {
      return result as K;
    }
    return null;
  }

  async prompt<T = any, K = any>(
    info: InputInfo<T>,
    data?: Omit<MessageDataParams<FormMessageData>, "form">,
    others: MessageDataParams2<FormMessageData> = {}
  ) {
    const result = await this.form([info], data, others);
    if (result && typeof result === "object") {
      return Object.values(result)[0] as K;
    }
    return null;
  }

  async book(data: string | MessageDataParams<BookMessageData>, others: MessageDataParams2<BookMessageData> = {}) {
    await this.open({data: this._getData(data, "book"), width: "80vw", ...others});
  }

  async editor(data: string | MessageDataParams<EditorMessageData>, others: MessageDataParams2<EditorMessageData> = {}) {
    return String(await this.open({data: this._getData(data, "editor"), width: "80vw", ...others}));
  }

  async button(data: string | MessageDataParams<ButtonMessageData>, others: MessageDataParams2<ButtonMessageData> = {}) {
    return String(await this.open({data: this._getData(data, "button"), ...others}));
  }

  async iframe(data: string | MessageDataParams<IFrameMessageData>, others: MessageDataParams2<IFrameMessageData> = {}) {
    return String(await this.open({data: this._getData(data, "iframe"), width: "100vw", height: "100vh", ...others}));
  }

  async json(json: any, data: Omit<MessageDataParams<JsonMessageData>, "json"> = {}, others: MessageDataParams2<JsonMessageData> = {}) {
    const data2 = {...data, content: "", json};
    return (await this.open({data: this._getData(data2, "json"), width: "80vw", height: "80vh", ...others})) as any;
  }

  async snack(message: string, action?: string, config?: MatSnackBarConfig) {
    const snackBarRef = this.snackBar.open(message, action, config);
    try {
      await lastValueFrom(snackBarRef.onAction());
    } catch {}
    if (!action) {
      snackBarRef.dismiss();
    }
  }

  async copyText(text: string, config?: {successText?: string; errorText?: string}) {
    const {successText = "已复制", errorText = "复制失败"} = config || {};
    try {
      navigator.clipboard.writeText(text);
      this.snack(successText);
    } catch (e) {
      console.error(e);
      this.snack(errorText);
    }
  }
}
