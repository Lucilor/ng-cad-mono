import {TestBed} from "@angular/core/testing";
import {RouterModule} from "@angular/router";
import {MessageModule} from "@modules/message/message.module";
import {AppComponent} from "./app.component";
import {routesInfo} from "./routing/routes-info";

describe("AppComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageModule, AppComponent, RouterModule.forRoot(routesInfo)]
    }).compileComponents();
  });

  it("should create the app", () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'ng-cad2'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual("ng-cad2");
  });

  // it("should render title", () => {
  //     const fixture = TestBed.createComponent(AppComponent);
  //     fixture.detectChanges();
  //     const compiled = fixture.nativeElement;
  //     expect(compiled.querySelector(".content span").textContent).toContain("ng-cad2 app is running!");
  // });
});
