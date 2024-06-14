import {ComponentFixture, TestBed} from "@angular/core/testing";
import {PageComponentText} from "../../models/page-components/page-component-text";
import {PageComponentsDiaplayComponent} from "./page-components-diaplay.component";

describe("PageComponentsDiaplayComponent", () => {
  let component: PageComponentsDiaplayComponent;
  let fixture: ComponentFixture<PageComponentsDiaplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageComponentsDiaplayComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PageComponentsDiaplayComponent);
    component = fixture.componentInstance;
    const ref = fixture.componentRef;
    const components = [new PageComponentText("1"), new PageComponentText("2")];
    ref.setInput("components", components);
    ref.setInput("activeComponent", components[0]);
    ref.setInput("activeComponent2", components[0]);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
