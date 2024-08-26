import {Component} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {local} from "@app/app.common";
import {openChangelogDialog} from "@components/dialogs/changelog/changelog.component";
import {Subscribed} from "@mixins/subscribed.mixin";
import {SpinnerModule} from "@modules/spinner/spinner.module";
import {AppStatusService} from "@services/app-status.service";

@Component({
  selector: "app-about",
  standalone: true,
  imports: [MatButtonModule, SpinnerModule],
  templateUrl: "./about.component.html",
  styleUrl: "./about.component.scss"
})
export class AboutComponent extends Subscribed() {
  isNew = false;

  constructor(
    private status: AppStatusService,
    private dialog: MatDialog
  ) {
    super();
    this.subscribe(this.status.updateTimeStamp$, (changelogTimeStamp) => {
      this.isNew = changelogTimeStamp > Number(local.load("changelogTimeStamp") || 0);
    });
  }

  showChangelog() {
    openChangelogDialog(this.dialog, {hasBackdrop: true});
    local.save("changelogTimeStamp", new Date().getTime());
    this.isNew = false;
  }
}
