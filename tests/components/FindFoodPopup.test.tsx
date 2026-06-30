import { render, screen, fireEvent } from "@testing-library/react-native";
import { FindFoodPopup } from "../../src/components/FindFoodPopup";

const noop = () => {};

test("Show me opens the list, X dismisses", async () => {
  const onShowList = jest.fn();
  const onClose = jest.fn();
  await render(<FindFoodPopup count={12} onShowList={onShowList} onClose={onClose} />);
  expect(screen.getByText("12 spots near you. The pins are your picks.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Show me"));
  expect(onShowList).toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Dismiss"));
  expect(onClose).toHaveBeenCalled();
});

test("singular wording for one spot", async () => {
  await render(<FindFoodPopup count={1} onShowList={noop} onClose={noop} />);
  expect(screen.getByText("1 spot near you. The pins are your picks.")).toBeTruthy();
});

test("does not parrot a fixed number when Google returns a full page", async () => {
  await render(<FindFoodPopup count={20} onShowList={noop} onClose={noop} />);
  expect(screen.getByText("Lots of spots near you. The pins are your picks.")).toBeTruthy();
});
