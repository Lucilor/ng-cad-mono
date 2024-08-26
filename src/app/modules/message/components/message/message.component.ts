import {A11yModule} from "@angular/cdk/a11y";
import {NgTemplateOutlet} from "@angular/common";
import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {DomSanitizer, SafeHtml, SafeResourceUrl} from "@angular/platform-browser";
import {Debounce} from "@decorators/debounce";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {clamp, cloneDeep, isEmpty} from "lodash";
import {QuillEditorComponent, QuillViewComponent} from "ngx-quill";
import {NgScrollbarModule} from "ngx-scrollbar";
import {JSONContent, JSONEditor, Mode} from "vanilla-jsoneditor";
import {ButtonMessageData, MessageData, MessageDataMap, MessageOutput} from "./message.types";
import {validateForm} from "./message.utils";

@Component({
  selector: "app-message",
  templateUrl: "./message.component.html",
  styleUrls: ["./message.component.scss"],
  standalone: true,
  imports: [
    A11yModule,
    FormsModule,
    forwardRef(() => InputComponent),
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatIconModule,
    NgScrollbarModule,
    NgTemplateOutlet,
    QuillEditorComponent
  ]
})
export class MessageComponent implements OnInit, AfterViewInit, OnDestroy {
  titleHTML: SafeHtml = "";
  subTitleHTML: SafeHtml = "";
  contentHTML: SafeHtml = "";
  iframeSrc: SafeResourceUrl = "";
  page = 0;
  inputsBackup: InputInfo[] = [];
  jsonEditor: JSONEditor | null = null;
  @ViewChild(QuillEditorComponent) editor?: QuillViewComponent;
  @ViewChild("iframe") iframe?: ElementRef<HTMLIFrameElement>;
  @ViewChildren("formInput") formInputs?: QueryList<InputComponent>;
  @ViewChild("jsonEditorContainer") jsonEditorContainer?: ElementRef<HTMLDivElement>;

  private get _editorToolbarHeight() {
    if (this.editor) {
      const el = this.editor.elementRef.nativeElement as HTMLElement;
      const toolbar = el.querySelector(".ql-toolbar");
      if (toolbar) {
        return toolbar.getBoundingClientRect().height;
      }
    }
    return 0;
  }

  get buttons() {
    if (this.data.type === "button") {
      return this.data.buttons;
    }
    return [];
  }

  get minPage() {
    return 0;
  }
  get maxPage() {
    if (this.data.type === "book") {
      return this.data.bookData.length - 1;
    }
    return 0;
  }

  get titleClass() {
    return this.data.titleClass || "";
  }
  get contentClass() {
    return this.data.contentClass || "";
  }

  constructor(
    public dialogRef: MatDialogRef<MessageComponent, MessageOutput>,
    private sanitizer: DomSanitizer,
    private message: MessageService,
    @Inject(MAT_DIALOG_DATA) public data: MessageData
  ) {}

  ngOnInit() {
    const data = this.data;
    if (data.title) {
      this.titleHTML = this.sanitizer.bypassSecurityTrustHtml(data.title);
    } else {
      this.titleHTML = "";
    }
    if (data.content === null || data.content === undefined) {
      data.content = "";
    } else if (data.content instanceof HTMLElement) {
      data.content = data.content.outerHTML;
    } else if (typeof data.content !== "string") {
      try {
        data.content = JSON.stringify(data.content);
      } catch (error) {
        console.warn(error);
      }
    }
    this.contentHTML = this.sanitizer.bypassSecurityTrustHtml(data.content);

    if (data.type === "form") {
      if (data.form.length > 0 && !data.form.some((v) => v.autoFocus)) {
        data.form[0].autoFocus = true;
      }
    } else if (data.type === "book") {
      this.setPage(0);
    } else if (data.type === "iframe") {
      this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(data.content);
    }

    const id = window.setInterval(() => {
      if (this.resizeEditor()) {
        window.clearInterval(id);
      }
    }, 600);

    if (data.type === "form") {
      this.inputsBackup = cloneDeep(data.form);
    }
  }

  ngAfterViewInit() {
    const {jsonEditorContainer, data} = this;
    if (jsonEditorContainer && data.type === "json") {
      this.jsonEditor = new JSONEditor({
        target: jsonEditorContainer.nativeElement,
        props: {mode: Mode.tree, ...data.options}
      });
      this.jsonEditor.set({json: data.json});
    }
  }

  ngOnDestroy() {
    if (this.jsonEditor) {
      this.jsonEditor.destroy();
      this.jsonEditor = null;
    }
  }

  @HostListener("window:resize")
  @Debounce(500)
  resizeEditor() {
    if (this.editor) {
      const el = this.editor.editorElem;
      const height = this._editorToolbarHeight;
      if (height) {
        el.style.height = `calc(100% - ${height}px)`;
        return true;
      }
    }
    return false;
  }

  async submit(button?: ButtonMessageData["buttons"][number]) {
    const type = this.data.type;
    if (type === "confirm") {
      this.dialogRef.close(true);
    } else if (type === "form") {
      const {errors, values, errorMsg} = await validateForm(this.formInputs?.toArray() || []);
      if (isEmpty(errors)) {
        this.dialogRef.close(values);
      } else {
        this.message.error(errorMsg);
      }
    } else if (type === "editor") {
      this.dialogRef.close(this.data.content);
    } else if (type === "button" && button) {
      this.dialogRef.close(typeof button === "string" ? button : button.value);
    } else if (type === "json" && this.jsonEditor) {
      const editor = this.jsonEditor;
      const errors = editor.validate();
      if (errors) {
        this.message.error("数据格式错误，请改正后再确定");
      } else {
        const result = editor.get();
        const isJSONContent = (v: any): v is JSONContent => v.json;
        if (isJSONContent(result)) {
          this.dialogRef.close(result.json as any);
        } else {
          this.dialogRef.close(JSON.parse(result.text));
        }
      }
    } else {
      this.dialogRef.close(null);
    }
  }

  cancel() {
    const type = this.data.type;
    if (type === "confirm") {
      this.dialogRef.close(false);
    } else if (type === "button") {
      this.dialogRef.close(this.data.btnTexts?.cancel);
    } else {
      this.dialogRef.close();
    }
  }

  reset() {
    switch (this.data.type) {
      case "form":
        this.data.form = cloneDeep(this.inputsBackup);
        break;
      case "json":
        this.jsonEditor?.set(this.data.defaultJson || null);
        break;
      default:
        break;
    }
  }

  autoFill() {
    switch (this.data.type) {
      case "form":
        this.data.autoFill?.(this.data.form);
        validateForm(this.formInputs?.toArray() || []);
        break;
      default:
        break;
    }
  }

  setPage(page: number) {
    if (this.data.type !== "book") {
      return;
    }
    if (this.data.bookData) {
      this.page = clamp(page, this.minPage, this.maxPage);
      const data = this.data.bookData[this.page];
      this.contentHTML = this.sanitizer.bypassSecurityTrustHtml(data.content);
      if (data.title) {
        this.subTitleHTML = this.sanitizer.bypassSecurityTrustHtml(data.title);
      } else {
        this.subTitleHTML = "";
      }
    } else {
      this.page = 0;
    }
  }

  cast<T extends MessageData["type"]>(type: T, data: MessageData) {
    return data as MessageDataMap[T];
  }

  getButtonLabel(button: ButtonMessageData["buttons"][0]) {
    return typeof button === "string" ? button : button.label;
  }

  onKeyUp(event: KeyboardEvent) {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      if (this.data.type !== "form") {
        this.submit();
      }
    }
  }
}
