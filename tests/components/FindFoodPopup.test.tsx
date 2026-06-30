import { render, screen, fireEvent } from "@testing-library/react-native";
import { FindFoodPopup } from "../../src/components/FindFoodPopup";

test("shows a count summary and Show me dismisses", async () => {
  const onClose = jest.fn();
  await render(<FindFoodPopup count={12} onClose={onClose} />);
  expect(screen.getByText("12 spots near you. The pins are your picks.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Show me"));
  expect(onClose).toHaveBeenCalled();
});

test("singular wording for one spot", async () => {
  await render(<FindFoodPopup count={1} onClose={() => {}} />);
  expect(screen.getByText("1 spot near you. The pins are your picks.")).toBeTruthy();
});

test("does not parrot a fixed number when Google returns a full page", async () => {
  await render(<FindFoodPopup count={20} onClose={() => {}} />);
  expect(screen.getByText("Lots of spots near you. The pins are your picks.")).toBeTruthy();
});
