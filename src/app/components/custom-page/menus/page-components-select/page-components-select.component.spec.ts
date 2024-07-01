import {ComponentFixture, TestBed} from "@angular/core/testing";
import {PageComponentsSeletComponent} from "./page-components-select.component";

describe("PageComponentsMenuComponent", () => {
  let component: PageComponentsSeletComponent;
  let fixture: ComponentFixture<PageComponentsSeletComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageComponentsSeletComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PageComponentsSeletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
