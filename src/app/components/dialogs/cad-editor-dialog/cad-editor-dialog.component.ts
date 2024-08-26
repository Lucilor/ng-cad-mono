import {Component, forwardRef, Inject, OnInit, ViewChild} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {OpenCadOptions} from "@app/services/app-status.types";
import {Subscribed} from "@mixins/subscribed.mixin";
import {CadEditorComponent} from "@modules/cad-editor/components/cad-editor/cad-editor.component";
import {AppStatusService} from "@services/app-status.service";
import {getOpenDialogFunc} from "../dialog.common";

@Component({
  selector: "app-cad-editor-dialog",
  templateUrl: "./cad-editor-dialog.component.html",
  styleUrls: ["./cad-editor-dialog.component.scss"],
  standalone: true,
  imports: [MatButtonModule, forwardRef(() => CadEditorComponent)]
})
export class CadEditorDialogComponent extends Subscribed() implements OnInit {
  @ViewChild(forwardRef(() => CadEditorComponent)) cadEditor?: CadEditorComponent;
  isSaved = false;
  canClose = true;
  cadEditorParams: OpenCadOptions = {};

  constructor(
    public dialogRef: MatDialogRef<CadEditorDialogComponent, CadEditorOutput>,
    @Inject(MAT_DIALOG_DATA) public data: CadEditorInput,
    private status: AppStatusService
  ) {
    super();
    if (!this.data) {
      this.data = {};
    }
    this.cadEditorParams = {...this.data, isDialog: true};
  }

  ngOnInit() {
    this.subscribe(this.status.saveCadStart$, () => {
      this.canClose = false;
    });
    this.subscribe(this.status.saveCadEnd$, () => {
      this.canClose = true;
      this.isSaved = true;
    });
  }

  async save() {
    if (this.cadEditor) {
      await this.cadEditor.save();
    }
  }

  async close(save: boolean) {
    if (save) {
      await this.save();
      if (!this.isSaved) {
        return;
      }
    }
    if (this.cadEditor) {
      this.dialogRef.close({isSaved: this.isSaved});
    } else {
      this.dialogRef.close();
    }
  }
}

export const openCadEditorDialog = getOpenDialogFunc<CadEditorDialogComponent, CadEditorInput, CadEditorOutput>(CadEditorDialogComponent, {
  width: "100%",
  height: "100%",
  disableClose: true
});

export type CadEditorInput = Omit<OpenCadOptions, "isDialog">;

export interface CadEditorOutput {
  isSaved: boolean;
}
