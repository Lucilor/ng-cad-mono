import {CdkDrag} from "@angular/cdk/drag-drop";
import {Component} from "@angular/core";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {ActivatedRoute, ResolveFn, Router, RouterLink, RouterOutlet} from "@angular/router";
import {environment} from "@env";
import {MessageTestComponent} from "./modules/message/components/message-test/message-test.component";
import {SpinnerComponent} from "./modules/spinner/components/spinner/spinner.component";
import {routesInfo} from "./routing/routes-info";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent, CdkDrag, MatIconModule, MatMenuModule, RouterLink, MessageTestComponent]
})
export class AppComponent {
  title = "ng-cad2";
  loaderText = "";
  isProd = environment.production;
  routesInfo = routesInfo;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  getRouteTitle(routeInfo: (typeof routesInfo)[number]) {
    const {title, path} = routeInfo;
    if (typeof title === "function") {
      return (title as ResolveFn<string>)(this.route.snapshot, this.router.routerState.snapshot);
    }
    return title || path;
  }

  setProject() {
    const {url, queryParams} = this.route.snapshot;
    const url2 = this.router.createUrlTree(url, {queryParams: {...queryParams, project: null}});
    location.href = url2.toString();
  }
}
