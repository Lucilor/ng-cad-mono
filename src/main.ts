import {enableProdMode, importProvidersFrom, Injectable} from "@angular/core";
import {MAT_DATE_LOCALE} from "@angular/material/core";
import {MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions} from "@angular/material/form-field";
import {MatPaginatorIntl} from "@angular/material/paginator";
import {bootstrapApplication} from "@angular/platform-browser";
import {provideAnimations} from "@angular/platform-browser/animations";
import {environment} from "@env";
import {CadEditorModule} from "@modules/cad-editor/cad-editor.module";
import {HttpModule} from "@modules/http/http.module";
import {MessageModule} from "@modules/message/message.module";
import {SpinnerModule} from "@modules/spinner/spinner.module";
import {RECAPTCHA_LOADER_OPTIONS, RECAPTCHA_V3_SITE_KEY, RecaptchaLoaderOptions, RecaptchaV3Module} from "ng-recaptcha";
import {QuillModule} from "ngx-quill";
import {AppComponent} from "./app/app.component";
import {AppRoutingModule} from "./app/routing/app-routing.module";

@Injectable()
class MyMatPaginatorIntl extends MatPaginatorIntl {
  itemsPerPageLabel = "每页条数";
  previousPageLabel = "上一页";
  nextPageLabel = "下一页";
  firstPageLabel = "首页";
  lastPageLabel = "尾页";

  getRangeLabel = (page: number, pageSize: number, length: number) => {
    const totalPage = Math.ceil(length / pageSize);
    return `第${page + 1}/${totalPage}页，共${length}条`;
  };
}
const matFormFieldOptions: MatFormFieldDefaultOptions = {
  appearance: "fill",
  floatLabel: "always"
};

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      AppRoutingModule,
      CadEditorModule,
      HttpModule,
      MessageModule,
      QuillModule.forRoot({
        format: "json",
        modules: {
          syntax: true,
          toolbar: [
            ["bold", "italic", "underline", "strike"],
            ["blockquote", "code-block"],
            [{header: 1}, {header: 2}],
            [{list: "ordered"}, {list: "bullet"}],
            [{script: "sub"}, {script: "super"}],
            [{indent: "-1"}, {indent: "+1"}],
            [{direction: "rtl"}],
            [{size: ["small", false, "large", "huge"]}],
            [{header: [1, 2, 3, 4, 5, 6, false]}],
            [{color: []}, {background: []}],
            // [{font: []}],
            [{align: []}],
            ["clean"],
            ["link", "image", "video"] // link and image, video
          ]
        }
      }),
      RecaptchaV3Module,
      SpinnerModule
    ),
    {provide: MatPaginatorIntl, useClass: MyMatPaginatorIntl},
    {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: matFormFieldOptions},
    {provide: MAT_DATE_LOCALE, useValue: "zh-CN"},
    {provide: RECAPTCHA_V3_SITE_KEY, useValue: "6Leil-0ZAAAAACnzpTud2QN5OuhJ10UyJJrUq70m"},
    {
      provide: RECAPTCHA_LOADER_OPTIONS,
      useValue: {
        onBeforeLoad: () => {
          return {
            url: new URL("https://www.recaptcha.net/recaptcha/api.js")
          };
        }
      } as RecaptchaLoaderOptions
    },
    provideAnimations()
  ]
}).catch((err) => console.error(err));
