import {A11yModule} from "@angular/cdk/a11y";
import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DEFAULT_OPTIONS, MatDialogModule} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MAT_SNACK_BAR_DEFAULT_OPTIONS, MatSnackBarModule} from "@angular/material/snack-bar";
import hljs from "highlight.js";
import {QuillModule} from "ngx-quill";
import {MessageTestComponent} from "./components/message-test/message-test.component";
import {MessageComponent} from "./components/message/message.component";

(window as any).hljs = hljs;
@NgModule({
  exports: [MessageComponent, MessageTestComponent],
  imports: [
    A11yModule,
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
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
    ReactiveFormsModule,
    MessageComponent,
    MessageTestComponent
  ],
  providers: [
    {provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: {maxWidth: "unset"}},
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {duration: 1000, verticalPosition: "top"}
    }
  ]
})
export class MessageModule {}
