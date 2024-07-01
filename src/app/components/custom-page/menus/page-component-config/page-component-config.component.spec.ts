import {ComponentFixture, TestBed} from "@angular/core/testing";
import {PageComponentConfigComponent} from "./page-component-config.component";

describe("PageComponentConfigComponent", () => {
  let component: PageComponentConfigComponent;
  let fixture: ComponentFixture<PageComponentConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageComponentConfigComponent],
      providers: []
    }).compileComponents();

    fixture = TestBed.createComponent(PageComponentConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
