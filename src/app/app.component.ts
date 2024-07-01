import {CdkDrag} from "@angular/cdk/drag-drop";
import {Component} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {ActivatedRoute, ResolveFn, Router, RouterOutlet} from "@angular/router";
import {environment} from "@env";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {MessageTestComponent} from "./modules/message/components/message-test/message-test.component";
import {SpinnerComponent} from "./modules/spinner/components/spinner/spinner.component";
import {routesInfo} from "./routing/routes-info";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent, CdkDrag, MatIconModule, MatMenuModule, MessageTestComponent]
})
export class AppComponent {
  title = "ng-cad2";
  loaderText = "";
  isProd = environment.production;
  routesInfo = routesInfo;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private status: AppStatusService,
    private message: MessageService,
    private dialog: MatDialog
  ) {}

  getRouteTitle(routeInfo: (typeof routesInfo)[number]) {
    const {title, path} = routeInfo;
    if (typeof title === "function") {
      return (title as ResolveFn<string>)(this.route.snapshot, this.router.routerState.snapshot);
    }
    return title || path;
  }

  async changeProject() {
    const project = this.status.project;
    const data = {project: "", clear: false};
    const form = await this.message.form<typeof data>([
      {
        type: "string",
        label: "项目缩写",
        model: {data, key: "project"},
        validators: (control) => {
          const value = control.value;
          if (!data.clear) {
            if (!value) {
              return {required: true};
            }
            if (value === project) {
              return {与当前项目相同: true};
            }
          }
          return null;
        }
      },
      {type: "boolean", label: "清除参数", appearance: "switch", model: {data, key: "clear"}}
    ]);
    if (form) {
      this.status.changeProject(form.项目缩写, form.清除参数);
    }
  }

  navigate(routeInfo: (typeof this.routesInfo)[number]) {
    this.dialog.closeAll();
    this.router.navigate([routeInfo.path], {queryParamsHandling: "merge"});
  }
}
