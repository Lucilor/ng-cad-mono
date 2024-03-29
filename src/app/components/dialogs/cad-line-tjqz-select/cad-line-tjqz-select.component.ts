import {Component, Inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {joinOptions, splitOptions} from "@app/app.common";
import {CadData} from "@lucilor/cad-viewer";
import {MessageService} from "@modules/message/services/message.service";
import {cloneDeep} from "lodash";
import {openCadOptionsDialog} from "../cad-options/cad-options.component";
import {getOpenDialogFunc} from "../dialog.common";

export type CadLineTjqzSelectData = {value?: {key: string; value: string}; options: {key: string; value: string}[]};

@Component({
  selector: "app-cad-line-tjqz-select",
  templateUrl: "./cad-line-tjqz-select.component.html",
  styleUrls: ["./cad-line-tjqz-select.component.scss"],
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatDialogActions]
})
export class CadLineTjqzSelectComponent {
  constructor(
    public dialogRef: MatDialogRef<CadLineTjqzSelectComponent, CadLineTjqzSelectData>,
    @Inject(MAT_DIALOG_DATA) public data: CadLineTjqzSelectData,
    private dialog: MatDialog,
    private message: MessageService
  ) {
    this.data = cloneDeep(this.data);
  }

  async onListClick(item: CadLineTjqzSelectData["options"][0]) {
    const name = item.key;
    const checkedItems = splitOptions(item.value);
    const result = await openCadOptionsDialog(this.dialog, {data: {data: new CadData(), name, checkedItems, multi: true}});
    if (result) {
      item.value = joinOptions(result.options, "*");
    }
  }

  submit() {
    for (const item of this.data.options) {
      if (!item.value) {
        this.message.alert("请不要留空！");
        return;
      }
    }
    this.dialogRef.close(this.data);
  }

  close() {
    this.dialogRef.close();
  }
}

type T = CadLineTjqzSelectComponent;
export const openCadLineTjqzSelectDialog = getOpenDialogFunc<T, CadLineTjqzSelectData, CadLineTjqzSelectData>(CadLineTjqzSelectComponent);
