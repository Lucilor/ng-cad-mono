import {KeyValuePipe} from "@angular/common";
import {Component, forwardRef, Inject} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogRef} from "@angular/material/dialog";
import {BatchUploadChecker} from "@app/views/import/import.utils";
import {CadData} from "@lucilor/cad-viewer";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {InputComponent} from "../../../modules/input/components/input.component";
import {getOpenDialogFunc} from "../dialog.common";

export interface BbzhmkgzComponentData {
  value: string;
  vars: CadData["info"]["vars"];
}

@Component({
  selector: "app-bbzhmkgz",
  templateUrl: "./bbzhmkgz.component.html",
  styleUrls: ["./bbzhmkgz.component.scss"],
  standalone: true,
  imports: [forwardRef(() => InputComponent), KeyValuePipe, MatDialogActions, MatButtonModule]
})
export class BbzhmkgzComponent {
  inputInfo: InputInfo = {type: "string", textarea: {}, label: ""};
  batchUploadChecker = new BatchUploadChecker();

  constructor(
    public dialogRef: MatDialogRef<BbzhmkgzComponent, BbzhmkgzComponentData>,
    @Inject(MAT_DIALOG_DATA) public data: BbzhmkgzComponentData,
    private message: MessageService
  ) {
    if (!data.value) {
      data.value = "";
    }
    if (!data.vars) {
      data.vars = {};
    }
    this.inputInfo.model = {data, key: "value"};
  }

  submit() {
    const {errors} = this.batchUploadChecker.parseBaobianzhengmianRules("修改包边正面宽规则:\n" + this.data.value, this.data.vars);
    if (errors.length > 0) {
      this.message.alert({content: errors.join("<br>"), title: "包边正面宽规则有误"});
      return;
    }
    this.dialogRef.close(this.data);
  }

  cancel() {
    this.dialogRef.close();
  }
}

export const openBbzhmkgzDialog = getOpenDialogFunc<BbzhmkgzComponent, BbzhmkgzComponentData, BbzhmkgzComponentData>(BbzhmkgzComponent);
