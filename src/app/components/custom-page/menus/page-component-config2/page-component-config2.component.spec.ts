import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {PageComponentConfig2Component} from "./page-component-config2.component";

describe("PageComponentConfig2Component", () => {
  let component: PageComponentConfig2Component;
  let fixture: ComponentFixture<PageComponentConfig2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageComponentConfig2Component],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PageComponentConfig2Component);
    component = fixture.componentInstance;
    const ref = fixture.componentRef;
    ref.setInput("workSpaceEl", document.createElement("div"));
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
